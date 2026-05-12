// api/search.js — SONIQ Proxy — calls JioSaavn internal API directly
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const forge = require('node-forge');

const DES_KEY = '38346591';
const DES_IV  = '00000000';

function decryptUrl(encryptedMediaUrl, has320) {
  if (!encryptedMediaUrl) return '';
  try {
    const encrypted = forge.util.decode64(encryptedMediaUrl);
    const decipher  = forge.cipher.createDecipher('DES-ECB', forge.util.createBuffer(DES_KEY));
    decipher.start({ iv: forge.util.createBuffer(DES_IV) });
    decipher.update(forge.util.createBuffer(encrypted));
    decipher.finish();
    let url = decipher.output.getBytes().replace(/\0+$/, '').trim();
    if (has320) url = url.replace('_96', '_320').replace('_160', '_320');
    return url.replace(/^http:\/\//, 'https://');
  } catch (e) {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const apiUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=wap6dot0&n=${limit}&p=1&q=${encodeURIComponent(q)}`;

  try {
    const r = await Promise.race([
      fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.jiosaavn.com/',
        }
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);

    if (!r.ok) throw new Error(`JioSaavn HTTP ${r.status}`);
    const data = await r.json();

    const results = data.results || [];
    if (!results.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const songs = results.map(song => {
      const has320  = song.more_info?.['320kbps'] === 'true';
      const url     = decryptUrl(song.more_info?.encrypted_media_url, has320);

      const image   = (song.image || '').replace('150x150', '500x500').replace(/^http:\/\//, 'https://');

      const primaryArtists = song.more_info?.artistMap?.primary_artists || [];
      const artist = Array.isArray(primaryArtists) && primaryArtists.length
        ? primaryArtists.map(a => a.name).join(', ')
        : (song.more_info?.music || 'Unknown');

      return {
        id:       song.id,
        name:     song.title || '',
        artist,
        album:    song.more_info?.album || '',
        image,
        duration: parseInt(song.more_info?.duration) || 0,
        url,
        quality:  has320 ? '320kbps' : '96kbps',
      };
    }).filter(s => s.name && s.url);

    return res.status(200).json({ success: true, data: songs, source: 'jiosaavn-direct' });

  } catch (e) {
    console.error('[SONIQ] JioSaavn error:', e.message);
    return res.status(503).json({ error: 'JioSaavn API unavailable', detail: e.message });
  }
}
