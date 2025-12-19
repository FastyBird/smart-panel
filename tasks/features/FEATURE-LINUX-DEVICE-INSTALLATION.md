# Task: Linux Device Installation
ID: FEATURE-LINUX-DEVICE-INSTALLATION
Type: feature
Scope: backend, admin
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to easily deploy Smart Panel on Linux-powered devices like Raspberry Pi
As a home automation enthusiast
I want to install Smart Panel using a simple npm command or installation script, have it run as a system service, and manage it through a CLI tool.

## 2. Context

- Smart Panel currently builds backend and admin as separate npm packages (`@fastybird/smart-panel-backend`, `@fastybird/smart-panel-admin`)
- Backend can serve admin UI as static files via `ServeStaticModule`
- GitHub Actions already build ARM tarballs for beta releases but not production releases
- A `build/` directory exists with a wrapper package but is marked as `private: true`
- Homebridge project serves as reference implementation for similar installation experience
- Users expect one-command installation similar to: `npm install -g homebridge`

**Reference locations:**
- Build package: `/build/`
- Backend: `/apps/backend/`
- Admin: `/apps/admin/`
- GitHub Actions: `/.github/workflows/`
- Backend CLI: `/apps/backend/src/cli.ts`
- Existing commands: `/apps/backend/src/modules/*/commands/`

**Inspiration:**
- Homebridge: https://github.com/homebridge/homebridge
- Homebridge Config UI X: https://github.com/homebridge/homebridge-config-ui-x
- `hb-service` CLI tool for service management

## 3. Scope

**In scope**

- Create publishable `@fastybird/smart-panel` npm package
- Create `smart-panel-service` CLI for Linux service management
- Create systemd service template and installer
- Update GitHub Actions to publish main package and ARM builds
- Create installation documentation
- Create one-liner installation script
- Add service management commands (install, uninstall, start, stop, restart, status, logs)
- Add first-time setup/onboarding flow
- Environment variable configuration for production deployments

**Out of scope**

- macOS/Windows service management (future enhancement)
- Docker image creation (separate task)
- Kubernetes/container orchestration
- Panel (Flutter) installation automation
- Plugin/extension installation CLI

## 4. Acceptance criteria

### 4.1 Distribution Package

- [ ] Create `@fastybird/smart-panel` npm package in `build/` directory
- [ ] Package is public (`private: false`) and publishable to npm
- [ ] Package includes `@fastybird/smart-panel-backend` and `@fastybird/smart-panel-admin` as dependencies
- [ ] Package exports `smart-panel` CLI command for running the server
- [ ] Package exports `smart-panel-service` CLI command for service management
- [ ] Package includes systemd service template
- [ ] Package version syncs with other packages during release

### 4.2 Service Management CLI (`smart-panel-service`)

- [ ] `smart-panel-service install` - Install as systemd service
  - Creates system user `smart-panel`
  - Creates data directory `/var/lib/smart-panel/`
  - Installs systemd unit file
  - Runs database migrations
  - Enables service to start on boot
  - Starts the service
- [ ] `smart-panel-service uninstall` - Remove systemd service
  - Stops the service
  - Disables the service
  - Removes systemd unit file
  - Optionally removes data directory (with confirmation)
- [ ] `smart-panel-service start` - Start the service
- [ ] `smart-panel-service stop` - Stop the service
- [ ] `smart-panel-service restart` - Restart the service
- [ ] `smart-panel-service status` - Show service status and health info
- [ ] `smart-panel-service logs [-f]` - Show/tail service logs
- [ ] `smart-panel-service update` - Update to latest version
- [ ] All commands require root/sudo for system operations
- [ ] Graceful error handling with helpful messages

### 4.3 Systemd Integration

- [ ] Create systemd service unit template (`smart-panel.service`)
- [ ] Service runs as dedicated `smart-panel` user (not root)
- [ ] Service auto-restarts on failure with 5-second delay
- [ ] Service starts after network is online
- [ ] Environment variables loaded from `/etc/smart-panel/environment`
- [ ] Working directory set to `/var/lib/smart-panel/`
- [ ] Logs to systemd journal (accessible via `journalctl`)

### 4.4 Directory Structure

- [ ] Application data: `/var/lib/smart-panel/`
- [ ] Database: `/var/lib/smart-panel/data/database.sqlite`
- [ ] Configuration: `/etc/smart-panel/`
- [ ] Environment file: `/etc/smart-panel/environment`
- [ ] Logs: systemd journal (default) or `/var/log/smart-panel/`

### 4.5 GitHub Actions Updates

- [ ] Update `release.yml` to build ARM tarballs (32-bit and 64-bit)
- [ ] Update `release.yml` to publish `@fastybird/smart-panel` package
- [ ] Update `beta-release.yml` to publish `@fastybird/smart-panel` package with beta tag
- [ ] Update `alpha-release.yml` to publish `@fastybird/smart-panel` package with alpha tag
- [ ] Attach installation script to GitHub releases
- [ ] Update version sync script to include main package

### 4.6 Installation Methods

- [ ] NPM global install: `sudo npm install -g @fastybird/smart-panel`
- [ ] One-liner script: `curl -fsSL https://get.smart-panel.fastybird.com | sudo bash`
- [ ] Manual tarball extraction with instructions
- [ ] Installation script detects architecture (armv7, arm64, x64)
- [ ] Installation script installs Node.js if not present

### 4.7 First-Time Setup

- [ ] `smart-panel-service install` prompts for admin user creation
- [ ] Or redirect to web UI for first-time setup wizard
- [ ] Generate secure JWT secret on first install
- [ ] Initialize database with migrations
- [ ] Seed default configuration data

### 4.8 Documentation

- [ ] Create installation guide for Raspberry Pi
- [ ] Create installation guide for generic Linux (Debian/Ubuntu)
- [ ] Document all CLI commands and options
- [ ] Document environment variables
- [ ] Document troubleshooting steps
- [ ] Add installation section to main README

## 5. Example scenarios

### Scenario: Fresh installation on Raspberry Pi

Given I have a Raspberry Pi running Raspberry Pi OS
And Node.js 20+ is installed
When I run `sudo npm install -g @fastybird/smart-panel`
And I run `sudo smart-panel-service install`
Then the service is installed and started
And I can access the web UI at `http://<pi-ip>:3000`
And I am prompted to create an admin account.

### Scenario: Update to new version

Given Smart Panel is installed and running
When I run `sudo smart-panel-service update`
Then the service is stopped
And the package is updated via npm
And database migrations are run
And the service is restarted
And I see a success message with the new version.

### Scenario: View service logs

Given Smart Panel is installed
When I run `smart-panel-service logs -f`
Then I see live log output from the service
And logs include timestamps and log levels.

### Scenario: Uninstall with data preservation

Given Smart Panel is installed with user data
When I run `sudo smart-panel-service uninstall`
Then I am asked if I want to remove data
When I choose to keep data
Then the service is removed but `/var/lib/smart-panel/` is preserved.

### Scenario: One-liner installation

Given I have a fresh Debian/Ubuntu server
When I run `curl -fsSL https://get.smart-panel.fastybird.com | sudo bash`
Then Node.js is installed if not present
And Smart Panel is installed globally
And the service is configured and started
And I see the URL to access the web UI.

## 6. Technical constraints

- Use Commander.js for CLI argument parsing (already used in backend)
- Systemd is the only supported init system (covers 95%+ of Linux deployments)
- Node.js 20+ is required (already a project requirement)
- Do not modify generated code in `apps/backend/src/spec/` or `apps/admin/src/api/`
- Service must run as non-root user for security
- All file operations must handle permissions correctly
- Installation must be idempotent (can run multiple times safely)
- Must support both npm global install and tarball extraction methods

## 7. Implementation hints

### 7.1 New files to create

```
build/
├── package.json                    # Updated to be publishable
├── bin/
│   ├── smart-panel.js              # Main CLI (starts server)
│   └── smart-panel-service.js      # Service management CLI
├── lib/
│   ├── service-manager.ts          # Service management logic
│   ├── installers/
│   │   ├── base.ts                 # Base installer interface
│   │   └── linux.ts                # Linux/systemd installer
│   └── utils/
│       ├── paths.ts                # Path constants
│       ├── user.ts                 # User/permission utilities
│       └── logger.ts               # CLI logging utilities
├── templates/
│   ├── systemd/
│   │   └── smart-panel.service     # Systemd unit template
│   └── environment.template        # Environment file template
└── tsconfig.json                   # TypeScript config for build

scripts/
└── install.sh                      # One-liner installation script
```

### 7.2 Systemd service template

```ini
[Unit]
Description=FastyBird Smart Panel
Documentation=https://smart-panel.fastybird.com
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=smart-panel
Group=smart-panel
WorkingDirectory=/var/lib/smart-panel
EnvironmentFile=-/etc/smart-panel/environment
ExecStart=/usr/bin/node ${SMART_PANEL_PATH}/node_modules/@fastybird/smart-panel-backend/dist/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smart-panel

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/smart-panel
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 7.3 Environment file template

```bash
# Smart Panel Configuration
NODE_ENV=production
FB_BACKEND_PORT=3000
FB_ADMIN_UI_PATH=/var/lib/smart-panel/node_modules/@fastybird/smart-panel-admin/dist
FB_DB_PATH=/var/lib/smart-panel/data
FB_CONFIG_PATH=/var/lib/smart-panel/config
FB_SEED_DATA_PATH=/var/lib/smart-panel/seed

# Uncomment to configure
# FB_JWT_SECRET=your-secure-secret-here
# FB_INFLUXDB_URL=http://localhost:8086
# FB_INFLUXDB_DATABASE=smart_panel
```

### 7.4 CLI command structure

```
smart-panel-service
├── install [options]
│   ├── --port <port>           # HTTP port (default: 3000)
│   ├── --user <user>           # Service user (default: smart-panel)
│   ├── --data-dir <path>       # Data directory (default: /var/lib/smart-panel)
│   └── --no-start              # Don't start after install
├── uninstall [options]
│   ├── --keep-data             # Keep data directory
│   └── --force                 # Skip confirmation
├── start
├── stop
├── restart
├── status
│   └── --json                  # Output as JSON
├── logs [options]
│   ├── -f, --follow            # Follow log output
│   ├── -n, --lines <n>         # Number of lines (default: 50)
│   └── --since <time>          # Show logs since time
├── update [options]
│   ├── --version <version>     # Specific version
│   └── --beta                  # Update to beta channel
└── config
    ├── show                    # Show current config
    └── set <key> <value>       # Set config value
```

### 7.5 Package.json updates for build/

```json
{
  "name": "@fastybird/smart-panel",
  "private": false,
  "version": "1.0.0",
  "description": "FastyBird Smart Panel - IoT Dashboard for Linux devices",
  "keywords": ["fastybird", "smart-panel", "iot", "home-automation", "raspberry-pi"],
  "bin": {
    "smart-panel": "./bin/smart-panel.js",
    "smart-panel-service": "./bin/smart-panel-service.js"
  },
  "files": [
    "bin/",
    "lib/",
    "templates/",
    "package.json",
    "README.md"
  ],
  "dependencies": {
    "@fastybird/smart-panel-backend": "^1.0.0",
    "@fastybird/smart-panel-admin": "^1.0.0",
    "commander": "^12.0.0",
    "chalk": "^5.0.0",
    "ora": "^8.0.0",
    "inquirer": "^9.0.0"
  },
  "engines": {
    "node": ">=20"
  },
  "os": ["linux"],
  "cpu": ["arm", "arm64", "x64"]
}
```

### 7.6 Version sync script update

Update `.github/scripts/monorepo-version-sync.js` to include `build/package.json` in version synchronization.

### 7.7 Workflow job for publishing main package

```yaml
publish-main-package:
  needs: ["sync-versions", "publish-backend", "publish-admin"]
  name: "Publish Main Package"
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: "Setup Node"
      uses: actions/setup-node@v4
      with:
        node-version: "22"
        registry-url: "https://registry.npmjs.org"
    - name: "Update Dependencies"
      working-directory: build
      run: |
        npm pkg set dependencies.@fastybird/smart-panel-backend=^${{ needs.publish-backend.outputs.version }}
        npm pkg set dependencies.@fastybird/smart-panel-admin=^${{ needs.publish-admin.outputs.version }}
    - name: "Publish"
      working-directory: build
      run: npm publish --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_REGISTRY_TOKEN }}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by implementing the build package structure and CLI skeleton.
- Test locally on a Linux system or Docker container before committing.
- Follow existing code patterns from backend CLI commands.
- Use TypeScript for all new code in `build/lib/`.
- Compile TypeScript to JavaScript before publishing.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Create unit tests for installer logic where practical.
- Handle errors gracefully with user-friendly messages.
- Log operations for debugging but don't spam the console.
- Consider security implications (file permissions, running as non-root).

## 9. Sub-tasks breakdown

This large feature can be broken into smaller tasks:

1. **FEATURE-LINUX-INSTALL-PACKAGE** - Create publishable npm package structure
2. **FEATURE-LINUX-INSTALL-CLI** - Implement service management CLI
3. **FEATURE-LINUX-INSTALL-SYSTEMD** - Create systemd integration
4. **FEATURE-LINUX-INSTALL-WORKFLOW** - Update GitHub Actions
5. **FEATURE-LINUX-INSTALL-SCRIPT** - Create installation script
6. **FEATURE-LINUX-INSTALL-DOCS** - Create documentation

## 10. Dependencies

- Backend and Admin packages must be published before main package
- Requires npm registry access (NPM_REGISTRY_TOKEN secret)
- Requires GitHub releases for tarball distribution
