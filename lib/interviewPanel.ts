// Interview panel: HR (Sinta) dan calon atasan bertanya bergantian di satu ruang.
// Kode yang memegang naskah giliran; AI hanya menulis kalimatnya. Dengan begitu panjang interview
// pasti terbatas dan tidak bergantung pada kemauan model untuk "menutup sendiri".

export type Pembicara = 'sinta' | 'sup'

export type TahapId = 'gali' | 'serah' | 'teknis' | 'tindak' | 'motivasi' | 'gaji' | 'nego'

export interface TahapPanel {
  id: TahapId
  topik: 0 | 1 | 2
  // Penanya yang boleh bicara di tahap ini, berurutan.
  pembicara: Pembicara[]
  // Instruksi tahap untuk model.
  tugas: string
  // Boleh menutup interview (mengeluarkan token hasil) di tahap ini.
  bolehTutup: boolean
}

// Batas keras jumlah jawaban kandidat. Sesudah ini panel ditutup oleh server walau model tidak menutup.
export const PANEL_MAKS = 9
// Jawaban ke-berapa mulai boleh menutup (sesudah topik gaji dibahas).
export const PANEL_TUTUP_MULAI = 6

export const TOPIK_PANEL = ['Tentang kamu', 'Cara kerjamu', 'Penawaran'] as const

// Pertanyaan pembuka (perkenalan) sudah ada di pesan awal, jadi jawaban ke-1 adalah jawaban perkenalan.
export function tahapUntuk(jawaban: number): TahapPanel {
  if (jawaban <= 1) {
    return {
      id: 'gali', topik: 0, pembicara: ['sinta'], bolehTutup: false,
      tugas: 'Tanggapi perkenalan kandidat dengan hangat, lalu gali SATU hal dari CV atau ceritanya: pengalaman, proyek, atau kegiatan yang paling ia banggakan. Minta contoh konkret.',
    }
  }
  if (jawaban === 2) {
    return {
      id: 'serah', topik: 1, pembicara: ['sinta', 'sup'], bolehTutup: false,
      tugas: 'SINTA: tanggapi jawaban kandidat satu kalimat singkat, lalu serahkan ke calon atasan dengan satu kalimat ("sekarang aku serahkan ke [nama atasan] ya"). ATASAN: bereaksi singkat pada jawaban tadi, lalu ajukan SATU skenario teknis ringan dari pekerjaan sehari-hari posisi ini ("kalau kamu dapat ... , langkah pertamamu apa?"). Jangan memberi jawabannya.',
    }
  }
  if (jawaban === 3) {
    return {
      id: 'teknis', topik: 1, pembicara: ['sup'], bolehTutup: false,
      tugas: 'ATASAN: tanggapi cara berpikir kandidat, lalu gali dengan SATU pertanyaan lanjutan ("kenapa mulai dari situ?", "ada cara lain?", "bagaimana kamu memastikan hasilnya benar?"). Kalau jawaban kandidat dangkal, beri petunjuk kecil agar ia bisa menjelaskan lebih baik.',
    }
  }
  if (jawaban === 4) {
    return {
      id: 'tindak', topik: 2, pembicara: ['sup', 'sinta'], bolehTutup: false,
      tugas: 'ATASAN: tanggapi jawaban kandidat dalam satu atau dua kalimat, tanpa pertanyaan baru. SINTA: lanjutkan dengan SATU pertanyaan motivasi spesifik: kenapa Vantara, kenapa posisi ini (bukan jawaban template).',
    }
  }
  if (jawaban === 5) {
    return {
      id: 'motivasi', topik: 2, pembicara: ['sinta'], bolehTutup: false,
      tugas: 'SINTA: tanggapi motivasi kandidat, lalu tanyakan ekspektasi gaji. JANGAN menyebut angka duluan. Minta dasar angkanya kalau ia menyebut angka tanpa alasan, pada giliran berikutnya.',
    }
  }
  if (jawaban < PANEL_MAKS) {
    return {
      id: 'nego', topik: 2, pembicara: ['sinta', 'sup'], bolehTutup: true,
      tugas: `SINTA: evaluasi ekspektasi gaji sesuai aturan negosiasi di atas. Kalau angka belum disepakati, lanjutkan negosiasi dan JANGAN menutup interview (pembicara hanya SINTA). Kalau angka SUDAH disepakati kedua pihak (kandidat menerima tawaranmu atau ekspektasinya masuk range dan kamu mengonfirmasi), sebut angka final secara eksplisit, katakan offering letter sudah ada di Inbox, lalu ATASAN menutup dengan satu kalimat hangat (ia menunggu di hari pertama). Tutup HANYA kalau angka sudah disepakati.`,
    }
  }
  return {
    id: 'nego', topik: 2, pembicara: ['sinta', 'sup'], bolehTutup: true,
    tugas: 'Ini jawaban terakhir. TUTUP interview sekarang. SINTA: sebut tawaran akhir secara eksplisit sebagai tawaran terbaikmu (kalau kandidat belum menerima, katakan itu tawaran akhir dan offering letter sudah ada di Inbox untuk dipertimbangkan), lalu ATASAN menutup dengan satu kalimat hangat. Wajib akhiri dengan token hasil.',
  }
}

// Topik aktif untuk penanda progres di header (0 = tentang kamu, 1 = cara kerjamu, 2 = penawaran).
// Sesudah interview selesai semua topik dianggap lewat (nilai = jumlah topik).
export function topikAktif(jawaban: number, selesai: boolean): number {
  if (selesai) return TOPIK_PANEL.length
  return tahapUntuk(Math.max(jawaban, 1)).topik
}

export interface GelembungPanel {
  npc: Pembicara
  text: string
}

const PENANDA = /^\s*\[(SINTA|ATASAN)\]\s*/i

// Pecah keluaran model jadi gelembung per penanya. Penanda hanya dari penanya yang boleh bicara
// di tahap ini; baris dari penanya lain dibuang supaya peran terkunci (HR tidak bertanya teknis,
// atasan tidak membahas gaji). Tanpa penanda sama sekali, seluruh teks jadi milik penanya pertama.
export function pecahGelembung(teks: string, tahap: TahapPanel): GelembungPanel[] {
  const hasil: GelembungPanel[] = []
  let saatIni: Pembicara | null = null
  for (const baris of teks.split(/\r?\n/)) {
    const m = baris.match(PENANDA)
    if (m) {
      saatIni = m[1].toUpperCase() === 'SINTA' ? 'sinta' : 'sup'
      const isi = baris.replace(PENANDA, '').trim()
      if (isi) hasil.push({ npc: saatIni, text: isi })
    } else if (baris.trim()) {
      if (saatIni && hasil.length) hasil[hasil.length - 1].text += ' ' + baris.trim()
      else hasil.push({ npc: tahap.pembicara[0], text: baris.trim() })
    }
  }
  const boleh = hasil.filter(g => tahap.pembicara.includes(g.npc))
  const dipakai = boleh.length ? boleh : hasil.map(g => ({ ...g, npc: tahap.pembicara[0] }))
  // Gabungkan gelembung berurutan dari penanya yang sama.
  const gabung: GelembungPanel[] = []
  for (const g of dipakai) {
    const akhir = gabung[gabung.length - 1]
    if (akhir && akhir.npc === g.npc) akhir.text += ' ' + g.text
    else gabung.push({ ...g })
  }
  return gabung
}
