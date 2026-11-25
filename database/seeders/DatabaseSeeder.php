<?php

namespace Database\Seeders;

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
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with PRD v1.4 initial state.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $today = Carbon::today();

            // Hitung 6 hari layanan ke depan (Senin-Sabtu, Minggu libur)
            $serviceDays = [];
            $cursor = $today->copy()->addDay();
            while (count($serviceDays) < 6) {
                if ($cursor->dayOfWeek !== Carbon::SUNDAY) {
                    $serviceDays[] = $cursor->copy();
                }
                $cursor->addDay();
            }

            $day1Iso = $serviceDays[0]->toDateString();
            $recDay = $today->copy()->addDays(3);
            if ($recDay->dayOfWeek === Carbon::SUNDAY) {
                $recDay->addDay();
            }
            $recIso = collect($serviceDays)->contains(fn ($d) => $d->toDateString() === $recDay->toDateString())
                ? $recDay->toDateString()
                : ($serviceDays[2] ?? $serviceDays[0])->toDateString();

            $sentDateIso = $today->copy()->subDay()->toDateString();

            // Bersihkan tabel untuk re-seed yang idempoten
            AuditLog::query()->delete();
            Referral::query()->delete();
            NotificationLog::query()->delete();
            Attendance::query()->delete();
            QueueNumber::query()->delete();
            Booking::query()->delete();
            ControlSchedule::query()->delete();
            ClinicalDecision::query()->delete();
            Examination::query()->delete();
            Patient::query()->delete();
            AppointmentSlot::query()->delete();
            Doctor::query()->delete();
            User::query()->delete();

            // 1. Users & Doctor
            $docUser = User::create([
                'name' => 'dr. Ahmad Fauzi',
                'email' => 'ahmad.fauzi@pulih.id',
                'role' => 'doctor',
                'status' => 'active',
            ]);

            User::create([
                'name' => 'Admin Rina (Petugas Poli PTM)',
                'email' => 'admin.rina@pulih.id',
                'role' => 'admin',
                'status' => 'active',
            ]);

            $doctor = Doctor::create([
                'user_id' => $docUser->id,
                'code' => 'DOC-PTM-01',
                'name' => 'dr. Ahmad Fauzi',
                'specialization' => 'Spesialis Penyakit Dalam / Poli PTM',
                'polyclinic' => 'Poli PTM, Lantai 1',
                'is_active' => true,
            ]);

            // 2. Appointment Slots (5 Sesi Harian, Kapasitas 10 Kursi / Sesi)
            $slotsData = [
                ['code' => 's1', 'sesi' => 'Pagi',  'jam_mulai' => '08.00', 'jam_selesai' => '09.00', 'start_minute' => 480],
                ['code' => 's2', 'sesi' => 'Pagi',  'jam_mulai' => '09.00', 'jam_selesai' => '10.00', 'start_minute' => 540],
                ['code' => 's3', 'sesi' => 'Pagi',  'jam_mulai' => '10.00', 'jam_selesai' => '11.00', 'start_minute' => 600],
                ['code' => 's4', 'sesi' => 'Siang', 'jam_mulai' => '13.00', 'jam_selesai' => '14.00', 'start_minute' => 780],
                ['code' => 's5', 'sesi' => 'Siang', 'jam_mulai' => '14.00', 'jam_selesai' => '15.00', 'start_minute' => 840],
            ];

            $slots = [];
            foreach ($slotsData as $s) {
                $slots[$s['code']] = AppointmentSlot::create([
                    'code' => $s['code'],
                    'doctor_id' => $doctor->id,
                    'sesi' => $s['sesi'],
                    'jam_mulai' => $s['jam_mulai'],
                    'jam_selesai' => $s['jam_selesai'],
                    'start_minute' => $s['start_minute'],
                    'kapasitas' => 10,
                    'is_active' => true,
                ]);
            }

            // 3. Pasien 1: Ibu Siti Aminah (Akun Aktif, Belum Booking)
            $p1 = Patient::create([
                'code' => 'p1',
                'doctor_id' => $doctor->id,
                'nama_lengkap' => 'Ibu Siti Aminah',
                'tanggal_lahir' => '1958-05-12',
                'nomor_rm' => 'RM-2026-0104',
                'kontak' => '0812-3400-1122',
                'jenis_kepesertaan' => 'BPJS',
                'keputusan_dokter' => 'kontrol',
                'status_akun' => 'active',
                'rekomendasi_tanggal' => $recIso,
                'reminder_sent_at' => $sentDateIso,
                'reminder_by' => 'Admin Rina (Petugas Poli PTM)',
                'reminder_count' => 1,
            ]);

            $ex1Latest = Examination::create([
                'patient_id' => $p1->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(25)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '05',
                'status_kehadiran' => 'Hadir Terverifikasi',
                'tekanan_darah' => '130/82 mmHg',
                'gula_darah' => '124 mg/dL',
                'kolesterol' => '188 mg/dL',
                'berat_tinggi' => '58 kg / 155 cm',
                'status_klinis' => 'Kondisi Membaik',
                'catatan_dokter' => 'Tekanan darah dan gula darah puasa membaik dibanding bulan lalu. Lanjutkan obat rutin Amlodipine 5mg dan Metformin, serta kontrol kembali sesuai jadwal rekomendasi.',
                'is_latest' => true,
            ]);

            Examination::create([
                'patient_id' => $p1->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(55)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '08',
                'status_kehadiran' => 'Hadir Terverifikasi',
                'tekanan_darah' => '145/90 mmHg',
                'gula_darah' => '148 mg/dL',
                'kolesterol' => '204 mg/dL',
                'berat_tinggi' => '59 kg / 155 cm',
                'status_klinis' => 'Evaluasi Dosis',
                'catatan_dokter' => 'Penyesuaian dosis obat hipertensi dan edukasi pola makan rendah garam serta gula.',
                'is_latest' => false,
            ]);

            Examination::create([
                'patient_id' => $p1->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(85)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '03',
                'status_kehadiran' => 'Hadir Terverifikasi',
                'tekanan_darah' => '155/96 mmHg',
                'gula_darah' => '162 mg/dL',
                'kolesterol' => '215 mg/dL',
                'berat_tinggi' => '60 kg / 155 cm',
                'status_klinis' => 'Pemeriksaan Awal PTM',
                'catatan_dokter' => 'Pemeriksaan awal dan registrasi akun kontrol pasien PTM.',
                'is_latest' => false,
            ]);

            ClinicalDecision::create([
                'examination_id' => $ex1Latest->id,
                'patient_id' => $p1->id,
                'doctor_id' => $doctor->id,
                'tindak_lanjut' => 'kontrol',
                'rekomendasi_tanggal' => $recIso,
                'alasan' => 'Kontrol rutin bulanan hipertensi & DM terkendali.',
            ]);

            $cs1 = ControlSchedule::create([
                'patient_id' => $p1->id,
                'doctor_id' => $doctor->id,
                'rekomendasi_tanggal' => $recIso,
                'status' => 'reminded',
                'catatan' => 'Pengingat daftar telah dikirim oleh Admin Rina.',
            ]);

            NotificationLog::create([
                'patient_id' => $p1->id,
                'control_schedule_id' => $cs1->id,
                'jenis' => 'pengingat_daftar',
                'sent_by_admin' => 'Admin Rina (Petugas Poli PTM)',
                'kanal' => 'whatsapp_web',
                'status' => 'sent',
                'pesan' => "Pengingat kontrol kembali pada {$recIso} atas arahan dr. Ahmad Fauzi.",
            ]);

            // 4. Pasien 2: Ibu Ratna Dewi (Akun Aktif, Sudah Booking Antrean 04 & Terverifikasi Hadir)
            $p2 = Patient::create([
                'code' => 'p2',
                'doctor_id' => $doctor->id,
                'nama_lengkap' => 'Ibu Ratna Dewi',
                'tanggal_lahir' => '1961-11-03',
                'nomor_rm' => 'RM-2026-0109',
                'kontak' => '0813-8899-2211',
                'jenis_kepesertaan' => 'BPJS',
                'keputusan_dokter' => 'kontrol',
                'status_akun' => 'active',
                'rekomendasi_tanggal' => $day1Iso,
                'reminder_sent_at' => $sentDateIso,
                'reminder_by' => 'Admin Rina (Petugas Poli PTM)',
                'reminder_count' => 2,
            ]);

            $ex2 = Examination::create([
                'patient_id' => $p2->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(28)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '03',
                'status_kehadiran' => 'Hadir Terverifikasi',
                'tekanan_darah' => '136/85 mmHg',
                'gula_darah' => '118 mg/dL',
                'kolesterol' => '194 mg/dL',
                'berat_tinggi' => '61 kg / 156 cm',
                'status_klinis' => 'Terkendali Stabil',
                'catatan_dokter' => 'Kondisi hipertensi terkontrol stabil. Dijadwalkan kontrol rutin bulanan untuk evaluasi dosis.',
                'is_latest' => true,
            ]);

            ClinicalDecision::create([
                'examination_id' => $ex2->id,
                'patient_id' => $p2->id,
                'doctor_id' => $doctor->id,
                'tindak_lanjut' => 'kontrol',
                'rekomendasi_tanggal' => $day1Iso,
                'alasan' => 'Evaluasi dosis rutin bulanan.',
            ]);

            $cs2 = ControlSchedule::create([
                'patient_id' => $p2->id,
                'doctor_id' => $doctor->id,
                'rekomendasi_tanggal' => $day1Iso,
                'status' => 'booked',
                'catatan' => 'Sudah booking jadwal kontrol.',
            ]);

            $b1 = Booking::create([
                'code' => 'b-init-1',
                'patient_id' => $p2->id,
                'slot_id' => $slots['s1']->id,
                'control_schedule_id' => $cs2->id,
                'tanggal_kontrol' => $day1Iso,
                'nomor_antrean' => '04',
                'urutan_dalam_slot' => 4,
                'status' => 'confirmed',
            ]);

            QueueNumber::create([
                'booking_id' => $b1->id,
                'tanggal' => $day1Iso,
                'nomor' => '04',
                'urutan_slot' => 4,
                'estimasi_datang' => '± 08.08 WIB (Giliran antrean ± 08.18 WIB)',
            ]);

            Attendance::create([
                'booking_id' => $b1->id,
                'status' => 'present',
                'verified_by' => 'Admin Rina',
                'verified_at_label' => '08.12 WIB',
                'verified_at' => now(),
            ]);

            // 5. Pasien 3: Bapak Haryono (Non-BPJS, Keputusan Kontrol, Menunggu Aktivasi Admin)
            $p3 = Patient::create([
                'code' => 'p3',
                'doctor_id' => $doctor->id,
                'nama_lengkap' => 'Bapak Haryono',
                'tanggal_lahir' => '1955-08-20',
                'nomor_rm' => 'RM-2026-0114',
                'kontak' => '0812-7766-5544',
                'jenis_kepesertaan' => 'Non-BPJS',
                'keputusan_dokter' => 'kontrol',
                'status_akun' => 'pending',
                'rekomendasi_tanggal' => $recIso,
                'reminder_sent_at' => null,
                'reminder_by' => null,
                'reminder_count' => 0,
            ]);

            $ex3 = Examination::create([
                'patient_id' => $p3->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(14)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '11',
                'status_kehadiran' => 'Hadir Pemeriksaan Awal',
                'tekanan_darah' => '142/88 mmHg',
                'gula_darah' => '135 mg/dL',
                'kolesterol' => '202 mg/dL',
                'berat_tinggi' => '66 kg / 164 cm',
                'status_klinis' => 'Direkomendasikan Kontrol',
                'catatan_dokter' => 'Pasien baru selesai pemeriksaan awal PTM. Dokter memutuskan perlu kontrol lanjutan. Menunggu aktivasi akun oleh admin.',
                'is_latest' => true,
            ]);

            ClinicalDecision::create([
                'examination_id' => $ex3->id,
                'patient_id' => $p3->id,
                'doctor_id' => $doctor->id,
                'tindak_lanjut' => 'kontrol',
                'rekomendasi_tanggal' => $recIso,
                'alasan' => 'Pasien masuk program kontrol rutin Poli PTM.',
            ]);

            ControlSchedule::create([
                'patient_id' => $p3->id,
                'doctor_id' => $doctor->id,
                'rekomendasi_tanggal' => $recIso,
                'status' => 'needs_reminder',
                'catatan' => 'Menunggu aktivasi akun pasien oleh admin.',
            ]);

            // 6. Pasien 4: Bapak Slamet Raharjo (BPJS, Keputusan Rujuk -> Tidak Dibuatkan Akun Kontrol)
            $p4 = Patient::create([
                'code' => 'p4',
                'doctor_id' => $doctor->id,
                'nama_lengkap' => 'Bapak Slamet Raharjo',
                'tanggal_lahir' => '1952-02-14',
                'nomor_rm' => 'RM-2026-0118',
                'kontak' => '0815-4433-9900',
                'jenis_kepesertaan' => 'BPJS',
                'keputusan_dokter' => 'rujuk',
                'status_akun' => 'referred',
                'rekomendasi_tanggal' => null,
                'nomor_rujukan' => 'SRJ/BPJS/2026/XI/042',
                'reminder_sent_at' => null,
                'reminder_by' => null,
                'reminder_count' => 0,
            ]);

            $ex4 = Examination::create([
                'patient_id' => $p4->id,
                'doctor_id' => $doctor->id,
                'tanggal_periksa' => $today->copy()->subDays(3)->toDateString(),
                'poli' => 'Poli PTM',
                'nomor_antrean' => '02',
                'status_kehadiran' => 'Hadir Pemeriksaan Awal',
                'tekanan_darah' => '175/105 mmHg',
                'gula_darah' => '240 mg/dL',
                'kolesterol' => '245 mg/dL',
                'berat_tinggi' => '68 kg / 162 cm',
                'status_klinis' => 'Dirujuk Lanjutan',
                'catatan_dokter' => 'Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS. Surat rujukan telah diterbitkan dokter.',
                'is_latest' => true,
            ]);

            ClinicalDecision::create([
                'examination_id' => $ex4->id,
                'patient_id' => $p4->id,
                'doctor_id' => $doctor->id,
                'tindak_lanjut' => 'rujuk',
                'rekomendasi_tanggal' => null,
                'alasan' => 'Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS.',
            ]);

            Referral::create([
                'patient_id' => $p4->id,
                'examination_id' => $ex4->id,
                'doctor_id' => $doctor->id,
                'nomor_surat' => 'SRJ/BPJS/2026/XI/042',
                'faskes_tujuan' => 'RSUD Rujukan Spesialis Penyakit Dalam',
                'status' => 'issued',
                'alasan_medis' => 'Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS.',
            ]);
        });
    }
}
