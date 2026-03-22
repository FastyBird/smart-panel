#!/usr/bin/env python3
"""Local mDNS discovery proxy for flutter-pi displays.

Runs a lightweight HTTP server on localhost:3001 that wraps avahi-browse
so the panel app can discover backends even when bonsoir doesn't work
under flutter-pi's DRM/KMS environment.
"""

import json
import re
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_TYPE = '_fastybird-panel._tcp'
BROWSE_TIMEOUT = 5  # seconds — must fit within Dart client's 6s timeout


class DiscoveryHandler(BaseHTTPRequestHandler):
    """HTTP request handler for mDNS discovery proxy."""

    def do_GET(self):
        if self.path == '/discover':
            backends = discover_backends()
            self._send_json(200, backends)
        elif self.path == '/health':
            self._send_json(200, {'status': 'ok'})
        else:
            self.send_error(404)

    def _send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Suppress default stderr logging — use journal via stdout."""
        pass


def _decode_avahi_escapes(text):
    """Decode avahi-browse decimal escape sequences (e.g. \\032 -> space)."""
    return re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1))), text)


def discover_backends():
    """Run avahi-browse and parse discovered backends."""
    try:
        result = subprocess.run(
            ['avahi-browse', '-rpt', SERVICE_TYPE, '--terminate'],
            capture_output=True,
            text=True,
            timeout=BROWSE_TIMEOUT,
        )
        backends = []
        seen = set()

        for line in result.stdout.strip().split('\n'):
            if not line.startswith('='):
                continue

            parts = line.split(';')
            if len(parts) < 9:
                continue

            host = parts[7]
            port = parts[8]
            key = (host, port)

            if key in seen:
                continue
            seen.add(key)

            # Parse TXT record key=value pairs from remaining fields
            # avahi-browse outputs TXT as: "key1=val1" "key2=val2"
            txt = {}
            if len(parts) > 9:
                for token in parts[9].split():
                    token = token.strip('"')
                    if '=' in token:
                        k, v = token.split('=', 1)
                        txt[k] = v

            backends.append({
                'name': _decode_avahi_escapes(parts[3]),
                'host': host,
                'port': int(port),
                'api': txt.get('api', '/api/v1'),
                'version': txt.get('version') or None,
            })

        return backends
    except Exception:
        return []


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 3001), DiscoveryHandler)
    print(f'Discovery proxy listening on http://127.0.0.1:3001')
    server.serve_forever()
