# Pre-Release Documentation Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align website documentation with all implemented installation methods, features, and configuration options before v1.0 release.

**Architecture:** The docs site is a Next.js app using Nextra at `apps/website/`. Pages are MDX files under `apps/website/app/docs/`. Navigation is controlled by `_meta.js` files. Content uses Nextra components (`Callout`, `Steps`, `Tabs`, `Cards`).

**Tech Stack:** Next.js, Nextra, MDX

---

## Gap Analysis

| Feature | Implemented | Documented |
|---------|------------|------------|
| Raspbian pre-built images (server/aio/display) | Yes | No |
| Captive portal WiFi provisioning | Yes | No |
| Image-based update mechanism (symlink versioning) | Yes | No |
| Admin UI update trigger | Yes | No |
| In-memory storage fallback (InfluxDB optional) | Yes | Partial |
| mDNS discovery proxy (flutter-pi) | Yes | Partial |
| reTerminal hardware support | Yes | No |
| Correct service names (`smart-panel.service`) | Yes | No — docs use `smart-panel-backend` |
| Boot partition config (`smart-panel.conf`) | Yes | No |

### Additional Issues

- **Service name mismatch**: Docs reference `smart-panel-backend` / `smart-panel-display` everywhere, but actual services are `smart-panel.service` / `smart-panel-display.service`
- **Updating page**: Only covers npm/tarball/Docker — missing image-based updates and admin UI trigger
- **Preparation page**: Only covers Raspberry Pi Imager with vanilla Pi OS — missing pre-built image option
- **Troubleshooting**: References wrong service names

---

## Task Breakdown

### Task 1: Add Raspbian Image installation option to Preparation page

**Files:**
- Modify: `apps/website/app/docs/get-started/preparation/page.mdx`

This is the highest-impact doc change — users with a pre-built image have a completely different (simpler) preparation flow.

- [ ] **Step 1:** Read the current preparation page fully
- [ ] **Step 2:** Add a new section at the top: "Option 1: Pre-Built Smart Panel Image (Recommended)" before the existing Raspberry Pi Imager section (rename that to "Option 2: Vanilla Raspberry Pi OS")
- [ ] **Step 3:** Document the pre-built image flow:
  - Download the image from GitHub Releases (3 variants: server, aio, display)
  - Flash with Raspberry Pi Imager or `dd`
  - Optional: create `smart-panel.conf` on boot partition for WiFi/hostname/timezone
  - First boot: captive portal appears if no WiFi configured, or boots directly if `smart-panel.conf` provided
  - Link to new captive portal page (Task 5)
- [ ] **Step 4:** Add a table comparing the three image variants (server, aio, display) with what each includes
- [ ] **Step 5:** Commit

---

### Task 2: Fix service names across all docs pages

**Files:**
- Modify: `apps/website/app/docs/get-started/installation/all-in-one/page.mdx`
- Modify: `apps/website/app/docs/get-started/installation/server-only/page.mdx`
- Modify: `apps/website/app/docs/updating/page.mdx`
- Modify: `apps/website/app/docs/troubleshooting/page.mdx`

The actual systemd service names are:
- `smart-panel.service` (not `smart-panel-backend`)
- `smart-panel-display.service` (stays the same)

- [ ] **Step 1:** Search and replace `smart-panel-backend` → `smart-panel` across all MDX files in the docs (service names only, not package names)
- [ ] **Step 2:** Verify the commands still read correctly (e.g., `journalctl -u smart-panel` not `journalctl -u smart-panel-backend`)
- [ ] **Step 3:** Commit

---

### Task 3: Update the Updating & Backup page

**Files:**
- Modify: `apps/website/app/docs/updating/page.mdx`

The current page only covers npm/tarball/Docker updates. It's missing:
- Image-based update via admin UI
- Image-based update via CLI
- Symlink versioning and rollback
- Correct data paths

- [ ] **Step 1:** Read the current page fully
- [ ] **Step 2:** Add "Raspberry Pi Image Installation" section covering:
  - Update via Admin UI: Settings → System → Check for Updates → Install
  - Update via CLI: `smart-panel-service update` or `system:update:server` NestJS command
  - How it works: downloads tarball from GitHub releases, extracts to `/opt/smart-panel/vX.Y.Z/`, switches `current` symlink, runs migrations
  - Rollback: previous 2 versions kept, can switch symlink manually
- [ ] **Step 3:** Update the backup paths table to include:
  - Image installs: `/var/lib/smart-panel/` (data), `/etc/smart-panel/environment` (config)
  - Correct the `config/config.yaml` reference — actual path depends on install method
- [ ] **Step 4:** Update service names per Task 2
- [ ] **Step 5:** Commit

---

### Task 4: Document InfluxDB as optional with in-memory fallback

**Files:**
- Modify: `apps/website/app/docs/get-started/installation/all-in-one/page.mdx`
- Modify: `apps/website/app/docs/get-started/installation/server-only/page.mdx`
- Modify: `apps/website/app/docs/configuration-reference/page.mdx`

- [ ] **Step 1:** In the all-in-one and server-only installation pages, add a callout to the InfluxDB section explaining:
  - InfluxDB is fully optional
  - Without it, the system uses in-memory storage — current values work, historical data (charts/timeseries) is not persisted
  - The admin UI shows a notification when InfluxDB is not available
  - Can be configured later without reinstalling
- [ ] **Step 2:** In the configuration reference, add a "Storage" section documenting:
  - Primary/fallback storage config (admin UI: Settings → Storage Module)
  - Available plugins: InfluxDB v1, In-Memory
- [ ] **Step 3:** Commit

---

### Task 5: Add Captive Portal documentation page

**Files:**
- Create: `apps/website/app/docs/get-started/installation/captive-portal/page.mdx`
- Modify: `apps/website/app/docs/get-started/installation/_meta.js` (add entry)

- [ ] **Step 1:** Add `"captive-portal": "WiFi Setup (Captive Portal)"` to the `_meta.js`
- [ ] **Step 2:** Create the page documenting:
  - What is the captive portal: auto-starts when no WiFi is configured on Raspbian images
  - How it works: `SmartPanel-XXXX` AP appears (WPA2, password: `smartpanel`)
  - Connect phone/laptop, setup page opens automatically
  - Configure: WiFi network, password, country, optional hostname/timezone
  - After connecting: panel accessible at `http://<hostname>.local:3000`
  - Alternative: `smart-panel.conf` on boot partition (document the file format)
  - WiFi watchdog: if WiFi drops for 5 minutes, portal re-activates
- [ ] **Step 3:** Cross-reference from the preparation page (Task 1) and troubleshooting page
- [ ] **Step 4:** Commit

---

### Task 6: Add reTerminal hardware documentation

**Files:**
- Create: `apps/website/app/docs/plugins/devices-module/reterminal/page.mdx`
- Modify: `apps/website/app/docs/plugins/devices-module/_meta.js` (add entry)

- [ ] **Step 1:** Check the existing plugin docs structure (e.g., shelly-ng, home-assistant, wled) for the page format
- [ ] **Step 2:** Add `"reterminal": "reTerminal"` to the `_meta.js`
- [ ] **Step 3:** Create the page documenting:
  - Supported hardware: reTerminal CM4 (5" touchscreen), reTerminal DM (10.1" industrial)
  - Auto-detection: plugin detects hardware variant from `/proc/device-tree/model`
  - Features per variant (buttons, LEDs, buzzer, sensors for CM4; status LED for DM)
  - Configuration: enable/disable via admin → Extensions → reTerminal Devices
  - No manual device creation needed — the plugin auto-creates the device on start
- [ ] **Step 4:** Commit

---

### Task 7: Update troubleshooting page

**Files:**
- Modify: `apps/website/app/docs/troubleshooting/page.mdx`

- [ ] **Step 1:** Read the current page fully
- [ ] **Step 2:** Add sections for:
  - "Captive Portal Not Appearing" — check WiFi adapter, check `.wifi-configured` / `.boot-config.applied` markers, check `journalctl -u smart-panel-portal`
  - "WiFi Disconnects / Portal Keeps Restarting" — watchdog behavior, check signal strength, check if correct SSID/password
  - "InfluxDB Not Available Warning" — explain it's expected without InfluxDB, link to storage config
- [ ] **Step 3:** Fix service names (if not already done in Task 2)
- [ ] **Step 4:** Commit

---

### Task 8: Update the main installation overview page

**Files:**
- Modify: `apps/website/app/docs/get-started/installation/page.mdx`

- [ ] **Step 1:** Add a "Pre-Built Raspberry Pi Image" card to the deployment scenarios:
  - "Flash a ready-to-go SD card image — the fastest path for Raspberry Pi setups. Includes WiFi captive portal for zero-config setup."
  - Link to the preparation page (pre-built image section from Task 1)
- [ ] **Step 2:** Update the "Which Scenario Is Right for You?" table to include the image option
- [ ] **Step 3:** Commit

---

### Task 9: Final review and cross-link pass

**Files:**
- All modified docs pages

- [ ] **Step 1:** Read through all modified pages end-to-end checking for:
  - Broken internal links
  - Consistent terminology (service names, paths, component names)
  - No references to old patterns (npm global install, `smart-panel-backend`, etc.)
- [ ] **Step 2:** Verify `_meta.js` navigation entries are correct
- [ ] **Step 3:** Run the website dev server to check pages render: `cd apps/website && pnpm dev`
- [ ] **Step 4:** Final commit

---

## Execution Notes

- **Do NOT modify generated code** (`openapi.json`, `openapi.constants.ts`, etc.)
- **Follow existing MDX patterns** — use `Callout`, `Steps`, `Tabs`, `Cards` from nextra/components
- **Keep pages concise** — link to other pages rather than duplicating content
- **Service names**: `smart-panel.service` (backend), `smart-panel-display.service` (display), `smart-panel-portal.service` (captive portal), `smart-panel-wifi-watchdog.service` (WiFi watchdog)
- **Data paths**: `/var/lib/smart-panel/` (data), `/etc/smart-panel/environment` (env config), `/opt/smart-panel/current/` (app, image installs)
