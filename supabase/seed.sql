-- =========================================================================
-- PULIH — Data Awal (Seed) Supabase PostgreSQL
-- Selaras dengan PRD v1.4 & Data Demo Interaktif 8 Fitur Inti
-- =========================================================================

BEGIN;

-- 1. Users (Admin & Dokter)
INSERT INTO public.users (id, name, email, role, status)
VALUES
    (1, 'dr. Ahmad Fauzi', 'ahmad.fauzi@pulih.id', 'doctor', 'active'),
    (2, 'Admin Rina (Petugas Poli PTM)', 'admin.rina@pulih.id', 'admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Doctors
INSERT INTO public.doctors (id, user_id, code, name, specialization, polyclinic, is_active)
VALUES
    (1, 1, 'DOC-PTM-01', 'dr. Ahmad Fauzi', 'Spesialis Penyakit Dalam / Poli PTM', 'Poli PTM, Lantai 1', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Appointment Slots (5 Sesi Praktik Harian, Kapasitas 10 Kursi / Sesi = 50 Kursi/Hari)
INSERT INTO public.appointment_slots (id, code, doctor_id, sesi, jam_mulai, jam_selesai, start_minute, kapasitas, is_active)
VALUES
    (1, 's1', 1, 'Pagi',  '08.00', '09.00', 480, 10, TRUE),
    (2, 's2', 1, 'Pagi',  '09.00', '10.00', 540, 10, TRUE),
    (3, 's3', 1, 'Pagi',  '10.00', '11.00', 600, 10, TRUE),
    (4, 's4', 1, 'Siang', '13.00', '14.00', 780, 10, TRUE),
    (5, 's5', 1, 'Siang', '14.00', '15.00', 840, 10, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 4. Patients (4 Pasien Contoh yang Mewakili Seluruh Alur PRD)
INSERT INTO public.patients (
    id, code, doctor_id, nama_lengkap, tanggal_lahir, nomor_rm, kontak,
    jenis_kepesertaan, keputusan_dokter, status_akun, rekomendasi_tanggal,
    nomor_rujukan, reminder_sent_at, reminder_by, reminder_count
)
VALUES
    (
        1, 'p1', 1, 'Ibu Siti Aminah', '1958-05-12', 'RM-2026-0104', '0812-3400-1122',
        'BPJS', 'kontrol', 'active', CURRENT_DATE + INTERVAL '3 days',
        NULL, CURRENT_DATE - INTERVAL '1 day', 'Admin Rina (Petugas Poli PTM)', 1
    ),
    (
        2, 'p2', 1, 'Ibu Ratna Dewi', '1961-11-03', 'RM-2026-0109', '0813-8899-2211',
        'BPJS', 'kontrol', 'active', CURRENT_DATE + INTERVAL '1 day',
        NULL, CURRENT_DATE - INTERVAL '1 day', 'Admin Rina (Petugas Poli PTM)', 2
    ),
    (
        3, 'p3', 1, 'Bapak Haryono', '1955-08-20', 'RM-2026-0114', '0812-7766-5544',
        'Non-BPJS', 'kontrol', 'pending', CURRENT_DATE + INTERVAL '3 days',
        NULL, NULL, NULL, 0
    ),
    (
        4, 'p4', 1, 'Bapak Slamet Raharjo', '1952-02-14', 'RM-2026-0118', '0815-4433-9900',
        'BPJS', 'rujuk', 'referred', NULL,
        'SRJ/BPJS/2026/XI/042', NULL, NULL, 0
    )
ON CONFLICT (code) DO NOTHING;

-- 5. Examinations (Riwayat Pemeriksaan & Hasil Medis Terakhir)
INSERT INTO public.examinations (
    id, patient_id, doctor_id, tanggal_periksa, poli, nomor_antrean,
    status_kehadiran, tekanan_darah, gula_darah, kolesterol, berat_tinggi,
    status_klinis, catatan_dokter, is_latest
)
VALUES
    (
        1, 1, 1, CURRENT_DATE - INTERVAL '25 days', 'Poli PTM', '05',
        'Hadir Terverifikasi', '130/82 mmHg', '124 mg/dL', '188 mg/dL', '58 kg / 155 cm',
        'Kondisi Membaik', 'Tekanan darah dan gula darah puasa membaik dibanding bulan lalu. Lanjutkan obat rutin Amlodipine 5mg dan Metformin, serta kontrol kembali sesuai jadwal rekomendasi.', TRUE
    ),
    (
        2, 1, 1, CURRENT_DATE - INTERVAL '55 days', 'Poli PTM', '08',
        'Hadir Terverifikasi', '145/90 mmHg', '148 mg/dL', '204 mg/dL', '59 kg / 155 cm',
        'Evaluasi Dosis', 'Penyesuaian dosis obat hipertensi dan edukasi pola makan rendah garam serta gula.', FALSE
    ),
    (
        3, 1, 1, CURRENT_DATE - INTERVAL '85 days', 'Poli PTM', '03',
        'Hadir Terverifikasi', '155/96 mmHg', '162 mg/dL', '215 mg/dL', '60 kg / 155 cm',
        'Pemeriksaan Awal PTM', 'Pemeriksaan awal dan registrasi akun kontrol pasien PTM.', FALSE
    ),
    (
        4, 2, 1, CURRENT_DATE - INTERVAL '28 days', 'Poli PTM', '03',
        'Hadir Terverifikasi', '136/85 mmHg', '118 mg/dL', '194 mg/dL', '61 kg / 156 cm',
        'Terkendali Stabil', 'Kondisi hipertensi terkontrol stabil. Dijadwalkan kontrol rutin bulanan untuk evaluasi dosis.', TRUE
    ),
    (
        5, 3, 1, CURRENT_DATE - INTERVAL '14 days', 'Poli PTM', '11',
        'Hadir Pemeriksaan Awal', '142/88 mmHg', '135 mg/dL', '202 mg/dL', '66 kg / 164 cm',
        'Direkomendasikan Kontrol', 'Pasien baru selesai pemeriksaan awal PTM. Dokter memutuskan perlu kontrol lanjutan. Menunggu aktivasi akun oleh admin.', TRUE
    ),
    (
        6, 4, 1, CURRENT_DATE - INTERVAL '3 days', 'Poli PTM', '02',
        'Hadir Pemeriksaan Awal', '175/105 mmHg', '240 mg/dL', '245 mg/dL', '68 kg / 162 cm',
        'Dirujuk Lanjutan', 'Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS. Surat rujukan telah diterbitkan dokter.', TRUE
    )
ON CONFLICT (id) DO NOTHING;

-- 6. Clinical Decisions
INSERT INTO public.clinical_decisions (id, examination_id, patient_id, doctor_id, tindak_lanjut, rekomendasi_tanggal, alasan)
VALUES
    (1, 1, 1, 1, 'kontrol', CURRENT_DATE + INTERVAL '3 days', 'Kontrol rutin evaluasi hipertensi & DM'),
    (2, 4, 2, 1, 'kontrol', CURRENT_DATE + INTERVAL '1 day', 'Kontrol rutin bulanan evaluasi dosis'),
    (3, 5, 3, 1, 'kontrol', CURRENT_DATE + INTERVAL '3 days', 'Program kontrol rutin Poli PTM baru'),
    (4, 6, 4, 1, 'rujuk',   NULL, 'Krisis hipertensi & hiperglikemia, rujuk spesialis RS rujukan BPJS')
ON CONFLICT (id) DO NOTHING;

-- 7. Control Schedules
INSERT INTO public.control_schedules (id, patient_id, doctor_id, rekomendasi_tanggal, status, catatan)
VALUES
    (1, 1, 1, CURRENT_DATE + INTERVAL '3 days', 'reminded', 'Sudah dikirim pengingat daftar oleh Admin Rina'),
    (2, 2, 1, CURRENT_DATE + INTERVAL '1 day',  'booked',   'Pasien sudah booking jadwal kontrol'),
    (3, 3, 1, CURRENT_DATE + INTERVAL '3 days', 'needs_reminder', 'Menunggu aktivasi akun pasien oleh admin')
ON CONFLICT (id) DO NOTHING;

-- 8. Initial Booking (Ibu Ratna Dewi - Antrean No. 04)
INSERT INTO public.bookings (
    id, code, patient_id, slot_id, control_schedule_id,
    tanggal_kontrol, nomor_antrean, urutan_dalam_slot, status
)
VALUES
    (
        1, 'b-init-1', 2, 1, 2,
        CURRENT_DATE + INTERVAL '1 day', '04', 4, 'confirmed'
    )
ON CONFLICT (code) DO NOTHING;

-- 9. Queue Numbers
INSERT INTO public.queue_numbers (id, booking_id, tanggal, nomor, urutan_slot, estimasi_datang)
VALUES
    (1, 1, CURRENT_DATE + INTERVAL '1 day', '04', 4, '± 08.08 WIB (Giliran antrean ± 08.18 WIB)')
ON CONFLICT (booking_id) DO NOTHING;

-- 10. Attendances
INSERT INTO public.attendances (id, booking_id, status, verified_by, verified_at_label, verified_at)
VALUES
    (1, 1, 'present', 'Admin Rina', '08.12 WIB', NOW())
ON CONFLICT (booking_id) DO NOTHING;

-- 11. Referrals (Bapak Slamet Raharjo - Jalur Rujukan BPJS)
INSERT INTO public.referrals (id, patient_id, examination_id, doctor_id, nomor_surat, alasan_medis)
VALUES
    (1, 4, 6, 1, 'SRJ/BPJS/2026/XI/042', 'Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS.')
ON CONFLICT (nomor_surat) DO NOTHING;

-- Reset Sequences
SELECT setval('public.users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.users));
SELECT setval('public.doctors_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.doctors));
SELECT setval('public.appointment_slots_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.appointment_slots));
SELECT setval('public.patients_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.patients));
SELECT setval('public.examinations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.examinations));
SELECT setval('public.clinical_decisions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.clinical_decisions));
SELECT setval('public.control_schedules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.control_schedules));
SELECT setval('public.bookings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.bookings));
SELECT setval('public.queue_numbers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.queue_numbers));
SELECT setval('public.attendances_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.attendances));
SELECT setval('public.referrals_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.referrals));

COMMIT;
