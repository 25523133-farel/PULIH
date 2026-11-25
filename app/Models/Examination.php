<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Examination extends Model
{
    protected $fillable = [
        'patient_id',
        'doctor_id',
        'tanggal_periksa',
        'poli',
        'nomor_antrean',
        'status_kehadiran',
        'tekanan_darah',
        'gula_darah',
        'kolesterol',
        'berat_tinggi',
        'status_klinis',
        'catatan_dokter',
        'is_latest',
    ];

    protected $casts = [
        'is_latest' => 'boolean',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function decision(): HasOne
    {
        return $this->hasOne(ClinicalDecision::class);
    }
}
