// api/jukebox.js — Fetch all songs from a movie/album by ID or name
// DES-ECB decrypt (same key as search.js)

const _IP  = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const _FP  = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const _E   = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const _P   = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const _PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const _PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const _SH  = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const _S   = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11],
];
const _perm  = (b, t) => t.map(p => b[p - 1]);
const _bits  = bytes => { const o=[]; for(const x of bytes) for(let i=7;i>=0;i--)o.push((x>>i)&1); return o; };
const _bytes = bits  => { const o=[]; for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bits[i+j];o.push(v);} return o; };
const _rotL  = (b,n) => [...b.slice(n), ...b.slice(0,n)];
function _subkeys(key) {
  let cd = _perm(_bits(key), _PC1);
  let C = cd.slice(0,28), D = cd.slice(28);
  return _SH.map(s => { C = _rotL(C,s); D = _rotL(D,s); return _perm([...C,...D], _PC2); });
}
function _f(R, K) {
  const x = _perm(R, _E).map((b,i) => b ^ K[i]);
  const out = [];
  for (let s = 0; s < 8; s++) {
    const bl = x.slice(s*6, s*6+6);
    const v  = _S[s][((bl[0]<<1)|bl[5])*16 + ((bl[1]<<3)|(bl[2]<<2)|(bl[3]<<1)|bl[4])];
    for (let i = 3; i >= 0; i--) out.push((v>>i)&1);
  }
  return _perm(out, _P);
}
function _desBlock(block, keys) {
  let bits = _perm(_bits(block), _IP);
  let L = bits.slice(0,32), R = bits.slice(32);
  for (const K of keys) { [L, R] = [R, L.map((v,i) => v ^ _f(R,K)[i])]; }
  return _bytes(_perm([...R,...L], _FP));
}
const _KEY = '38346591'.split('').map(c => c.charCodeAt(0));
const _DEC_KEYS = _subkeys(_KEY).reverse();
function decryptUrl(encBase64, has320) {
  try {
    const enc = Buffer.from(encBase64, 'base64');
    const out = [];
    for (let i = 0; i < enc.length; i += 8)
      out.push(..._desBlock([...enc.slice(i, i+8)], _DEC_KEYS));
    let url = Buffer.from(out).toString('utf8').replace(/\0+$/, '').trim();
    if (has320) url = url.replace('_96', '_320').replace('_160', '_320');
    return url.replace(/^http:\/\//, 'https://');
  } catch { return ''; }
}

const hdrs = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.jiosaavn.com/',
};

function parseSong(song, fallbackImage) {
  const has320 = song.more_info?.['320kbps'] === 'true';
  const url    = decryptUrl(song.more_info?.encrypted_media_url || '', has320);
  const raw    = song.image || fallbackImage || '';
  const image  = raw.replace('150x150','500x500').replace(/^http:\/\//, 'https://');
  const prim   = song.more_info?.artistMap?.primary_artists || [];
  const artist = Array.isArray(prim) && prim.length
    ? prim.map(a => a.name).join(', ')
    : (song.primary_artists || song.more_info?.music || 'Unknown');
  return {
    id:       song.id,
    name:     song.song || song.title || '',
    artist,
    album:    song.more_info?.album || '',
    image,
    duration: parseInt(song.more_info?.duration || song.duration) || 0,
    url,
    quality:  has320 ? '320kbps' : '96kbps',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let { id, q } = req.query;
  if (!id && !q) return res.status(400).json({ error: 'Missing id or q' });

  try {
    let albumName = '', albumImage = '';

    // Step 1 — if no ID given, search for the album first
    if (!id) {
      const r    = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=wap6dot0&n=1&p=1&q=${encodeURIComponent(q)}`, { headers: hdrs });
      const data = await r.json();
      const top  = (data.results || [])[0];
      if (!top) return res.status(404).json({ error: 'No album found' });
      id          = top.id;
      albumName   = top.title || q;
      albumImage  = (top.image || '').replace('150x150','500x500').replace(/^http:\/\//, 'https://');
    }

    // Step 2 — fetch all songs from the album
    const r    = await fetch(`https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&_format=json&_marker=0&api_version=4&ctx=wap6dot0&albumid=${id}`, { headers: hdrs });
    const data = await r.json();

    albumName  = albumName  || data.name  || data.title || '';
    albumImage = albumImage || (data.image || '').replace('150x150','500x500').replace(/^http:\/\//, 'https://');

    let list = data.list || [];
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
    if (!Array.isArray(list))     list = Object.values(list).filter(v => v && typeof v === 'object');

    const songs = list.map(s => parseSong(s, albumImage)).filter(s => s.name && s.url);

    return res.status(200).json({
      success: true,
      album:   { id, name: albumName, image: albumImage },
      data:    songs,
    });
  } catch (e) {
    console.error('[JUKEBOX]', e.message);
    return res.status(503).json({ error: 'JioSaavn unavailable', detail: e.message });
  }
}
