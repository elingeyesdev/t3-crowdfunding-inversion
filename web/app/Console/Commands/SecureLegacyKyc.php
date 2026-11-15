<?php

namespace App\Console\Commands;

use App\Services\LegacyKycFiles;
use Illuminate\Console\Command;

class SecureLegacyKyc extends Command
{
    protected $signature = 'legacy:secure-kyc {--dry-run : Inventariar y validar sin escribir ni retirar archivos}';

    protected $description = 'Protege KYC heredado: verifica copias privadas, respalda y actualiza referencias, y retira copias públicas y antiguas';

    public function handle(LegacyKycFiles $files): int
    {
        try {
            $result = $files->migrate((bool) $this->option('dry-run'));
            $this->table(['Archivos únicos', 'Perfiles a actualizar', 'Copias retiradas'], [[$result['files'], $result['profiles'], $result['removedCopies']]]);
            if ($result['backup']) {
                $this->info('Respaldo privado de referencias: '.$result['backup']);
            }
            $this->info($this->option('dry-run') ? 'Validación correcta. No se modificaron datos ni archivos.' : 'KYC heredado protegido. Comprueba las reglas del servidor y los accesos antes de reabrir la aplicación.');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }
}
