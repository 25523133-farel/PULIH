<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QueueNumber extends Model
{
    protected $fillable = [
        'booking_id',
        'tanggal',
        'nomor',
        'urutan_slot',
        'estimasi_datang',
        'cakupan_antrean',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
