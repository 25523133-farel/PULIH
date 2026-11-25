<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (Kompatibel dengan Supabase PostgreSQL & SQLite).
     */
    public function up(): void
    {
        // 1. Tabel users
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('email', 150)->nullable()->unique();
            $table->string('role', 30)->default('patient'); // patient | admin | doctor
            $table->string('status', 30)->default('active'); // pending | active | referred | inactive
            $table->string('password')->nullable();
            $table->timestampsTz();
        });

        // 2. Tabel doctors
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('code', 40)->unique();
            $table->string('name', 150);
            $table->string('specialization', 120)->default('Poli PTM / Penyakit Dalam');
            $table->string('polyclinic', 120)->default('Poli PTM, Lantai 1');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        // 3. Tabel patients (FR-01, FR-02, FR-09, FR-19)
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->string('nama_lengkap', 150);
            $table->date('tanggal_lahir');
            $table->string('nomor_rm', 60)->unique();
            $table->string('nik', 32)->nullable();
            $table->string('kode_pembeda_opsional', 30)->nullable();
            $table->string('kontak', 40);
            $table->string('jenis_kepesertaan', 20)->default('BPJS'); // BPJS | Non-BPJS
            $table->string('keputusan_dokter', 20)->default('kontrol'); // kontrol | rujuk | selesai
            $table->string('status_akun', 20)->default('pending'); // pending | active | referred | inactive
            $table->date('rekomendasi_tanggal')->nullable();
            $table->string('nomor_rujukan', 80)->nullable();
            $table->date('reminder_sent_at')->nullable();
            $table->string('reminder_by', 150)->nullable();
            $table->integer('reminder_count')->default(0);
            $table->timestampsTz();

            $table->index(['nama_lengkap', 'tanggal_lahir']);
            $table->index('status_akun');
        });

        // 4. Tabel examinations (FR-08, FR-11)
        Schema::create('examinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->date('tanggal_periksa');
            $table->string('poli', 100)->default('Poli PTM');
            $table->string('nomor_antrean', 10)->default('01');
            $table->string('status_kehadiran', 60)->default('Hadir Terverifikasi');
            $table->string('tekanan_darah', 40);
            $table->string('gula_darah', 40);
            $table->string('kolesterol', 40);
            $table->string('berat_tinggi', 50)->default('60 kg / 160 cm');
            $table->string('status_klinis', 100)->default('Terkontrol Baik');
            $table->text('catatan_dokter')->nullable();
            $table->boolean('is_latest')->default(false);
            $table->timestampsTz();

            $table->index(['patient_id', 'tanggal_periksa']);
        });

        // 5. Tabel clinical_decisions (FR-12)
        Schema::create('clinical_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('examination_id')->constrained('examinations')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->string('tindak_lanjut', 20); // kontrol | rujuk | selesai
            $table->date('rekomendasi_tanggal')->nullable();
            $table->text('alasan')->nullable();
            $table->timestampsTz();
        });

        // 6. Tabel control_schedules (FR-20)
        Schema::create('control_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->date('rekomendasi_tanggal');
            $table->string('status', 30)->default('needs_reminder'); // needs_reminder | reminded | booked | completed | cancelled
            $table->text('catatan')->nullable();
            $table->timestampsTz();
        });

        // 7. Tabel appointment_slots (FR-03)
        Schema::create('appointment_slots', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique(); // s1..s5
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->string('sesi', 30); // Pagi | Siang
            $table->string('jam_mulai', 10);
            $table->string('jam_selesai', 10);
            $table->integer('start_minute');
            $table->integer('kapasitas')->default(10);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        // 8. Tabel bookings (FR-04, FR-15)
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('slot_id')->constrained('appointment_slots')->restrictOnDelete();
            $table->foreignId('control_schedule_id')->nullable()->constrained('control_schedules')->nullOnDelete();
            $table->date('tanggal_kontrol');
            $table->string('nomor_antrean', 10);
            $table->integer('urutan_dalam_slot')->default(1);
            $table->string('status', 25)->default('confirmed'); // confirmed | cancelled | completed | no_show
            $table->timestampTz('waktu_booking')->useCurrent();
            $table->timestampsTz();

            $table->index(['tanggal_kontrol', 'slot_id', 'status']);
            $table->index(['patient_id', 'status']);
        });

        // 9. Tabel queue_numbers (FR-05)
        Schema::create('queue_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('nomor', 10);
            $table->integer('urutan_slot')->default(1);
            $table->string('estimasi_datang', 100)->nullable();
            $table->string('cakupan_antrean', 60)->default('Poli PTM - dr. Ahmad Fauzi');
            $table->timestampsTz();
        });

        // 10. Tabel attendances (FR-07)
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending | present | absent
            $table->string('verified_by', 150)->nullable();
            $table->string('verified_at_label', 40)->nullable();
            $table->timestampTz('verified_at')->nullable();
            $table->timestampsTz();
        });

        // 11. Tabel notifications (FR-06, FR-18)
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('control_schedule_id')->nullable()->constrained('control_schedules')->nullOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->string('jenis', 30); // pengingat_daftar | pengingat_h3
            $table->string('sent_by_admin', 150)->default('Petugas Admin Poli PTM');
            $table->string('kanal', 30)->default('whatsapp_web');
            $table->string('status', 20)->default('sent'); // queued | sent | failed
            $table->text('pesan')->nullable();
            $table->timestampTz('sent_at')->useCurrent();
            $table->string('provider_reference', 100)->nullable();
            $table->timestampsTz();
        });

        // 12. Tabel referrals (FR-13)
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('examination_id')->nullable()->constrained('examinations')->nullOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->string('nomor_surat', 80)->unique();
            $table->string('faskes_tujuan', 150)->default('RSUD Rujukan Spesialis Penyakit Dalam');
            $table->string('status', 25)->default('issued'); // draft | issued | cancelled
            $table->text('alasan_medis')->nullable();
            $table->timestampTz('issued_at')->useCurrent();
            $table->timestampsTz();
        });

        // 13. Tabel audit_logs (FR-16)
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor_role', 30);
            $table->string('actor_name', 150);
            $table->string('action', 80);
            $table->string('entity', 60);
            $table->string('entity_id', 60)->nullable();
            $table->json('details')->nullable();
            $table->timestampTz('occurred_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('referrals');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('queue_numbers');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('appointment_slots');
        Schema::dropIfExists('control_schedules');
        Schema::dropIfExists('clinical_decisions');
        Schema::dropIfExists('examinations');
        Schema::dropIfExists('patients');
        Schema::dropIfExists('doctors');
        Schema::dropIfExists('users');
    }
};
