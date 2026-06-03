// Serverless Function (berjalan di server Vercel, TIDAK terlihat browser).
// Key dibaca dari Environment Variable, bukan dari kode.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY belum di-set di Environment Variables Vercel' } });
  }

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message || 'Proxy error' } });
  }
}
