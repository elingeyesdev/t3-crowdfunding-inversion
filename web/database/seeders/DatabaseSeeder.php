<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['investor' => 'Inversor', 'entrepreneur' => 'Emprendedor', 'admin' => 'Administrador', 'super_admin' => 'Superadministrador'] as $name => $label) {
            Role::firstOrCreate(['name' => $name], ['display_name' => $label]);
        }
        foreach (['Tecnología', 'Educación', 'Salud', 'Medio ambiente', 'Arte y cultura', 'Comunidad', 'Emprendimiento', 'Deportes'] as $order => $name) {
            Category::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name, 'display_name' => $name, 'sort_order' => $order]);
        }
    }
}
