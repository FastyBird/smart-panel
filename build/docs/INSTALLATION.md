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
- **Node.js**: Version 24 or higher
- **Architecture**: ARM64 (64-bit) or x64
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

### Option 3: Manual Tarball Install

For environments where npm is not available or you prefer a self-contained installation, download the
pre-built tarball from GitHub Releases.

Choose the tarball that matches your architecture:

| Architecture | Tarball | Typical devices |
|-------------|---------|-----------------|
| ARM64 (64-bit) | `smart-panel-server-{version}-arm64.tar.gz` | Raspberry Pi 4/5, Pi Zero 2W (64-bit OS) |

> **Tip:** Check your architecture with `uname -m`. `aarch64` = ARM64.

```bash
# Create installation directory
sudo mkdir -p /opt/smart-panel
sudo chown -R ${USER}:${USER} /opt/smart-panel
cd /opt/smart-panel

# Set the version you want to install
VERSION="0.1.0"

# Download
curl --http1.1 -L -C - -o smart-panel-server.tar.gz \
    "https://github.com/FastyBird/smart-panel/releases/download/v${VERSION}/smart-panel-server-${VERSION}-arm64.tar.gz"
tar -xzf smart-panel-server.tar.gz -C .
rm smart-panel-server.tar.gz

# Optional: verify download integrity
curl -LO "https://github.com/FastyBird/smart-panel/releases/download/v${VERSION}/smart-panel-server-${VERSION}-arm64.tar.gz.sha256"
sha256sum -c smart-panel-server-${VERSION}-arm64.tar.gz.sha256

# Create data directory
sudo mkdir -p /var/smart-panel
sudo chown -R ${USER}:${USER} /var/smart-panel

# Run database migrations
npm run migration:run
```

Then create a systemd service at `/etc/systemd/system/smart-panel-backend.service`:

```ini
[Unit]
Description=Smart Panel Backend & Admin Service
After=network.target

[Service]
User=pi
WorkingDirectory=/opt/smart-panel
ExecStart=npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable smart-panel-backend
sudo systemctl start smart-panel-backend
```

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
| `FB_TOKEN_SECRET` | Auto-generated | JWT authentication secret |
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

# Docker Installation

If you prefer running Smart Panel in a container, Docker is the quickest way to get a production server running.

## Prerequisites

- Linux host with [Docker](https://docs.docker.com/engine/install/) and Docker Compose installed
- At least 512 MB RAM and 300 MB free disk space

## Quick Start

```bash
# Create a project directory
mkdir -p ~/smart-panel && cd ~/smart-panel

# Download the production Docker Compose file
curl -sL "https://raw.githubusercontent.com/FastyBird/smart-panel/main/docker/prod/docker-compose.yml" \
    -o docker-compose.yml

# Generate a JWT secret and save it
export FB_TOKEN_SECRET=$(openssl rand -base64 32)
echo "FB_TOKEN_SECRET=${FB_TOKEN_SECRET}" > .env

# Start Smart Panel
docker compose up -d
```

The container runs database migrations on first startup and then starts the server. Access the admin interface at `http://<host-ip>:3000`.

## With InfluxDB

To include InfluxDB for time-series data (temperature history, energy monitoring):

```bash
curl -sL "https://raw.githubusercontent.com/FastyBird/smart-panel/main/docker/prod/docker-compose.influxdb.yml" \
    -o docker-compose.influxdb.yml
docker compose -f docker-compose.yml -f docker-compose.influxdb.yml up -d
```

## Configuration

Set environment variables in your `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `FB_BACKEND_PORT` | `3000` | HTTP server port (host-side mapping) |
| `FB_TOKEN_SECRET` | **Required** | JWT authentication secret |
| `FB_MDNS_ENABLED` | `true` | Enable mDNS discovery |
| `FB_OPENWEATHERMAP_API_KEY` | - | OpenWeatherMap API key |

## Data Persistence

Application data is stored in a Docker named volume `smart-panel-data`. Back up with:

```bash
docker run --rm -v smart-panel-data:/data -v $(pwd):/backup alpine \
    tar czf /backup/smart-panel-backup.tar.gz -C /data .
```

## Updating

```bash
docker compose pull
docker compose up -d
```

## Container Management

```bash
# View logs
docker compose logs -f smart-panel

# Restart
docker compose restart smart-panel

# Stop
docker compose down
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
| `smart-panel-display-flutterpi-{version}-arm64.tar.gz` | Raspberry Pi (64-bit) via flutter-pi |
| `smart-panel-display-elinux-{version}-x64.tar.gz` | Linux x64 headless (DRM-GBM, no desktop needed) |
| `smart-panel-display-linux-{version}-x64.tar.gz` | Linux x64 desktop (GTK) |
| `smart-panel-display-android-{version}.apk` | Android (sideload via ADB) |

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
   VERSION="0.1.0"  # Set the version you want to install
   sudo mkdir -p /opt/smart-panel-display
   curl -sL "https://github.com/FastyBird/smart-panel/releases/download/v${VERSION}/smart-panel-display-flutterpi-${VERSION}-arm64.tar.gz" \
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
   VERSION="0.1.0"  # Set the version you want to install
   sudo mkdir -p /opt/smart-panel-display
   curl -sL "https://github.com/FastyBird/smart-panel/releases/download/v${VERSION}/smart-panel-display-elinux-${VERSION}-x64.tar.gz" \
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
VERSION="0.1.0"  # Set the version you want to install
curl -sL "https://github.com/FastyBird/smart-panel/releases/download/v${VERSION}/smart-panel-display-android-${VERSION}.apk" \
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
