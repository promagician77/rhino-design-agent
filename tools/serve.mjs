// Static server for a built site with the same rules as vercel.json:
// directory index and trailing-slash redirect for directories.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.webp': 'image/webp', '.wasm': 'application/wasm', '.3dm': 'application/octet-stream' };

export function serve(root, port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    const file = async rel => { const f = normalize(join(root, rel)); if (!f.startsWith(normalize(root))) return null; try { const s = await stat(f); return s.isFile() ? f : s.isDirectory() ? 'DIR' : null; } catch { return null; } };
    let f = await file(p);
    if (f === 'DIR') {
      if (!p.endsWith('/')) { res.writeHead(308, { Location: p + '/' + url.search }); return res.end(); }
      f = await file(p + 'index.html');
    }
    let status = 200;
    
    if (!f) { f = await file('/404.html'); status = 404; }
    if (!f) { res.writeHead(404); return res.end('not found'); }
    let body = await readFile(f);
    const type = TYPES[extname(f)] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': /\/(fonts|photos)\//.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
    // Compress text like Vercel does, so local speed measurements are fair.
    const ae = req.headers['accept-encoding'] || '';
    if (/text|javascript|json|svg|csv/.test(type) && body.length > 1024) {
      if (ae.includes('br')) { body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }); headers['Content-Encoding'] = 'br'; }
      else if (ae.includes('gzip')) { body = gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
      headers.Vary = 'Accept-Encoding';
    }
    res.writeHead(status, headers);
    res.end(body);
  });
  return new Promise(r => server.listen(port, () => r({ server, port: server.address().port, close: () => new Promise(c => server.close(c)) })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || 'dist/phase1';
  const port = Number(process.argv[3] || 4173);
  serve(root, port).then(s => console.log(`serving ${root} at http://localhost:${s.port}/`));
}
