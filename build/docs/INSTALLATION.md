# Smart Panel Installation Guide

This guide covers installing FastyBird Smart Panel on Linux devices including Raspberry Pi.

## Requirements

- **Operating System**: Linux with systemd (Debian, Ubuntu, Raspberry Pi OS, Fedora, etc.)
- **Node.js**: Version 20 or higher
- **Architecture**: ARM (32-bit), ARM64 (64-bit), or x64

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

## Support

- **Documentation**: https://smart-panel.fastybird.com/docs
- **Issues**: https://github.com/FastyBird/smart-panel/issues
- **Discord**: https://discord.gg/fastybird
