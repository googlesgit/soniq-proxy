// api/lyrics.js — RagaSync Lyrics Proxy
// 1st: LRCLIB (time-synced, free, no key) — karaoke-style
// 2nd: JioSaavn lyrics API (static, best Indian coverage) — fallback

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, title, artist } = req.query;
  if (!id && !title) return res.status(400).json({ error: 'Missing id or title' });

  // ── 1. LRCLIB — synced lyrics ──────────────────────────────────
  if (title) {
    try {
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist || '')}`;
      const r = await Promise.race([
        fetch(url, { headers: { 'User-Agent': 'RagaSync Music Player/1.0 (https://googlesgit.github.io/playtheworld)' } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      if (r.ok) {
        const results = await r.json();
        const match = results.find(s => s.syncedLyrics) || results.find(s => s.plainLyrics);
        if (match?.syncedLyrics) {
          return res.status(200).json({ synced: true,  lines: parseLRC(match.syncedLyrics), source: 'lrclib' });
        }
        if (match?.plainLyrics) {
          const lines = match.plainLyrics.split('\n').map(l => l.trim()).filter(Boolean);
          return res.status(200).json({ synced: false, lines, source: 'lrclib' });
        }
      }
    } catch (e) {
      console.warn('[RagaSync] LRCLIB failed:', e.message);
    }
  }

  // ── 2. JioSaavn — static lyrics ───────────────────────────────
  if (id) {
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(id)}&_format=json`;
      const r = await Promise.race([
        fetch(url, { headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.jiosaavn.com/',
        }}),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      if (r.ok) {
        const data = await r.json();
        if (data.lyrics) {
          const lines = data.lyrics.split('<br>').map(l => l.trim()).filter(Boolean);
          return res.status(200).json({ synced: false, lines, source: 'jiosaavn' });
        }
      }
    } catch (e) {
      console.warn('[RagaSync] JioSaavn lyrics failed:', e.message);
    }
  }

  return res.status(404).json({ error: 'No lyrics found' });
}

// Parse LRC format: [mm:ss.xx] text line
function parseLRC(lrc) {
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (m) {
      const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
      const text = m[3].trim();
      if (text) lines.push({ time, text });
    }
  }
  return lines;
}
