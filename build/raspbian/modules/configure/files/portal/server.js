#!/usr/bin/env node
'use strict';

/**
 * Smart Panel Captive Portal Server
 *
 * Minimal HTTP server for WiFi provisioning on first boot.
 * No npm dependencies — uses only Node.js built-in modules.
 *
 * Endpoints:
 *   GET  /                   — Setup page
 *   GET  /api/scan           — Scan WiFi networks
 *   GET  /api/status         — Current connection status
 *   POST /api/connect        — Connect to a WiFi network
 *   GET  /hotspot-detect.*   — Captive portal detection (redirect)
 *   GET  /generate_204       — Android captive portal detection
 *   GET  /connecttest.txt    — Windows captive portal detection
 *   *                        — All other paths redirect to /
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const PORT = 80;
const PORTAL_IP = '192.168.4.1';
const PORTAL_DIR = path.dirname(__filename);
const WIFI_CONFIGURED_MARKER = '/var/lib/smart-panel/.wifi-configured';

// Captive portal detection paths — redirect to setup page
const CAPTIVE_PATHS = new Set([
	'/hotspot-detect.html',
	'/library/test/success.html',
	'/generate_204',
	'/connecttest.txt',
	'/redirect',
	'/ncsi.txt',
	'/check_network_status.txt',
	'/success.txt',
	'/kindle-wifi/wifistub.html',
	'/favicon.ico',
]);

let indexHtml = '';
try {
	indexHtml = fs.readFileSync(path.join(PORTAL_DIR, 'index.html'), 'utf8');
} catch (err) {
	console.error('Failed to load index.html:', err.message);
	process.exit(1);
}

/**
 * Scan available WiFi networks using nmcli.
 * Temporarily switches wlan0 to station mode for scanning if needed.
 */
function scanWifiNetworks() {
	try {
		// Trigger a fresh scan (may fail in AP mode — that's OK, we use cached results)
		try {
			execSync('nmcli device wifi rescan ifname wlan0 2>/dev/null', { timeout: 10000 });
		} catch (_) {
			// rescan may fail in AP mode
		}

		const output = execSync(
			'nmcli -t -f SSID,SIGNAL,SECURITY device wifi list ifname wlan0 2>/dev/null || true',
			{ timeout: 10000, encoding: 'utf8' }
		);

		const seen = new Set();
		const networks = [];

		for (const line of output.trim().split('\n')) {
			if (!line) continue;
			// nmcli -t uses : as separator; SSID may contain escaped colons
			const parts = line.split(':');
			if (parts.length < 3) continue;

			const ssid = parts[0].replace(/\\:/g, ':');
			if (!ssid || seen.has(ssid)) continue;
			seen.add(ssid);

			networks.push({
				ssid,
				signal: parseInt(parts[1], 10) || 0,
				security: parts.slice(2).join(' ').trim(),
			});
		}

		// Sort by signal strength descending
		networks.sort((a, b) => b.signal - a.signal);
		return networks;
	} catch (err) {
		console.error('WiFi scan failed:', err.message);
		return [];
	}
}

/**
 * Get current connection status.
 */
function getStatus() {
	try {
		const state = execSync(
			'nmcli -t -f WIFI-HW,WIFI general 2>/dev/null || echo "unknown:unknown"',
			{ timeout: 5000, encoding: 'utf8' }
		).trim();

		const hostname = execSync('hostname', { timeout: 2000, encoding: 'utf8' }).trim();

		return {
			mode: 'setup',
			hostname,
			wifiHw: state,
		};
	} catch (_) {
		return { mode: 'setup', hostname: 'smart-panel' };
	}
}

/**
 * Connect to a WiFi network.
 * Returns a promise that resolves with { success, message, ip }.
 */
function connectToWifi(ssid, password, country, hostname, timezone) {
	return new Promise((resolve) => {
		try {
			// Set WiFi country
			if (country) {
				try {
					execSync(`iw reg set ${country} 2>/dev/null`, { timeout: 5000 });
					execSync(`raspi-config nonint do_wifi_country ${country} 2>/dev/null`, { timeout: 5000 });
				} catch (_) {
					// non-fatal
				}
			}

			// Set hostname
			if (hostname) {
				try {
					execSync(`hostnamectl set-hostname ${hostname}`, { timeout: 5000 });
					execSync(`sed -i 's/127.0.1.1.*/127.0.1.1\\t${hostname}/' /etc/hosts`, { timeout: 5000 });
				} catch (_) {
					// non-fatal
				}
			}

			// Set timezone
			if (timezone) {
				try {
					execSync(`timedatectl set-timezone ${timezone}`, { timeout: 5000 });
				} catch (_) {
					// non-fatal
				}
			}

			// Deactivate the hotspot connection
			try {
				execSync('nmcli connection down SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
			} catch (_) {
				// may not exist
			}

			// Small delay to let the interface settle
			execSync('sleep 2');

			// Unblock WiFi
			try {
				execSync('rfkill unblock wifi 2>/dev/null', { timeout: 5000 });
			} catch (_) {}

			// Connect to the user's WiFi
			try {
				execSync(
					`nmcli device wifi connect ${JSON.stringify(ssid)} password ${JSON.stringify(password)} ifname wlan0`,
					{ timeout: 30000 }
				);
			} catch (err) {
				// Try adding as a new connection profile
				try {
					execSync(
						`nmcli connection add type wifi con-name ${JSON.stringify(ssid)} ssid ${JSON.stringify(ssid)} ` +
						`wifi-sec.key-mgmt wpa-psk wifi-sec.psk ${JSON.stringify(password)} autoconnect yes`,
						{ timeout: 15000 }
					);
					execSync(`nmcli connection up ${JSON.stringify(ssid)}`, { timeout: 30000 });
				} catch (err2) {
					resolve({
						success: false,
						message: `Failed to connect: ${err2.message}`,
					});
					return;
				}
			}

			// Wait a moment for IP assignment
			execSync('sleep 3');

			// Get IP address
			let ip = '';
			try {
				ip = execSync("hostname -I | awk '{print $1}'", { timeout: 5000, encoding: 'utf8' }).trim();
			} catch (_) {}

			// Create WiFi configured marker
			try {
				fs.writeFileSync(WIFI_CONFIGURED_MARKER, `configured=${new Date().toISOString()}\nssid=${ssid}\n`);
			} catch (_) {}

			// Delete the hotspot connection profile
			try {
				execSync('nmcli connection delete SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
			} catch (_) {}

			const finalHostname = hostname || 'smart-panel';

			resolve({
				success: true,
				message: 'Connected successfully!',
				ip,
				hostname: finalHostname,
				url: `http://${finalHostname}.local:3000`,
			});

			// Schedule service stop + backend start after response is sent
			setTimeout(() => {
				console.log('WiFi configured — stopping portal service...');
				try {
					execSync('systemctl start smart-panel.service 2>/dev/null', { timeout: 5000 });
				} catch (_) {}
				try {
					execSync('systemctl start smart-panel-wifi-watchdog.service 2>/dev/null', { timeout: 5000 });
				} catch (_) {}
				// Stop ourselves last
				exec('systemctl stop smart-panel-portal.service 2>/dev/null');
			}, 2000);
		} catch (err) {
			resolve({
				success: false,
				message: `Unexpected error: ${err.message}`,
			});
		}
	});
}

/**
 * Parse JSON POST body.
 */
function parseBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
			if (body.length > 4096) {
				reject(new Error('Body too large'));
			}
		});
		req.on('end', () => {
			try {
				resolve(JSON.parse(body));
			} catch (err) {
				reject(err);
			}
		});
	});
}

/**
 * Send JSON response.
 */
function sendJson(res, status, data) {
	const json = JSON.stringify(data);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(json),
		'Cache-Control': 'no-store',
	});
	res.end(json);
}

// ──────────────────────────────────────────────────────────────
// HTTP Server
// ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
	const url = req.url.split('?')[0];

	// Captive portal detection — redirect to setup page
	if (CAPTIVE_PATHS.has(url)) {
		res.writeHead(302, { Location: `http://${PORTAL_IP}/` });
		res.end();
		return;
	}

	// Setup page
	if (url === '/' && req.method === 'GET') {
		res.writeHead(200, {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Length': Buffer.byteLength(indexHtml),
			'Cache-Control': 'no-store',
		});
		res.end(indexHtml);
		return;
	}

	// WiFi scan
	if (url === '/api/scan' && req.method === 'GET') {
		const networks = scanWifiNetworks();
		sendJson(res, 200, { networks });
		return;
	}

	// Status
	if (url === '/api/status' && req.method === 'GET') {
		const status = getStatus();
		sendJson(res, 200, status);
		return;
	}

	// Connect
	if (url === '/api/connect' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const { ssid, password, country, hostname, timezone } = body;

			if (!ssid || !password) {
				sendJson(res, 400, { success: false, message: 'SSID and password are required' });
				return;
			}

			const result = await connectToWifi(ssid, password, country, hostname, timezone);
			sendJson(res, result.success ? 200 : 500, result);
		} catch (err) {
			sendJson(res, 400, { success: false, message: 'Invalid request body' });
		}
		return;
	}

	// All other paths — redirect to setup page (helps with captive portal detection)
	res.writeHead(302, { Location: `http://${PORTAL_IP}/` });
	res.end();
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`Smart Panel Captive Portal running on http://${PORTAL_IP}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('Received SIGTERM — shutting down portal server');
	server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
	console.log('Received SIGINT — shutting down portal server');
	server.close(() => process.exit(0));
});
