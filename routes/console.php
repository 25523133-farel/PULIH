<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('pulih:info', function () {
    $this->comment('PULIH — Sistem Manajemen Kontrol Pasien PTM (Laravel + Supabase PostgreSQL)');
})->purpose('Tampilkan informasi aplikasi PULIH');
