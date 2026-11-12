<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ImportLegacy extends Command
{
    protected $signature = 'legacy:import {file : Exportación JSON de scripts/export-legacy.cjs} {--dry-run : Validar sin escribir}';

    protected $description = 'Importa una exportación del backend anterior en una base Laravel vacía';

    private const TABLES = ['roles', 'users', 'user_roles', 'admin_profiles', 'entrepreneur_profiles', 'investor_profiles', 'categories', 'campaigns', 'campaign_categories', 'reward_tiers', 'investments', 'transactions', 'reward_claims', 'campaign_status_history', 'campaign_reviews', 'campaign_documents', 'campaign_updates', 'comments', 'comment_likes', 'notification_types', 'notifications', 'conversations', 'messages'];

    public function handle(): int
    {
        try {
            $file = $this->argument('file');
            if (! is_file($file)) {
                throw new \RuntimeException('Archivo no encontrado.');
            }
            $export = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if (($export['version'] ?? null) !== 1 || ! is_array($export['tables'] ?? null)) {
                throw new \RuntimeException('Formato de exportación inválido.');
            }
            $tables = $export['tables'];
            if (! isset($tables['users'],$tables['campaigns'])) {
                throw new \RuntimeException('Faltan tablas principales.');
            }
            if (isset($tables['campaign_comments'])) {
                $tables['comments'] = array_values(array_filter($tables['campaign_comments'], fn ($r) => ! ($r['is_deleted'] ?? false)));
            }
            $participants = collect($tables['conversation_participants'] ?? [])->groupBy('conversation_id');
            foreach ($tables['conversations'] ?? [] as $index => $conversation) {
                if (! isset($conversation['user_one_id'])) {
                    $members = $participants->get($conversation['id'], collect())->unique('user_id')->sortBy('user_id')->values();
                    if ($members->count() !== 2) {
                        throw new \RuntimeException('Solo se admiten conversaciones directas de dos participantes.');
                    }
                    foreach (['one' => 0, 'two' => 1] as $label => $position) {
                        $tables['conversations'][$index]['user_'.$label.'_id'] = $members[$position]['user_id'];
                        $tables['conversations'][$index]['user_'.$label.'_read_at'] = $members[$position]['last_read_at'] ?? null;
                    }
                }
            }
            if (isset($tables['messages'])) {
                $tables['messages'] = array_values(array_filter($tables['messages'], fn ($r) => ! ($r['is_deleted'] ?? false)));
            }
            $prepared = [];
            foreach (self::TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    throw new \RuntimeException('Ejecuta las migraciones antes de importar.');
                }
                $columns = array_flip(Schema::getColumnListing($table));
                $rows = [];
                foreach ($tables[$table] ?? [] as $row) {
                    $row = array_intersect_key($row, $columns);
                    if (isset($columns['id']) && empty($row['id'])) {
                        $row['id'] = (string) Str::uuid();
                    }
                    if (isset($columns['created_at'])) {
                        $row['created_at'] ??= now()->toDateTimeString();
                    }
                    if (isset($columns['updated_at'])) {
                        $row['updated_at'] ??= $row['created_at'];
                    }
                    foreach ($row as $key => $value) {
                        if (is_array($value)) {
                            $row[$key] = json_encode($value, JSON_THROW_ON_ERROR);
                        } elseif (is_bool($value)) {
                            $row[$key] = $value ? 1 : 0;
                        } elseif (is_string($value) && preg_match('/(_at|_date)$/', $key) && $value !== '') {
                            $row[$key] = Carbon::parse($value)->timezone(config('app.timezone'))->format('Y-m-d H:i:s');
                        }
                    }
                    $rows[] = $row;
                }
                $prepared[$table] = $rows;
            }
            DB::beginTransaction();
            try {
                foreach (self::TABLES as $table) {
                    if (DB::table($table)->exists()) {
                        throw new \RuntimeException('El destino debe estar vacío, sin seeders ni datos previos.');
                    }
                }
                foreach ($prepared as $table => $rows) {
                    foreach ($rows as $row) {
                        DB::table($table)->insert($row);
                    }
                }
                foreach ($export['tables'] as $table => $rows) {
                    foreach ($rows as $index => $row) {
                        DB::table('legacy_records')->insert(['source_table' => $table, 'source_key' => (string) ($row['id'] ?? $index), 'payload' => json_encode($row, JSON_THROW_ON_ERROR)]);
                    }
                }
                foreach (DB::table('campaigns')->get(['id', 'category_id']) as $campaign) {
                    DB::table('campaign_categories')->insertOrIgnore(['campaign_id' => $campaign->id, 'category_id' => $campaign->category_id]);
                }
                foreach (DB::table('notification_types')->get() as $type) {
                    DB::table('notifications')->where('type_id', $type->id)->update(['type_code' => $type->code]);
                }
                if ($this->option('dry-run')) {
                    DB::rollBack();
                } else {
                    DB::commit();
                }
            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }
            $this->table(['Tabla', 'Filas'], collect($prepared)->map(fn ($rows, $table) => [$table, count($rows)])->values()->all());
            $this->info($this->option('dry-run') ? 'Validación correcta. No se guardaron datos.' : 'Importación completada. Se conservaron los hashes de contraseña y los UUID.');
            $this->warn('Conserva el JSON original: incluye tablas y campos históricos fuera del modelo activo. Copia también los archivos de backend/uploads.');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e instanceof QueryException ? 'La importación no es compatible con las restricciones del destino. Se revirtió completamente; revisa relaciones y campos obligatorios en la exportación.' : $e->getMessage());

            return self::FAILURE;
        }
    }
}
