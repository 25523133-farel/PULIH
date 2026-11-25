<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicalDecision extends Model
{
    protected $fillable = [
        'examination_id',
        'patient_id',
        'doctor_id',
        'tindak_lanjut',
        'rekomendasi_tanggal',
        'alasan',
    ];

    public function examination(): BelongsTo
    {
        return $this->belongsTo(Examination::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
