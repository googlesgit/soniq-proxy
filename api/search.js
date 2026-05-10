// api/search.js — SONIQ Proxy
// Uses saavn.dev which correctly returns downloadUrl array with working MP3s

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    // saavn.dev is the proven API that returns downloadUrl[] with real MP3 links
    // We call it from Vercel (server-side) so CORS is not an issue
    const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}&page=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`saavn.dev returned ${response.status}`);
    }

    const data = await response.json();
    const results = data?.data?.results;

    if (!results || !results.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Parse saavn.dev response into clean song objects
    const songs = results.map(song => {
      // downloadUrl is an array sorted by quality: 12kbps, 48kbps, 96kbps, 160kbps, 320kbps
      const urls = song.downloadUrl || [];
      
      // Pick best quality available
      const best = urls.find(u => u.quality === '320kbps')
                || urls.find(u => u.quality === '160kbps')
                || urls.find(u => u.quality === '96kbps')
                || urls[urls.length - 1];

      // Get best image
      const images = song.image || [];
      const image = images.find(i => i.quality === '500x500')?.url
                 || images.find(i => i.quality === '150x150')?.url
                 || images[images.length - 1]?.url
                 || '';

      // Get artists
      const primaryArtists = song.artists?.primary || [];
      const artist = primaryArtists.map(a => a.name).join(', ') || 'Unknown';

      return {
        id:       song.id,
        name:     song.name || '',
        artist,
        album:    song.album?.name || '',
        image,
        duration: parseInt(song.duration) || 0,
        url:      best?.url || '',
        quality:  best?.quality || '',
      };
    });

    return res.status(200).json({ success: true, data: songs });

  } catch (err) {
    console.error('[SONIQ Proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
