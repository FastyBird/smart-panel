# Task: Local mDNS discovery service for flutter-pi displays
ID: FEATURE-FLUTTERPI-MDNS
Type: feature
Scope: backend, panel
Size: small
Parent: (none)
Status: planned

## 1. Business goal

In order to discover Smart Panel backends without manual URL entry...
As a user running the panel app via flutter-pi on a Raspberry Pi display...
I want the panel to automatically find available backends on the network.

## 2. Context

- The panel app uses the `bonsoir` Dart package for mDNS discovery.
- `bonsoir_linux` requires the Linux desktop plugin infrastructure (GTK/D-Bus) which flutter-pi's DRM/KMS environment doesn't provide.
- mDNS discovery works on Android, iOS, macOS, Windows, and Linux desktop — only flutter-pi is affected.
- The backend advertises via `_fastybird-panel._tcp` using bonjour-service (Node.js).
- `avahi-browse` works perfectly on the command line — the issue is only inside flutter-pi.
- The panel already has a fallback for `FB_APP_HOST` env var (compile-time), used for AIO variant.
- For display-only images, the user currently has to enter the backend URL manually.

### Approach

Create a lightweight HTTP discovery service that runs on `localhost:3001` on display devices. The panel app calls this local API instead of using bonsoir directly.

```
Panel app (flutter-pi)
  → GET http://localhost:3001/discover
  → Local discovery service
  → avahi-browse -rpt _fastybird-panel._tcp
  → JSON response with discovered backends
```

## 3. Scope

**In scope**

- Lightweight local HTTP discovery service (~50 lines)
- Uses `avahi-browse` for actual mDNS resolution (proven to work)
- Returns JSON list of discovered backends
- Systemd service that starts before the display service
- Panel app fallback: try bonsoir first, if empty/error → call local discovery API
- Works for both display-only and AIO variants (AIO doesn't need it but it's harmless)

**Out of scope**

- Fixing bonsoir to work with flutter-pi (upstream issue)
- Running the discovery service on non-Raspberry Pi platforms
- Persistent caching of discovered backends

## 4. Acceptance criteria

- [ ] Discovery service listens on `localhost:3001`
- [ ] `GET /discover` returns JSON array of backends: `[{"name": "...", "host": "...", "port": 3000, "api": "/api/v1", "version": "..."}]`
- [ ] `GET /health` returns `{"status": "ok"}` for monitoring
- [ ] Service uses `avahi-browse -rpt _fastybird-panel._tcp` with 5-second timeout
- [ ] Service starts before `smart-panel-display.service`
- [ ] Panel app's `MdnsDiscoveryService` tries bonsoir first, falls back to `http://localhost:3001/discover`
- [ ] Display-only image includes the service
- [ ] AIO image includes the service (harmless, consistent)
- [ ] Works when avahi-daemon is running
- [ ] Returns empty array gracefully when no backends found or avahi not available

## 5. Example scenarios

### Scenario: flutter-pi display discovers backend

Given the panel app is running via flutter-pi
And bonsoir mDNS discovery returns no results (flutter-pi limitation)
When the panel calls `GET http://localhost:3001/discover`
Then the discovery service runs `avahi-browse` in the background
And returns `[{"name": "FastyBird Smart Panel (smart-panel-server)", "host": "10.10.0.22", "port": 3000, "api": "/api/v1", "version": "1.0.0"}]`
And the panel shows the backend in the gateway list

### Scenario: Android/desktop app uses bonsoir directly

Given the panel app is running on Android or Linux desktop
When bonsoir discovers backends via native mDNS
Then the local discovery API is never called
And everything works as before

## 6. Technical constraints

- The discovery service must be minimal — no npm install, no dependencies. Use Python's `http.server` or a simple shell script with `socat`/`ncat`.
- Alternatively: a Node.js script using only built-in `http` module (Node.js is available on AIO, but NOT on display-only images).
- For display-only images (no Node.js), use Python3 which is available in the base Raspbian image.
- The avahi-browse command is: `avahi-browse -rpt _fastybird-panel._tcp --terminate`
- Output format: `=;wlan0;IPv4;FastyBird Smart Panel (server);_fastybird-panel._tcp;local;smart-panel-server.local;10.10.0.22;3000;version=1.0.0 api=/api/v1 secure=false`
- Parse the `;`-delimited fields to extract name, host, port, and TXT records.
- Discovery timeout: 5 seconds (avahi-browse `--terminate` stops after all responses received).

## 7. Implementation hints

### Discovery service (Python3, ~50 lines)

```python
#!/usr/bin/env python3
"""Local mDNS discovery proxy for flutter-pi displays."""
import json, subprocess, http.server

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/discover':
            backends = discover_backends()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(backends).encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_error(404)

def discover_backends():
    try:
        result = subprocess.run(
            ['avahi-browse', '-rpt', '_fastybird-panel._tcp', '--terminate'],
            capture_output=True, text=True, timeout=10
        )
        backends = []
        for line in result.stdout.strip().split('\n'):
            if line.startswith('='):
                parts = line.split(';')
                if len(parts) >= 9:
                    txt = dict(kv.split('=', 1) for kv in parts[9:] if '=' in kv) if len(parts) > 9 else {}
                    backends.append({
                        'name': parts[3],
                        'host': parts[7],
                        'port': int(parts[8]),
                        'api': txt.get('api', '/api/v1'),
                        'version': txt.get('version', ''),
                    })
        return backends
    except Exception:
        return []

http.server.HTTPServer(('127.0.0.1', 3001), Handler).serve_forever()
```

### Systemd service

```ini
[Unit]
Description=Smart Panel mDNS Discovery Proxy
After=avahi-daemon.service
Wants=avahi-daemon.service
Before=smart-panel-display.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/smart-panel-display/discovery-service.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Panel app changes (Dart)

In `MdnsDiscoveryService.discover()`, after the bonsoir timeout returns empty:

```dart
// Fallback: try local discovery proxy (for flutter-pi)
if (_discoveredBackends.isEmpty) {
  try {
    final response = await http.get(Uri.parse('http://localhost:3001/discover'))
        .timeout(const Duration(seconds: 6));
    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      for (final item in data) {
        final backend = DiscoveredBackend(
          name: item['name'],
          host: item['host'],
          port: item['port'],
          apiPath: item['api'],
          version: item['version'],
          isSecure: false,
        );
        _discoveredBackends.add(backend);
        onBackendFound?.call(backend);
      }
    }
  } catch (_) {
    // Discovery proxy not available — user will use manual entry
  }
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- The discovery service script must work with Python 3.11+ (Bookworm default).
- The panel app change must not break existing bonsoir-based discovery on other platforms.
- Test that the fallback only activates when bonsoir returns empty results.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
