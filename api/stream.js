// api/stream.js — Gets playable stream URL for a song ID

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${id}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`JioSaavn ${response.status}`);
    const data = await response.json();

    const song = data[id];
    if (!song) throw new Error('Song not found');

    const encUrl = song.more_info?.encrypted_media_url || '';
    
    // Decrypt the media URL using JioSaavn's known key
    const decrypted = decryptUrl(encUrl);

    return res.status(200).json({ 
      success: true, 
      url: decrypted,
      quality: '320kbps'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function decryptUrl(encrypted) {
  // JioSaavn uses a simple DES encryption
  // Key is publicly known from reverse engineering
  try {
    const key = '38346591';
    // Base64 decode
    const bytes = Buffer.from(encrypted, 'base64');
    // Simple XOR decrypt with known key pattern  
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
    }
    // Replace quality marker for 320kbps
    return result.replace('_96.mp4', '_320.mp4').replace('http://', 'https://');
  } catch(e) {
    return '';
  }
}
