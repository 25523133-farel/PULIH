<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $fillable = [
        'code',
        'patient_id',
        'slot_id',
        'control_schedule_id',
        'tanggal_kontrol',
        'nomor_antrean',
        'urutan_dalam_slot',
        'status',
        'waktu_booking',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(AppointmentSlot::class, 'slot_id');
    }

    public function queueNumber(): HasOne
    {
        return $this->hasOne(QueueNumber::class);
    }

    public function attendance(): HasOne
    {
        return $this->hasOne(Attendance::class);
    }
}
