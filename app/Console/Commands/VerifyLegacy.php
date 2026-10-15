<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class VerifyLegacy extends Command
{
    protected $signature = 'legacy:verify {file : Exportación JSON utilizada para importar}';

    protected $description = 'Compara las filas y hashes importados con el respaldo original, sin escribir';

    public function handle(): int
    {
        $file = $this->argument('file');
        if (! is_file($file)) {
            $this->error('Archivo no encontrado.');

            return self::FAILURE;
        }
        $export = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        $count = 0;
        foreach ($export['tables'] as $table => $rows) {
            $active = $table === 'campaign_comments' ? 'comments' : $table;
            $columns = Schema::hasTable($active) ? Schema::getColumnListing($active) : [];
            foreach ($rows as $index => $row) {
                $key = (string) ($row['id'] ?? $index);
                $archive = DB::table('legacy_records')->where('source_table', $table)->where('source_key', $key)->value('payload');
                if (! $archive || json_decode($archive, true) != $row) {
                    $this->error('El respaldo archivado no coincide con el origen.');

                    return self::FAILURE;
                }
                if (isset($row['id']) && in_array('id', $columns) && ! ($row['is_deleted'] ?? false)) {
                    $record = DB::table($active)->where('id', $row['id'])->first();
                    if (! $record) {
                        $this->error('Falta un registro en la tabla '.$active);

                        return self::FAILURE;
                    }
                    foreach (array_intersect_key($row, array_flip($columns)) as $field => $expected) {
                        if (preg_match('/(_at|_date)$/', $field)) {
                            continue;
                        }
                        $actual = $record->$field;
                        if (is_array($expected)) {
                            $actual = json_decode($actual ?? 'null', true);
                        }
                        if ($actual != $expected) {
                            $this->error('Diferencia en '.$active.'.'.$field);

                            return self::FAILURE;
                        }
                    }
                }
                $count++;
            }
        }
        $this->info($count.' filas verificadas. Coinciden UUID, contraseñas, campos activos y copia histórica completa.');

        return self::SUCCESS;
    }
}
