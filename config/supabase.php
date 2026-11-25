<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Konfigurasi Integrasi Supabase PULIH
    |--------------------------------------------------------------------------
    */
    'url' => env('SUPABASE_URL', ''),
    'anon_key' => env('SUPABASE_ANON_KEY', ''),
    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY', ''),
    'db_host' => env('DB_HOST', ''),
    'db_port' => env('DB_PORT', 5432),
];
