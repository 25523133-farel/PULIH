<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_role',
        'actor_name',
        'action',
        'entity',
        'entity_id',
        'details',
        'occurred_at',
    ];

    protected $casts = [
        'details' => 'array',
    ];
}
