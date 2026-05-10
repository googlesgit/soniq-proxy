// api/search.js — SONIQ Proxy
// Returns song metadata + tries multiple methods to get stream URL

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
    // Step 1: Search
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&p=1&q=${encodeURIComponent(q)}`;
    const sr = await fetch(searchUrl, { headers: hdrs });
    if (!sr.ok) throw new Error(`Search ${sr.status}`);
    const sd = await sr.json();
    const raw = sd.results || [];
    if (!raw.length) return res.status(200).json({ success: true, data: [] });

    // Step 2: Get full song details including encrypted URLs
    const ids = raw.map(s => s.id).join(',');
    const detailUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${ids}`;
    const dr = await fetch(detailUrl, { headers: hdrs });
    const details = dr.ok ? await dr.json() : {};

    // Step 3: Build songs, try all known methods to get stream URL
    const songs = await Promise.all(raw.map(async (song) => {
      const d = details[song.id] || {};
      const mi = d.more_info || song.more_info || {};

      // Method 1: DES decrypt encrypted_media_url
      const encUrl = mi.encrypted_media_url || '';
      let streamUrl = encUrl ? tryDecrypt(encUrl) : '';

      // Method 2: If decrypt failed, try encrypted_media_preview_url
      if (!streamUrl) {
        const prevUrl = mi.encrypted_media_preview_url || '';
        if (prevUrl) streamUrl = tryDecrypt(prevUrl);
      }

      // Method 3: Try direct CDN URL construction using song ID
      if (!streamUrl && song.id) {
        streamUrl = await tryDirectStream(song.id, hdrs);
      }

      return {
        id:       song.id,
        name:     clean(song.title || song.song || ''),
        artist:   clean(mi.singers || song.subtitle || ''),
        album:    clean(mi.album || ''),
        image:    (song.image || '').replace('150x150', '500x500'),
        duration: parseInt(mi.duration || '0'),
        url:      streamUrl,
        has320:   mi['320kbps'] === 'true',
      };
    }));

    return res.status(200).json({ success: true, data: songs });

  } catch (err) {
    console.error('[SONIQ]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Method 1: DES-ECB decryption (JioSaavn's primary method)
function tryDecrypt(enc) {
  // Try multiple known JioSaavn keys
  const keys = ['38346591', '3H9aJFmE'];
  for (const key of keys) {
    try {
      const k = Buffer.from(key, 'utf8');
      const data = Buffer.from(enc, 'base64');
      const decipher = crypto.createDecipheriv('des-ecb', k, null);
      decipher.setAutoPadding(false);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      const url = dec.toString('utf8').replace(/\0/g, '').trim()
        .replace('_96.mp4',  '_320.mp4')
        .replace('_160.mp4', '_320.mp4')
        .replace('http://', 'https://');
      if (url.startsWith('https://') && (url.includes('saavn') || url.includes('jiosaavn'))) {
        return url;
      }
    } catch {}
  }
  return '';
}

// Method 3: Get stream URL via JioSaavn's song detail API
async function tryDirectStream(songId, hdrs) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=https://aac.saavncdn.com/${songId}_320.mp4&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
    const r = await fetch(url, { headers: hdrs });
    if (!r.ok) return '';
    const d = await r.json();
    const authUrl = d.auth_url || '';
    return authUrl.startsWith('https://') ? authUrl : '';
  } catch {
    return '';
  }
}

function clean(s) {
  return (s || '').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/<[^>]+>/g,'').trim();
}
