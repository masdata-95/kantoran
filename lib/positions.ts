export interface NPC {
  id: string
  initials: string
  avClass: string
  name: string
  role: string
  status: string
  statusDot: string
  bio: string
}

// ── LEVEL / JENJANG ───────────────────────────────
// Level dipilih user saat apply di job listing — TIDAK lagi dikunci ke background profil.
// Background hanya dipakai sebagai konteks cerita (CV user) dan default pilihan level.
export type LevelType = 'intern' | 'junior' | 'mid'

export const LEVEL_LABEL: Record<LevelType, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-Level',
}

export const LEVELS: { id: LevelType; label: string; desc: string }[] = [
  { id: 'intern', label: 'Intern',    desc: 'Magang untuk mahasiswa dan pemula' },
  { id: 'junior', label: 'Junior',    desc: 'Entry-level dengan tanggung jawab penuh' },
  { id: 'mid',    label: 'Mid-Level', desc: 'Berpengalaman, ekspektasi lebih tinggi' },
]

// Default level dari background profil (dipakai sebagai pre-select, bukan kunci)
export const LEVEL_FOR_BG: Record<string, LevelType> = {
  student: 'intern',
  fresh_grad: 'intern',
  jobseeker: 'junior',
  career_switch: 'mid',
}

// Terima nilai level baru, level lama ('intern_magang' sudah dilebur ke 'intern'),
// maupun key background lama (progress tersimpan sebelum sistem level)
export function normalizeLevel(v: string | undefined | null): LevelType {
  if (v && v in LEVEL_LABEL) return v as LevelType
  if (v === 'intern_magang') return 'intern'
  if (v && LEVEL_FOR_BG[v]) return LEVEL_FOR_BG[v]
  return 'intern'
}

export interface Position {
  title: string
  dept: string
  icon: string
  getRole: (level: string) => string
  reqs: string[]
  itx: string
  taskFile: string
  supervisor: NPC
  manager: NPC
  junior: NPC
  taskRubric: {
    mustFind: string[]
    goodToMention: string[]
  }
  taskTitle: string
  taskBody: string
  taskContext: string
  // Pertanyaan junior setelah task user approved — user gantian MENGAJARI
  // (protégé effect: mengajar = bentuk belajar terdalam, konten gratis via chat AI)
  teachBack: string
  // Task hari berikutnya, ditampilkan terkunci (teaser premium), tidak bisa diklik
  upcomingTasks: { day: number; title: string; teaser: string }[]
}

export const POSITIONS: Record<string, Position> = {
  data_analyst: {
    title: 'Data Analyst', dept: 'Data & Analytics', icon: '📊',
    getRole: (lv) => LEVEL_LABEL[normalizeLevel(lv)] + ' Data Analyst',
    reqs: ['Dasar Excel atau Google Sheets', 'Logika data dan angka', 'Baca dan interpretasi tabel', 'Nilai plus: pernah belajar SQL'],
    itx: 'analisis data, Excel, SQL, cara berpikir berbasis data',
    taskFile: 'task_data_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'RP', avClass: 'av-blue', name: 'Rizky Pratama',
      role: 'Senior Data Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 29 tahun. Lulusan Statistika ITS, 5 tahun di Vantara sejak fresh grad. Kerjaan pertama dan satu-satunya.
Pengalaman nyata: pernah stuck 3 hari debug pipeline karena satu spasi tersembunyi di CSV. Pernah kena marah Director karena dashboard crash pas presentasi ke client. Punya ritual kopi sebelum coding, tidak mau diganggu sampai kopi habis. Suka chess online, main sela-sela nunggu query panjang jalan.
Cara bicara: sangat singkat untuk non-teknikal. Demanding tapi fair. Kalau bagus, dia acknowledge. Kalau salah, langsung bilang.`
    },
    manager: {
      id: 'mgr', initials: 'DK', avClass: 'av-purple', name: 'Diana Kusuma',
      role: 'Manager Data & Analytics', status: '🔴 In Meeting', statusDot: 'bg-red-500',
      bio: `Perempuan 41 tahun. MBA INSEAD, ex-McKinsey. Strategic dan data-driven. Tidak micromanage. Jarang interact langsung dengan junior tapi genuinely peduli perkembangan tim. Anaknya sering protes dia kerja terus.`
    },
    junior: {
      id: 'jnr', initials: 'GA', avClass: 'av-amber', name: 'Galih Ananta',
      role: 'Junior Analyst · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 25 tahun. Fresh grad Binus, masuk 6 bulan lebih awal. Pernah hampir nangis pas Rizky bilang kerjanya "tidak memenuhi standar". Kost di Tebet, sering makan warteg sebelah. Suka Stardew Valley. Lagi jatuh cinta sama specialty coffee.`
    },
    taskRubric: {
      mustFind: ['format tanggal tidak konsisten', 'region null atau kosong', 'revenue Rp 0 dengan qty lebih dari 0', 'duplikat order_id', 'SKU tidak konsisten atau lowercase'],
      goodToMention: ['dampak ke total revenue atau laporan', 'jumlah baris bermasalah', 'rekomendasi tindak lanjut spesifik']
    },
    taskTitle: 'Cek Kualitas Data Penjualan Lumière Jan 2026',
    taskBody: 'File <strong>task_data_analyst.xlsx</strong> ada di Notion. Temukan semua issue kualitas data dan buat summary singkat.',
    taskContext: 'Tim Marketing butuh data ini untuk planning campaign Q2. Pastikan datanya bisa dipercaya sebelum dipakai.',
    teachBack: `eh btw, tadi kan task lo soal data kotor tuh. cara lo nemuin duplikat sama data aneh di Excel gimana sih? aku suka kelewatan mulu, ajarin dong versi simpelnya`,
    upcomingTasks: [
      { day: 2, title: 'Dashboard Penjualan untuk Rapat Direksi', teaser: 'Diana butuh dashboard dari data yang kamu bersihkan kemarin, dipresentasikan langsung ke jajaran direksi.' },
      { day: 3, title: 'Investigasi Anomali Region Timur', teaser: 'Penjualan Jawa Timur tiba-tiba anjlok 38%, dan tim Finance menemukan selisih pembayaran distributor di region yang sama. Rizky minta kamu cari tahu sebelum direksi bertanya duluan.' },
      { day: 5, title: 'Forecast Penjualan Q3', teaser: 'Budget semua tim bergantung pada angka forecast-mu. Salah sedikit, satu kantor merasakan akibatnya.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Rizky dan Diana menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  },

  marketing_analyst: {
    title: 'Marketing Analyst', dept: 'Marketing & Brand', icon: '📣',
    getRole: (lv) => LEVEL_LABEL[normalizeLevel(lv)] + ' Marketing Analyst',
    reqs: ['Konsep dasar marketing dan branding', 'Baca metrik campaign (CTR, conversion)', 'Consumer behavior dasar', 'Nilai plus: pernah kelola konten atau sosmed'],
    itx: 'marketing funnel, analisis campaign, consumer insight, brand positioning',
    taskFile: 'task_marketing_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'DP', avClass: 'av-blue', name: 'Dinda Pratiwi',
      role: 'Senior Marketing Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 28 tahun. Background komunikasi, self-taught di data dan analitik. Campaign pertama yang dia handle sendiri flop total, impresi tinggi tapi zero konversi. Belajar banyak dari situ. Masih suka impostor syndrome kadang. Hobi: jalan-jalan ke pasar, foto untuk Instagram pribadi, nonton film dokumenter.
Cara bicara: lebih warm dari Rizky tapi tetap high standard. Suka kasih konteks kenapa sesuatu penting untuk bisnis.`
    },
    manager: {
      id: 'mgr', initials: 'BK', avClass: 'av-purple', name: 'Budi Kurniawan',
      role: 'Marketing Director', status: '🟡 Away', statusDot: 'bg-yellow-500',
      bio: `Pria 45 tahun. 20 tahun di marketing FMCG. Old school tapi mau belajar digital. Tegas di meeting tapi sebenernya supportive ke anak muda.`
    },
    junior: {
      id: 'jnr', initials: 'AL', avClass: 'av-amber', name: 'Aldi Lesmana',
      role: 'Junior Marketing Analyst · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 24 tahun. Obsessed dengan tren sosmed dan pop culture, sering tahu viral content sebelum orang lain. Tapi juga sering overthinking soal kerjaan. Banyak emoji, jujur soal struggle.`
    },
    taskRubric: {
      mustFind: ['TikTok conversion rate rendah', 'Google Ads paling efektif dari sisi CTR dan conversion', 'campaign tanpa start date atau data tidak lengkap'],
      goodToMention: ['perbandingan CPA antar channel', 'rekomendasi alokasi budget Q1 2026', 'reasoning berbasis data bukan asumsi']
    },
    taskTitle: 'Analisis Performa Campaign Lumière Q4 2025',
    taskBody: 'File <strong>task_marketing_analyst.xlsx</strong> ada di Notion. Hitung CTR dan conversion rate tiap campaign, identifikasi yang terbaik dan terburuk.',
    taskContext: 'Budget Q1 akan diputuskan berdasarkan performa Q4 ini. Analisismu dipakai di rapat besok pagi.',
    teachBack: `eh mumpung lo baru ngerjain analisis campaign, jelasin dong bedanya CTR sama conversion rate. aku suka ketuker, malu nanya ke kak Dinda wkwk`,
    upcomingTasks: [
      { day: 2, title: 'Brief Campaign Lebaran Lumière', teaser: 'Budget Rp 2 miliar. Campaign terbesar tahun ini, dan Dinda mengajakmu masuk tim intinya.' },
      { day: 3, title: 'Krisis: Video Komplain Viral di TikTok', teaser: 'Video komplain produk Lumière menembus 800 ribu views semalam, dan asalnya dari region timur yang penjualannya sedang diselidiki tim Data. Seluruh tim menunggu rekomendasimu.' },
      { day: 5, title: 'A/B Test Landing Page Roots&Co', teaser: 'Dua versi, satu pemenang. Datamu yang menentukan ke mana budget mengalir.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Dinda dan Pak Budi menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  },

  finance_analyst: {
    title: 'Finance Analyst', dept: 'Finance & Accounting', icon: '💰',
    getRole: (lv) => LEVEL_LABEL[normalizeLevel(lv)] + ' Finance Analyst',
    reqs: ['Dasar laporan keuangan (P&L, neraca)', 'Konsep budgeting dan variance analysis', 'Teliti bekerja dengan angka', 'Nilai plus: pernah belajar akuntansi'],
    itx: 'laporan keuangan, budgeting, variance analysis, financial modeling dasar',
    taskFile: 'task_finance_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'AW', avClass: 'av-blue', name: 'Andi Wijaya',
      role: 'Senior Finance Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 31 tahun. CPA, background akuntansi. Pernah menemukan error senilai Rp 2 miliar di laporan karena satu formula salah, jadi legend di kantor. Dulu kerja sampai jam 11 malam setiap akhir bulan, sekarang sudah lebih baik manage ekspektasi. Hobi hiking dan masak.
Cara bicara: presisi dan terstruktur. Kalau ada yang salah, langsung bilang spesifik apa yang salah. Lebih warm kalau sudah kenal.`
    },
    manager: {
      id: 'mgr', initials: 'PH', avClass: 'av-purple', name: 'Pak Hendra',
      role: 'Finance Manager', status: '🔴 In Meeting', statusDot: 'bg-red-500',
      bio: `Pria 42 tahun. 15 tahun di Finance. Conservative, by-the-book, tapi fair. Jarang muncul kecuali ada hal penting.`
    },
    junior: {
      id: 'jnr', initials: 'NS', avClass: 'av-amber', name: 'Nisa Safitri',
      role: 'Junior Finance Analyst · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 25 tahun. Ex-accounting student yang ternyata lebih suka analytical work. Jujur soal betapa stressnya kerja Finance di quarter end. Casual dan supportive.`
    },
    taskRubric: {
      mustFind: ['Marketing overspending terbesar', 'Sales overspending signifikan', 'IT Digital juga overspending', 'total overspending keseluruhan'],
      goodToMention: ['perhitungan variance persen yang akurat', 'rekomendasi investigasi spesifik per departemen', 'next steps untuk CFO']
    },
    taskTitle: 'Review Budget Variance Q4 2025',
    taskBody: 'File <strong>task_finance_analyst.xlsx</strong> ada di Notion. Temukan departemen dengan overspending terbesar dan buat ringkasan untuk CFO.',
    taskContext: 'CFO minta laporan variance sebelum budget meeting minggu depan. Ini urgent.',
    teachBack: `eh lo kan baru ngerjain variance analysis. itu sebenernya ngitungnya gimana sih, terus kapan selisih dianggap wajar? jelasin dong, aku suka bingung pas ditanya bu CFO`,
    upcomingTasks: [
      { day: 2, title: 'Closing Akhir Bulan, Rekonsiliasi Kas', teaser: 'Hari paling menegangkan di Finance. Semua angka harus balance sebelum tengah malam.' },
      { day: 3, title: 'Selisih Rp 80 Juta, Temukan Sumbernya', teaser: 'Angka tidak balance dan CFO sudah bertanya dua kali. Jejaknya mengarah ke pembayaran distributor region timur, kasus yang juga sedang diselidiki tim Data. Andi menyerahkannya ke kamu.' },
      { day: 5, title: 'Proyeksi Cashflow 6 Bulan', teaser: 'Manajemen mau ekspansi. Proyeksimu yang menentukan apakah perusahaan sanggup atau tidak.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Andi dan Pak Hendra menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  },

  hr_generalist: {
    title: 'HR Generalist', dept: 'Human Resources', icon: '👥',
    getRole: (lv) => LEVEL_LABEL[normalizeLevel(lv)] + ' HR Generalist',
    reqs: ['Komunikasi verbal dan tulisan yang baik', 'Empati dan kemampuan mendengarkan', 'Konsep dasar rekrutmen', 'Nilai plus: pernah organise event atau kepanitiaan'],
    itx: 'proses rekrutmen, employee relations, people management, culture building',
    taskFile: 'task_hr_generalist.xlsx',
    supervisor: {
      id: 'sup', initials: 'BR', avClass: 'av-blue', name: 'Bu Ratna',
      role: 'Senior HR Business Partner · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 35 tahun. 10 tahun di HR. Pernah harus lay off 15 orang sekaligus karena restrukturisasi, pengalaman yang tidak pernah terlupakan. Orang-orang think HR itu enak karena banyak ngobrol. Padahal burnout di HR lebih tinggi dari yang dikira. Punya ritual journaling setiap malam untuk dekompresi.
Cara bicara: warm dan empatik, tapi tetap professional. Honest soal sisi gelap dunia HR.`
    },
    manager: {
      id: 'mgr', initials: 'TS', avClass: 'av-purple', name: 'Pak Tono',
      role: 'HR Manager', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 38 tahun. 12 tahun di HR. Lebih banyak di sisi compliance dan policy. Baik tapi sometimes too by-the-book.`
    },
    junior: {
      id: 'jnr', initials: 'LL', avClass: 'av-amber', name: 'Lili Cahyani',
      role: 'Junior HR · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 24 tahun. Masuk HR karena suka people, tapi realize kerjaan HR lebih banyak admin daripada yang dibayangkan. Jujur, relatable, kasih tips survival di HR.`
    },
    taskRubric: {
      mustFind: ['Eko Wibowo gugur karena pendidikan SMA tidak memenuhi syarat', 'Maya Laksmini kandidat terkuat secara teknikal dan komunikasi', 'Rina Setiawati kandidat kedua dengan pengalaman magang'],
      goodToMention: ['scoring berdasarkan rubrik yang objektif', 'alasan shortlist yang spesifik dan terukur', 'handling kandidat borderline seperti Sari']
    },
    taskTitle: 'CV Screening Junior Data Analyst, Batch 1',
    taskBody: 'File <strong>task_hr_generalist.xlsx</strong> ada di Notion. Screen 5 kandidat dan shortlist 2 terbaik untuk interview tahap berikutnya.',
    taskContext: 'Tim butuh shortlist ini sebelum akhir minggu. Interview tahap berikutnya sudah dijadwalkan minggu depan.',
    teachBack: `eh gimana sih cara lo scoring kandidat biar objektif? aku masih suka kebawa feeling pas screening, ajarin dong caranya`,
    upcomingTasks: [
      { day: 2, title: 'Interview Kandidat Pertamamu', teaser: 'Kali ini kamu yang duduk di kursi pewawancara. Kandidatnya dari shortlist yang kamu buat sendiri, calon Junior Data Analyst untuk tim Rizky.' },
      { day: 3, title: 'Exit Interview Mendadak', teaser: 'Salah satu performer terbaik tim mengajukan resign pagi ini. Bu Ratna minta kamu yang menangani.' },
      { day: 5, title: 'Susun Program Onboarding Batch Baru', teaser: '8 karyawan baru masuk bulan depan. Pengalaman hari pertama mereka ada di tanganmu.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Bu Ratna dan Pak Tono menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  },

  bizdev: {
    title: 'Business Development', dept: 'Komersial & Strategi', icon: '🚀',
    getRole: (lv) => ({ intern:'Intern BD', junior:'Junior BD Analyst', mid:'BD Associate' }[normalizeLevel(lv)]),
    reqs: ['Komunikasi dan presentasi yang kuat', 'Pemahaman dasar bisnis dan pasar', 'Analytical thinking', 'Nilai plus: pernah terlibat sales atau pitching'],
    itx: 'identifikasi peluang bisnis, evaluasi partnership, pitching, negosiasi, growth mindset',
    taskFile: 'task_bizdev.xlsx',
    supervisor: {
      id: 'sup', initials: 'RF', avClass: 'av-blue', name: 'Reza Firmansyah',
      role: 'BD Manager · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 33 tahun. Ex-startup founder yang gagal, lalu masuk corporate. Deal senilai Rp 2 miliar pernah gagal di menit terakhir karena satu klausa kontrak. Pernah pitch ke 12 calon partner dalam seminggu dan semua ditolak, minggu paling brutal dalam karirnya.
Cara bicara: energetik, big-picture thinker. Direct tapi charming. Honest soal failure dan rejection di BD.`
    },
    manager: {
      id: 'mgr', initials: 'PA', avClass: 'av-purple', name: 'Pak Anton',
      role: 'Commercial Director', status: '🟡 Away', statusDot: 'bg-yellow-500',
      bio: `Pria 47 tahun. Veteran FMCG. Calm under pressure. Jarang DM kecuali ada hal penting. Kalau muncul, biasanya ada agenda besar.`
    },
    junior: {
      id: 'jnr', initials: 'MR', avClass: 'av-amber', name: 'Mira Rahayu',
      role: 'Junior BD Analyst · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 25 tahun. Suka BD karena setiap hari berbeda. Tapi juga sering overwhelmed dengan target yang ambisius. Jujur, excited, dan relatable.`
    },
    taskRubric: {
      mustFind: ['UD Berkah Jaya tidak direkomendasikan karena 3x dispute', 'PT Maju Bersama teratas karena track record excellent dan kapasitas tinggi', 'PT Andalan Distribusi direkomendasikan karena coverage Papua yang strategis'],
      goodToMention: ['justifikasi scoring yang logis dan terukur', 'next steps yang konkret untuk top 3', 'risk consideration untuk setiap partner']
    },
    taskTitle: 'Evaluasi Peluang Partnership Distributor Regional',
    taskBody: 'File <strong>task_bizdev.xlsx</strong> ada di Notion. Evaluasi 6 calon partner dan shortlist 3 terbaik dengan justifikasi.',
    taskContext: 'Direktur Komersial butuh shortlist ini untuk roadshow partnership bulan depan. Jangan sampai rekomendasikan partner yang bermasalah.',
    teachBack: `eh lo tadi nge-rank calon partner pake kriteria apa aja sih? aku kalau disuruh gitu bingung mulai dari mana, share dong cara mikirnya`,
    upcomingTasks: [
      { day: 2, title: 'Meeting Follow-up PT Maju Bersama', teaser: 'Shortlist-mu dipakai. Sekarang kamu ikut meeting pertamanya, dan Reza memintamu yang membuka presentasi.' },
      { day: 3, title: 'Negosiasi: Partner Minta Diskon 25%', teaser: 'Term sheet hampir deal, lalu mereka menekan di menit terakhir. Mundur, atau cari jalan tengah?' },
      { day: 5, title: 'Riset Ekspansi Indonesia Timur', teaser: 'Pasar baru, data minim, potensi besar. Tapi laporan anomali region timur dari tim Data bikin Pak Anton ragu. Dia menunggu rekomendasi go atau no-go darimu.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Reza dan Pak Anton menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  },

  admin_ops: {
    title: 'Admin Operasional', dept: 'Operations & Sales Support', icon: '🗂️',
    getRole: (lv) => ({ intern: 'Intern Admin', junior: 'Admin Operasional', mid: 'Senior Admin Operasional' }[normalizeLevel(lv)]),
    reqs: ['Teliti dan rapi mengelola dokumen', 'Excel dasar (sort, filter, SUM)', 'Komunikasi tertulis yang jelas', 'Nilai plus: pernah pegang administrasi organisasi atau usaha'],
    itx: 'administrasi order dan invoice, arsip dokumen, rekap data, koordinasi antar tim',
    taskFile: 'task_admin_ops.xlsx',
    supervisor: {
      id: 'sup', initials: 'SW', avClass: 'av-blue', name: 'Mbak Sari Wulandari',
      role: 'Office & Admin Lead · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 33 tahun. Mulai dari resepsionis 10 tahun lalu, naik jadi Office & Admin Lead tanpa gelar S1, semua dari kerapian dan bisa dipercaya. Pernah menyelamatkan perusahaan saat audit karena satu-satunya yang arsipnya lengkap 5 tahun ke belakang. Hafal nomor PO seperti orang hafal lagu. Punya prinsip: kerjaan admin itu tidak kelihatan kalau benar, tapi satu kesalahan kecil kelihatan semua orang.
Cara bicara: ramah tapi tegas soal detail. Suka kasih konteks kenapa dokumen sekecil apa pun penting. Tidak suka jawaban "kayaknya".`
    },
    manager: {
      id: 'mgr', initials: 'DW', avClass: 'av-purple', name: 'Pak Darmawan',
      role: 'Operations Manager', status: '🟡 Away', statusDot: 'bg-yellow-500',
      bio: `Pria 44 tahun. 18 tahun di operations FMCG. Kalem, jarang bicara, tapi sekalinya menegur semua orang diam. Sangat menghargai orang yang kerjanya rapi tanpa disuruh.`
    },
    junior: {
      id: 'jnr', initials: 'FR', avClass: 'av-amber', name: 'Fajar Ramadhan',
      role: 'Junior Admin · Teman tim', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 23 tahun. Lulusan SMK, masuk 8 bulan lalu. Dulu kira kerjaan admin cuma fotokopi, ternyata pegang nadi operasional perusahaan. Sering kewalahan dokumen tapi nggak pernah ngeluh ke atasan, ngeluhnya ke teman. Suka futsal dan mie ayam depan kantor.`
    },
    taskRubric: {
      mustFind: ['ada invoice dobel (nomor invoice sama tercatat dua kali)', 'tagihan UD Berkah Jaya belum dibayar atau baru dibayar sebagian', 'ada invoice tanpa tanggal jatuh tempo'],
      goodToMention: ['total nilai outstanding dihitung', 'daftar distributor yang perlu di-follow up', 'usulan langkah berikutnya, termasuk memberi tahu tim Finance'],
    },
    taskTitle: 'Rekap & Validasi Invoice Distributor Semester 1 2026',
    taskBody: 'File <strong>task_admin_ops.xlsx</strong> ada di Notion. Periksa daftar invoice, temukan pencatatan yang janggal, dan buat rekap status pembayaran per distributor.',
    taskContext: 'Tim Finance butuh rekap ini untuk closing. Kalau ada yang janggal di pembayaran distributor, kamu orang pertama yang melihatnya.',
    teachBack: `eh cara lo nemuin invoice dobel di Excel gimana sih? aku biasanya scroll manual terus suka kelewat, ajarin dong biar cepet`,
    upcomingTasks: [
      { day: 2, title: 'Jadwal Meeting Direksi Bentrok', teaser: 'Tiga direktur, satu ruangan, dua jam yang sama, semuanya merasa paling penting. Mbak Sari menyerahkan puzzle-nya ke kamu.' },
      { day: 3, title: 'Kontrak UD Berkah Jaya Harus Ketemu Hari Ini', teaser: 'Finance menemukan tunggakan dari rekap yang kamu buat, dan sekarang semua mata ke arsip. Dokumen kontrak distributor itu di mana?' },
      { day: 5, title: 'Onboarding Kit 8 Karyawan Baru', teaser: 'HR merekrut 8 orang sekaligus. Peralatan, akses, ruang kerja, semua harus siap, dan checklist-mu yang menentukan hari pertama mereka.' },
      { day: 7, title: 'Performance Review Pertamamu', teaser: 'Satu minggu bekerja. Mbak Sari dan Pak Darmawan menilai kerjamu, dan menentukan arah karirmu di Vantara.' },
    ]
  }
}

export type BackgroundType = 'fresh_grad' | 'jobseeker' | 'career_switch' | 'student'

export const BACKGROUNDS: Record<BackgroundType, { label: string; role: string; icon: string; desc: string }> = {
  fresh_grad: { label: 'Fresh Graduate', role: 'Intern', icon: '🎓', desc: 'Baru lulus, belum punya pengalaman kerja kantoran' },
  jobseeker: { label: 'Job Seeker', role: 'Junior', icon: '🔍', desc: 'Aktif mencari kerja, sudah punya sedikit pengalaman' },
  career_switch: { label: 'Career Switcher', role: 'Mid-Level', icon: '🔄', desc: 'Sudah kerja di bidang lain, ingin pindah karir' },
  student: { label: 'Mahasiswa Tingkat Akhir', role: 'Intern', icon: '📚', desc: 'Masih kuliah, butuh pengalaman kerja lebih awal' },
}

// Keyed by LevelType — akses lewat getSalaryRange() supaya key background/level lama tetap jalan
export const SALARY_RANGE: Record<LevelType, { min: number; offer: number; max: number }> = {
  intern: { min: 1800000, offer: 2500000, max: 3000000 },
  junior: { min: 4000000, offer: 4500000, max: 5200000 },
  mid:    { min: 6500000, offer: 7000000, max: 8000000 },
}

export function getSalaryRange(levelOrBg: string | undefined | null) {
  return SALARY_RANGE[normalizeLevel(levelOrBg)]
}
