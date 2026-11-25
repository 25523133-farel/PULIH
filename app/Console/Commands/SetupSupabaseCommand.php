<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SetupSupabaseCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pulih:supabase-sync {--seed : Jalankan juga file supabase/seed.sql}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Terapkan skema SQL Supabase (supabase/migrations/20261125000000_pulih_schema.sql) dan seed data langsung ke database PostgreSQL Supabase';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $driver = DB::connection()->getDriverName();
        $this->info("Koneksi database aktif: {$driver}");

        if ($driver !== 'pgsql') {
            $this->warn('Koneksi saat ini bukan PostgreSQL (pgsql). Menjalankan php artisan migrate:fresh --seed standar...');
            $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);
            return self::SUCCESS;
        }

        $schemaPath = base_path('supabase/migrations/20261125000000_pulih_schema.sql');
        if (! file_exists($schemaPath)) {
            $this->error("File skema tidak ditemukan: {$schemaPath}");
            return self::FAILURE;
        }

        $this->info('Menerapkan skema DDL Supabase PostgreSQL...');
        DB::unprepared(file_get_contents($schemaPath));
        $this->info('Skema Supabase berhasil diterapkan.');

        if ($this->option('seed')) {
            $seedPath = base_path('supabase/seed.sql');
            if (file_exists($seedPath)) {
                $this->info('Menjalankan supabase/seed.sql...');
                DB::unprepared(file_get_contents($seedPath));
                $this->info('Data awal Supabase berhasil dimasukkan.');
            }
        }

        return self::SUCCESS;
    }
}
