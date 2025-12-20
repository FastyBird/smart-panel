# Task: Linux Installation Enhancements
ID: FEATURE-LINUX-INSTALL-ENHANCEMENTS
Type: feature
Scope: backend, admin
Size: medium
Parent: FEATURE-LINUX-DEVICE-INSTALLATION
Status: planned

## 1. Business goal

In order to provide a more polished installation experience on Linux devices
As a home automation user
I want enhanced setup automation, ARM tarball builds for production releases, and Docker support.

## 2. Context

- Parent task `FEATURE-LINUX-DEVICE-INSTALLATION` is complete with core functionality
- Beta releases already build ARM tarballs, but production releases do not
- Docker is a popular deployment method that should be officially supported
- Seed data would help new users get started faster with example configurations

**Reference locations:**
- Build package: `/build/`
- GitHub Actions: `/.github/workflows/`
- Beta release ARM build: `/.github/workflows/beta-release.yml` (lines 288-406)

## 3. Scope

**In scope**

- Add ARM tarball builds to production release workflow
- Create official Docker image and docker-compose.yml
- Implement seed data for new installations
- Add interactive setup wizard option
- Improve error messages and recovery suggestions

**Out of scope**

- macOS/Windows service management
- Kubernetes/Helm charts
- Plugin marketplace integration

## 4. Acceptance criteria

### 4.1 ARM Tarball Builds for Production

- [ ] Copy ARM build jobs from beta-release.yml to release.yml
- [ ] Build ARMv7 (32-bit) tarball for production releases
- [ ] Build ARM64 (64-bit) tarball for production releases
- [ ] Attach ARM tarballs to GitHub releases
- [ ] Update documentation with manual tarball installation

### 4.2 Docker Support

- [ ] Create `Dockerfile` for Smart Panel
- [ ] Create `docker-compose.yml` with backend + admin
- [ ] Include InfluxDB service in docker-compose (optional)
- [ ] Document Docker installation method
- [ ] Publish Docker image to GitHub Container Registry
- [ ] Add Docker build to release workflows

### 4.3 Seed Data

- [ ] Create seed data for example devices
- [ ] Create seed data for example dashboard layout
- [ ] Add `--seed` flag to `smart-panel-service install`
- [ ] Implement `smart-panel-service seed` command
- [ ] Document available seed data options

### 4.4 Interactive Setup Wizard

- [ ] Add `--interactive` flag to install command
- [ ] Prompt for port number
- [ ] Prompt for admin username/password
- [ ] Prompt for optional features (InfluxDB, mDNS)
- [ ] Show configuration summary before applying

### 4.5 Error Handling Improvements

- [ ] Add recovery suggestions for common errors
- [ ] Implement `smart-panel-service doctor` command
- [ ] Check for port conflicts before installation
- [ ] Verify disk space requirements
- [ ] Test Node.js version compatibility

## 5. Example scenarios

### Scenario: Interactive installation

Given I run `sudo smart-panel-service install --interactive`
Then I am prompted for configuration options
When I complete the wizard
Then the service is installed with my chosen settings.

### Scenario: Docker deployment

Given I have Docker installed
When I run `docker-compose up -d`
Then Smart Panel starts in containers
And I can access the admin UI.

### Scenario: Install with seed data

Given I run `sudo smart-panel-service install --seed`
Then example devices and dashboard are created
And I can see a pre-configured demo setup.

## 6. Technical constraints

- Docker images should be multi-arch (amd64, arm64, arm/v7)
- Seed data should be idempotent (safe to run multiple times)
- Interactive mode should work in both terminal and SSH sessions
- ARM builds should match the beta-release process

## 7. Implementation hints

### 7.1 Docker files to create

```
docker/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.influxdb.yml
└── .dockerignore
```

### 7.2 Dockerfile outline

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g @fastybird/smart-panel
EXPOSE 3000
CMD ["smart-panel-service", "run"]
```

### 7.3 ARM build job (copy from beta-release.yml)

The `build-application` job in beta-release.yml (lines 288-406) should be copied to release.yml with appropriate modifications for production tags.

### 7.4 Seed data location

Seed data should be stored in:
- Backend: `apps/backend/src/modules/seed/data/`
- Or included in the build package: `build/data/seed/`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Prioritize ARM builds and Docker support as they have the highest user impact.
- Seed data can be implemented as a separate sub-task if needed.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Test Docker builds locally before committing.

## 9. Priority order

1. ARM tarball builds for production (high impact, low effort)
2. Docker support (high impact, medium effort)
3. Seed data (medium impact, medium effort)
4. Interactive wizard (low impact, medium effort)
5. Error handling improvements (low impact, low effort)
