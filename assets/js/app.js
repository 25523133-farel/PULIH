/* =========================================================
   PULIH — Implementasi Interaktif 8 Fitur Inti (PRD v1.4)
   1. Reminder kontrol       (Notifikasi pengingat kontrol pasien)
   2. Lihat jadwal kontrol   (Cegah tabrakan jadwal & penumpukan)
   3. Lihat nomor antrean    (Datang sesuai antrean, kurangi tunggu)
   4. Riwayat kontrol        (Pantau perkembangan kondisi kesehatan)
   5. Booking jadwal kontrol (Daftar ulang daring tanpa datang fisik)
   6. Registrasi pasien      Memastikan data resmi masuk database
   7. Aktivasi akun pasien   (Admin aktifkan akun siap langsung pakai)
   8. Verifikasi kehadiran   (Admin kelola hadir, slot & partisipasi)
   ========================================================= */
(() => {
  "use strict";

  const STORE_STATE = "pulih.state.v14";
  const STORE_SIZE = "pulih.textsize";

  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const SLOTS = [
    { id: "s1", start: "08.00", end: "09.00", part: "Pagi", startMin: 8 * 60 },
    { id: "s2", start: "09.00", end: "10.00", part: "Pagi", startMin: 9 * 60 },
    { id: "s3", start: "10.00", end: "11.00", part: "Pagi", startMin: 10 * 60 },
    { id: "s4", start: "13.00", end: "14.00", part: "Siang", startMin: 13 * 60 },
    { id: "s5", start: "14.00", end: "15.00", part: "Siang", startMin: 14 * 60 },
  ];
  const CAPACITY = 10;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Util Tanggal & Waktu ---------- */
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = (d) => `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const shortDate = (d) => `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;

  function formatMinutes(totalMin) {
    const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const m = String(totalMin % 60).padStart(2, "0");
    return `${h}.${m} WIB`;
  }

  // Hitung estimasi waktu datang sesuai nomor antrean di dalam slot (6 menit per pasien)
  function estimateArrival(slotId, orderInSlot) {
    const slot = SLOTS.find((s) => s.id === slotId) || SLOTS[1];
    const turnMin = slot.startMin + Math.max(0, (orderInSlot - 1) * 6);
    const arriveMin = Math.max(slot.startMin, turnMin - 10);
    return `± ${formatMinutes(arriveMin)} (Giliran antrean ± ${formatMinutes(turnMin)})`;
  }

  const today = startOfDay(new Date());

  // 6 Hari layanan ke depan (Senin–Sabtu, Minggu libur)
  function nextServiceDays(from, count) {
    const out = [];
    let d = addDays(from, 1);
    while (out.length < count) {
      if (d.getDay() !== 0) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }
  const days = nextServiceDays(today, 6);

  let defaultRecommended = addDays(today, 3);
  if (defaultRecommended.getDay() === 0) defaultRecommended = addDays(defaultRecommended, 1);
  if (!days.some((d) => iso(d) === iso(defaultRecommended))) defaultRecommended = days[2] || days[0];

  /* ---------- Data Awal Default (Terintegrasi Pasien & Admin) ---------- */
  function createInitialState() {
    const recIso = iso(defaultRecommended);
    const day1Iso = iso(days[0]);
    const sentDateIso = iso(addDays(today, -1));

    return {
      currentRole: "patient",        // "patient" | "admin" | "login"
      currentPatientId: "p1",
      currentPatientView: "booking", // "booking" | "riwayat" | "hasil" | "notifikasi"
      currentAdminView: "kehadiran", // "kehadiran" | "registrasi" | "aktivasi" | "reminder"
      patients: [
        {
          id: "p1",
          name: "Ibu Siti Aminah",
          dob: "1958-05-12",
          rm: "RM-2026-0104",
          phone: "0812-3400-1122",
          bpjs: "BPJS",
          doctor: "dr. Ahmad Fauzi",
          decision: "kontrol",
          accountStatus: "active", // active = siap langsung pakai
          adviceDate: recIso,
          latestExam: {
            date: iso(addDays(today, -25)),
            td: "130/82 mmHg",
            gdp: "124 mg/dL",
            chol: "188 mg/dL",
            bbTb: "58 kg / 155 cm",
            note: "Tekanan darah dan gula darah puasa membaik dibanding bulan lalu. Lanjutkan obat rutin Amlodipine 5mg dan Metformin, serta kontrol kembali sesuai jadwal rekomendasi.",
          },
          reminderSentAt: sentDateIso,
          reminderBy: "Admin Rina (Petugas Poli PTM)",
          reminderCount: 1,
        },
        {
          id: "p2",
          name: "Ibu Ratna Dewi",
          dob: "1961-11-03",
          rm: "RM-2026-0109",
          phone: "0813-8899-2211",
          bpjs: "BPJS",
          doctor: "dr. Ahmad Fauzi",
          decision: "kontrol",
          accountStatus: "active",
          adviceDate: day1Iso,
          latestExam: {
            date: iso(addDays(today, -28)),
            td: "136/85 mmHg",
            gdp: "118 mg/dL",
            chol: "194 mg/dL",
            bbTb: "61 kg / 156 cm",
            note: "Kondisi hipertensi terkontrol stabil. Dijadwalkan kontrol rutin bulanan untuk evaluasi dosis.",
          },
          reminderSentAt: sentDateIso,
          reminderBy: "Admin Rina (Petugas Poli PTM)",
          reminderCount: 2,
        },
        {
          id: "p3",
          name: "Bapak Haryono",
          dob: "1955-08-20",
          rm: "RM-2026-0114",
          phone: "0812-7766-5544",
          bpjs: "Non-BPJS",
          doctor: "dr. Ahmad Fauzi",
          decision: "kontrol",
          accountStatus: "pending", // menunggu aktivasi akun oleh admin agar langsung pakai
          adviceDate: recIso,
          latestExam: {
            date: iso(addDays(today, -14)),
            td: "142/88 mmHg",
            gdp: "135 mg/dL",
            chol: "202 mg/dL",
            bbTb: "66 kg / 164 cm",
            note: "Pasien baru selesai pemeriksaan awal PTM. Dokter memutuskan perlu kontrol lanjutan. Menunggu aktivasi akun oleh admin.",
          },
          reminderSentAt: null,
          reminderBy: null,
          reminderCount: 0,
        },
        {
          id: "p4",
          name: "Bapak Slamet Raharjo",
          dob: "1952-02-14",
          rm: "RM-2026-0118",
          phone: "0815-4433-9900",
          bpjs: "BPJS",
          doctor: "dr. Ahmad Fauzi",
          decision: "rujuk",
          accountStatus: "referred", // jalur rujukan BPJS, tidak dibuatkan akun kontrol
          referralNo: "SRJ/BPJS/2026/XI/042",
          adviceDate: null,
          latestExam: {
            date: iso(addDays(today, -3)),
            td: "175/105 mmHg",
            gdp: "240 mg/dL",
            chol: "245 mg/dL",
            bbTb: "68 kg / 162 cm",
            note: "Perlu penanganan spesialis penyakit dalam di RS Rujukan BPJS. Surat rujukan telah diterbitkan dokter.",
          },
          reminderSentAt: null,
          reminderBy: null,
          reminderCount: 0,
        }
      ],
      // Daftar booking jadwal kontrol aktif
      bookings: [
        {
          id: "b-init-1",
          patientId: "p2",
          date: day1Iso,
          slotId: "s1",
          start: "08.00",
          end: "09.00",
          part: "Pagi",
          queue: "04",
          orderInSlot: 4,
          attendance: "present", // "pending" | "present" | "absent"
          verifiedAt: "08.12 WIB",
          verifiedBy: "Admin Rina",
        }
      ],
      // Riwayat aktivitas kontrol sebelumnya (Fitur 4: Riwayat Kontrol)
      history: {
        p1: [
          {
            date: iso(addDays(today, -25)),
            doctor: "dr. Ahmad Fauzi",
            poli: "Poli PTM",
            queue: "05",
            attendance: "Hadir Terverifikasi",
            td: "130/82 mmHg",
            gdp: "124 mg/dL",
            chol: "188 mg/dL",
            status: "Kondisi Membaik",
            note: "Tekanan darah turun dari 145/90 ke 130/82 mmHg. Pasien patuh minum obat dan jadwal kontrol.",
          },
          {
            date: iso(addDays(today, -55)),
            doctor: "dr. Ahmad Fauzi",
            poli: "Poli PTM",
            queue: "08",
            attendance: "Hadir Terverifikasi",
            td: "145/90 mmHg",
            gdp: "148 mg/dL",
            chol: "204 mg/dL",
            status: "Evaluasi Dosis",
            note: "Penyesuaian dosis obat hipertensi dan edukasi pola makan rendah garam serta gula.",
          },
          {
            date: iso(addDays(today, -85)),
            doctor: "dr. Ahmad Fauzi",
            poli: "Poli PTM",
            queue: "03",
            attendance: "Hadir Terverifikasi",
            td: "155/96 mmHg",
            gdp: "162 mg/dL",
            chol: "215 mg/dL",
            status: "Pemeriksaan Awal PTM",
            note: "Pemeriksaan awal dan registrasi akun kontrol pasien PTM.",
          }
        ],
        p2: [
          {
            date: iso(addDays(today, -28)),
            doctor: "dr. Ahmad Fauzi",
            poli: "Poli PTM",
            queue: "03",
            attendance: "Hadir Terverifikasi",
            td: "136/85 mmHg",
            gdp: "118 mg/dL",
            chol: "194 mg/dL",
            status: "Terkendali Stabil",
            note: "Kondisi stabil, lanjutkan kontrol berkala bulan berikutnya.",
          }
        ],
        p3: [
          {
            date: iso(addDays(today, -14)),
            doctor: "dr. Ahmad Fauzi",
            poli: "Poli PTM",
            queue: "11",
            attendance: "Hadir Pemeriksaan Awal",
            td: "142/88 mmHg",
            gdp: "135 mg/dL",
            chol: "202 mg/dL",
            status: "Direkomendasikan Kontrol",
            note: "Pasien direkomendasikan masuk program kontrol rutin Poli PTM.",
          }
        ]
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.patients) && Array.isArray(parsed.bookings)) {
          return parsed;
        }
      }
    } catch (_) { /* abaikan */ }
    return createInitialState();
  }

  let state = loadState();
  const saveState = () => localStorage.setItem(STORE_STATE, JSON.stringify(state));

  /* ---------- Integrasi Backend PHP Laravel & Supabase Database ---------- */
  const API_BASE = "/api";

  async function apiRequest(method, path, body = null) {
    try {
      const opts = {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      };
      if (body !== null) {
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json().catch(() => null);
      if (data && data.state) {
        applyServerState(data.state);
      }
      return { ok: res.ok, status: res.status, data };
    } catch (_) {
      return { ok: false, offline: true, data: null };
    }
  }

  function applyServerState(serverState) {
    if (!serverState || !Array.isArray(serverState.patients)) return;
    state.patients = serverState.patients;
    state.bookings = Array.isArray(serverState.bookings) ? serverState.bookings : [];
    state.history = serverState.history || {};
    if (!state.patients.some((p) => p.id === state.currentPatientId)) {
      const activeFirst = state.patients.find((p) => p.accountStatus === "active") || state.patients[0];
      if (activeFirst) state.currentPatientId = activeFirst.id;
    }
    saveState();
  }

  async function syncFromBackend() {
    const res = await apiRequest("GET", "/state");
    if (res.ok && res.data) {
      applyServerState(res.data);
      renderAll();
    }
  }

  /* ---------- Helper Data ---------- */
  const getCurrentPatient = () =>
    state.patients.find((p) => p.id === state.currentPatientId) || state.patients[0];

  const getPatientBooking = (patientId) =>
    state.bookings.find((b) => b.patientId === patientId) || null;

  // Sisa kuota dasar + dikurangi jumlah booking aktif di tanggal & slot tersebut
  function baseRemaining(date, slotIdx) {
    const n = date.getDate() * 7 + date.getMonth() * 3 + slotIdx * 5;
    let left = (n % 6) + 1; // 1..6 kursi tersedia secara default
    if (slotIdx === 2 && date.getDay() === 2) left = 0; // simulasi 1 slot penuh agar terlihat pencegahan tabrakan
    return left;
  }

  function remaining(date, slotIdx) {
    const base = baseRemaining(date, slotIdx);
    const slot = SLOTS[slotIdx];
    const dIso = iso(date);
    const bookedCount = state.bookings.filter(
      (b) => b.date === dIso && b.slotId === slot.id && b.attendance !== "absent"
    ).length;
    return Math.max(0, base - bookedCount);
  }

  const dayTotalLeft = (date) =>
    SLOTS.reduce((acc, _, i) => acc + remaining(date, i), 0);

  const dayFull = (date) => dayTotalLeft(date) === 0;

  /* ---------- Elemen DOM ---------- */
  const el = {
    roleBadge: $("#role-badge"),
    switchRoleBtn: $("#switch-role-btn"),
    switchRoleLabel: $("#switch-role-label"),
    logoutBtn: $("#logout-btn"),
    logoutLabel: $("#logout-label"),
    exitAdminBtn: $("#exit-admin-btn"),
    patientNav: $("#patient-nav"),
    adminNav: $("#admin-nav"),
    mobileTabbar: $("#mobile-tabbar"),
    navDot: $("#nav-dot"),
    mobDot: $("#mob-dot"),

    // Apps
    patientApp: $("#patient-app"),
    loginApp: $("#login-app"),
    adminApp: $("#admin-app"),

    // Patient header
    greetTime: $("#greet-time"),
    patientName: $("#patient-name"),
    today: $("#today"),
    patientRm: $("#patient-rm"),

    // Patient subviews
    viewBooking: $("#view-booking"),
    viewRiwayat: $("#view-riwayat"),
    viewNotifikasi: $("#view-notifikasi"),

    // Ticket (Lihat Nomor Antrean)
    ticket: $("#ticket"),
    tNum: $("#t-num"),
    tDate: $("#t-date"),
    tTime: $("#t-time"),
    tArrival: $("#t-arrival"),
    tRemind: $("#t-remind"),
    tAttendanceBadge: $("#t-attendance-badge"),
    tDoctorBadge: $("#t-doctor-badge"),
    openCancel: $("#open-cancel"),

    // Booking & Reminder
    booking: $("#booking"),
    reminder: $("#reminder"),
    reminderPatient: $("#reminder-patient"),
    adviceDate: $("#advice-date"),
    reminderSender: $("#reminder-sender"),
    reminderDoctor: $("#reminder-doctor"),
    reminderSent: $("#reminder-sent"),
    dates: $("#dates"),
    stepTime: $("#step-time"),
    timeHint: $("#time-hint"),
    slots: $("#slots"),
    summary: $("#summary"),
    summaryQueueHint: $("#summary-queue-hint"),
    error: $("#form-error"),
    submit: $("#submit-btn"),
    form: $("#booking-form"),
    locked: $("#booking-locked"),

    // Riwayat, Hasil, Notifikasi
    historyList: $("#history-list"),
    latestExamBox: $("#latest-exam-box"),
    notifList: $("#notif-list"),

    // Login Ringkas
    loginForm: $("#login-form"),
    loginName: $("#login-name"),
    loginDob: $("#login-dob"),
    loginError: $("#login-error"),
    quickPatientList: $("#quick-patient-list"),

    // Admin
    backToPatientBtn: $("#back-to-patient-btn"),
    kpiTotalPatients: $("#kpi-total-patients"),
    kpiActiveAccounts: $("#kpi-active-accounts"),
    kpiPendingAccounts: $("#kpi-pending-accounts"),
    kpiSlotAvail: $("#kpi-slot-avail"),
    kpiBookedCount: $("#kpi-booked-count"),
    kpiAttendanceRate: $("#kpi-attendance-rate"),
    kpiAttendanceDetail: $("#kpi-attendance-detail"),
    slotEvalBar: $("#slot-eval-bar"),
    adminAttendanceList: $("#admin-attendance-list"),
    adminActivationList: $("#admin-activation-list"),
    adminReminderList: $("#admin-reminder-list"),
    adminRegForm: $("#admin-reg-form"),
    regName: $("#reg-name"),
    regDob: $("#reg-dob"),
    regRm: $("#reg-rm"),
    regPhone: $("#reg-phone"),
    regBpjs: $("#reg-bpjs"),
    regDecision: $("#reg-decision"),
    regAdviceWrap: $("#reg-advice-wrap"),
    regAdviceDate: $("#reg-advice-date"),
    regVital: $("#reg-vital"),
    regAutoActivate: $("#reg-auto-activate"),
    regError: $("#reg-error"),

    // Dialog & Toast
    dialog: $("#cancel-dialog"),
    cancelText: $("#cancel-text"),
    toast: $("#toast"),
  };

  let selectedDate = null;
  let selectedSlot = null;

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("is-on"), 3600);
  }

  /* ---------- Navigasi Peran & Subview ---------- */
  function setRole(role) {
    state.currentRole = role;
    saveState();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setPatientView(view) {
    state.currentRole = "patient";
    state.currentPatientView = view;
    saveState();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAdminView(view) {
    state.currentRole = "admin";
    state.currentAdminView = view;
    saveState();
    renderAll();
  }

  /* ---------- Render Tampilan Pasien ---------- */
  function renderPatientHeader() {
    const p = getCurrentPatient();
    const h = new Date().getHours();
    el.greetTime.textContent =
      h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
    el.patientName.textContent = p.name;
    el.today.textContent = `Hari ini ${longDate(today)}`;
    el.patientRm.textContent = `${p.rm} · ${p.bpjs}`;

    const recDate = p.adviceDate ? fromIso(p.adviceDate) : defaultRecommended;
    el.reminderPatient.textContent = p.name;
    el.adviceDate.textContent = longDate(recDate);
    el.reminderSender.textContent = p.reminderBy || "Petugas Admin Poli PTM";
    el.reminderDoctor.textContent = `atas arahan ${p.doctor}`;
    const sentDate = p.reminderSentAt ? fromIso(p.reminderSentAt) : addDays(today, -1);
    el.reminderSent.textContent = `dikirim ${shortDate(sentDate)}`;
  }

  function renderDates() {
    const p = getCurrentPatient();
    const recIso = p.adviceDate || iso(defaultRecommended);
    el.dates.innerHTML = "";
    el.dates.setAttribute("role", "radiogroup");
    el.dates.setAttribute("aria-label", "Tanggal kontrol");

    days.forEach((d) => {
      const totalLeft = dayTotalLeft(d);
      const full = totalLeft === 0;
      const isRec = iso(d) === recIso;
      const isChecked = selectedDate && iso(selectedDate) === iso(d);
      const label = document.createElement("label");
      label.className = "choice";
      label.innerHTML = `
        <input type="radio" name="date" value="${iso(d)}" ${full ? "disabled" : ""} ${isChecked ? "checked" : ""}
          aria-label="${longDate(d)}${isRec ? ", disarankan dokter" : ""}${full ? ", penuh" : `, tersedia ${totalLeft} kuota`}">
        <span class="choice__box" aria-hidden="true">
          <span class="choice__dow">${HARI[d.getDay()]}</span>
          <span class="choice__day">${d.getDate()}</span>
          <span class="choice__mon">${BULAN[d.getMonth()].slice(0, 3)}</span>
          <span class="choice__quota">${full ? "0 kuota" : `${totalLeft} kursi`}</span>
          ${isRec ? '<span class="choice__tag">Saran dokter</span>' : ""}
          ${full ? '<span class="choice__tag choice__tag--full">Penuh</span>' : ""}
        </span>`;
      el.dates.appendChild(label);
    });
  }

  function renderSlots() {
    el.slots.innerHTML = "";
    if (!selectedDate) {
      el.stepTime.disabled = true;
      el.timeHint.hidden = false;
      return;
    }
    el.stepTime.disabled = false;
    el.timeHint.hidden = true;

    const parts = [...new Set(SLOTS.map((s) => s.part))];
    parts.forEach((part) => {
      const group = document.createElement("div");
      group.className = "slotgroup";
      const gid = `grp-${part.toLowerCase()}`;
      group.innerHTML = `<h3 id="${gid}">Sesi ${part} (Dokter Praktik: dr. Ahmad Fauzi)</h3><div class="slotgrid" role="radiogroup" aria-labelledby="${gid}"></div>`;
      const grid = $(".slotgrid", group);

      SLOTS.forEach((s, i) => {
        if (s.part !== part) return;
        const left = remaining(selectedDate, i);
        const full = left === 0;
        const nextOrder = CAPACITY - left + 1;
        const nextQueue = String(i * CAPACITY + nextOrder).padStart(2, "0");
        const leftText = full ? "Penuh (Cegah Penumpukan)" : `Tersedia ${left} kursi`;
        const cls = full ? "is-full" : left <= 2 ? "is-few" : "";
        const isChecked = selectedSlot && selectedSlot.id === s.id;

        const label = document.createElement("label");
        label.className = "choice";
        label.innerHTML = `
          <input type="radio" name="slot" value="${s.id}" ${full ? "disabled" : ""} ${isChecked ? "checked" : ""}
            aria-label="Pukul ${s.start} sampai ${s.end}, ${leftText}">
          <span class="choice__box" aria-hidden="true">
            <span class="slot__time">${s.start} – ${s.end}</span>
            <span class="slot__left ${cls}">${leftText}</span>
            <span class="slot__est">${full ? "Pilih jam lain" : `Estimasi Antrean No. ${nextQueue}`}</span>
          </span>`;
        grid.appendChild(label);
      });
      el.slots.appendChild(group);
    });
  }

  function renderSummary() {
    el.error.hidden = true;
    if (selectedDate && selectedSlot) {
      const idx = SLOTS.findIndex((s) => s.id === selectedSlot.id);
      const left = remaining(selectedDate, idx);
      const nextOrder = CAPACITY - left + 1;
      const nextQueue = String(idx * CAPACITY + nextOrder).padStart(2, "0");
      el.summary.innerHTML = `Anda memilih jadwal <strong>${longDate(selectedDate)}</strong>, pukul <strong>${selectedSlot.start} – ${selectedSlot.end} WIB</strong>.`;
      el.summaryQueueHint.innerHTML = `Anda akan mendapat <strong>Nomor Antrean ${nextQueue}</strong> (${estimateArrival(selectedSlot.id, nextOrder)}).`;
      el.submit.disabled = false;
    } else if (selectedDate) {
      el.summary.innerHTML = `Tanggal <strong>${longDate(selectedDate)}</strong> dipilih. Sekarang pilih jam kedatangan.`;
      el.summaryQueueHint.textContent = "Pilih jam yang tersedia agar tidak bertabrakan dengan pasien lain.";
      el.submit.disabled = true;
    } else {
      el.summary.textContent = "Belum ada jadwal kontrol yang dipilih.";
      el.summaryQueueHint.textContent = "Nomor antrean dan jam estimasi kedatangan akan langsung terbit setelah Anda memesan.";
      el.submit.disabled = true;
    }
  }

  function renderBookingState({ animate = false } = {}) {
    const p = getCurrentPatient();
    const b = getPatientBooking(p.id);
    if (b) {
      const d = fromIso(b.date);
      el.tNum.textContent = b.queue;
      el.tDate.textContent = longDate(d);
      el.tTime.textContent = `${b.start} – ${b.end} WIB`;
      el.tArrival.textContent = estimateArrival(b.slotId, b.orderInSlot || 3);
      el.tRemind.textContent = shortDate(addDays(d, -3));
      el.tDoctorBadge.textContent = p.doctor;

      if (b.attendance === "present") {
        el.tAttendanceBadge.className = "badge badge--ok";
        el.tAttendanceBadge.textContent = `Kehadiran Terverifikasi Hadir (${b.verifiedAt || "Poli PTM"})`;
      } else if (b.attendance === "absent") {
        el.tAttendanceBadge.className = "badge badge--danger";
        el.tAttendanceBadge.textContent = "Tercatat Tidak Hadir (Silakan Jadwalkan Ulang)";
      } else {
        el.tAttendanceBadge.className = "badge badge--info";
        el.tAttendanceBadge.textContent = "Terdaftar · Menunggu Verifikasi Kehadiran di Loket";
      }

      el.ticket.hidden = false;
      el.form.hidden = true;
      el.locked.hidden = false;
      el.reminder.hidden = true; // BR-14: pengingat daftar berhenti setelah booking
      el.navDot.hidden = true;
      el.mobDot.hidden = true;
      el.ticket.classList.toggle("is-new", animate);
    } else {
      el.ticket.hidden = true;
      el.ticket.classList.remove("is-new");
      el.form.hidden = false;
      el.locked.hidden = true;
      el.reminder.hidden = false; // Pengingat daftar aktif sebelum booking
      el.navDot.hidden = false;
      el.mobDot.hidden = false;
    }
  }

  /* ---------- Render Fitur 4: Riwayat Kontrol ---------- */
  function renderRiwayat() {
    const p = getCurrentPatient();
    const b = getPatientBooking(p.id);
    const items = [...(state.history[p.id] || [])];
    el.historyList.innerHTML = "";

    // Bila sedang punya jadwal kontrol aktif, tampilkan paling atas di riwayat aktivitas kontrol
    if (b) {
      const d = fromIso(b.date);
      const statusLabel =
        b.attendance === "present"
          ? '<span class="badge badge--ok">Hadir Terverifikasi oleh Admin</span>'
          : b.attendance === "absent"
          ? '<span class="badge badge--danger">Tidak Hadir (No-Show)</span>'
          : '<span class="badge badge--info">Jadwal Kontrol Aktif · Menunggu Kunjungan</span>';

      const activeCard = document.createElement("article");
      activeCard.className = "history-item history-item--active";
      activeCard.innerHTML = `
        <div class="item-top">
          <span class="item-title">${longDate(d)} · Nomor Antrean ${b.queue}</span>
          ${statusLabel}
        </div>
        <div class="item-meta">
          <span>Dokter: <strong>${p.doctor}</strong></span>
          <span>Sesi Jam: <strong>${b.start} – ${b.end} WIB</strong></span>
          <span>Estimasi Datang: <strong>${estimateArrival(b.slotId, b.orderInSlot || 3)}</strong></span>
        </div>
        <p>${
          b.attendance === "present"
            ? "Kehadiran Anda telah diverifikasi oleh petugas admin Poli PTM. Hasil pemeriksaan tercatat pada rekam medis."
            : "Booking jadwal kontrol telah berhasil terdaftar secara daring tanpa perlu antre pendaftaran manual."
        }</p>`;
      el.historyList.appendChild(activeCard);
    }

    if (items.length === 0 && !b) {
      el.historyList.innerHTML = `<div class="history-item"><p>Belum ada riwayat kontrol tercatat untuk pasien ini.</p></div>`;
      return;
    }

    items.forEach((h) => {
      const d = fromIso(h.date);
      const card = document.createElement("article");
      card.className = "history-item";
      card.innerHTML = `
        <div class="item-top">
          <span class="item-title">${longDate(d)}</span>
          <span class="badge badge--ok">${h.attendance} · ${h.status}</span>
        </div>
        <div class="item-meta">
          <span>Dokter: <strong>${h.doctor}</strong></span>
          <span>Lokasi: <strong>${h.poli}</strong></span>
          <span>No. Antrean: <strong>${h.queue}</strong></span>
        </div>
        <div class="vitals-row">
          <span class="vital-pill">Tekanan Darah: <strong>${h.td}</strong></span>
          <span class="vital-pill">Gula Darah: <strong>${h.gdp}</strong></span>
          <span class="vital-pill">Kolesterol: <strong>${h.chol}</strong></span>
        </div>
        <p>${h.note}</p>`;
      el.historyList.appendChild(card);
    });
  }

  /* ---------- Render Hasil Pemeriksaan Terakhir ---------- */
  function renderHasil() {
    const p = getCurrentPatient();
    const ex = p.latestExam;
    if (!ex) {
      el.latestExamBox.innerHTML = `<p>Belum ada data hasil pemeriksaan.</p>`;
      return;
    }
    const recDate = p.adviceDate ? longDate(fromIso(p.adviceDate)) : longDate(defaultRecommended);
    el.latestExamBox.innerHTML = `
      <div class="exam-decision">
        <div class="item-top">
          <strong>Keputusan Medis Dokter: Perlu Kontrol Lanjutan</strong>
          <span class="badge badge--ocean">${p.doctor} · Pemeriksaan ${longDate(fromIso(ex.date))}</span>
        </div>
        <p>Rekomendasi jadwal kontrol berikutnya: <strong>${recDate}</strong></p>
      </div>
      <div class="trend-grid">
        <div class="trend-card">
          <span class="trend-card__label">Tekanan Darah</span>
          <strong class="trend-card__val">${ex.td}</strong>
          <span class="trend-card__note">Target lansia PTM: &lt;140/90 mmHg</span>
        </div>
        <div class="trend-card">
          <span class="trend-card__label">Gula Darah Puasa</span>
          <strong class="trend-card__val">${ex.gdp}</strong>
          <span class="trend-card__note">Target terkendali: 80–130 mg/dL</span>
        </div>
        <div class="trend-card">
          <span class="trend-card__label">Kolesterol &amp; Fisik</span>
          <strong class="trend-card__val">${ex.chol}</strong>
          <span class="trend-card__note">BB/TB: ${ex.bbTb}</span>
        </div>
      </div>
      <div class="history-item">
        <span class="item-title">Catatan Evaluasi Dokter (${p.doctor})</span>
        <p>${ex.note}</p>
      </div>`;
  }

  /* ---------- Render Fitur 1: Reminder Kontrol (Notifikasi Pasien) ---------- */
  function renderNotifikasi() {
    const p = getCurrentPatient();
    const b = getPatientBooking(p.id);
    const recDate = p.adviceDate ? fromIso(p.adviceDate) : defaultRecommended;
    const sentDate = p.reminderSentAt ? fromIso(p.reminderSentAt) : addDays(today, -1);

    el.notifList.innerHTML = "";

    if (b) {
      const bDate = fromIso(b.date);
      const h3Date = addDays(bDate, -3);
      const itemH3 = document.createElement("article");
      itemH3.className = "notif-item notif-item--unread";
      itemH3.innerHTML = `
        <div class="item-top">
          <span class="item-title">Reminder Jadwal Kontrol H-3 (Nomor Antrean ${b.queue})</span>
          <span class="badge badge--info">Pengingat Jadwal Terbooking</span>
        </div>
        <p>Yth. <strong>${p.name}</strong>, kami mengingatkan jadwal kontrol medis Anda di Poli PTM pada <strong>${longDate(bDate)} pukul ${b.start} – ${b.end} WIB</strong> bersama <strong>${p.doctor}</strong>. Nomor Antrean Anda adalah <strong>${b.queue}</strong> (${estimateArrival(b.slotId, b.orderInSlot || 3)}).</p>
        <div class="item-meta">
          <span>Jadwal Pengingat H-3: <strong>${longDate(h3Date)}</strong></span>
          <span>Pengirim: <strong>${p.reminderBy || "Petugas Admin Poli PTM"}</strong></span>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-sm" data-go-booking="true">Lihat Karcis Nomor Antrean</button>
        </div>`;
      el.notifList.appendChild(itemH3);
    }

    const itemDaftar = document.createElement("article");
    itemDaftar.className = `notif-item ${!b ? "notif-item--unread" : ""}`;
    itemDaftar.innerHTML = `
      <div class="item-top">
        <span class="item-title">Reminder Kontrol: Pengingat Pendaftaran Jadwal Kontrol</span>
        <span class="badge ${b ? "badge--ok" : "badge--warn"}">${b ? "Selesai · Sudah Booking" : "Perlu Perhatian · Belum Booking"}</span>
      </div>
      <p>Yth. <strong>${p.name}</strong>, berdasarkan hasil pemeriksaan <strong>${p.doctor}</strong>, Anda direkomendasikan melakukan kontrol rutin pada <strong>${longDate(recDate)}</strong>. Notifikasi ini dikirimkan agar Anda tidak lupa dan tidak terlewat jadwal kontrol medis.</p>
      <div class="item-meta">
        <span>Dikirim: <strong>${longDate(sentDate)}</strong></span>
        <span>Oleh: <strong>${p.reminderBy || "Petugas Admin Poli PTM"}</strong></span>
        <span>Frekuensi Pengingat: <strong>${p.reminderCount || 1}x dikirim</strong></span>
      </div>
      ${
        !b
          ? `<div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-go-booking="true">Pilih &amp; Booking Jadwal Kontrol Sekarang</button></div>`
          : ""
      }`;
    el.notifList.appendChild(itemDaftar);

    $$("[data-go-booking]", el.notifList).forEach((btn) => {
      btn.addEventListener("click", () => setPatientView("booking"));
    });
  }

  /* ---------- Render Login Ringkas Pasien ---------- */
  function renderLoginView() {
    el.loginError.hidden = true;
    el.quickPatientList.innerHTML = "";

    state.patients.forEach((p) => {
      const b = getPatientBooking(p.id);
      let statusBadge = "";
      if (p.accountStatus === "active") {
        statusBadge = `<span class="badge badge--ok">Aktif · Siap Langsung Pakai</span>`;
      } else if (p.accountStatus === "pending") {
        statusBadge = `<span class="badge badge--warn">Menunggu Aktivasi Admin</span>`;
      } else {
        statusBadge = `<span class="badge badge--danger">Jalur Rujukan BPJS (Tidak Aktif Booking)</span>`;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-card";
      btn.innerHTML = `
        <div class="item-top">
          <span class="quick-card__name">${p.name}</span>
          ${statusBadge}
        </div>
        <span class="quick-card__sub">Tgl Lahir: <strong>${p.dob}</strong> · ${p.rm} (${p.bpjs})</span>
        <span class="quick-card__sub">${
          b ? `Sudah Booking: Antrean No. ${b.queue} (${b.date})` : p.accountStatus === "active" ? "Belum booking jadwal" : "Klik untuk uji validasi akses"
        }</span>`;

      btn.addEventListener("click", () => {
        el.loginName.value = p.name;
        el.loginDob.value = p.dob;
        attemptPatientLogin(p.name, p.dob);
      });

      el.quickPatientList.appendChild(btn);
    });
  }

  async function attemptPatientLogin(nameInput, dobInput) {
    const cleanName = nameInput.trim().toLowerCase();
    if (!cleanName) {
      el.loginError.textContent = "Mohon masukkan Nama Lengkap pasien.";
      el.loginError.hidden = false;
      return;
    }

    const apiRes = await apiRequest("POST", "/auth/patient-login", {
      name: nameInput.trim(),
      dob: dobInput,
    });

    if (!apiRes.offline && apiRes.data) {
      if (!apiRes.ok) {
        el.loginError.textContent = apiRes.data.message || "Gagal memverifikasi akun pasien.";
        el.loginError.hidden = false;
        return;
      }
      state.currentPatientId = apiRes.data.patientId;
      selectedDate = null;
      selectedSlot = null;
      setPatientView("booking");
      toast(apiRes.data.message || "Selamat datang. Akun Anda aktif dan siap digunakan.");
      return;
    }

    const found = state.patients.find(
      (p) => p.name.toLowerCase().includes(cleanName) && (!dobInput || p.dob === dobInput)
    );

    if (!found) {
      el.loginError.textContent =
        "Data pasien tidak ditemukan di database. Pastikan pasien telah diregistrasi secara resmi oleh Admin Poli PTM.";
      el.loginError.hidden = false;
      return;
    }

    if (found.accountStatus === "referred") {
      el.loginError.textContent = `Akses booking ditolak (BR-01): ${found.name} berada pada jalur Surat Rujukan BPJS (${found.referralNo || "RS Rujukan"}). Akun kontrol tidak diaktifkan; silakan hubungi loket rujukan.`;
      el.loginError.hidden = false;
      return;
    }

    if (found.accountStatus !== "active") {
      el.loginError.textContent = `Akun ${found.name} sudah terdata di database namun belum diaktifkan. Silakan buka Panel Admin → menu "Aktivasi Akun" untuk mengaktifkan akun agar siap langsung pakai.`;
      el.loginError.hidden = false;
      return;
    }

    state.currentPatientId = found.id;
    selectedDate = null;
    selectedSlot = null;
    setPatientView("booking");
    toast(`Selamat datang, ${found.name}. Akun Anda aktif dan siap digunakan.`);
  }

  /* ---------- Render Panel Admin (Fitur 6, 7, 8 + Kirim Reminder) ---------- */
  function renderAdminDashboard() {
    const totalPatients = state.patients.length;
    const activeAccounts = state.patients.filter((p) => p.accountStatus === "active").length;
    const pendingAccounts = state.patients.filter((p) => p.accountStatus === "pending").length;

    const totalBookings = state.bookings.length;
    const presentCount = state.bookings.filter((b) => b.attendance === "present").length;
    const absentCount = state.bookings.filter((b) => b.attendance === "absent").length;
    const verifiedTotal = presentCount + absentCount;
    const participationRate =
      verifiedTotal > 0 ? Math.round((presentCount / verifiedTotal) * 100) : 100;

    const dailyTotalCapacity = SLOTS.length * CAPACITY; // 50 slot per hari
    const activeSlotUsed = state.bookings.filter((b) => b.attendance !== "absent").length;
    const availSlots = Math.max(0, dailyTotalCapacity - activeSlotUsed);

    el.kpiTotalPatients.textContent = String(totalPatients);
    el.kpiActiveAccounts.textContent = String(activeAccounts);
    el.kpiPendingAccounts.textContent = `${pendingAccounts} menunggu aktivasi`;
    el.kpiSlotAvail.textContent = `${availSlots} / ${dailyTotalCapacity}`;
    el.kpiBookedCount.textContent = `${activeSlotUsed} slot antrean terisi`;
    el.kpiAttendanceRate.textContent = `${participationRate}%`;
    el.kpiAttendanceDetail.textContent = `${presentCount} hadir · ${absentCount} tidak hadir · ${totalBookings - verifiedTotal} menunggu`;

    // 1. Render Verifikasi Kehadiran Pasien & Evaluasi Slot Antrean (Fitur 8)
    el.slotEvalBar.innerHTML = `
      <div>
        <strong>Evaluasi Slot &amp; Kedatangan:</strong>
        Dari <strong>${totalBookings} pasien</strong> yang melakukan booking jadwal kontrol,
        <strong>${presentCount} pasien hadir</strong>,
        <strong>${absentCount} tidak hadir (slot dibuka kembali)</strong>, dan
        <strong>${totalBookings - verifiedTotal} menunggu verifikasi kedatangan</strong>.
      </div>
      <span class="badge badge--ocean">Efektivitas Slot Terjaga · Partisipasi ${participationRate}%</span>`;

    el.adminAttendanceList.innerHTML = "";
    if (state.bookings.length === 0) {
      el.adminAttendanceList.innerHTML = `
        <div class="admin-card">
          <p>Belum ada pasien yang melakukan booking jadwal kontrol. Silakan lakukan booking dari tampilan Pasien untuk menguji verifikasi kehadiran.</p>
        </div>`;
    } else {
      state.bookings.forEach((b) => {
        const p = state.patients.find((x) => x.id === b.patientId) || {
          name: "Pasien",
          rm: "-",
          bpjs: "BPJS",
          doctor: "dr. Ahmad Fauzi",
        };
        const d = fromIso(b.date);
        const badgeHtml =
          b.attendance === "present"
            ? `<span class="badge badge--ok">Hadir Terverifikasi (${b.verifiedAt || "Loket"})</span>`
            : b.attendance === "absent"
            ? `<span class="badge badge--danger">Tidak Hadir / No-Show (Slot Dibebaskan)</span>`
            : `<span class="badge badge--warn">Menunggu Kedatangan Pasien</span>`;

        const card = document.createElement("article");
        card.className = "admin-card";
        card.innerHTML = `
          <div class="item-top">
            <span class="item-title">Antrean No. ${b.queue} · ${p.name} (${p.rm})</span>
            ${badgeHtml}
          </div>
          <div class="item-meta">
            <span>Jadwal Kontrol: <strong>${longDate(d)}</strong></span>
            <span>Sesi Jam: <strong>${b.start} – ${b.end} WIB</strong></span>
            <span>Estimasi Datang: <strong>${estimateArrival(b.slotId, b.orderInSlot || 3)}</strong></span>
            <span>Kepesertaan: <strong>${p.bpjs}</strong></span>
          </div>
          <div class="admin-card__actions">
            <button type="button" class="btn btn-ok btn-sm" data-verify-id="${b.id}" data-status="present" ${b.attendance === "present" ? "disabled" : ""}>
              <svg class="ic"><use href="#i-check"/></svg><span>Verifikasi Hadir</span>
            </button>
            <button type="button" class="btn btn-line-danger btn-sm" data-verify-id="${b.id}" data-status="absent" ${b.attendance === "absent" ? "disabled" : ""}>
              <span>Tandai Tidak Hadir (Bebaskan Slot)</span>
            </button>
            ${
              b.attendance !== "pending"
                ? `<button type="button" class="btn btn-quiet btn-sm" data-verify-id="${b.id}" data-status="pending">Reset Status</button>`
                : ""
            }
          </div>`;
        el.adminAttendanceList.appendChild(card);
      });
    }

    $$("[data-verify-id]", el.adminAttendanceList).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const bId = btn.dataset.verifyId;
        const newStatus = btn.dataset.status;
        const b = state.bookings.find((x) => x.id === bId);
        if (!b) return;
        const p = state.patients.find((x) => x.id === b.patientId);

        const apiRes = await apiRequest("PATCH", `/admin/bookings/${encodeURIComponent(bId)}/attendance`, {
          status: newStatus,
        });

        if (apiRes.offline) {
          b.attendance = newStatus;
          const now = new Date();
          b.verifiedAt = `${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")} WIB`;
          b.verifiedBy = "Admin Poli PTM";
          saveState();
        }
        renderAll();
        if (newStatus === "present") {
          toast(`Kehadiran ${p ? p.name : "pasien"} (Antrean ${b.queue}) berhasil diverifikasi HADIR.`);
        } else if (newStatus === "absent") {
          toast(`Pasien ditandai TIDAK HADIR. Slot antrean telah diperbarui untuk menjaga efektivitas kuota.`);
        } else {
          toast(`Status kehadiran direset menjadi menunggu kedatangan.`);
        }
      });
    });

    // 2. Render Aktivasi Akun Pasien (Fitur 7)
    el.adminActivationList.innerHTML = "";
    state.patients.forEach((p) => {
      let badgeHtml = "";
      if (p.accountStatus === "active") {
        badgeHtml = `<span class="badge badge--ok">Akun Aktif · Siap Langsung Pakai</span>`;
      } else if (p.accountStatus === "pending") {
        badgeHtml = `<span class="badge badge--warn">Menunggu Aktivasi Akun</span>`;
      } else {
        badgeHtml = `<span class="badge badge--danger">Status: Rujuk (Tidak Dibuatkan Akun Kontrol)</span>`;
      }

      const card = document.createElement("article");
      card.className = "admin-card";
      card.innerHTML = `
        <div class="item-top">
          <span class="item-title">${p.name} · ${p.rm}</span>
          ${badgeHtml}
        </div>
        <div class="item-meta">
          <span>Tanggal Lahir (Kredensial Masuk): <strong>${p.dob}</strong></span>
          <span>Telepon/WA: <strong>${p.phone}</strong></span>
          <span>Kepesertaan: <strong>${p.bpjs}</strong></span>
          <span>Keputusan Dokter: <strong>${p.decision === "kontrol" ? "Perlu Kontrol Lanjutan" : `Perlu Rujukan (${p.referralNo || "RS Rujukan"})`}</strong></span>
        </div>
        <p>${
          p.accountStatus === "active"
            ? `Akun sudah diaktifkan oleh admin. Pasien lansia tinggal langsung pakai masuk menggunakan Nama (${p.name}) + Tanggal Lahir (${p.dob}).`
            : p.accountStatus === "pending"
            ? `Data pasien sudah tervalidasi di database. Klik "Aktifkan Akun (Siap Pakai)" agar pasien dapat langsung menggunakan aplikasi tanpa kendala teknis pendaftaran.`
            : `Sesuai BR-01 & FR-02, pasien dengan keputusan rujukan dokter tidak diaktifkan akun booking kontrolnya.`
        }</p>
        <div class="admin-card__actions">
          ${
            p.decision === "kontrol" && p.accountStatus !== "active"
              ? `<button type="button" class="btn btn-primary btn-sm" data-activate-id="${p.id}">
                   <svg class="ic"><use href="#i-shield"/></svg><span>Aktifkan Akun (Siap Langsung Pakai)</span>
                 </button>`
              : ""
          }
          ${
            p.accountStatus === "active"
              ? `<button type="button" class="btn btn-quiet btn-sm" data-use-patient="${p.id}">
                   <svg class="ic"><use href="#i-user"/></svg><span>Buka Tampilan Pasien Ini</span>
                 </button>`
              : ""
          }
        </div>`;
      el.adminActivationList.appendChild(card);
    });

    $$("[data-activate-id]", el.adminActivationList).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const p = state.patients.find((x) => x.id === btn.dataset.activateId);
        if (!p) return;
        const apiRes = await apiRequest("PATCH", `/admin/patients/${encodeURIComponent(p.id)}/activate`);
        if (apiRes.offline) {
          p.accountStatus = "active";
          p.reminderSentAt = iso(today);
          p.reminderBy = "Admin Poli PTM";
          p.reminderCount = (p.reminderCount || 0) + 1;
          saveState();
        }
        renderAll();
        toast(`Akun ${p.name} berhasil DIAKTIFKAN dan siap langsung pakai!`);
      });
    });

    $$("[data-use-patient]", el.adminActivationList).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.currentPatientId = btn.dataset.usePatient;
        selectedDate = null;
        selectedSlot = null;
        setPatientView("booking");
        const p = getCurrentPatient();
        toast(`Beralih ke tampilan pasien: ${p.name}`);
      });
    });

    // 3. Render Kirim Reminder Kontrol (Fitur 1 - Sisi Admin)
    el.adminReminderList.innerHTML = "";
    state.patients
      .filter((p) => p.decision === "kontrol" && p.accountStatus === "active")
      .forEach((p) => {
        const b = getPatientBooking(p.id);
        const recDate = p.adviceDate ? longDate(fromIso(p.adviceDate)) : longDate(defaultRecommended);
        const stageBadge = b
          ? `<span class="badge badge--info">Tahap 2: Pengingat Jadwal H-3 (Sudah Booking Antrean ${b.queue})</span>`
          : `<span class="badge badge--warn">Tahap 1: Pengingat Daftar Kontrol (Belum Booking)</span>`;

        const card = document.createElement("article");
        card.className = "admin-card";
        card.innerHTML = `
          <div class="item-top">
            <span class="item-title">${p.name} (${p.phone})</span>
            ${stageBadge}
          </div>
          <div class="item-meta">
            <span>Instruksi Dokter (${p.doctor}): <strong>Rekomendasi Kontrol ${recDate}</strong></span>
            <span>Terakhir Diingatkan: <strong>${p.reminderSentAt ? longDate(fromIso(p.reminderSentAt)) : "Belum pernah"} (${p.reminderCount || 0}x)</strong></span>
          </div>
          <p>${
            b
              ? `Pasien telah memesan jadwal pada ${longDate(fromIso(b.date))} (${b.start}–${b.end} WIB) dengan Nomor Antrean ${b.queue}. Kirim Reminder H-3 agar pasien tidak lupa hadir.`
              : `Pasien belum memesan jadwal kontrol. Kirim Reminder Daftar agar pasien yang pelupa mendapat perhatian notifikasi dan segera menetapkan waktu kontrol.`
          }</p>
          <div class="admin-card__actions">
            <button type="button" class="btn btn-primary btn-sm" data-send-reminder="${p.id}">
              <svg class="ic"><use href="#i-send"/></svg><span>Kirim Notifikasi Reminder Kontrol Sekarang</span>
            </button>
            <button type="button" class="btn btn-quiet btn-sm" data-preview-reminder="${p.id}">
              <span>Lihat Notifikasi di Layar Pasien</span>
            </button>
          </div>`;
        el.adminReminderList.appendChild(card);
      });

    $$("[data-send-reminder]", el.adminReminderList).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const p = state.patients.find((x) => x.id === btn.dataset.sendReminder);
        if (!p) return;
        const apiRes = await apiRequest("POST", `/admin/patients/${encodeURIComponent(p.id)}/reminders`);
        if (apiRes.offline) {
          p.reminderSentAt = iso(today);
          p.reminderBy = "Petugas Admin Poli PTM";
          p.reminderCount = (p.reminderCount || 0) + 1;
          saveState();
        }
        renderAll();
        toast(`Notifikasi Reminder Kontrol berhasil dikirim kepada ${p.name} (${p.phone}).`);
      });
    });

    $$("[data-preview-reminder]", el.adminReminderList).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.currentPatientId = btn.dataset.previewReminder;
        setPatientView("notifikasi");
      });
    });
  }

  /* ---------- Render Utama ---------- */
  function renderAll() {
    const isPatient = state.currentRole === "patient";
    const isAdmin = state.currentRole === "admin";
    const isLogin = state.currentRole === "login";

    // Tampilkan View Utama yang sesuai
    el.patientApp.hidden = !isPatient;
    el.adminApp.hidden = !isAdmin;
    el.loginApp.hidden = !isLogin;

    // 1. Role-based Navbar Header
    if (isLogin) {
      // Di Halaman Login: sembunyikan menu internal (Jadwal, Riwayat, Reminder)
      el.patientNav.hidden = true;
      el.adminNav.hidden = true;
      el.mobileTabbar.hidden = true;

      el.roleBadge.textContent = "MASUK";
      el.roleBadge.className = "brand__tag is-login";

      // Di mode login: tampilkan tombol pintasan Panel Admin dan sembunyikan tombol logout/exit
      el.switchRoleBtn.hidden = false;
      el.logoutBtn.hidden = true;
      el.exitAdminBtn.hidden = true;
    } else if (isAdmin) {
      // Di Mode Admin: tampilkan menu khusus admin dan tombol Keluar / Mode Pasien di kanan atas
      el.patientNav.hidden = true;
      el.adminNav.hidden = false;
      el.mobileTabbar.hidden = true;

      el.roleBadge.textContent = "ADMIN";
      el.roleBadge.className = "brand__tag is-admin";

      el.switchRoleBtn.hidden = true;
      el.logoutBtn.hidden = true;
      el.exitAdminBtn.hidden = false;
    } else {
      // Di Mode Pasien: tampilkan menu pasien
      el.patientNav.hidden = false;
      el.adminNav.hidden = true;
      el.mobileTabbar.hidden = false;

      el.roleBadge.textContent = "PASIEN";
      el.roleBadge.className = "brand__tag";

      el.switchRoleBtn.hidden = false;
      el.logoutBtn.hidden = false;
      el.exitAdminBtn.hidden = true;
    }

    if (isPatient) {
      // Subviews pasien
      const v = state.currentPatientView || "booking";
      el.viewBooking.hidden = v !== "booking";
      el.viewRiwayat.hidden = v !== "riwayat";
      el.viewNotifikasi.hidden = v !== "notifikasi";

      // Sorot menu navigasi pasien yang aktif
      $$("[data-nav]", el.patientNav).forEach((link) => {
        const match = link.dataset.nav === v;
        link.classList.toggle("is-active", match);
        if (match) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      // Mobile tabbar
      $$("[data-nav]", el.mobileTabbar).forEach((link) => {
        const match = link.dataset.nav === v;
        link.classList.toggle("is-active", match);
        if (match) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      renderPatientHeader();
      renderDates();
      renderSlots();
      renderSummary();
      renderBookingState();
      renderRiwayat();
      renderHasil();
      renderNotifikasi();
    } else if (isLogin) {
      renderLoginView();
    } else if (isAdmin) {
      const av = state.currentAdminView || "kehadiran";
      $("#admin-view-kehadiran").hidden = av !== "kehadiran";
      $("#admin-view-registrasi").hidden = av !== "registrasi";
      $("#admin-view-aktivasi").hidden = av !== "aktivasi";
      $("#admin-view-reminder").hidden = av !== "reminder";

      // Update menu admin (di navbar dan di grid tab 2x2)
      $$("[data-admin-nav]").forEach((item) => {
        const active = item.dataset.adminNav === av;
        item.classList.toggle("is-active", active);
        if (item.tagName === "A") {
          if (active) item.setAttribute("aria-current", "page");
          else item.removeAttribute("aria-current");
        }
      });

      if (!el.regAdviceDate.value) {
        el.regAdviceDate.value = iso(defaultRecommended);
      }
      renderAdminDashboard();
    }
  }

  /* ---------- Event Listeners ---------- */
  // Navigasi Subview Pasien
  $$("[data-nav]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setPatientView(link.dataset.nav);
    });
  });

  // Navigasi Subview Admin
  $$("[data-admin-nav]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      setAdminView(item.dataset.adminNav);
    });
  });

  // Tombol Pintasan Panel Admin (Header)
  el.switchRoleBtn.addEventListener("click", () => {
    setRole("admin");
    toast("Beralih ke Panel Petugas Admin Poli PTM.");
  });

  // Tombol Keluar dari Mode Admin
  el.exitAdminBtn.addEventListener("click", () => {
    setRole("patient");
    toast("Kembali ke Tampilan Pasien.");
  });

  // Tombol Ganti Pasien (Mode Pasien)
  el.logoutBtn.addEventListener("click", () => {
    setRole("login");
    toast("Membuka Halaman Masuk Pasien.");
  });

  el.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    attemptPatientLogin(el.loginName.value, el.loginDob.value);
  });

  // Pilih Tanggal & Slot Jam (Fitur 2 & 5: Lihat & Booking Jadwal Kontrol)
  el.dates.addEventListener("change", (e) => {
    if (e.target.name !== "date") return;
    selectedDate = fromIso(e.target.value);
    selectedSlot = null;
    renderSlots();
    renderSummary();
  });

  el.slots.addEventListener("change", (e) => {
    if (e.target.name !== "slot") return;
    selectedSlot = SLOTS.find((s) => s.id === e.target.value);
    renderSummary();
  });

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) return;

    const p = getCurrentPatient();
    const idx = SLOTS.indexOf(selectedSlot);
    const left = remaining(selectedDate, idx);
    if (left === 0) {
      el.error.textContent = "Maaf, slot jam ini baru saja penuh untuk mencegah penumpukan pasien. Silakan pilih jam lain.";
      el.error.hidden = false;
      return;
    }

    el.submit.disabled = true;
    el.submit.classList.add("is-loading");
    const labelSpan = $("span", el.submit);
    const iconUse = $("use", el.submit);
    labelSpan.textContent = "Memproses Booking & Nomor Antrean…";
    iconUse.setAttribute("href", "#i-clock");

    const apiRes = await apiRequest("POST", "/bookings", {
      patientId: p.id,
      date: iso(selectedDate),
      slotId: selectedSlot.id,
    });

    if (!apiRes.offline && apiRes.data) {
      el.submit.classList.remove("is-loading");
      labelSpan.textContent = "Booking Jadwal Kontrol";
      iconUse.setAttribute("href", "#i-check");

      if (!apiRes.ok) {
        el.error.textContent = apiRes.data.message || "Gagal memproses booking.";
        el.error.hidden = false;
        el.submit.disabled = false;
        return;
      }

      renderBookingState({ animate: true });
      el.ticket.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      el.ticket.focus({ preventScroll: true });
      toast(apiRes.data.message || `Booking berhasil! Nomor Antrean Anda ${apiRes.data.queue}.`);
      return;
    }

    setTimeout(() => {
      const orderInSlot = CAPACITY - left + 1;
      const queue = String(idx * CAPACITY + orderInSlot).padStart(2, "0");

      // Hapus booking lama pasien ini jika ada, lalu simpan booking baru
      state.bookings = state.bookings.filter((b) => b.patientId !== p.id);
      state.bookings.unshift({
        id: `b-${Date.now()}`,
        patientId: p.id,
        date: iso(selectedDate),
        slotId: selectedSlot.id,
        start: selectedSlot.start,
        end: selectedSlot.end,
        part: selectedSlot.part,
        queue,
        orderInSlot,
        attendance: "pending",
      });
      saveState();

      el.submit.classList.remove("is-loading");
      labelSpan.textContent = "Booking Jadwal Kontrol";
      iconUse.setAttribute("href", "#i-check");

      renderBookingState({ animate: true });
      el.ticket.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      el.ticket.focus({ preventScroll: true });
      toast(`Booking berhasil! Nomor Antrean Anda ${queue}.`);
    }, 350);
  });

  // Pembatalan Booking
  el.openCancel.addEventListener("click", () => {
    const p = getCurrentPatient();
    const b = getPatientBooking(p.id);
    if (!b) return;
    el.cancelText.textContent = `Jadwal kontrol Anda pada ${longDate(fromIso(b.date))} pukul ${b.start} WIB akan dibatalkan dan Nomor Antrean ${b.queue} akan dilepas kembali ke kuota tersedia.`;
    el.dialog.showModal();
  });

  el.dialog.addEventListener("close", async () => {
    if (el.dialog.returnValue !== "cancel") return;
    const p = getCurrentPatient();
    const apiRes = await apiRequest("DELETE", `/bookings/${encodeURIComponent(p.id)}`);
    if (apiRes.offline) {
      state.bookings = state.bookings.filter((b) => b.patientId !== p.id);
      saveState();
    }
    selectedDate = null;
    selectedSlot = null;
    el.form.reset();
    renderDates();
    renderSlots();
    renderSummary();
    renderBookingState();
    el.booking.focus();
    toast("Jadwal kontrol dibatalkan. Kuota slot telah dikembalikan.");
  });

  // Form Registrasi Pasien oleh Admin (Fitur 6 & 7: Registrasi & Aktivasi Akun)
  el.regDecision.addEventListener("change", () => {
    const isRujuk = el.regDecision.value === "rujuk";
    el.regAdviceWrap.hidden = isRujuk;
    el.regAutoActivate.disabled = isRujuk;
    if (isRujuk) el.regAutoActivate.checked = false;
    else el.regAutoActivate.checked = true;
  });

  el.adminRegForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.regError.hidden = true;

    const name = el.regName.value.trim();
    const dob = el.regDob.value;
    const rm = el.regRm.value.trim();
    const phone = el.regPhone.value.trim();
    const bpjs = el.regBpjs.value;
    const decision = el.regDecision.value;
    const adviceDate = el.regAdviceDate.value || iso(defaultRecommended);
    const vital = el.regVital.value.trim() || "Pemeriksaan awal PTM tercatat.";
    const autoActivate = el.regAutoActivate.checked;

    if (!name || !dob || !rm || !phone) {
      el.regError.textContent = "Mohon lengkapi Nama Lengkap, Tanggal Lahir, Nomor Rekam Medis/NIK, dan Nomor Telepon pasien.";
      el.regError.hidden = false;
      return;
    }

    const apiRes = await apiRequest("POST", "/admin/patients", {
      name,
      dob,
      rm,
      phone,
      bpjs,
      decision,
      adviceDate,
      vital,
      autoActivate,
    });

    if (!apiRes.offline && apiRes.data) {
      if (!apiRes.ok) {
        el.regError.textContent = apiRes.data.message || "Gagal menyimpan data pasien.";
        el.regError.hidden = false;
        return;
      }

      el.adminRegForm.reset();
      el.regDob.value = "1957-04-15";
      el.regAdviceDate.value = iso(defaultRecommended);
      el.regAutoActivate.checked = true;

      setAdminView("aktivasi");
      toast(apiRes.data.message);
      return;
    }

    // Fallback offline jika backend tidak aktif
    const duplicate = state.patients.some(
      (p) => p.rm.toLowerCase() === rm.toLowerCase() || (p.name.toLowerCase() === name.toLowerCase() && p.dob === dob)
    );
    if (duplicate) {
      el.regError.textContent = "Data pasien dengan Nomor Rekam Medis atau kombinasi Nama + Tanggal Lahir tersebut sudah terdaftar di database.";
      el.regError.hidden = false;
      return;
    }

    const accountStatus =
      decision === "rujuk" ? "referred" : autoActivate ? "active" : "pending";

    const newId = `p-${Date.now()}`;
    const newPatient = {
      id: newId,
      name,
      dob,
      rm,
      phone,
      bpjs,
      doctor: "dr. Ahmad Fauzi",
      decision,
      accountStatus,
      referralNo: decision === "rujuk" ? `SRJ/BPJS/2026/XI/${Math.floor(100 + Math.random() * 899)}` : null,
      adviceDate: decision === "kontrol" ? adviceDate : null,
      latestExam: {
        date: iso(today),
        td: "138/86 mmHg",
        gdp: "130 mg/dL",
        chol: "192 mg/dL",
        bbTb: "62 kg / 160 cm",
        note: vital,
      },
      reminderSentAt: accountStatus === "active" ? iso(today) : null,
      reminderBy: accountStatus === "active" ? "Petugas Admin Poli PTM" : null,
      reminderCount: accountStatus === "active" ? 1 : 0,
    };

    state.patients.unshift(newPatient);
    state.history[newId] = [
      {
        date: iso(today),
        doctor: "dr. Ahmad Fauzi",
        poli: "Poli PTM",
        queue: "01",
        attendance: "Hadir Pemeriksaan Awal",
        td: "138/86 mmHg",
        gdp: "130 mg/dL",
        chol: "192 mg/dL",
        status: decision === "kontrol" ? "Perlu Kontrol Rutin" : "Dirujuk Lanjutan",
        note: vital,
      },
    ];
    saveState();

    el.adminRegForm.reset();
    el.regDob.value = "1957-04-15";
    el.regAdviceDate.value = iso(defaultRecommended);
    el.regAutoActivate.checked = true;

    setAdminView("aktivasi");
    toast(
      accountStatus === "active"
        ? `Pasien ${name} berhasil diregistrasi ke database & akun langsung AKTIF siap pakai!`
        : `Pasien ${name} berhasil diregistrasi ke database dengan status: ${accountStatus}.`
    );
  });

  /* ---------- Pengatur Ukuran Huruf (Ramah Lansia) ---------- */
  const sizeBtns = $$(".textsize button");
  function applySize(size) {
    if (size === "md") delete document.documentElement.dataset.size;
    else document.documentElement.dataset.size = size;
    sizeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === size)));
    localStorage.setItem(STORE_SIZE, size);
  }
  sizeBtns.forEach((b) => b.addEventListener("click", () => applySize(b.dataset.size)));

  /* ---------- Parameter URL Demo ---------- */
  const params = new URLSearchParams(location.search);
  const demo = params.get("demo");
  if (demo === "reset") {
    state = createInitialState();
    saveState();
    apiRequest("POST", "/reset").then(() => renderAll());
  } else if (demo === "admin") {
    state.currentRole = "admin";
    saveState();
  }

  applySize(localStorage.getItem(STORE_SIZE) || "md");
  renderAll();
  syncFromBackend();
})();
