# Smart Panel Installation Guide

This guide covers installing FastyBird Smart Panel on Linux devices including Raspberry Pi.

Smart Panel has two main components that can be installed independently or together:
- **Server** (Backend + Admin) — the brain that manages devices, dashboards, and configuration
- **Display** (Panel App) — the touchscreen UI that connects to a server

## Deployment Scenarios

| Scenario | Description | Example |
|----------|-------------|---------|
| **Server Only** | Backend on a central device, displays connect remotely | Mini PC or Raspberry Pi 4 as a hub |
| **Display Only** | Panel app on a screen, connecting to an existing server | Raspberry Pi Zero 2W + touchscreen |
| **All-in-One** | Server and display on the same device | Raspberry Pi 3B+/4 with DSI display |

## Server Requirements

- **Operating System**: Linux with systemd (Debian, Ubuntu, Raspberry Pi OS, Fedora, etc.)
- **Node.js**: Version 20 or higher
- **Architecture**: ARM (32-bit), ARM64 (64-bit), or x64
- **RAM**: 512 MB minimum, 1 GB recommended
- **Storage**: 300 MB free space

## Display Requirements

- **Raspberry Pi**: flutter-pi runtime (no desktop environment needed)
- **Linux x64**: eLinux DRM-GBM mode (headless) or Linux desktop with GTK3
- **Android**: Android 5.0+ (sideloaded via ADB)

---

# Server Installation

## Quick Installation

### Option 1: NPM Global Install (Recommended)

```bash
# Install the package globally
sudo npm install -g @fastybird/smart-panel

# Install and start the service
sudo smart-panel-service install
```

### Option 2: One-liner Script

```bash
curl -fsSL https://get.smart-panel.fastybird.com | sudo bash
```

This script will:
- Install Node.js if not present
- Install Smart Panel globally via npm
- Configure and start the systemd service

## Installation Options

The `smart-panel-service install` command supports several options:

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | HTTP port for the backend |
| `-u, --user <user>` | `smart-panel` | System user for the service |
| `-d, --data-dir <path>` | `/var/lib/smart-panel` | Data directory path |
| `--admin-username <username>` | - | Create admin user during install |
| `--admin-password <password>` | - | Password for admin user |
| `--no-start` | - | Don't start service after install |

### Example: Custom Port with Admin User

```bash
sudo smart-panel-service install \
  --port 8080 \
  --admin-username admin \
  --admin-password mysecurepassword
```

## Post-Installation Setup

### Creating an Admin Account

If you didn't create an admin account during installation, you have two options:

**Option 1: Web UI (Recommended)**

1. Open your browser to `http://<device-ip>:3000`
2. Follow the on-screen setup wizard

**Option 2: Command Line**

```bash
sudo smart-panel auth:onboarding <username> <password>
```

## Service Management

### Check Status

```bash
sudo smart-panel-service status
```

Example output:
```
  Smart Panel Service Status
  ──────────────────────────

  Installed: Yes
  Running:   Yes
  Enabled:   Yes
  PID:       1234
  Uptime:    2h 30m 15s
  Memory:    128 MB
```

### Start/Stop/Restart

```bash
# Start the service
sudo smart-panel-service start

# Stop the service
sudo smart-panel-service stop

# Restart the service
sudo smart-panel-service restart
```

### View Logs

```bash
# View last 50 lines
sudo smart-panel-service logs

# Follow logs in real-time
sudo smart-panel-service logs -f

# View last 100 lines
sudo smart-panel-service logs -n 100

# View logs since a specific time
sudo smart-panel-service logs --since "1 hour ago"
```

### Update to Latest Version

```bash
sudo smart-panel-service update
```

To update to a specific version:
```bash
sudo smart-panel-service update --version 1.2.3
```

To update to beta channel:
```bash
sudo smart-panel-service update --beta
```

## Uninstallation

```bash
# Uninstall but keep data
sudo smart-panel-service uninstall --keep-data

# Complete uninstall (removes all data)
sudo smart-panel-service uninstall --force
```

## Directory Structure

| Path | Description |
|------|-------------|
| `/var/lib/smart-panel/` | Application data directory |
| `/var/lib/smart-panel/data/` | Database files |
| `/var/lib/smart-panel/config/` | Configuration files |
| `/etc/smart-panel/` | System configuration |
| `/etc/smart-panel/environment` | Environment variables |

## Configuration

Environment variables are stored in `/etc/smart-panel/environment`:

```bash
# View current configuration
sudo cat /etc/smart-panel/environment

# Edit configuration
sudo nano /etc/smart-panel/environment

# Restart to apply changes
sudo smart-panel-service restart
```

### Available Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FB_BACKEND_PORT` | `3000` | HTTP server port |
| `FB_JWT_SECRET` | Auto-generated | JWT authentication secret |
| `FB_DB_PATH` | `/var/lib/smart-panel/data` | Database directory |
| `FB_CONFIG_PATH` | `/var/lib/smart-panel/config` | Config directory |
| `FB_MDNS_ENABLED` | `true` | Enable mDNS discovery |
| `FB_MDNS_SERVICE_NAME` | `FastyBird Smart Panel` | mDNS service name |
| `FB_INFLUXDB_URL` | - | InfluxDB connection URL |
| `FB_INFLUXDB_DATABASE` | - | InfluxDB database name |
| `FB_OPENWEATHERMAP_API_KEY` | - | OpenWeatherMap API key |

## Raspberry Pi Specific Notes

### Recommended Hardware

- Raspberry Pi 3B+ or newer
- 1GB+ RAM
- 8GB+ SD card
- Stable power supply

### Performance Tips

1. Use a high-quality SD card (Class 10 or better)
2. Consider using USB SSD for better database performance
3. Enable hardware watchdog for automatic recovery

### Headless Setup

For headless Raspberry Pi setup:

1. Flash Raspberry Pi OS Lite
2. Enable SSH by creating empty `ssh` file on boot partition
3. Configure WiFi via `wpa_supplicant.conf` if needed
4. Boot and SSH into the Pi
5. Install Smart Panel following the quick installation steps

## Troubleshooting

### Service Won't Start

1. Check logs for errors:
   ```bash
   sudo smart-panel-service logs -n 100
   ```

2. Verify Node.js version:
   ```bash
   node --version  # Should be 20+
   ```

3. Check port availability:
   ```bash
   sudo ss -tlnp | grep 3000
   ```

### Permission Issues

If you encounter permission errors:

```bash
# Fix data directory ownership
sudo chown -R smart-panel:smart-panel /var/lib/smart-panel

# Fix environment file permissions
sudo chmod 600 /etc/smart-panel/environment
```

### Database Issues

To reset the database:

```bash
sudo smart-panel-service stop
sudo rm /var/lib/smart-panel/data/database.sqlite
sudo smart-panel-service start
# Database will be recreated on startup
```

### Reinstallation

For a fresh start:

```bash
sudo smart-panel-service uninstall --force
sudo npm uninstall -g @fastybird/smart-panel
sudo npm install -g @fastybird/smart-panel
sudo smart-panel-service install
```

---

# Display Installation

## Quick Installation

### One-liner Script

```bash
curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash -s -- --backend http://YOUR_SERVER_IP:3000
```

The script auto-detects your platform (Raspberry Pi, Linux x64, etc.) and installs the appropriate
variant. Add `--kiosk` to auto-start the display on boot.

Available options:
- `--backend <url>` — Backend server URL (e.g., `http://192.168.1.100:3000`)
- `--version <ver>` — Install a specific version
- `--beta` — Install latest beta version
- `--platform <p>` — Force platform: `flutter-pi`, `elinux`, `linux`, `android`
- `--kiosk` — Enable kiosk mode (auto-start on boot, no desktop)

### Manual Installation

The pre-built display app is available as release assets on GitHub:

| Asset | Platform |
|-------|----------|
| `smart-panel-display-arm64.tar.gz` | Raspberry Pi (64-bit) via flutter-pi |
| `smart-panel-display-armv7.tar.gz` | Raspberry Pi (32-bit) via flutter-pi |
| `smart-panel-display-elinux-x64.tar.gz` | Linux x64 headless (DRM-GBM, no desktop needed) |
| `smart-panel-display-linux-x64.tar.gz` | Linux x64 desktop (GTK) |
| `smart-panel-display.apk` | Android (sideload via ADB) |

Download from: `https://github.com/FastyBird/smart-panel/releases/latest`

#### Raspberry Pi (flutter-pi)

1. Install dependencies:
   ```bash
   sudo apt install cmake libgl1-mesa-dev libgles2-mesa-dev libegl1-mesa-dev \
       libdrm-dev libgbm-dev libsystemd-dev libinput-dev libudev-dev \
       libxkbcommon-dev git -y
   ```

2. Build and install flutter-pi:
   ```bash
   git clone --depth 1 https://github.com/ardera/flutter-pi.git /opt/flutter-pi
   cd /opt/flutter-pi && mkdir build && cd build
   cmake .. && make -j$(nproc) && sudo make install
   ```

3. Enable KMS in `/boot/firmware/config.txt`:
   ```
   dtoverlay=vc4-kms-v3d
   ```

4. Download and extract the display app:
   ```bash
   sudo mkdir -p /opt/smart-panel-display
   curl -sL "https://github.com/FastyBird/smart-panel/releases/latest/download/smart-panel-display-arm64.tar.gz" \
       | sudo tar -xzf - -C /opt/smart-panel-display
   ```

5. Create a systemd service (`/etc/systemd/system/smart-panel-display.service`):
   ```ini
   [Unit]
   Description=Smart Panel Display App
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/opt/smart-panel-display
   ExecStart=/usr/local/bin/flutter-pi --release /opt/smart-panel-display
   Restart=on-failure
   RestartSec=5
   SupplementaryGroups=video render input

   [Install]
   WantedBy=multi-user.target
   ```

6. Enable and start:
   ```bash
   sudo systemctl enable smart-panel-display
   sudo systemctl start smart-panel-display
   ```

#### Linux x64 (eLinux DRM-GBM, Headless)

1. Install dependencies:
   ```bash
   sudo apt install -y libegl1-mesa libgles2-mesa libxkbcommon0 \
       libdrm2 libgbm1 libinput10 libudev1 libsystemd0
   ```

2. Download and extract:
   ```bash
   sudo mkdir -p /opt/smart-panel-display
   curl -sL "https://github.com/FastyBird/smart-panel/releases/latest/download/smart-panel-display-elinux-x64.tar.gz" \
       | sudo tar -xzf - -C /opt/smart-panel-display
   sudo chmod +x /opt/smart-panel-display/fastybird_smart_panel
   ```

3. Create a systemd service (`/etc/systemd/system/smart-panel-display.service`):
   ```ini
   [Unit]
   Description=Smart Panel Display (eLinux DRM-GBM)
   After=multi-user.target

   [Service]
   User=root
   WorkingDirectory=/opt/smart-panel-display
   Environment=FLUTTER_DRM_DEVICE=/dev/dri/card0
   ExecStart=/opt/smart-panel-display/fastybird_smart_panel --bundle=/opt/smart-panel-display --fullscreen --no-cursor
   Restart=on-failure
   RestartSec=5
   SupplementaryGroups=video render input

   [Install]
   WantedBy=multi-user.target
   ```

4. Enable and start:
   ```bash
   sudo systemctl enable smart-panel-display
   sudo systemctl start smart-panel-display
   ```

#### Android (via ADB)

```bash
curl -sL "https://github.com/FastyBird/smart-panel/releases/latest/download/smart-panel-display.apk" \
    -o /tmp/smart-panel-display.apk
adb install -r /tmp/smart-panel-display.apk
```

## Display Service Management

```bash
# Check status
sudo systemctl status smart-panel-display

# View logs
sudo journalctl -u smart-panel-display -f

# Restart
sudo systemctl restart smart-panel-display

# Stop
sudo systemctl stop smart-panel-display
```

## Updating the Display App

Re-run the install script to update:

```bash
curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash
```

Or manually download the new release and replace the files in `/opt/smart-panel-display/`.

---

# All-in-One Installation

To run both the server and display on a single device (e.g., Raspberry Pi with touchscreen):

```bash
# 1. Install the server
curl -fsSL https://get.smart-panel.fastybird.com | sudo bash

# 2. Install the display app pointing to localhost
curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash -s -- --backend http://localhost:3000 --kiosk
```

Both services will start automatically on boot. See the sections above for detailed configuration
options and manual installation steps.

---

## Support

- **Documentation**: https://smart-panel.fastybird.com/docs
- **Issues**: https://github.com/FastyBird/smart-panel/issues
- **Discord**: https://discord.gg/fastybird
