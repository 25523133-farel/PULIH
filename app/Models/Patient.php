<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Patient extends Model
{
    protected $fillable = [
        'code',
        'user_id',
        'doctor_id',
        'nama_lengkap',
        'tanggal_lahir',
        'nomor_rm',
        'nik',
        'kode_pembeda_opsional',
        'kontak',
        'jenis_kepesertaan',
        'keputusan_dokter',
        'status_akun',
        'rekomendasi_tanggal',
        'nomor_rujukan',
        'reminder_sent_at',
        'reminder_by',
        'reminder_count',
    ];

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function examinations(): HasMany
    {
        return $this->hasMany(Examination::class)->orderByDesc('tanggal_periksa')->orderByDesc('id');
    }

    public function latestExamination(): HasOne
    {
        return $this->hasOne(Examination::class)->orderByDesc('is_latest')->orderByDesc('tanggal_periksa')->orderByDesc('id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function activeBooking(): HasOne
    {
        return $this->hasOne(Booking::class)->where('status', 'confirmed')->latestOfMany();
    }

    public function controlSchedules(): HasMany
    {
        return $this->hasMany(ControlSchedule::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(NotificationLog::class);
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }
}
