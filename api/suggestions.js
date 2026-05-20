// api/suggestions.js — Fast autocomplete: songs + albums/movies in one shot
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Missing q' });

  const hdrs = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.jiosaavn.com/',
  };

  const [songRes, albumRes] = await Promise.allSettled([
    fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=wap6dot0&n=6&p=1&q=${encodeURIComponent(q)}`,
      { headers: hdrs }
    ),
    fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=wap6dot0&n=4&p=1&q=${encodeURIComponent(q)}`,
      { headers: hdrs }
    ),
  ]);

  const songs = [];
  if (songRes.status === 'fulfilled' && songRes.value.ok) {
    try {
      const data = await songRes.value.json();
      (data.results || []).slice(0, 6).forEach(s => {
        const prim = s.more_info?.artistMap?.primary_artists || [];
        const artist = Array.isArray(prim) && prim.length
          ? prim.map(a => a.name).join(', ')
          : (s.more_info?.music || '');
        const image = (s.image || '').replace(/^http:\/\//, 'https://');
        if (s.title) songs.push({ id: s.id, title: s.title, artist, image });
      });
    } catch {}
  }

  const albums = [];
  if (albumRes.status === 'fulfilled' && albumRes.value.ok) {
    try {
      const data = await albumRes.value.json();
      (data.results || []).slice(0, 4).forEach(a => {
        const image = (a.image || '').replace(/^http:\/\//, 'https://');
        if (a.title) albums.push({ id: a.id, title: a.title, year: a.header_desc || a.year || '', image });
      });
    } catch {}
  }

  return res.status(200).json({ songs, albums });
}
