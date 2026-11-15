<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class LegacyKycFiles
{
    private const TABLES = ['entrepreneur_profiles', 'investor_profiles'];

    public static function privateUrl(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || ! preg_match('#^/?(?:uploads/kyc|storage/(?:uploads/)?kyc|api/v1/private-files/kyc)/([a-zA-Z0-9._-]+)$#', $path, $matches) || str_contains($matches[1], '..')) {
            return null;
        }

        return '/api/v1/private-files/kyc/'.$matches[1];
    }

    public static function normalizeDocuments(?array $documents): ?array
    {
        if ($documents === null) {
            return null;
        }
        array_walk_recursive($documents, function (&$value): void {
            if (is_string($value)) {
                $value = self::privateUrl($value) ?? $value;
            }
        });

        return $documents;
    }

    public static function maySign(string $url): bool
    {
        $user = Auth::guard('sanctum')->user();
        if (! $user || ! $user->is_active) {
            return false;
        }
        if ($user->roles()->whereIn('name', ['admin', 'super_admin'])->exists()) {
            return true;
        }
        foreach ([$user->entrepreneur?->verification_documents, $user->investor?->verification_documents] as $documents) {
            $values = $documents ?? [];
            $found = false;
            array_walk_recursive($values, function ($value) use ($url, &$found): void {
                if (is_string($value) && self::privateUrl($value) === $url) {
                    $found = true;
                }
            });
            if ($found) {
                return true;
            }
        }

        return false;
    }

    /**
     * Copy and verify everything before updating references or deleting sources.
     * Run with application writes stopped; files and SQL cannot share a transaction.
     */
    public function migrate(bool $dryRun): array
    {
        $disk = Storage::disk('local');
        if (is_link($disk->path('kyc'))) {
            throw new RuntimeException('El directorio KYC privado no puede ser un enlace simbólico.');
        }
        $files = $this->inventory();
        $profiles = $this->profiles();
        $changed = [];
        foreach ($profiles as $key => $profile) {
            $documents = $profile['documents'];
            $normalized = self::normalizeDocuments($documents);
            if ($normalized !== $documents) {
                $changed[$key] = [...$profile, 'normalized' => $normalized];
            }
            $this->assertReferencesAvailable($normalized, $files);
        }

        // Detect conflicting destination contents during dry-run as well.
        foreach ($files as $name => $file) {
            $target = $disk->path('kyc/'.$name);
            if (file_exists($target) || is_link($target)) {
                $this->assertHash($target, $file['hash']);
            }
        }
        $result = ['files' => count($files), 'profiles' => count($changed), 'removedCopies' => 0, 'backup' => null];
        if ($dryRun || ($files === [] && $changed === [])) {
            return $result;
        }

        foreach ($files as $name => $file) {
            $target = $disk->path('kyc/'.$name);
            if (! file_exists($target)) {
                $source = $file['sources'][0];
                $this->assertHash($source, $file['hash']);
                $stream = fopen($source, 'rb');
                if ($stream === false) {
                    throw new RuntimeException('No se pudo leer un archivo KYC. No se retiraron las copias originales.');
                }
                try {
                    if (! $disk->put('kyc/'.$name, $stream, ['visibility' => 'private'])) {
                        throw new RuntimeException('No se pudo guardar un archivo KYC en almacenamiento privado.');
                    }
                } finally {
                    fclose($stream);
                }
            }
            $this->assertHash($target, $file['hash']);
            if (! $disk->setVisibility('kyc/'.$name, 'private')) {
                throw new RuntimeException('No se pudieron aplicar permisos privados al archivo KYC.');
            }
        }

        // This backup is outside the web root and outside the signed-file route.
        $backup = 'kyc-migrations/'.Str::uuid().'.json';
        $manifest = ['createdAt' => now()->toIso8601String(), 'profiles' => array_values($changed), 'files' => $files];
        if (! $disk->put($backup, json_encode($manifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT), ['visibility' => 'private'])) {
            throw new RuntimeException('No se pudo guardar el respaldo de referencias. No se retiraron las copias originales.');
        }
        $result['backup'] = $backup;

        DB::transaction(function () use ($profiles, $changed): void {
            // Abort if profiles changed while files were being copied.
            if ($this->profiles(true) !== $profiles) {
                throw new RuntimeException('Los perfiles cambiaron durante la migración. Detén las escrituras y repite el comando.');
            }
            foreach ($changed as $profile) {
                DB::table($profile['table'])->where('id', $profile['id'])->update([
                    'verification_documents' => json_encode($profile['normalized'], JSON_THROW_ON_ERROR),
                ]);
            }
        });

        // No recursive deletion: only inventoried, unchanged files with a verified copy.
        foreach ($files as $name => $file) {
            foreach ($file['sources'] as $source) {
                $this->assertHash($disk->path('kyc/'.$name), $file['hash']);
                $this->assertHash($source, $file['hash']);
                if (! unlink($source)) {
                    throw new RuntimeException('No se pudo retirar una copia KYC heredada. La copia privada está verificada; repite el comando antes de habilitar el servidor.');
                }
                $result['removedCopies']++;
            }
        }

        return $result;
    }

    private function inventory(): array
    {
        $files = [];
        $roots = [];
        foreach (config('legacy.kyc_directories', []) as $directory) {
            if (! file_exists($directory) && ! is_link($directory)) {
                continue;
            }
            if (is_link($directory) || ! is_dir($directory) || ($root = realpath($directory)) === false) {
                throw new RuntimeException('Un directorio KYC no es un directorio local válido. No se siguen enlaces simbólicos.');
            }
            if (in_array($root, $roots, true)) {
                continue;
            }
            $roots[] = $root;
            $targetRoot = str_replace('\\', '/', Storage::disk('local')->path('kyc'));
            $sourceRoot = str_replace('\\', '/', $root);
            if (strtolower($targetRoot) === strtolower($sourceRoot) || str_starts_with(strtolower($targetRoot).'/', strtolower($sourceRoot).'/')) {
                throw new RuntimeException('El destino privado no puede estar dentro de un directorio de origen.');
            }
            $entries = scandir($root);
            if ($entries === false) {
                throw new RuntimeException('No se pudo inventariar un directorio KYC.');
            }
            foreach ($entries as $name) {
                if (in_array($name, ['.', '..', '.gitignore', '.htaccess', 'web.config'], true)) {
                    continue;
                }
                $source = $root.DIRECTORY_SEPARATOR.$name;
                if (is_link($source) || ! is_file($source) || ! preg_match('/^[a-zA-Z0-9._-]+$/', $name) || str_contains($name, '..')) {
                    throw new RuntimeException('Un directorio KYC contiene una entrada inesperada. Revisa el inventario antes de migrar.');
                }
                $hash = hash_file('sha256', $source);
                if ($hash === false || (isset($files[$name]) && $files[$name]['hash'] !== $hash)) {
                    throw new RuntimeException('Existen copias KYC con el mismo nombre y contenido diferente. No se sobrescriben archivos.');
                }
                $files[$name]['hash'] = $hash;
                $files[$name]['sources'][] = $source;
            }
        }
        ksort($files);

        return $files;
    }

    private function profiles(bool $lock = false): array
    {
        $profiles = [];
        foreach (self::TABLES as $table) {
            $query = DB::table($table)->orderBy('id');
            if ($lock) {
                $query->lockForUpdate();
            }
            foreach ($query->get(['id', 'verification_documents']) as $row) {
                $documents = is_string($row->verification_documents)
                    ? json_decode($row->verification_documents, true, 512, JSON_THROW_ON_ERROR)
                    : $row->verification_documents;
                if ($documents !== null && ! is_array($documents)) {
                    throw new RuntimeException('Un perfil tiene documentos KYC con formato inválido.');
                }
                $profiles[$table.':'.$row->id] = ['table' => $table, 'id' => $row->id, 'documents' => $documents];
            }
        }

        return $profiles;
    }

    private function assertReferencesAvailable(?array $documents, array $files): void
    {
        $values = $documents ?? [];
        array_walk_recursive($values, function ($value) use ($files): void {
            if (! is_string($value)) {
                return;
            }
            $url = self::privateUrl($value);
            if ($url === null) {
                $path = parse_url($value, PHP_URL_PATH);
                if (is_string($path) && preg_match('#^/?(?:uploads/kyc|storage/(?:uploads/)?kyc|api/v1/private-files/kyc)(?:/|$)#', $path)) {
                    throw new RuntimeException('Un perfil contiene una referencia KYC inválida. Corrígela antes de migrar.');
                }

                return;
            }
            $name = basename($url);
            $target = Storage::disk('local')->path('kyc/'.$name);
            if (! isset($files[$name]) && (! is_file($target) || is_link($target))) {
                throw new RuntimeException('Falta un archivo KYC referenciado por un perfil. Restaura el origen antes de migrar.');
            }
        });
    }

    private function assertHash(string $path, string $expected): void
    {
        if (is_link($path) || ! is_file($path) || hash_file('sha256', $path) !== $expected) {
            throw new RuntimeException('Un archivo KYC falta o no coincide con su copia verificada. No se sobrescriben ni se retiran copias sin verificar.');
        }
    }
}
