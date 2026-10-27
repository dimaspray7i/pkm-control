<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Super Admin',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('admin123'),
            'role' => 'admin',
            'phone' => '081234567890',
            'is_active' => true,
        ]);

        User::create([
            'name' => 'Budi Pimpinan',
            'email' => 'pimpinan@pkm.co.id',
            'password' => Hash::make('pimpinan123'),
            'role' => 'pimpinan',
            'phone' => '081234567891',
            'is_active' => true,
        ]);

        User::create([
            'name' => 'Siti Project Manager',
            'email' => 'pm@pkm.co.id',
            'password' => Hash::make('pm123'),
            'role' => 'project_manager',
            'phone' => '081234567892',
            'is_active' => true,
        ]);

        User::create([
            'name' => 'Andi Member',
            'email' => 'member@pkm.co.id',
            'password' => Hash::make('member123'),
            'role' => 'member',
            'phone' => '081234567893',
            'is_active' => true,
        ]);

        $this->command->info('✅ 4 user default berhasil dibuat!');
        $this->command->info(' admin@pkm.co.id / admin123');
        $this->command->info(' pimpinan@pkm.co.id / pimpinan123');
        $this->command->info('📧 pm@pkm.co.id / pm123');
        $this->command->info('📧 member@pkm.co.id / member123');
    }
}