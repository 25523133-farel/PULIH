<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    protected $table = 'notifications';

    protected $fillable = [
        'patient_id',
        'control_schedule_id',
        'booking_id',
        'jenis',
        'sent_by_admin',
        'kanal',
        'status',
        'pesan',
        'sent_at',
        'provider_reference',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
