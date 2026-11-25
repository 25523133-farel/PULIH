<?php

use App\Http\Controllers\Api\PulihController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PULIH REST API Routes (8 Fitur Inti PRD v1.4)
|--------------------------------------------------------------------------
*/

// Sinkronisasi state lengkap (Pasien, Booking, Antrean, Riwayat, Hasil Pemeriksaan)
Route::get('/state', [PulihController::class, 'state']);

// Fitur 7 & FR-09: Login Ringkas Lansia (Nama + Tanggal Lahir)
Route::post('/auth/patient-login', [PulihController::class, 'patientLogin']);

// Fitur 2, 3, 4 (FR-03, FR-04, FR-05, FR-15): Booking Jadwal Kontrol & Nomor Antrean
Route::post('/bookings', [PulihController::class, 'storeBooking']);
Route::delete('/bookings/{patientCode}', [PulihController::class, 'cancelBooking']);

// Fitur 6 (FR-01): Registrasi Pasien ke Database Resmi
Route::post('/admin/patients', [PulihController::class, 'registerPatient']);

// Fitur 7 (FR-02): Aktivasi Akun Pasien Siap Pakai
Route::patch('/admin/patients/{patientCode}/activate', [PulihController::class, 'activatePatient']);

// Fitur 1 (FR-06, FR-20): Kirim Reminder Kontrol (Pengingat Daftar & Pengingat H-3)
Route::post('/admin/patients/{patientCode}/reminders', [PulihController::class, 'sendReminder']);

// Fitur 8 (FR-07): Verifikasi Kehadiran Pasien & Evaluasi Slot Antrean
Route::patch('/admin/bookings/{bookingCode}/attendance', [PulihController::class, 'verifyAttendance']);

// Reset Demo Data
Route::post('/reset', [PulihController::class, 'reset']);
