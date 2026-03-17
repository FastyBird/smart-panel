# Smart Panel - Raspberry Pi OS Image Builder

Build a ready-to-flash Raspberry Pi OS image with the Smart Panel backend and admin UI pre-installed.

## What's Included

The image is based on **Raspberry Pi OS Lite (Bookworm, arm64)** and includes:

- **Node.js 24** (via NodeSource)
- **Smart Panel backend** (NestJS) with all dependencies
- **Admin UI** (Vue.js) served as static files
- **SQLite** database (pre-configured)
- **InfluxDB 1.8** time-series database for device metrics and historical data
- **systemd service** for auto-start on boot
- **First-boot initialization** (JWT secret generation, InfluxDB setup, DB migrations)
- **mDNS/Avahi** for network discovery
- **SSH** enabled by default

## Quick Start

### Prerequisites

- Docker installed and running
- ~10 GB free disk space
- Internet connection (for pi-gen base image download)

### Build

```bash
# From repository root
cd build/raspbian

# Full build (builds app + image)
./build.sh

# Or step by step:
./build.sh --prepare-only    # Build and package the app
./build.sh --skip-prepare    # Build image using existing app files
```

The output image will be in `build/raspbian/output/`.

### Flash

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select **"Use custom"** and choose the `.img.xz` file from the output directory
3. Configure WiFi and hostname in Imager settings (optional)
4. Flash to your SD card / USB drive

### First Boot

On first boot, the image will automatically:
1. Generate a unique JWT secret
2. Create the InfluxDB `fastybird` database with retention policies
3. Run database migrations
4. Start the Smart Panel service

The panel will be accessible at `http://<pi-ip>:3000` after ~30 seconds.

## CI/CD

The GitHub Actions workflow (`.github/workflows/build-raspbian-image.yml`) can:

- **Manual trigger**: Build an image on demand via `workflow_dispatch`
- **Release trigger**: Automatically build and attach images to GitHub releases

## Image Architecture

```
Raspberry Pi OS Lite (Bookworm arm64)
└── stage-smart-panel/
    ├── 00-install-deps/     → Node.js 24, InfluxDB 1.8, system packages
    ├── 01-install-app/      → Smart Panel backend + admin UI
    └── 02-configure/        → systemd services, first-boot setup
```

### File Layout on the Image

```
/usr/lib/smart-panel/          # Application
├── dist/                      # Compiled backend
├── static/                    # Admin UI
├── node_modules/              # Dependencies
├── var/                       # Seed data
└── first-boot.sh             # First-boot script

/var/lib/smart-panel/          # Runtime data
├── data/
│   └── database.sqlite        # SQLite database
└── config/
    └── config.yaml            # Configuration

/etc/smart-panel/
└── environment                # Environment variables

/etc/systemd/system/
├── smart-panel.service        # Main service
└── smart-panel-firstboot.service  # One-time setup
```

## Configuration

### Environment Variables

Edit `/etc/smart-panel/environment` on the Pi:

| Variable | Default | Description |
|----------|---------|-------------|
| `FB_BACKEND_PORT` | `3000` | HTTP server port |
| `FB_TOKEN_SECRET` | Auto-generated | JWT signing secret |
| `FB_DB_PATH` | `/var/lib/smart-panel/data` | Database directory |
| `FB_CONFIG_PATH` | `/var/lib/smart-panel/config` | Config directory |

### Service Management

```bash
sudo systemctl status smart-panel     # Check status
sudo systemctl restart smart-panel    # Restart
sudo journalctl -u smart-panel -f     # View logs

# InfluxDB
sudo systemctl status influxdb        # Check InfluxDB status
sudo systemctl restart influxdb       # Restart InfluxDB
influx -execute "SHOW DATABASES"      # Verify database
```

## Customization

To customize the image further, edit the stage scripts in `stage-smart-panel/` or add new sub-stages. See the [pi-gen documentation](https://github.com/RPi-Distro/pi-gen) for details on the stage system.
