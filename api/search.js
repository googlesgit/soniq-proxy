// api/search.js — SONIQ Proxy
// Calls JioSaavn directly, decrypts stream URLs, returns playable MP3s
// No build step, no dependencies, pure Node.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Referer': 'https://www.jiosaavn.com/',
    'Origin': 'https://www.jiosaavn.com',
    'Cookie': 'L=english; gdpr_acceptance=true; DL=english;',
  };

  try {
    // Search for songs
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&p=1&q=${encodeURIComponent(q)}`;
    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const rawSongs = searchData.results || [];
    if (!rawSongs.length) return res.status(200).json({ success: true, data: [] });

    // Get detailed song info including encrypted stream URLs
    const ids = rawSongs.map(s => s.id).join(',');
    const detailUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${ids}`;
    const detailRes = await fetch(detailUrl, { headers });
    const details = detailRes.ok ? await detailRes.json() : {};

    // Build clean response
    const songs = rawSongs.map(song => {
      const d = details[song.id] || {};
      const mi = d.more_info || song.more_info || {};
      const encUrl = mi.encrypted_media_url || '';
      const streamUrl = encUrl ? decryptUrl(encUrl) : '';
      return {
        id: song.id,
        name:     clean(song.title || song.song || ''),
        artist:   clean(mi.singers || song.subtitle || ''),
        album:    clean(mi.album || ''),
        image:    (song.image || '').replace('150x150', '500x500'),
        duration: parseInt(mi.duration || '0'),
        url:      streamUrl,
      };
    }).filter(s => s.url);

    return res.status(200).json({ success: true, data: songs });

  } catch (err) {
    console.error('[Proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// JioSaavn uses DES encryption with key '38346591'
// This is publicly documented from reverse engineering their web app
function decryptUrl(enc) {
  try {
    const key = Buffer.from('38346591', 'utf8');
    const raw = Buffer.from(enc, 'base64');
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw[i] ^ key[i % key.length]);
    }
    // Strip non-printable chars
    const url = out.replace(/[^\x20-\x7E]/g, '').trim()
      .replace('_96.mp4',  '_320.mp4')
      .replace('_160.mp4', '_320.mp4')
      .replace('http://',  'https://');
    return (url.startsWith('https://') && url.includes('saavn')) ? url : '';
  } catch { return ''; }
}

function clean(s) {
  return (s || '').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").trim();
}
