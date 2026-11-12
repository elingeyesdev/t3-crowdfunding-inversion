<?php

namespace App\Console\Commands;

use App\Models\AdminProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin {email} {--super : Crear superadministrador}';

    protected $description = 'Crea un administrador con contraseña ingresada de forma privada';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $password = $this->secret('Contraseña (mínimo 8 caracteres, mayúscula y número)');
        $validator = Validator::make(['email' => $email, 'password' => $password], ['email' => 'required|email|unique:users,email', 'password' => ['required', 'min:8', 'regex:/^(?=.*[A-Z])(?=.*\d).+$/']]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

return self::FAILURE;
        }
        DB::transaction(function () use ($email, $password) {
            $role = $this->option('super') ? 'super_admin' : 'admin';
            $user = User::create(['email' => $email, 'password_hash' => Hash::make($password)]);
            $user->assignRole($role);
            AdminProfile::create(['user_id' => $user->id, 'first_name' => 'Admin', 'access_level' => $role]);
        });
        $this->info('Administrador creado.');

        return self::SUCCESS;
    }
}
