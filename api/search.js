// api/search.js — SONIQ Proxy
// Tries multiple JioSaavn API instances — if one is down, uses the next

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  // Multiple public JioSaavn API instances
  // If one is down, we try the next one
 // const INSTANCES = [
 //   `https://jiosaavn-api-privatecvc2.vercel.app/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
 //   `https://jiosaavn-api-two.vercel.app/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
 //   `https://saavn.dev/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}&page=1`,
 //   `https://jiosaavn-api.vercel.app/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
 // ];

  const INSTANCES = [
  `https://jiosaavn-api-2-liard.vercel.app/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
];

  const hdrs = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  let lastError = '';

  for (const url of INSTANCES) {
    try {
      const r = await Promise.race([
        fetch(url, { headers: hdrs }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ]);

      if (!r.ok) { lastError = `HTTP ${r.status} from ${url}`; continue; }

      const data = await r.json();
      const results = data?.data?.results || data?.results || [];

      if (!results.length) { lastError = 'empty results'; continue; }

      // Parse into clean format
      const songs = results.map(song => {
        const urls = song.downloadUrl || song.download_url || [];
        const best = urls.find(u => u.quality === '320kbps')
                  || urls.find(u => u.quality === '160kbps')
                  || urls.find(u => u.quality === '96kbps')
                  || urls[urls.length - 1];

        const images = song.image || [];
        const image = Array.isArray(images)
          ? (images.find(i => i.quality === '500x500')?.url || images[images.length - 1]?.url || '')
          : images;

        const primaryArtists = song.artists?.primary || [];
        const artist = Array.isArray(primaryArtists)
          ? primaryArtists.map(a => a.name).join(', ')
          : (song.primaryArtists || song.artist_name || 'Unknown');

        return {
          id:       song.id,
          name:     song.name || song.title || '',
          artist,
          album:    song.album?.name || song.album || '',
          image:    typeof image === 'string' ? image : '',
          duration: parseInt(song.duration) || 0,
          url:      best?.url || '',
          quality:  best?.quality || '',
        };
      }).filter(s => s.name); // filter out malformed entries

      console.log(`[SONIQ] Success from: ${url}`);
      return res.status(200).json({ success: true, data: songs, source: url });

    } catch (e) {
      lastError = e.message;
      console.warn(`[SONIQ] Failed ${url}: ${e.message}`);
      continue;
    }
  }

  // All instances failed
  return res.status(503).json({
    error: 'All JioSaavn API instances are currently unavailable',
    detail: lastError
  });
}
