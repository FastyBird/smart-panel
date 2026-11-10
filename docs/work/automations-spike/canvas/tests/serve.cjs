// Static server emulating a reverse proxy that exposes a build ONLY under a path prefix (like Home Assistant ingress).
// Usage: node serve.cjs <dir> <port> [prefix]   — any request outside the prefix is answered 404 and logged.
const http = require('http'); const fs = require('fs'); const path = require('path');
const [dir, port, prefix = '/'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
	const url = decodeURIComponent(req.url.split('?')[0]);
	if (!url.startsWith(prefix)) { console.log('OUTSIDE-PREFIX 404', url); res.writeHead(404); return res.end('outside prefix'); }
	const file = path.join(dir, url.slice(prefix.length) || 'spike.html');
	if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { console.log('404', url); res.writeHead(404); return res.end('not found'); }
	res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
	fs.createReadStream(file).pipe(res);
}).listen(Number(port), () => console.log('serving', dir, 'at', prefix, 'on', port));
