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

export interface Position {
  title: string
  dept: string
  icon: string
  getRole: (bg: string) => string
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
}

export const POSITIONS: Record<string, Position> = {
  data_analyst: {
    title: 'Data Analyst', dept: 'Data & Analytics', icon: '📊',
    getRole: (bg) => ({ fresh_grad:'Intern', jobseeker:'Junior', career_switch:'Mid-Level', student:'Intern Magang' }[bg] || 'Intern') + ' Data Analyst',
    reqs: ['Dasar Excel atau Google Sheets', 'Logika data dan angka', 'Baca dan interpretasi tabel', 'Nilai plus: pernah belajar SQL'],
    itx: 'analisis data, Excel, SQL, cara berpikir berbasis data',
    taskFile: 'task_data_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'RP', avClass: 'av-blue', name: 'Rizky Pratama',
      role: 'Senior Data Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 29 tahun. Lulusan Statistika ITS, 5 tahun di Vantara sejak fresh grad. Kerjaan pertama dan satu-satunya.
Pengalaman nyata: pernah stuck 3 hari debug pipeline karena satu spasi tersembunyi di CSV. Pernah kena marah Director karena dashboard crash pas presentasi ke client. Punya ritual kopi sebelum coding — tidak mau diganggu sampai kopi habis. Suka chess online, main sela-sela nunggu query panjang jalan.
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
    taskContext: 'Tim Marketing butuh data ini untuk planning campaign Q2. Pastikan datanya bisa dipercaya sebelum dipakai.'
  },

  marketing_analyst: {
    title: 'Marketing Analyst', dept: 'Marketing & Brand', icon: '📣',
    getRole: (bg) => ({ fresh_grad:'Intern', jobseeker:'Junior', career_switch:'Mid-Level', student:'Intern Magang' }[bg] || 'Intern') + ' Marketing Analyst',
    reqs: ['Konsep dasar marketing dan branding', 'Baca metrik campaign (CTR, conversion)', 'Consumer behavior dasar', 'Nilai plus: pernah kelola konten atau sosmed'],
    itx: 'marketing funnel, analisis campaign, consumer insight, brand positioning',
    taskFile: 'task_marketing_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'DP', avClass: 'av-blue', name: 'Dinda Pratiwi',
      role: 'Senior Marketing Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 28 tahun. Background komunikasi, self-taught di data dan analitik. Campaign pertama yang dia handle sendiri flop total — impresi tinggi tapi zero konversi. Belajar banyak dari situ. Masih suka impostor syndrome kadang. Hobi: jalan-jalan ke pasar, foto untuk Instagram pribadi, nonton film dokumenter.
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
      bio: `Pria 24 tahun. Obsessed dengan tren sosmed dan pop culture — sering tahu viral content sebelum orang lain. Tapi juga sering overthinking soal kerjaan. Banyak emoji, jujur soal struggle.`
    },
    taskRubric: {
      mustFind: ['TikTok conversion rate rendah', 'Google Ads paling efektif dari sisi CTR dan conversion', 'campaign tanpa start date atau data tidak lengkap'],
      goodToMention: ['perbandingan CPA antar channel', 'rekomendasi alokasi budget Q1 2026', 'reasoning berbasis data bukan asumsi']
    },
    taskTitle: 'Analisis Performa Campaign Lumière Q4 2025',
    taskBody: 'File <strong>task_marketing_analyst.xlsx</strong> ada di Notion. Hitung CTR dan conversion rate tiap campaign, identifikasi yang terbaik dan terburuk.',
    taskContext: 'Budget Q1 akan diputuskan berdasarkan performa Q4 ini. Analisismu dipakai di rapat besok pagi.'
  },

  finance_analyst: {
    title: 'Finance Analyst', dept: 'Finance & Accounting', icon: '💰',
    getRole: (bg) => ({ fresh_grad:'Intern', jobseeker:'Junior', career_switch:'Mid-Level', student:'Intern Magang' }[bg] || 'Intern') + ' Finance Analyst',
    reqs: ['Dasar laporan keuangan (P&L, neraca)', 'Konsep budgeting dan variance analysis', 'Teliti bekerja dengan angka', 'Nilai plus: pernah belajar akuntansi'],
    itx: 'laporan keuangan, budgeting, variance analysis, financial modeling dasar',
    taskFile: 'task_finance_analyst.xlsx',
    supervisor: {
      id: 'sup', initials: 'AW', avClass: 'av-blue', name: 'Andi Wijaya',
      role: 'Senior Finance Analyst · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 31 tahun. CPA, background akuntansi. Pernah menemukan error senilai Rp 2 miliar di laporan karena satu formula salah — jadi legend di kantor. Dulu kerja sampai jam 11 malam setiap akhir bulan, sekarang sudah lebih baik manage ekspektasi. Hobi hiking dan masak.
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
    taskContext: 'CFO minta laporan variance sebelum budget meeting minggu depan. Ini urgent.'
  },

  hr_generalist: {
    title: 'HR Generalist', dept: 'Human Resources', icon: '👥',
    getRole: (bg) => ({ fresh_grad:'Intern', jobseeker:'Junior', career_switch:'Mid-Level', student:'Intern Magang' }[bg] || 'Intern') + ' HR Generalist',
    reqs: ['Komunikasi verbal dan tulisan yang baik', 'Empati dan kemampuan mendengarkan', 'Konsep dasar rekrutmen', 'Nilai plus: pernah organise event atau kepanitiaan'],
    itx: 'proses rekrutmen, employee relations, people management, culture building',
    taskFile: 'task_hr_generalist.xlsx',
    supervisor: {
      id: 'sup', initials: 'BR', avClass: 'av-blue', name: 'Bu Ratna',
      role: 'Senior HR Business Partner · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Perempuan 35 tahun. 10 tahun di HR. Pernah harus lay off 15 orang sekaligus karena restrukturisasi — pengalaman yang tidak pernah terlupakan. Orang-orang think HR itu enak karena banyak ngobrol. Padahal burnout di HR lebih tinggi dari yang dikira. Punya ritual journaling setiap malam untuk dekompresi.
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
    taskTitle: 'CV Screening Junior Data Analyst — Batch 1',
    taskBody: 'File <strong>task_hr_generalist.xlsx</strong> ada di Notion. Screen 5 kandidat dan shortlist 2 terbaik untuk interview tahap berikutnya.',
    taskContext: 'Tim butuh shortlist ini sebelum akhir minggu. Interview tahap berikutnya sudah dijadwalkan minggu depan.'
  },

  bizdev: {
    title: 'Business Development', dept: 'Komersial & Strategi', icon: '🚀',
    getRole: (bg) => ({ fresh_grad:'Intern BD', jobseeker:'Junior BD Analyst', career_switch:'BD Associate', student:'Intern Magang BD' }[bg] || 'Intern BD'),
    reqs: ['Komunikasi dan presentasi yang kuat', 'Pemahaman dasar bisnis dan pasar', 'Analytical thinking', 'Nilai plus: pernah terlibat sales atau pitching'],
    itx: 'identifikasi peluang bisnis, evaluasi partnership, pitching, negosiasi, growth mindset',
    taskFile: 'task_bizdev.xlsx',
    supervisor: {
      id: 'sup', initials: 'RF', avClass: 'av-blue', name: 'Reza Firmansyah',
      role: 'BD Manager · Supervisormu', status: '🟢 Online', statusDot: 'bg-green-500',
      bio: `Pria 33 tahun. Ex-startup founder yang gagal, lalu masuk corporate. Deal senilai Rp 2 miliar pernah gagal di menit terakhir karena satu klausa kontrak. Pernah pitch ke 12 calon partner dalam seminggu dan semua ditolak — minggu paling brutal dalam karirnya.
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
    taskContext: 'Direktur Komersial butuh shortlist ini untuk roadshow partnership bulan depan. Jangan sampai rekomendasikan partner yang bermasalah.'
  }
}

export type BackgroundType = 'fresh_grad' | 'jobseeker' | 'career_switch' | 'student'

export const BACKGROUNDS: Record<BackgroundType, { label: string; role: string; icon: string; desc: string }> = {
  fresh_grad: { label: 'Fresh Graduate', role: 'Intern', icon: '🎓', desc: 'Baru lulus, belum punya pengalaman kerja kantoran' },
  jobseeker: { label: 'Job Seeker', role: 'Junior', icon: '🔍', desc: 'Aktif mencari kerja, sudah punya sedikit pengalaman' },
  career_switch: { label: 'Career Switcher', role: 'Mid-Level', icon: '🔄', desc: 'Sudah kerja di bidang lain, ingin pindah karir' },
  student: { label: 'Mahasiswa Tingkat Akhir', role: 'Intern Magang', icon: '📚', desc: 'Masih kuliah, butuh pengalaman kerja lebih awal' },
}

export const SALARY_RANGE: Record<string, Record<string, number>> = {
  fresh_grad: { min: 2200000, offer: 2500000, max: 2900000 },
  jobseeker: { min: 4000000, offer: 4500000, max: 5200000 },
  career_switch: { min: 6500000, offer: 7000000, max: 8000000 },
  student: { min: 1200000, offer: 1500000, max: 1800000 },
}
