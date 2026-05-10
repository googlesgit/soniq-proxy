// api/search.js — Vercel serverless function
// Calls JioSaavn directly — no middleman

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    // Call JioSaavn's internal API directly
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&p=1&q=${encodeURIComponent(q)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com',
      },
    });

    if (!response.ok) throw new Error(`JioSaavn ${response.status}`);

    const raw = await response.json();

    // Parse JioSaavn's response format into clean song objects
    const results = (raw.results || []).map(song => {
      // Decrypt the encrypted media URL
      const encUrl = song.more_info?.encrypted_media_url || '';
      
      // Get best image
      const image = (song.image || '').replace('150x150', '500x500');
      
      // Duration in seconds
      const duration = song.more_info?.duration || '0';
      
      // Artists
      const artists = song.more_info?.singers || song.subtitle || '';

      return {
        id: song.id,
        name: song.title?.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'") || '',
        artist: artists,
        image,
        duration: parseInt(duration),
        encUrl,
        // We'll use JioSaavn's stream URL format
        albumUrl: song.perma_url || '',
      };
    }).filter(s => s.id);

    return res.status(200).json({ success: true, data: results });

  } catch (err) {
    console.error('Search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
