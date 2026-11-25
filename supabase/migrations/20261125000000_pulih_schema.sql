-- =========================================================================
-- PULIH — Sistem Manajemen Kontrol Pasien PTM (PRD v1.4)
-- Target Database : Supabase (PostgreSQL 15+)
-- Mencakup 12 Entitas Inti PRD Bab 9 & 8 Fitur Utama:
--   1. users              7. appointment_slots
--   2. doctors            8. bookings
--   3. patients           9. queue_numbers
--   4. examinations      10. attendances
--   5. clinical_decisions 11. notifications
--   6. control_schedules 12. referrals & audit_logs
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. TABEL USERS (Akun Aktor: Pasien, Admin, Dokter)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    role VARCHAR(30) NOT NULL DEFAULT 'patient'
        CHECK (role IN ('patient', 'admin', 'doctor')),
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'referred', 'inactive')),
    password VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. TABEL DOCTORS (Tenaga Medis Pemeriksa Poli PTM)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    code VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    specialization VARCHAR(120) NOT NULL DEFAULT 'Poli PTM / Penyakit Dalam',
    polyclinic VARCHAR(120) NOT NULL DEFAULT 'Poli PTM, Lantai 1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 3. TABEL PATIENTS (Data Pasien Tervalidasi & Status Akun Kontrol)
--    FR-01 (Registrasi Pasien), FR-02 (Aktivasi Akun), FR-09 (Login Lansia),
--    FR-19 (Kategori Kepesertaan BPJS / Non-BPJS), BR-01
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40) UNIQUE NOT NULL,                     -- Contoh: 'p1', 'p2'
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    nama_lengkap VARCHAR(150) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    nomor_rm VARCHAR(60) UNIQUE NOT NULL,                 -- Contoh: RM-2026-0104
    nik VARCHAR(32),
    kode_pembeda_opsional VARCHAR(30),                    -- BR-12: kode acak singkat bila nama+tgl lahir kembar
    kontak VARCHAR(40) NOT NULL,                          -- Nomor Telepon / WhatsApp
    jenis_kepesertaan VARCHAR(20) NOT NULL DEFAULT 'BPJS'
        CHECK (jenis_kepesertaan IN ('BPJS', 'Non-BPJS')),
    keputusan_dokter VARCHAR(20) NOT NULL DEFAULT 'kontrol'
        CHECK (keputusan_dokter IN ('kontrol', 'rujuk', 'selesai')),
    status_akun VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status_akun IN ('pending', 'active', 'referred', 'inactive')),
    rekomendasi_tanggal DATE,                             -- Instruksi tanggal kontrol dari dokter
    nomor_rujukan VARCHAR(80),                            -- Nomor surat rujukan jika status_akun = 'referred'
    reminder_sent_at DATE,
    reminder_by VARCHAR(150),
    reminder_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_login
    ON public.patients (LOWER(nama_lengkap), tanggal_lahir);
CREATE INDEX IF NOT EXISTS idx_patients_status_akun
    ON public.patients (status_akun);

-- -------------------------------------------------------------------------
-- 4. TABEL EXAMINATIONS (Hasil Pemeriksaan Fisik & Vital PTM)
--    FR-08 (Riwayat Kontrol), FR-11 (Pemeriksaan & Hasil Medis)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.examinations (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    tanggal_periksa DATE NOT NULL,
    poli VARCHAR(100) NOT NULL DEFAULT 'Poli PTM',
    nomor_antrean VARCHAR(10) DEFAULT '01',
    status_kehadiran VARCHAR(60) NOT NULL DEFAULT 'Hadir Terverifikasi',
    tekanan_darah VARCHAR(40) NOT NULL,                   -- Contoh: '130/82 mmHg'
    gula_darah VARCHAR(40) NOT NULL,                      -- Contoh: '124 mg/dL'
    kolesterol VARCHAR(40) NOT NULL,                      -- Contoh: '188 mg/dL'
    berat_tinggi VARCHAR(50) DEFAULT '60 kg / 160 cm',    -- Contoh: '58 kg / 155 cm'
    status_klinis VARCHAR(100) NOT NULL DEFAULT 'Terkontrol Baik',
    catatan_dokter TEXT,
    is_latest BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_examinations_patient_date
    ON public.examinations (patient_id, tanggal_periksa DESC);

-- -------------------------------------------------------------------------
-- 5. TABEL CLINICAL_DECISIONS (Keputusan Tindak Lanjut Medis Dokter)
--    FR-12 (Keputusan Medis Dokter: kontrol / rujuk / selesai), BR-06
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_decisions (
    id BIGSERIAL PRIMARY KEY,
    examination_id BIGINT NOT NULL REFERENCES public.examinations(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    tindak_lanjut VARCHAR(20) NOT NULL
        CHECK (tindak_lanjut IN ('kontrol', 'rujuk', 'selesai')),
    rekomendasi_tanggal DATE,
    alasan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. TABEL CONTROL_SCHEDULES (Instruksi Jadwal Kontrol dari Dokter ke Admin)
--    FR-20 (Instruksi Pengingat dari Dokter ke Daftar Perlu Diingatkan Admin)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.control_schedules (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    rekomendasi_tanggal DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'needs_reminder'
        CHECK (status IN ('needs_reminder', 'reminded', 'booked', 'completed', 'cancelled')),
    catatan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. TABEL APPOINTMENT_SLOTS (Master Slot Waktu Praktik Dokter)
--    FR-03 (Lihat Jadwal Kontrol & Cegah Penumpukan Jam Sama)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_slots (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,                     -- 's1', 's2', 's3', 's4', 's5'
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    sesi VARCHAR(30) NOT NULL,                            -- 'Pagi' | 'Siang'
    jam_mulai VARCHAR(10) NOT NULL,                       -- '08.00'
    jam_selesai VARCHAR(10) NOT NULL,                     -- '09.00'
    start_minute INTEGER NOT NULL,                        -- 480 (8 * 60)
    kapasitas INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. TABEL BOOKINGS (Pendaftaran / Booking Jadwal Kontrol Daring)
--    FR-04 (Booking Jadwal Kontrol), FR-15 (Pembatalan Booking), BR-02, BR-03
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    slot_id BIGINT NOT NULL REFERENCES public.appointment_slots(id) ON DELETE RESTRICT,
    control_schedule_id BIGINT REFERENCES public.control_schedules(id) ON DELETE SET NULL,
    tanggal_kontrol DATE NOT NULL,
    nomor_antrean VARCHAR(10) NOT NULL,
    urutan_dalam_slot INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(25) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    waktu_booking TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_date_slot
    ON public.bookings (tanggal_kontrol, slot_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_patient_status
    ON public.bookings (patient_id, status);

-- -------------------------------------------------------------------------
-- 9. TABEL QUEUE_NUMBERS (Penerbitan Nomor Antrean & Estimasi Kedatangan)
--    FR-05 (Lihat Nomor Antrean), BR-04
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queue_numbers (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    nomor VARCHAR(10) NOT NULL,
    urutan_slot INTEGER NOT NULL DEFAULT 1,
    estimasi_datang VARCHAR(100),
    cakupan_antrean VARCHAR(60) NOT NULL DEFAULT 'Poli PTM - dr. Ahmad Fauzi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 10. TABEL ATTENDANCES (Verifikasi Kehadiran Fisik Pasien oleh Admin)
--     FR-07 (Verifikasi Kehadiran Pasien & Evaluasi Slot), BR-08
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendances (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'present', 'absent')),
    verified_by VARCHAR(150),
    verified_at_label VARCHAR(40),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 11. TABEL NOTIFICATIONS (Reminder Kontrol Dua Tahap: Daftar & H-3)
--     FR-06 (Reminder Kontrol), FR-18 (Status & Retry), BR-13, BR-14, BR-15
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    control_schedule_id BIGINT REFERENCES public.control_schedules(id) ON DELETE SET NULL,
    booking_id BIGINT REFERENCES public.bookings(id) ON DELETE SET NULL,
    jenis VARCHAR(30) NOT NULL
        CHECK (jenis IN ('pengingat_daftar', 'pengingat_h3')),
    sent_by_admin VARCHAR(150) NOT NULL DEFAULT 'Petugas Admin Poli PTM',
    kanal VARCHAR(30) NOT NULL DEFAULT 'whatsapp_web',
    status VARCHAR(20) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('queued', 'sent', 'failed')),
    pesan TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 12. TABEL REFERRALS (Surat Rujukan BPJS untuk Jalur Rujuk)
--     FR-13 (Surat Rujukan BPJS), BR-09, BR-11
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    examination_id BIGINT REFERENCES public.examinations(id) ON DELETE SET NULL,
    doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
    nomor_surat VARCHAR(80) UNIQUE NOT NULL,
    faskes_tujuan VARCHAR(150) NOT NULL DEFAULT 'RSUD Rujukan Spesialis Penyakit Dalam',
    status VARCHAR(25) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('draft', 'issued', 'cancelled')),
    alasan_medis TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 13. TABEL AUDIT_LOGS (Jejak Audit Aktivitas Kritis Sistem)
--     FR-16 (Audit Aktivitas), NFR-03
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_role VARCHAR(30) NOT NULL,
    actor_name VARCHAR(150) NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60),
    details JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- TRIGGER AUTO-UPDATE updated_at
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'doctors', 'patients', 'examinations', 'clinical_decisions',
        'control_schedules', 'appointment_slots', 'bookings', 'queue_numbers',
        'attendances', 'notifications', 'referrals'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
            t, t
        );
    END LOOP;
END;
$$;
