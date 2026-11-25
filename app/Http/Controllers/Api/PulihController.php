<?php

namespace App\Http\Controllers\Api;

use App\Models\AppointmentSlot;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\ClinicalDecision;
use App\Models\ControlSchedule;
use App\Models\Doctor;
use App\Models\Examination;
use App\Models\NotificationLog;
use App\Models\Patient;
use App\Models\QueueNumber;
use App\Models\Referral;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PulihController
{
    /**
     * Format seluruh state database ke struktur JSON yang digunakan oleh Frontend PULIH.
     */
    public function state(): JsonResponse
    {
        return response()->json($this->buildPayload());
    }

    /**
     * FITUR 7 & FR-09 / BR-01 / BR-12: Login Ringkas Lansia (Nama + Tanggal Lahir).
     */
    public function patientLogin(Request $request): JsonResponse
    {
        $nameInput = trim((string) $request->input('name', ''));
        $dobInput = trim((string) $request->input('dob', ''));

        if ($nameInput === '') {
            return response()->json([
                'ok' => false,
                'message' => 'Mohon masukkan Nama Lengkap pasien.',
            ], 422);
        }

        $patients = Patient::with(['doctor', 'examinations'])->get();
        $found = $patients->first(function (Patient $p) use ($nameInput, $dobInput) {
            $nameMatch = str_contains(mb_strtolower($p->nama_lengkap), mb_strtolower($nameInput));
            $dobMatch = $dobInput === '' || Carbon::parse($p->tanggal_lahir)->toDateString() === $dobInput;
            return $nameMatch && $dobMatch;
        });

        if (! $found) {
            return response()->json([
                'ok' => false,
                'code' => 'not_found',
                'message' => 'Data pasien tidak ditemukan di database. Pastikan pasien telah diregistrasi secara resmi oleh Admin Poli PTM.',
            ], 404);
        }

        if ($found->status_akun === 'referred') {
            return response()->json([
                'ok' => false,
                'code' => 'referred',
                'message' => "Akses booking ditolak (BR-01): {$found->nama_lengkap} berada pada jalur Surat Rujukan BPJS (" . ($found->nomor_rujukan ?: 'RS Rujukan') . "). Akun kontrol tidak diaktifkan; silakan hubungi loket rujukan.",
            ], 403);
        }

        if ($found->status_akun !== 'active') {
            return response()->json([
                'ok' => false,
                'code' => 'pending',
                'message' => "Akun {$found->nama_lengkap} sudah terdata di database namun belum diaktifkan. Silakan buka Panel Admin → menu \"Aktivasi Akun\" untuk mengaktifkan akun agar siap langsung pakai.",
            ], 403);
        }

        AuditLog::create([
            'actor_role' => 'patient',
            'actor_name' => $found->nama_lengkap,
            'action' => 'patient_login',
            'entity' => 'patients',
            'entity_id' => $found->code,
            'details' => ['nomor_rm' => $found->nomor_rm],
        ]);

        return response()->json([
            'ok' => true,
            'patientId' => $found->code,
            'message' => "Selamat datang, {$found->nama_lengkap}. Akun Anda aktif dan siap digunakan.",
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * FITUR 3 & 4 (FR-04, FR-05, BR-02, BR-03, BR-04):
     * Booking Jadwal Kontrol secara atomik di database & terbitkan Nomor Antrean.
     */
    public function storeBooking(Request $request): JsonResponse
    {
        $patientCode = (string) $request->input('patientId', '');
        $dateIso = (string) $request->input('date', '');
        $slotCode = (string) $request->input('slotId', '');

        $patient = Patient::where('code', $patientCode)->first();
        if (! $patient) {
            return response()->json(['ok' => false, 'message' => 'Pasien tidak ditemukan.'], 404);
        }

        // BR-01: Hanya pasien dengan status_akun = active yang boleh booking
        if ($patient->status_akun !== 'active') {
            return response()->json([
                'ok' => false,
                'message' => 'Akses ditolak (BR-01): Hanya akun pasien berstatus aktif jalur kontrol yang dapat melakukan booking.',
            ], 403);
        }

        $slot = AppointmentSlot::where('code', $slotCode)->first();
        if (! $slot) {
            return response()->json(['ok' => false, 'message' => 'Slot jam tidak valid.'], 422);
        }

        $allSlots = AppointmentSlot::orderBy('id')->get()->values();
        $slotIdx = $allSlots->search(fn ($s) => $s->id === $slot->id);
        if ($slotIdx === false) {
            $slotIdx = 0;
        }

        return DB::transaction(function () use ($patient, $slot, $slotIdx, $dateIso) {
            $dateObj = Carbon::parse($dateIso);
            $baseLeft = $this->baseRemaining($dateObj, $slotIdx);

            // Hitung booking aktif pada tanggal & slot tersebut (selain pasien ini yang sedang re-booking)
            $activeBookingsInSlot = Booking::where('tanggal_kontrol', $dateObj->toDateString())
                ->where('slot_id', $slot->id)
                ->where('status', 'confirmed')
                ->where('patient_id', '!=', $patient->id)
                ->whereHas('attendance', function ($q) {
                    $q->where('status', '!=', 'absent');
                })
                ->lockForUpdate()
                ->count();

            $remaining = max(0, $baseLeft - $activeBookingsInSlot);
            if ($remaining <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Maaf, slot jam ini baru saja penuh untuk mencegah penumpukan pasien. Silakan pilih jam lain.',
                ], 409);
            }

            $capacity = (int) $slot->kapasitas;
            $orderInSlot = $capacity - $remaining + 1;
            $queueStr = str_pad((string) ($slotIdx * $capacity + $orderInSlot), 2, '0', STR_PAD_LEFT);

            // BR-03: Hapus/batalkan booking aktif lama milik pasien ini agar tidak ada booking ganda
            Booking::where('patient_id', $patient->id)->delete();

            $controlSchedule = ControlSchedule::where('patient_id', $patient->id)->latest('id')->first();
            if ($controlSchedule) {
                $controlSchedule->update(['status' => 'booked']);
            }

            $booking = Booking::create([
                'code' => 'b-' . now()->format('YmdHis') . '-' . random_int(100, 999),
                'patient_id' => $patient->id,
                'slot_id' => $slot->id,
                'control_schedule_id' => $controlSchedule?->id,
                'tanggal_kontrol' => $dateObj->toDateString(),
                'nomor_antrean' => $queueStr,
                'urutan_dalam_slot' => $orderInSlot,
                'status' => 'confirmed',
                'waktu_booking' => now(),
            ]);

            $turnMin = $slot->start_minute + max(0, ($orderInSlot - 1) * 6);
            $arriveMin = max($slot->start_minute, $turnMin - 10);
            $estimasi = sprintf(
                '± %02d.%02d WIB (Giliran antrean ± %02d.%02d WIB)',
                intdiv($arriveMin, 60),
                $arriveMin % 60,
                intdiv($turnMin, 60),
                $turnMin % 60
            );

            QueueNumber::create([
                'booking_id' => $booking->id,
                'tanggal' => $dateObj->toDateString(),
                'nomor' => $queueStr,
                'urutan_slot' => $orderInSlot,
                'estimasi_datang' => $estimasi,
            ]);

            Attendance::create([
                'booking_id' => $booking->id,
                'status' => 'pending',
            ]);

            AuditLog::create([
                'actor_role' => 'patient',
                'actor_name' => $patient->nama_lengkap,
                'action' => 'create_booking',
                'entity' => 'bookings',
                'entity_id' => $booking->code,
                'details' => [
                    'tanggal_kontrol' => $dateObj->toDateString(),
                    'slot' => $slot->code,
                    'nomor_antrean' => $queueStr,
                ],
            ]);

            return response()->json([
                'ok' => true,
                'queue' => $queueStr,
                'message' => "Booking berhasil! Nomor Antrean Anda {$queueStr}.",
                'state' => $this->buildPayload(),
            ]);
        });
    }

    /**
     * FR-15: Pembatalan Booking oleh Pasien & pengembalian kuota slot.
     */
    public function cancelBooking(string $patientCode): JsonResponse
    {
        $patient = Patient::where('code', $patientCode)->first();
        if (! $patient) {
            return response()->json(['ok' => false, 'message' => 'Pasien tidak ditemukan.'], 404);
        }

        DB::transaction(function () use ($patient) {
            Booking::where('patient_id', $patient->id)->delete();

            ControlSchedule::where('patient_id', $patient->id)
                ->latest('id')
                ->first()
                ?->update(['status' => 'needs_reminder']);

            AuditLog::create([
                'actor_role' => 'patient',
                'actor_name' => $patient->nama_lengkap,
                'action' => 'cancel_booking',
                'entity' => 'bookings',
                'entity_id' => $patient->code,
            ]);
        });

        return response()->json([
            'ok' => true,
            'message' => 'Jadwal kontrol dibatalkan. Kuota slot telah dikembalikan.',
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * FITUR 6 & 7 (FR-01, FR-02, FR-12, FR-13, FR-19):
     * Registrasi Pasien oleh Admin ke Database Resmi & Opsi Auto-Aktivasi Akun.
     */
    public function registerPatient(Request $request): JsonResponse
    {
        $name = trim((string) $request->input('name', ''));
        $dob = trim((string) $request->input('dob', ''));
        $rm = trim((string) $request->input('rm', ''));
        $phone = trim((string) $request->input('phone', ''));
        $bpjs = (string) $request->input('bpjs', 'BPJS');
        $decision = (string) $request->input('decision', 'kontrol');
        $adviceDate = $request->input('adviceDate') ?: Carbon::today()->addDays(3)->toDateString();
        $vital = trim((string) $request->input('vital', '')) ?: 'Pemeriksaan awal PTM tercatat.';
        $autoActivate = (bool) $request->input('autoActivate', true);

        if ($name === '' || $dob === '' || $rm === '' || $phone === '') {
            return response()->json([
                'ok' => false,
                'message' => 'Mohon lengkapi Nama Lengkap, Tanggal Lahir, Nomor Rekam Medis/NIK, dan Nomor Telepon pasien.',
            ], 422);
        }

        // Validasi duplikasi Nomor RM atau kombinasi Nama + Tanggal Lahir
        $duplicate = Patient::whereRaw('LOWER(nomor_rm) = ?', [mb_strtolower($rm)])
            ->orWhere(function ($q) use ($name, $dob) {
                $q->whereRaw('LOWER(nama_lengkap) = ?', [mb_strtolower($name)])
                    ->whereDate('tanggal_lahir', $dob);
            })
            ->exists();

        if ($duplicate) {
            return response()->json([
                'ok' => false,
                'message' => 'Data pasien dengan Nomor Rekam Medis atau kombinasi Nama + Tanggal Lahir tersebut sudah terdaftar di database.',
            ], 409);
        }

        $accountStatus = $decision === 'rujuk'
            ? 'referred'
            : ($autoActivate ? 'active' : 'pending');

        $patient = DB::transaction(function () use (
            $name, $dob, $rm, $phone, $bpjs, $decision, $adviceDate, $vital, $accountStatus
        ) {
            $doctor = Doctor::first();
            $todayIso = Carbon::today()->toDateString();
            $code = 'p-' . now()->format('His') . random_int(10, 99);
            $referralNo = $decision === 'rujuk' ? 'SRJ/BPJS/2026/XI/' . random_int(100, 999) : null;

            $newPatient = Patient::create([
                'code' => $code,
                'doctor_id' => $doctor?->id,
                'nama_lengkap' => $name,
                'tanggal_lahir' => $dob,
                'nomor_rm' => $rm,
                'kontak' => $phone,
                'jenis_kepesertaan' => in_array($bpjs, ['BPJS', 'Non-BPJS'], true) ? $bpjs : 'BPJS',
                'keputusan_dokter' => in_array($decision, ['kontrol', 'rujuk', 'selesai'], true) ? $decision : 'kontrol',
                'status_akun' => $accountStatus,
                'rekomendasi_tanggal' => $decision === 'kontrol' ? $adviceDate : null,
                'nomor_rujukan' => $referralNo,
                'reminder_sent_at' => $accountStatus === 'active' ? $todayIso : null,
                'reminder_by' => $accountStatus === 'active' ? 'Petugas Admin Poli PTM' : null,
                'reminder_count' => $accountStatus === 'active' ? 1 : 0,
            ]);

            $exam = Examination::create([
                'patient_id' => $newPatient->id,
                'doctor_id' => $doctor?->id,
                'tanggal_periksa' => $todayIso,
                'poli' => 'Poli PTM',
                'nomor_antrean' => '01',
                'status_kehadiran' => 'Hadir Pemeriksaan Awal',
                'tekanan_darah' => '138/86 mmHg',
                'gula_darah' => '130 mg/dL',
                'kolesterol' => '192 mg/dL',
                'berat_tinggi' => '62 kg / 160 cm',
                'status_klinis' => $decision === 'kontrol' ? 'Perlu Kontrol Rutin' : 'Dirujuk Lanjutan',
                'catatan_dokter' => $vital,
                'is_latest' => true,
            ]);

            ClinicalDecision::create([
                'examination_id' => $exam->id,
                'patient_id' => $newPatient->id,
                'doctor_id' => $doctor?->id,
                'tindak_lanjut' => $decision,
                'rekomendasi_tanggal' => $decision === 'kontrol' ? $adviceDate : null,
                'alasan' => $vital,
            ]);

            if ($decision === 'kontrol') {
                $cs = ControlSchedule::create([
                    'patient_id' => $newPatient->id,
                    'doctor_id' => $doctor?->id,
                    'rekomendasi_tanggal' => $adviceDate,
                    'status' => $accountStatus === 'active' ? 'reminded' : 'needs_reminder',
                    'catatan' => $vital,
                ]);

                if ($accountStatus === 'active') {
                    NotificationLog::create([
                        'patient_id' => $newPatient->id,
                        'control_schedule_id' => $cs->id,
                        'jenis' => 'pengingat_daftar',
                        'sent_by_admin' => 'Petugas Admin Poli PTM',
                        'kanal' => 'whatsapp_web',
                        'status' => 'sent',
                        'pesan' => "Pengingat daftar kontrol untuk {$newPatient->nama_lengkap} pada {$adviceDate}.",
                    ]);
                }
            } elseif ($decision === 'rujuk' && $referralNo) {
                Referral::create([
                    'patient_id' => $newPatient->id,
                    'examination_id' => $exam->id,
                    'doctor_id' => $doctor?->id,
                    'nomor_surat' => $referralNo,
                    'alasan_medis' => $vital,
                ]);
            }

            AuditLog::create([
                'actor_role' => 'admin',
                'actor_name' => 'Petugas Admin Poli PTM',
                'action' => 'register_patient',
                'entity' => 'patients',
                'entity_id' => $newPatient->code,
                'details' => [
                    'nomor_rm' => $newPatient->nomor_rm,
                    'status_akun' => $accountStatus,
                    'keputusan_dokter' => $decision,
                ],
            ]);

            return $newPatient;
        });

        return response()->json([
            'ok' => true,
            'patientId' => $patient->code,
            'message' => $accountStatus === 'active'
                ? "Pasien {$patient->nama_lengkap} berhasil diregistrasi ke database & akun langsung AKTIF siap pakai!"
                : "Pasien {$patient->nama_lengkap} berhasil diregistrasi ke database dengan status: {$accountStatus}.",
            'state' => $this->buildPayload(),
        ], 201);
    }

    /**
     * FITUR 7 (FR-02): Aktivasi Akun Pasien oleh Admin agar siap langsung pakai.
     */
    public function activatePatient(string $patientCode): JsonResponse
    {
        $patient = Patient::where('code', $patientCode)->first();
        if (! $patient) {
            return response()->json(['ok' => false, 'message' => 'Pasien tidak ditemukan.'], 404);
        }

        if ($patient->keputusan_dokter === 'rujuk') {
            return response()->json([
                'ok' => false,
                'message' => 'Sesuai BR-01 & FR-02, pasien jalur rujukan tidak dapat diaktifkan akun kontrolnya.',
            ], 422);
        }

        DB::transaction(function () use ($patient) {
            $patient->update([
                'status_akun' => 'active',
                'reminder_sent_at' => Carbon::today()->toDateString(),
                'reminder_by' => 'Admin Poli PTM',
                'reminder_count' => ($patient->reminder_count ?? 0) + 1,
            ]);

            $cs = ControlSchedule::where('patient_id', $patient->id)->latest('id')->first();
            $cs?->update(['status' => 'reminded']);

            NotificationLog::create([
                'patient_id' => $patient->id,
                'control_schedule_id' => $cs?->id,
                'jenis' => 'pengingat_daftar',
                'sent_by_admin' => 'Admin Poli PTM',
                'kanal' => 'whatsapp_web',
                'status' => 'sent',
                'pesan' => "Akun {$patient->nama_lengkap} telah diaktifkan dan pengingat daftar kontrol dikirim.",
            ]);

            AuditLog::create([
                'actor_role' => 'admin',
                'actor_name' => 'Admin Poli PTM',
                'action' => 'activate_account',
                'entity' => 'patients',
                'entity_id' => $patient->code,
            ]);
        });

        return response()->json([
            'ok' => true,
            'message' => "Akun {$patient->nama_lengkap} berhasil DIAKTIFKAN dan siap langsung pakai!",
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * FITUR 1 (FR-06, FR-20, BR-13): Kirim Notifikasi Reminder Kontrol (Pengingat Daftar / H-3).
     */
    public function sendReminder(string $patientCode): JsonResponse
    {
        $patient = Patient::with('activeBooking')->where('code', $patientCode)->first();
        if (! $patient) {
            return response()->json(['ok' => false, 'message' => 'Pasien tidak ditemukan.'], 404);
        }

        DB::transaction(function () use ($patient) {
            $patient->update([
                'reminder_sent_at' => Carbon::today()->toDateString(),
                'reminder_by' => 'Petugas Admin Poli PTM',
                'reminder_count' => ($patient->reminder_count ?? 0) + 1,
            ]);

            $activeBooking = $patient->activeBooking;
            $jenis = $activeBooking ? 'pengingat_h3' : 'pengingat_daftar';
            $cs = ControlSchedule::where('patient_id', $patient->id)->latest('id')->first();

            NotificationLog::create([
                'patient_id' => $patient->id,
                'control_schedule_id' => $cs?->id,
                'booking_id' => $activeBooking?->id,
                'jenis' => $jenis,
                'sent_by_admin' => 'Petugas Admin Poli PTM',
                'kanal' => 'whatsapp_web',
                'status' => 'sent',
                'pesan' => $jenis === 'pengingat_h3'
                    ? "Pengingat Jadwal H-3 untuk Antrean {$activeBooking->nomor_antrean} pada {$activeBooking->tanggal_kontrol}."
                    : "Pengingat Daftar Kontrol untuk {$patient->nama_lengkap}.",
            ]);

            AuditLog::create([
                'actor_role' => 'admin',
                'actor_name' => 'Petugas Admin Poli PTM',
                'action' => 'send_reminder',
                'entity' => 'notifications',
                'entity_id' => $patient->code,
                'details' => ['jenis' => $jenis, 'count' => $patient->reminder_count],
            ]);
        });

        return response()->json([
            'ok' => true,
            'message' => "Notifikasi Reminder Kontrol berhasil dikirim kepada {$patient->nama_lengkap} ({$patient->kontak}).",
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * FITUR 8 (FR-07, BR-08): Verifikasi Kehadiran Pasien & Evaluasi Slot Antrean.
     */
    public function verifyAttendance(Request $request, string $bookingCode): JsonResponse
    {
        $status = (string) $request->input('status', 'present');
        if (! in_array($status, ['present', 'absent', 'pending'], true)) {
            return response()->json(['ok' => false, 'message' => 'Status kehadiran tidak valid.'], 422);
        }

        $booking = Booking::with(['patient', 'attendance'])->where('code', $bookingCode)->first();
        if (! $booking) {
            return response()->json(['ok' => false, 'message' => 'Data booking tidak ditemukan.'], 404);
        }

        $timeLabel = now()->setTimezone('Asia/Jakarta')->format('H.i') . ' WIB';

        DB::transaction(function () use ($booking, $status, $timeLabel) {
            Attendance::updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'status' => $status,
                    'verified_by' => 'Admin Poli PTM',
                    'verified_at_label' => $timeLabel,
                    'verified_at' => now(),
                ]
            );

            $bookingStatus = match ($status) {
                'present' => 'confirmed',
                'absent' => 'no_show',
                default => 'confirmed',
            };
            $booking->update(['status' => $bookingStatus]);

            AuditLog::create([
                'actor_role' => 'admin',
                'actor_name' => 'Admin Poli PTM',
                'action' => 'verify_attendance',
                'entity' => 'attendances',
                'entity_id' => $booking->code,
                'details' => ['status' => $status, 'verified_at' => $timeLabel],
            ]);
        });

        return response()->json([
            'ok' => true,
            'status' => $status,
            'verifiedAt' => $timeLabel,
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * Reset data ke kondisi awal PRD v1.4.
     */
    public function reset(DatabaseSeeder $seeder): JsonResponse
    {
        $seeder->run();

        return response()->json([
            'ok' => true,
            'message' => 'Database berhasil di-reset ke data awal PRD v1.4.',
            'state' => $this->buildPayload(),
        ]);
    }

    /**
     * Formula kuota dasar slot yang konsisten dengan frontend.
     */
    private function baseRemaining(Carbon $date, int $slotIdx): int
    {
        $monthZeroIndexed = $date->month - 1;
        $n = $date->day * 7 + $monthZeroIndexed * 3 + $slotIdx * 5;
        $left = ($n % 6) + 1;
        if ($slotIdx === 2 && $date->dayOfWeek === Carbon::TUESDAY) {
            $left = 0;
        }
        return $left;
    }

    /**
     * Bangun representasi state lengkap dari tabel-tabel database.
     */
    private function buildPayload(): array
    {
        $patients = Patient::with(['doctor', 'examinations'])
            ->orderBy('id')
            ->get();

        $bookings = Booking::with(['patient', 'slot', 'attendance'])
            ->orderByDesc('id')
            ->get();

        $patientsOut = [];
        $historyOut = [];

        foreach ($patients as $p) {
            $doctorName = $p->doctor?->name ?? 'dr. Ahmad Fauzi';
            $exams = $p->examinations;
            $latest = $exams->firstWhere('is_latest', true) ?? $exams->first();

            $patientsOut[] = [
                'id' => $p->code,
                'name' => $p->nama_lengkap,
                'dob' => Carbon::parse($p->tanggal_lahir)->toDateString(),
                'rm' => $p->nomor_rm,
                'phone' => $p->kontak,
                'bpjs' => $p->jenis_kepesertaan,
                'doctor' => $doctorName,
                'decision' => $p->keputusan_dokter,
                'accountStatus' => $p->status_akun,
                'referralNo' => $p->nomor_rujukan,
                'adviceDate' => $p->rekomendasi_tanggal
                    ? Carbon::parse($p->rekomendasi_tanggal)->toDateString()
                    : null,
                'latestExam' => $latest ? [
                    'date' => Carbon::parse($latest->tanggal_periksa)->toDateString(),
                    'td' => $latest->tekanan_darah,
                    'gdp' => $latest->gula_darah,
                    'chol' => $latest->kolesterol,
                    'bbTb' => $latest->berat_tinggi,
                    'note' => $latest->catatan_dokter,
                ] : null,
                'reminderSentAt' => $p->reminder_sent_at
                    ? Carbon::parse($p->reminder_sent_at)->toDateString()
                    : null,
                'reminderBy' => $p->reminder_by,
                'reminderCount' => (int) $p->reminder_count,
            ];

            $historyOut[$p->code] = $exams->map(fn (Examination $ex) => [
                'date' => Carbon::parse($ex->tanggal_periksa)->toDateString(),
                'doctor' => $doctorName,
                'poli' => $ex->poli,
                'queue' => $ex->nomor_antrean,
                'attendance' => $ex->status_kehadiran,
                'td' => $ex->tekanan_darah,
                'gdp' => $ex->gula_darah,
                'chol' => $ex->kolesterol,
                'status' => $ex->status_klinis,
                'note' => $ex->catatan_dokter,
            ])->values()->all();
        }

        $bookingsOut = $bookings->map(function (Booking $b) {
            return [
                'id' => $b->code,
                'patientId' => $b->patient?->code,
                'date' => Carbon::parse($b->tanggal_kontrol)->toDateString(),
                'slotId' => $b->slot?->code ?? 's1',
                'start' => $b->slot?->jam_mulai ?? '08.00',
                'end' => $b->slot?->jam_selesai ?? '09.00',
                'part' => $b->slot?->sesi ?? 'Pagi',
                'queue' => $b->nomor_antrean,
                'orderInSlot' => (int) $b->urutan_dalam_slot,
                'attendance' => $b->attendance?->status ?? 'pending',
                'verifiedAt' => $b->attendance?->verified_at_label,
                'verifiedBy' => $b->attendance?->verified_by,
            ];
        })->values()->all();

        return [
            'ok' => true,
            'driver' => DB::connection()->getDriverName(),
            'patients' => $patientsOut,
            'bookings' => $bookingsOut,
            'history' => $historyOut,
        ];
    }
}
