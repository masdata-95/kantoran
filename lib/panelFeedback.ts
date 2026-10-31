// Umpan balik singkat di akhir interview panel: apa yang sudah bagus dan apa yang bisa dipertajam,
// dari sudut HR dan calon atasan. Ini yang membuat interview terasa berguna, bukan sekadar gerbang.

export interface CatatanPenanya {
  bagus: string
  tajam: string
}

export interface UmpanBalikPanel {
  hr: CatatanPenanya
  atasan: CatatanPenanya
  contoh: string
  // Satu kalimat fakta yang diingat atasan dari jawaban teknis kandidat; dirujuk saat briefing.
  catatanAtasan: string
}

export function getUmpanBalikPrompt(namaKandidat: string, posisi: string, namaAtasan: string): string {
  return `Kamu pelatih interview yang membaca transkrip interview panel di PT Vantara Nusantara. Penanyanya dua: Sinta (HR) dan ${namaAtasan} (calon atasan). Kandidatnya ${namaKandidat}, melamar ${posisi}.

Tugasmu: menulis umpan balik singkat untuk kandidat, dari sudut pandang masing-masing penanya.

Balas HANYA dengan satu objek JSON valid, tanpa teks lain di luar JSON:
{
  "hr": { "bagus": "...", "tajam": "..." },
  "atasan": { "bagus": "...", "tajam": "..." },
  "contoh": "...",
  "catatanAtasan": "..."
}

Aturan isi:
- "hr" menilai cara kandidat memperkenalkan diri, bercerita tentang pengalaman, dan menjelaskan motivasi. "atasan" menilai cara berpikir dan cara kerja dari jawaban teknisnya.
- "bagus": satu hal yang benar-benar sudah baik, sebutkan apa yang kandidat katakan. "tajam": satu hal yang bisa dipertajam, dengan saran konkret yang bisa dilatih. Masing-masing maksimal 2 kalimat.
- "contoh": ambil SATU jawaban kandidat yang nyata, lalu tulis ulang versi yang lebih kuat (urutan situasi, tindakan, hasil) memakai HANYA fakta yang kandidat sebutkan sendiri. Jangan mengarang fakta, angka, atau nama. Kalau kandidat tidak memberi fakta yang cukup, isi dengan kalimat kosong "".
- "catatanAtasan": satu kalimat netral tentang apa yang kandidat jawab di bagian teknis, ditulis dari sudut pandang atasan ("katanya ..."). Kalau tidak ada jawaban teknis yang berarti, isi "".
- Bahasa Indonesia natural, bicara langsung ke kandidat dengan "kamu" (kecuali catatanAtasan). Hangat dan jujur, tidak memuji berlebihan. Kalau jawabannya sangat singkat atau asal, katakan dengan ramah dan beri langkah latihan yang jelas.
- Tanpa markdown, tanpa bullet, tanpa tanda hubung panjang, tanpa emoji. Jangan menyebut skor atau angka penilaian.`
}

const bersih = (v: unknown, maks: number): string =>
  String(v ?? '')
    .replace(/[*_#`]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maks)

const penanya = (v: unknown): CatatanPenanya | null => {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const bagus = bersih(o.bagus, 320)
  const tajam = bersih(o.tajam, 320)
  return bagus && tajam ? { bagus, tajam } : null
}

// Validasi keluaran model: bentuk tidak sesuai → null (kartu umpan balik dilewati, bukan error).
export function rapikanUmpanBalik(mentah: unknown): UmpanBalikPanel | null {
  if (!mentah || typeof mentah !== 'object') return null
  const o = mentah as Record<string, unknown>
  const hr = penanya(o.hr)
  const atasan = penanya(o.atasan)
  if (!hr || !atasan) return null
  return {
    hr,
    atasan,
    contoh: bersih(o.contoh, 420),
    catatanAtasan: bersih(o.catatanAtasan, 240),
  }
}
