# @fastybird/smart-panel

FastyBird Smart Panel - IoT Dashboard for Linux devices including Raspberry Pi.

## Quick Start

```bash
# Install globally
sudo npm install -g @fastybird/smart-panel

# Install and start as a service
sudo smart-panel-service install

# Open http://localhost:3000 in your browser
```

## Installation Options

```bash
# Custom port with admin user
sudo smart-panel-service install \
  --port 8080 \
  --admin-username admin \
  --admin-password yourpassword

# View all options
smart-panel-service install --help
```

## Service Management

```bash
# Check status
sudo smart-panel-service status

# View logs
sudo smart-panel-service logs -f

# Restart
sudo smart-panel-service restart

# Update
sudo smart-panel-service update

# Uninstall
sudo smart-panel-service uninstall
```

## CLI Commands

### smart-panel-service

| Command | Description |
|---------|-------------|
| `install` | Install as systemd service |
| `uninstall` | Remove the service |
| `start` | Start the service |
| `stop` | Stop the service |
| `restart` | Restart the service |
| `status` | Show service status |
| `logs` | View service logs |
| `update` | Update to latest version |

### smart-panel

Access backend CLI commands:

```bash
# Create admin user
sudo smart-panel auth:onboarding <username> <password>

# List users
sudo smart-panel users:list

# Run database migrations
sudo smart-panel migration:run
```

## Requirements

- Linux with systemd
- Node.js 20+
- ARM, ARM64, or x64 architecture

## Documentation

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for detailed installation instructions.

## Links

- **Website**: https://smart-panel.fastybird.com
- **Documentation**: https://smart-panel.fastybird.com/docs
- **GitHub**: https://github.com/FastyBird/smart-panel
- **Issues**: https://github.com/FastyBird/smart-panel/issues

## License

Apache-2.0
