# Task: mDNS Backend Discovery
ID: FEATURE-MDNS-BACKEND-DISCOVERY
Type: feature
Scope: backend, panel
Size: medium
Parent: (none)
Status: done

## 1. Business goal

In order to enable seamless connection between the Smart Panel Flutter app and the backend server  
As a Smart Panel user  
I want the panel application to automatically discover the backend server on my local network via mDNS, eliminating the need for manual IP address configuration.

## 2. Context

- The Flutter panel app previously required hardcoded configuration for the backend URL via compile-time environment variables (`FB_APP_HOST`, `FB_BACKEND_PORT`).
- Users had to know the backend IP address or hostname beforehand.
- This created friction for initial setup, especially in home automation scenarios where the backend runs on embedded devices (e.g., Raspberry Pi).

**Reference locations:**
- Backend: `/apps/backend/` (NestJS with Fastify)
- Panel: `/apps/panel/` (Flutter)
- mDNS module: `/apps/backend/src/modules/mdns/`
- Discovery service: `/apps/panel/lib/core/services/mdns_discovery.dart`

## 3. Scope

**In scope**

- Backend: New `MdnsModule` advertising service via `_fastybird-panel._tcp` with TXT records (version, API path, secure flag)
- Backend: Configurable via environment variables, graceful shutdown
- Panel: New `MdnsDiscoveryService` using `bonsoir` package
- Panel: Discovery screen with backend list, manual URL entry, rescan
- Panel: Updated `StartupManagerService` to try stored URL first, fallback to discovery on failure

**Out of scope**

- Admin interface changes
- mDNS discovery for other services (Shelly, Home Assistant, etc.)
- IPv6 support
- Multiple simultaneous backend connections

## 4. Acceptance criteria

### Backend

- [x] New `MdnsModule` created following existing module patterns
- [x] Service advertised with correct type `_fastybird-panel._tcp`
- [x] TXT records include: `version`, `api`, `secure`, `hostname`
- [x] Service is unpublished on graceful shutdown
- [x] mDNS can be disabled via `FB_MDNS_ENABLED=false`
- [x] Service name configurable via `FB_MDNS_SERVICE_NAME`
- [x] Unit tests for mDNS service (24 tests passing)
- [x] Logging for mDNS events

### Panel

- [x] New `MdnsDiscoveryService` implemented with `bonsoir` package
- [x] Discovery screen with searching animation, backend list, manual entry, rescan button
- [x] `StartupManagerService` attempts stored URL first, falls back to discovery on failure
- [x] Discovered URL persisted in secure storage
- [x] Discovery timeout configurable via `FB_MDNS_DISCOVERY_TIMEOUT`
- [x] Works on Android, iOS, Linux, macOS, and Windows platforms

## 5. Example scenarios

### Scenario: First-time setup with automatic discovery

Given I install the Smart Panel app on a new device  
And the backend is running on the same network  
When I launch the app for the first time  
Then the app shows a discovery screen  
And the backend appears in the list within 10 seconds  
When I tap on the discovered backend  
Then the app connects and stores the backend URL.

### Scenario: Connection failure with recovery via mDNS

Given I have previously connected to the backend at `192.168.1.100:3000`  
And the backend's IP address has changed  
When I launch the app  
Then the app fails to connect to the stored URL  
And automatically shows the discovery screen with an error message  
And I can select the backend at its new IP.

### Scenario: Manual URL entry fallback

Given mDNS discovery finds no backends  
When I tap "Enter Manually"  
And enter `http://192.168.1.100:3000`  
Then the app connects and stores this URL.

## 6. Technical constraints

- Backend uses `bonjour-service` npm package (pure JavaScript, cross-platform)
- Panel uses `bonsoir` Flutter package (cross-platform native mDNS)
- Follow existing module structure in `/apps/backend/src/modules/`
- Do not modify generated code in `lib/api/`
- mDNS failures must not block application startup
- Environment variable `FB_APP_HOST` takes priority over discovery (for embedded deployments)

## 7. Implementation hints

**Backend files created:**
```
apps/backend/src/modules/mdns/
├── mdns.module.ts
├── mdns.constants.ts
└── services/
    ├── mdns.service.ts
    └── mdns.service.spec.ts
```

**Panel files created/modified:**
```
apps/panel/lib/core/models/discovered_backend.dart       # New
apps/panel/lib/core/services/mdns_discovery.dart         # New
apps/panel/lib/features/discovery/presentation/backend_discovery.dart  # New
apps/panel/lib/core/services/startup_manager.dart        # Modified
apps/panel/lib/app/app.dart                              # Modified
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `FB_MDNS_ENABLED` | `true` | Enable backend mDNS advertisement |
| `FB_MDNS_SERVICE_NAME` | `FastyBird Smart Panel` | Advertised service name |
| `FB_MDNS_SERVICE_TYPE` | `fastybird-panel` | mDNS service type |
| `FB_MDNS_DISCOVERY_ENABLED` | `true` | Enable panel mDNS discovery |
| `FB_MDNS_DISCOVERY_TIMEOUT` | `10000` | Discovery timeout in ms |

## 8. AI instructions (for Junie / AI)

- Read this file entirely before making any code changes.
- Backend implementation uses `bonjour-service` (not `@homebridge/ciao`).
- Panel implementation uses `bonsoir` package for cross-platform mDNS.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- All acceptance criteria have been implemented and tested.
