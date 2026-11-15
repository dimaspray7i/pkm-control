<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'email' => 'admin@pkm.co.id',
                'name' => 'Super Admin',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'phone' => '081234567890',
                'is_active' => true,
            ],
            [
                'email' => 'pimpinan@pkm.co.id',
                'name' => 'Budi Pimpinan',
                'password' => Hash::make('pimpinan123'),
                'role' => 'pimpinan',
                'phone' => '081234567891',
                'is_active' => true,
            ],
            [
                'email' => 'pm@pkm.co.id',
                'name' => 'Siti Project Manager',
                'password' => Hash::make('pm123'),
                'role' => 'project_manager',
                'phone' => '081234567892',
                'is_active' => true,
            ],
            [
                'email' => 'pm1@pkm.co.id',
                'name' => 'Ahmad Project Manager',
                'password' => Hash::make('pm123'),
                'role' => 'project_manager',
                'phone' => '081234567894',
                'is_active' => true,
            ],
            [
                'email' => 'pm2@pkm.co.id',
                'name' => 'Farhan Project Manager',
                'password' => Hash::make('pm123'),
                'role' => 'project_manager',
                'phone' => '081234567895',
                'is_active' => true,
            ],
            [
                'email' => 'member@pkm.co.id',
                'name' => 'Andi Member',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567893',
                'is_active' => true,
            ],
            [
                'email' => 'budi@pkm.co.id',
                'name' => 'Budi Santoso',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567896',
                'is_active' => true,
            ],
            [
                'email' => 'siti@pkm.co.id',
                'name' => 'Siti Rahma',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567897',
                'is_active' => true,
            ],
            [
                'email' => 'andi@pkm.co.id',
                'name' => 'Andi Pratama',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567898',
                'is_active' => true,
            ],
            [
                'email' => 'dewi@pkm.co.id',
                'name' => 'Dewi Lestari',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567899',
                'is_active' => true,
            ],
            [
                'email' => 'rizky@pkm.co.id',
                'name' => 'Rizky Maulana',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'phone' => '081234567888',
                'is_active' => true,
            ],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }

        $this->command->info('✅ User default berhasil dibuat/disinkronkan dengan aman!');
    }
}