# Task: Captive Portal for WiFi provisioning
ID: FEATURE-CAPTIVE-PORTAL
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to set up Smart Panel without needing a computer, ethernet cable, or SD card editing...
As a user who just flashed the image and powered on the Pi...
I want the device to create a WiFi hotspot with a setup page where I can enter my WiFi credentials and configure the system.

## 2. Context

- Current WiFi setup requires creating a `smart-panel.conf` file on the SD card boot partition from a computer — not user-friendly.
- IoT devices like WLED, ESPHome, Tasmota, and Home Assistant use captive portal provisioning as the standard UX pattern.
- Raspberry Pi supports AP mode via `hostapd` + `dnsmasq`.
- The captive portal should work on phones (iOS, Android) and laptops — all platforms auto-detect captive portals and open the page automatically.
- Once WiFi is configured, the AP should be disabled and never start again (unless factory reset or WiFi connection fails persistently).

### How it works (user perspective)

1. User flashes SD card and powers on the Pi
2. After ~30 seconds, a WiFi network `SmartPanel-XXXX` appears (last 4 of MAC, WPA2 password: `smartpanel`)
3. User connects their phone/laptop to `SmartPanel-XXXX`
4. A setup page opens automatically (captive portal detection)
5. User fills in: WiFi network, password, country code
6. Optionally: hostname, timezone
7. User clicks "Save & Connect"
8. Pi disables AP, connects to user's WiFi
9. Smart Panel is accessible at `http://smart-panel.local:3000`

### Existing tools on Raspberry Pi OS

- `hostapd` — WiFi Access Point daemon
- `dnsmasq` — DHCP server + DNS (redirects all DNS to the portal)
- `NetworkManager` — already installed, can manage AP mode natively via `nmcli`
- Alternatively: `nmcli` can create a hotspot without hostapd

### Reference implementations

- **WLED**: ESP32-based, starts AP on first boot, serves config page on 4.3.2.1
- **ESPHome**: Similar pattern, uses mDNS fallback
- **Raspberry Pi Connect**: Uses a captive portal for initial cloud pairing
- **comitup** (https://github.com/davesteele/comitup): Python-based captive portal for RPi, uses NetworkManager

## 3. Scope

**In scope**

- AP mode activation when no WiFi is configured (first boot or after factory reset)
- Captive portal with a setup web page
- WiFi credential input (SSID, password, country)
- Optional system config (hostname, timezone)
- Captive portal detection for iOS, Android, Windows, macOS, Linux
- Switch from AP mode to client mode after configuration
- Fallback: re-enable AP if WiFi connection fails for 5+ minutes after reboot
- LED/status indication (if available) — e.g., blinking = AP mode, solid = connected
- The `smart-panel.conf` boot file approach continues to work as an alternative (skip AP if config file exists)

**Out of scope**

- Bluetooth provisioning (like ESP32 BLE provisioning)
- WPS button support
- Multiple WiFi network profiles
- Enterprise WiFi (WPA2-Enterprise, 802.1X)
- Custom SSL certificate for the portal

## 4. Acceptance criteria

### AP Mode

- [x] On first boot with no WiFi configured and no `smart-panel.conf`, the Pi starts a WiFi AP named `SmartPanel-XXXX` (last 4 of MAC) after first-boot completes
- [x] AP uses WPA2 with a default password printed on the boot log: `smartpanel`
- [x] AP assigns IPs via DHCP (192.168.4.x range)
- [x] All DNS queries redirect to the Pi's IP (captive portal detection)
- [x] AP mode is indicated in system status API — `network_mode` field: online/offline/setup

### Captive Portal Web Page

- [x] A lightweight HTTP server runs on port 80 during AP mode
- [x] The page is mobile-friendly (responsive, works on phone screens)
- [x] Captive portal auto-detection works on iOS, Android, Windows, macOS
- [x] Page shows: WiFi network dropdown (scan results), password field, country selector
- [x] Optional fields: hostname, timezone
- [x] "Scan" button refreshes available WiFi networks
- [x] "Save & Connect" validates inputs, saves config, and initiates connection
- [x] Loading/progress indicator while connecting
- [x] Success page with the new IP address and `http://<hostname>.local:3000` link
- [x] Error page if connection fails, with option to retry

### Mode Switching

- [x] After successful WiFi connection, AP is disabled
- [x] Smart Panel backend starts normally on the WiFi network
- [x] A marker file `/var/lib/smart-panel/.wifi-configured` prevents AP from starting on subsequent boots
- [x] Factory reset removes the marker and re-enables AP mode on next boot

### Fallback

- [x] If the configured WiFi network is unavailable for 5 minutes after boot, AP mode re-activates
- [x] User can reconfigure WiFi through the portal
- [x] If `smart-panel.conf` exists on the boot partition, skip AP mode entirely (existing flow)

### Integration

- [x] The captive portal service is a systemd service: `smart-panel-portal.service`
- [x] It runs before `smart-panel.service` (the backend)
- [x] Once WiFi is connected, it stops itself and the backend starts
- [x] System status API exposes current mode: `setup` (AP) / `online` (connected) / `offline` — via `network_mode` in system info response
- [ ] Admin UI shows a banner when in AP/setup mode — deferred: needs admin UI component

## 5. Example scenarios

### Scenario: First boot without any config

Given a freshly flashed SD card with no `smart-panel.conf`
When the Pi boots for the first time
Then first-boot runs (expand partition, generate JWT, migrate DB)
And after first-boot completes, AP mode activates
And `SmartPanel-A3F7` WiFi network appears (WPA2, password: `smartpanel`)
And connecting to it opens the captive portal setup page

### Scenario: User configures WiFi via portal

Given the user is connected to `SmartPanel-A3F7` and sees the setup page
When they select "MyHomeWiFi" from the dropdown, enter the password, select "CZ"
And click "Save & Connect"
Then the Pi saves the WiFi configuration
And disables the AP
And connects to "MyHomeWiFi"
And starts the Smart Panel backend
And the success page shows: "Connected! Access Smart Panel at http://smart-panel.local:3000"

### Scenario: WiFi network unavailable after reboot

Given the Pi was configured for "MyHomeWiFi" and rebooted
When "MyHomeWiFi" is not available (router off, out of range)
And 5 minutes pass without connection
Then AP mode re-activates with `SmartPanel-A3F7`
And user can reconfigure WiFi through the portal

### Scenario: Boot file takes priority

Given the user created `smart-panel.conf` on the boot partition with WiFi settings
When the Pi boots
Then WiFi is configured from the file (existing flow)
And `apply-boot-config.sh` archives it to `.boot-config.applied`
And AP mode is never activated (portal checks `.boot-config.applied`)

### Scenario: Factory reset

Given the user triggers a factory reset from the admin UI
When the Pi reboots
Then `.wifi-configured` and `.boot-config.applied` are deleted
And AP mode activates on next boot
And the user can reconfigure everything

## 6. Technical constraints

- Use NetworkManager (`nmcli`) for AP mode — it's already installed and avoids adding hostapd/dnsmasq as extra dependencies.
- `nmcli device wifi hotspot` can create an AP without hostapd.
- For DNS redirection (captive portal detection), use `dnsmasq` in lightweight mode or NetworkManager's built-in DNS.
- The captive portal web page should be a minimal static HTML/JS page served by a lightweight HTTP server (e.g., Node.js `http` module or Python's `http.server`).
- Keep the portal server separate from the Smart Panel backend — it must work before the backend starts.
- The portal should be as small as possible — no npm install, no build step. A single HTML file + a tiny server script.
- Captive portal detection relies on specific HTTP responses:
  - iOS: `GET /hotspot-detect.html` → must NOT return success (redirect instead)
  - Android: `GET /generate_204` → must NOT return 204 (redirect instead)
  - Windows: `GET /connecttest.txt` → redirect to portal
  - macOS: `GET /hotspot-detect.html` → same as iOS
- All these paths should redirect to the setup page.
- AP mode should use a predictable IP: `192.168.4.1`
- DHCP range: `192.168.4.10` - `192.168.4.50`
- The WiFi scan should use `nmcli device wifi list` for available networks.

## 7. Implementation hints

### Approach: NetworkManager-based (recommended)

```bash
# Create hotspot
nmcli device wifi hotspot ifname wlan0 ssid "SmartPanel-A3F7" password "smartpanel"

# Get hotspot IP
nmcli -g IP4.ADDRESS connection show Hotspot

# Scan available networks (while in AP mode — may need to toggle)
nmcli device wifi rescan
nmcli -t -f SSID,SIGNAL,SECURITY device wifi list

# Connect to user's network
nmcli device wifi connect "MyHomeWiFi" password "secret" ifname wlan0

# Delete hotspot connection
nmcli connection delete Hotspot
```

### Portal server (minimal Node.js)

A ~100-line Node.js HTTP server that:
- Serves the setup HTML page on `/`
- Handles captive portal detection redirects
- Exposes `/api/scan` for WiFi network list
- Accepts `/api/connect` POST with SSID + password
- Runs as `smart-panel-portal.service`

### File layout

```
/opt/smart-panel/portal/
  server.js          # Minimal HTTP server (~100 lines)
  index.html         # Setup page (single file, inline CSS/JS)
```

### Systemd service ordering

```
smart-panel-firstboot.service (oneshot, first boot only)
  ↓
smart-panel-portal.service (if no WiFi configured)
  ↓ (after WiFi connected, stops itself)
smart-panel.service (main backend)
```

### Captive portal detection

```javascript
// In server.js — redirect all captive portal detection URLs to the setup page
const CAPTIVE_PATHS = [
  '/hotspot-detect.html',      // iOS, macOS
  '/library/test/success.html', // iOS
  '/generate_204',              // Android
  '/connecttest.txt',           // Windows
  '/redirect',                  // Windows
  '/ncsi.txt',                  // Windows
  '/check_network_status.txt',  // Samsung
];

if (CAPTIVE_PATHS.includes(req.url)) {
  res.writeHead(302, { Location: 'http://192.168.4.1/' });
  res.end();
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- The portal server must be minimal — no npm dependencies, no build step. Pure Node.js `http` module.
- The setup page must be a single HTML file with inline CSS and JS — no external assets.
- Test captive portal detection on at least iOS and Android (document the test URLs).
- The AP SSID should include last 4 chars of wlan0 MAC for uniqueness when multiple panels are nearby.
