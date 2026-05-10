// api/search.js — SONIQ Proxy
// Uses Node.js built-in crypto for proper DES decryption of JioSaavn URLs

import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const hdrs = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Referer': 'https://www.jiosaavn.com/',
    'Cookie': 'L=english; gdpr_acceptance=true; DL=english;',
  };

  try {
    // Search
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&p=1&q=${encodeURIComponent(q)}`;
    const sr = await fetch(searchUrl, { headers: hdrs });
    if (!sr.ok) throw new Error(`Search ${sr.status}`);
    const sd = await sr.json();
    const raw = sd.results || [];
    if (!raw.length) return res.status(200).json({ success: true, data: [] });

    // Get details with encrypted URLs
    const ids = raw.map(s => s.id).join(',');
    const dr = await fetch(`https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${ids}`, { headers: hdrs });
    const details = dr.ok ? await dr.json() : {};

    const songs = raw.map(song => {
      const d = details[song.id] || {};
      const mi = d.more_info || song.more_info || {};
      const encUrl = mi.encrypted_media_url || '';

      let streamUrl = '';
      if (encUrl) {
        streamUrl = decryptDES(encUrl);
      }

      return {
        id:       song.id,
        name:     clean(song.title || song.song || ''),
        artist:   clean(mi.singers || song.subtitle || ''),
        album:    clean(mi.album || ''),
        image:    (song.image || '').replace('150x150', '500x500'),
        duration: parseInt(mi.duration || '0'),
        url:      streamUrl,
        quality:  mi['320kbps'] === 'true' ? '320kbps' : '128kbps',
      };
    });

    // Return all songs, even ones without URL (frontend will skip them)
    return res.status(200).json({ success: true, data: songs });

  } catch (err) {
    console.error('[SONIQ]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Proper DES ECB decryption using Node.js crypto
// JioSaavn key is publicly known from their web app source
function decryptDES(encrypted) {
  try {
    const key = Buffer.from('38346591', 'utf8'); // 8 bytes = DES key
    const data = Buffer.from(encrypted, 'base64');

    const decipher = crypto.createDecipheriv('des-ecb', key, null);
    decipher.setAutoPadding(false);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);

    let url = decrypted.toString('utf8').replace(/\0/g, '').trim();

    // Upgrade quality
    url = url
      .replace('_96.mp4', '_320.mp4')
      .replace('_160.mp4', '_320.mp4')
      .replace('http://', 'https://');

    return url.startsWith('https://') ? url : '';
  } catch (e) {
    console.error('Decrypt error:', e.message);
    return '';
  }
}

function clean(s) {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}
