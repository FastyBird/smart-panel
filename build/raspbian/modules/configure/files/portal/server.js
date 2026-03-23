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
const { execSync, execFileSync, execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PORT = 80;
const PORTAL_IP = '192.168.4.1';
const PORTAL_DIR = __dirname;
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

let connectInProgress = false;
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
async function scanWifiNetworks() {
	try {
		// Trigger a fresh scan (may fail in AP mode — that's OK, we use cached results)
		try {
			await execFileAsync('nmcli', ['device', 'wifi', 'rescan', 'ifname', 'wlan0'], { timeout: 10000 });
		} catch (_) {
			// rescan may fail in AP mode
		}

		let output;
		try {
			const result = await execFileAsync(
				'nmcli', ['-t', '-f', 'SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list', 'ifname', 'wlan0'],
				{ timeout: 10000 }
			);
			output = result.stdout;
		} catch (_) {
			return [];
		}

		const seen = new Set();
		const networks = [];

		for (const line of output.trim().split('\n')) {
			if (!line) continue;
			// nmcli -t uses : as separator and escapes literal colons in values as \:
			// Split on unescaped colons only (: not preceded by \), then unescape.
			const parts = line.split(/(?<!\\):/);
			if (parts.length < 3) continue;

			const ssid = parts[0].replace(/\\:/g, ':');
			if (!ssid || seen.has(ssid)) continue;
			seen.add(ssid);

			networks.push({
				ssid,
				signal: parseInt(parts[1], 10) || 0,
				security: parts.slice(2).join(':').trim().replace(/\\:/g, ':'),
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
 * Validate and sanitize inputs to prevent command injection.
 * Each field is validated against a strict allowlist pattern.
 */
function validateInputs(country, hostname, timezone, password, ssid) {
	const errors = [];

	// SSID: reject null bytes and enforce max 32-byte length
	if (ssid && /\x00/.test(ssid)) {
		errors.push('SSID contains invalid characters');
	}
	if (ssid && Buffer.byteLength(ssid) > 32) {
		errors.push('SSID must be at most 32 bytes');
	}

	if (password && (password.length < 8 || password.length > 63)) {
		errors.push('WiFi password must be 8–63 characters');
	}

	// Password: reject null bytes for the same reason as SSID
	if (password && /\x00/.test(password)) {
		errors.push('Password contains invalid characters');
	}

	if (country && !/^[A-Z]{2}$/.test(country)) {
		errors.push('Country code must be exactly 2 uppercase letters (e.g., US, DE)');
	}

	if (hostname && !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(hostname)) {
		errors.push('Hostname must contain only letters, numbers, and hyphens (max 63 chars)');
	}

	if (timezone && !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+){1,2}$/.test(timezone)) {
		errors.push('Invalid timezone format (expected e.g., America/New_York)');
	}

	return errors;
}

/**
 * Re-activate the hotspot AP after a failed WiFi connection attempt.
 */
function reactivateHotspot() {
	try {
		execSync('nmcli connection up SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
		console.log('Hotspot re-activated after connection failure');
	} catch (_) {
		console.error('Failed to re-activate hotspot — device may be unreachable');
	}
}

/**
 * Apply system settings (country, hostname, timezone) before WiFi connection.
 * These run while the AP is still active so failures can be reported to the client.
 * Caller is responsible for input validation before calling this function.
 */
function applySystemSettings(country, hostname, timezone) {
	const errors = [];

	if (country) {
		try {
			execFileSync('iw', ['reg', 'set', country], { timeout: 5000, stdio: 'ignore' });
			execFileSync('raspi-config', ['nonint', 'do_wifi_country', country], { timeout: 5000, stdio: 'ignore' });
		} catch (_) {
			// non-fatal
		}
	}

	if (hostname) {
		try {
			execFileSync('hostnamectl', ['set-hostname', hostname], { timeout: 5000 });
			const hostsPath = '/etc/hosts';
			let hosts = fs.readFileSync(hostsPath, 'utf8');
			hosts = hosts.replace(/^127\.0\.1\.1\s+.*$/m, `127.0.1.1\t${hostname}`);
			fs.writeFileSync(hostsPath, hosts);
		} catch (err) {
			errors.push(`hostname: ${err.message}`);
		}
	}

	if (timezone) {
		try {
			execFileSync('timedatectl', ['set-timezone', timezone], { timeout: 5000 });
		} catch (err) {
			errors.push(`timezone: ${err.message}`);
		}
	}

	return errors;
}

/**
 * Connect to a WiFi network.
 * Runs AFTER the HTTP response has been sent to the client (the AP is about
 * to go down, so the client cannot receive anything after this point).
 * On failure, re-activates the hotspot so the user can retry.
 */
function connectToWifiAsync(ssid, password, hostname) {
	// Deactivate the hotspot connection — client connection dies here
	try {
		execSync('nmcli connection down SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
	} catch (_) {}

	// Small delay to let the interface settle
	execSync('sleep 2');

	// Unblock WiFi
	try {
		execSync('rfkill unblock wifi 2>/dev/null', { timeout: 5000 });
	} catch (_) {}

	// Connect to the user's WiFi
	// Use execFileSync with argument arrays to avoid shell interpretation
	// of user-supplied ssid/password (prevents command injection)
	const connectArgs = password
		? ['device', 'wifi', 'connect', ssid, 'password', password, 'ifname', 'wlan0']
		: ['device', 'wifi', 'connect', ssid, 'ifname', 'wlan0'];

	try {
		execFileSync('nmcli', connectArgs, { timeout: 30000 });
	} catch (err) {
		// The failed attempt may have left a connection profile behind.
		try {
			execFileSync('nmcli', ['connection', 'delete', ssid], { timeout: 10000 });
		} catch (_) {}

		// Try adding as a new connection profile
		const addArgs = ['connection', 'add', 'type', 'wifi', 'con-name', ssid, 'ssid', ssid, 'autoconnect', 'yes'];
		if (password) {
			addArgs.push('wifi-sec.key-mgmt', 'wpa-psk', 'wifi-sec.psk', password);
		}

		try {
			execFileSync('nmcli', addArgs, { timeout: 15000 });
			execFileSync('nmcli', ['connection', 'up', ssid], { timeout: 30000 });
		} catch (err2) {
			console.error(`WiFi connection failed: ${err2.message}`);
			connectInProgress = false;
			reactivateHotspot();
			return;
		}
	}

	// Wait a moment for IP assignment
	execSync('sleep 3');

	// Create WiFi configured marker
	try {
		fs.mkdirSync(path.dirname(WIFI_CONFIGURED_MARKER), { recursive: true });
		fs.writeFileSync(WIFI_CONFIGURED_MARKER, `configured=${new Date().toISOString()}\nssid=${ssid}\n`);
	} catch (_) {}

	// Delete the hotspot connection profile
	try {
		execSync('nmcli connection delete SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
	} catch (_) {}

	// Get IP for logging
	let ip = '';
	try {
		ip = execSync("hostname -I | awk '{print $1}'", { timeout: 5000, encoding: 'utf8' }).trim();
	} catch (_) {}

	const finalHostname = hostname || 'smart-panel';
	console.log(`WiFi connected — IP: ${ip}, URL: http://${finalHostname}.local:3000`);

	// Start backend + watchdog, then stop portal
	try {
		execSync('systemctl start smart-panel.service 2>/dev/null', { timeout: 5000 });
	} catch (_) {}
	try {
		execSync('systemctl start smart-panel-wifi-watchdog.service 2>/dev/null', { timeout: 5000 });
	} catch (_) {}
	// Stop ourselves last — uses exec (async) intentionally as this is a
	// hardcoded command with no user input, and we don't need to wait for it
	exec('systemctl stop smart-panel-portal.service');
}

/**
 * Parse JSON POST body.
 */
function parseBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		let rejected = false;
		req.on('data', (chunk) => {
			if (rejected) return;
			body += chunk;
			if (body.length > 4096) {
				rejected = true;
				body = '';
				req.destroy();
				reject(new Error('Body too large'));
			}
		});
		req.on('end', () => {
			if (rejected) return;
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
		const networks = await scanWifiNetworks();
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
		if (connectInProgress) {
			sendJson(res, 409, { success: false, message: 'Connection already in progress' });
			return;
		}

		try {
			const body = await parseBody(req);
			const { ssid, password, country, hostname, timezone } = body;

			if (!ssid || typeof ssid !== 'string') {
				sendJson(res, 400, { success: false, message: 'SSID is required' });
				return;
			}

			// Validate and sanitize optional fields
			const sanitizedPassword = typeof password === 'string' && password.length > 0 ? password : '';
			const sanitizedCountry = typeof country === 'string' ? country : '';
			const sanitizedHostname = typeof hostname === 'string' ? hostname : '';
			const sanitizedTimezone = typeof timezone === 'string' ? timezone : '';

			const validationErrors = validateInputs(sanitizedCountry, sanitizedHostname, sanitizedTimezone, sanitizedPassword, ssid);
			if (validationErrors.length > 0) {
				sendJson(res, 400, { success: false, message: validationErrors.join('; ') });
				return;
			}

			// Apply system settings while AP is still up (errors can reach the client)
			const settingsErrors = applySystemSettings(sanitizedCountry, sanitizedHostname, sanitizedTimezone);
			if (settingsErrors.length > 0) {
				console.warn('Non-fatal settings errors:', settingsErrors.join('; '));
			}

			const finalHostname = sanitizedHostname || 'smart-panel';

			// Send the response BEFORE deactivating the AP — the client will lose
			// connectivity as soon as the hotspot goes down, so this is the last
			// message that can reach them. The client shows a "connecting" view
			// with the expected URL so the user knows where to find the panel.
			sendJson(res, 200, {
				success: true,
				message: 'Connecting...',
				hostname: finalHostname,
				url: `http://${finalHostname}.local:3000`,
			});

			// Run the actual WiFi connection asynchronously after the response is flushed.
			// This blocks the event loop but that's fine — no more client requests are expected.
			connectInProgress = true;
			setTimeout(() => {
				connectToWifiAsync(ssid, sanitizedPassword, sanitizedHostname);
			}, 500);
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

/**
 * Clean up portal resources (DNS redirect, hotspot).
 * Defense-in-depth: the bash wrapper also has a cleanup trap,
 * but this handles cases where node receives signals directly.
 */
function portalCleanup() {
	try {
		execSync('rm -f /etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf', { timeout: 5000 });
	} catch (_) {}
	try {
		execSync('nmcli connection down SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
	} catch (_) {}
	try {
		execSync('nmcli connection delete SmartPanel-Hotspot 2>/dev/null', { timeout: 10000 });
	} catch (_) {}
}

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('Received SIGTERM — shutting down portal server');
	portalCleanup();
	server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
	console.log('Received SIGINT — shutting down portal server');
	portalCleanup();
	server.close(() => process.exit(0));
});
