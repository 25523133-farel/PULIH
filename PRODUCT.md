# PULIH — Product Context (PRD v1.4)

> Disusun dari [PRD_PULIH_v1.2.md](file:///E:/SEMESTER%203/MPTI/PULIH/PRD_PULIH_v1.2.md) versi 1.4 (23 Nov 2026).

## Produk
Aplikasi web manajemen kontrol pasien Penyakit Tidak Menular (PTM) untuk fasilitas kesehatan yang menyelaraskan **8 Fitur Inti** antara Pasien (ramah lansia) dan Petugas Admin Poli PTM:

1. **Reminder kontrol**: Notifikasi pengingat dua tahap kepada pasien (Pengingat Daftar sebelum booking & Pengingat Jadwal H-3 sesudah booking) agar pasien yang memiliki sifat pelupa mendapat perhatian dari notifikasi dan memastikan tidak terlewat jadwal kontrol medis.
2. **Lihat jadwal kontrol**: Pasien melihat jadwal praktik dokter dan sisa kuota slot waktu untuk menetapkan waktu kontrol agar jadwal antar-pasien dan dokter tidak tabrakan serta mencegah penumpukan pasien pada jam yang sama.
3. **Booking jadwal kontrol**: Pasien dapat mendaftar ulang untuk kontrol secara daring langsung dari halaman utama tanpa harus datang ke tempat demi efisiensi waktu dan efektivitas proses pendaftaran pasien.
4. **Lihat nomor antrean**: Pasien mendapat nomor antrean beserta estimasi jam kedatangan sesuai nomor antrean setelah booking jadwal kontrol, agar pasien tidak menunggu lama di tempat dan mengurangi penumpukan di lokasi pelayanan.
5. **Riwayat kontrol**: Pasien dan dokter melihat riwayat semua aktivitas kontrol serta tren perkembangan parameter kesehatan (tekanan darah, gula darah, kolesterol) untuk memudahkan pemantauan kondisi kesehatan.
6. **Registrasi pasien**: Admin membuat akun pasien dan melakukan registrasi terhadap data yang diberikan pasien menuju database resmi dan tervalidasi.
7. **Aktivasi akun pasien**: Admin membuat aktivasi akun bagi pasien jalur kontrol agar tinggal langsung pakai (masuk cukup dengan Nama + Tanggal Lahir), mempermudah aksesibilitas bagi pasien lansia yang mengalami kendala teknis pendaftaran.
8. **Verifikasi kehadiran pasien**: Admin mengelola kehadiran pasien (`Hadir` / `Tidak Hadir`), menyusun ketersediaan slot antrean secara efektif, sekaligus mengevaluasi tingkat partisipasi kedatangan pasien.

## Pengguna Utama
Pasien PTM (prioritas **orang tua / lansia**) dan **Petugas Admin Poli PTM**.

## Prinsip Pengalaman
- **Halaman utama Pasien = Lihat & Booking Jadwal Kontrol (Hero)** dengan kartu **Nomor Antrean & Estimasi Waktu Datang** tampil paling atas setelah booking.
- Huruf besar (`Atkinson Hyperlegible`), kontras tinggi, pengatur ukuran huruf (`A`, `A`, `A`), tombol lebar, bahasa sehari-hari.
- Menu Pasien yang berfungsi penuh: **Jadwal & Antrean**, **Riwayat Kontrol**, **Hasil Pemeriksaan**, **Reminder Kontrol**, serta **Ganti Pasien (Login Ringkas Nama + Tanggal Lahir)**.
- **Panel Admin Terintegrasi**: Beralih langsung ke mode Admin untuk mempraktikkan **Verifikasi Kehadiran & Evaluasi Slot**, **Registrasi Pasien ke Database**, **Aktivasi Akun Pasien Siap Pakai**, dan **Kirim Reminder Kontrol**.

## Palet
- Utama: `#0077B6` Ocean Blue
- Latar: `#F0F8FF` Alice Blue
- Aksen: `#00B4D8` Cyan lembut

## Stack
HTML, CSS, JavaScript → Laravel Blade & PostgreSQL.
