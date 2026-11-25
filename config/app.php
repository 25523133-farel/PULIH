<?php

return [
    'name' => env('APP_NAME', 'PULIH'),
    'env' => env('APP_ENV', 'local'),
    'debug' => (bool) env('APP_DEBUG', true),
    'url' => env('APP_URL', 'http://127.0.0.1:8000'),
    'timezone' => env('APP_TIMEZONE', 'Asia/Jakarta'),
    'locale' => env('APP_LOCALE', 'id'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'id'),
    'faker_locale' => env('APP_FAKER_LOCALE', 'id_ID'),
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY', 'base64:8xP1nL4mK9vQ2wR5tY8uI0oP3aS6dF9gH2jK5lZ8xC1='),
    'previous_keys' => [],
    'maintenance' => [
        'driver' => 'file',
    ],
];
