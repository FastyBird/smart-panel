# Task: mDNS Backend Discovery
ID: FEATURE-MDNS-BACKEND-DISCOVERY
Type: feature
Scope: backend, panel
Size: medium
Parent: (none)
Status: planned
Created: 2025-12-07

## 1. Business goal

In order to enable seamless connection between the Smart Panel Flutter app and the backend server  
As a Smart Panel user  
I want the panel application to automatically discover the backend server on my local network via mDNS, eliminating the need for manual IP address configuration.

## 2. Context

### Current Situation

- The Flutter panel app currently requires hardcoded configuration for the backend URL via compile-time environment variables (`FB_APP_HOST`, `FB_BACKEND_PORT`).
- Users must know the backend IP address or hostname beforehand.
- This creates friction for initial setup, especially in home automation scenarios where the backend runs on embedded devices (e.g., Raspberry Pi).

### Reference Implementation

- **Backend location**: `/apps/backend/` - NestJS application using Fastify adapter
- **Panel location**: `/apps/panel/` - Flutter application
- **Backend entry point**: `apps/backend/src/main.ts`
- **Panel startup**: `apps/panel/lib/core/services/startup_manager.dart`
- **Panel socket service**: `apps/panel/lib/core/services/socket.dart`

### mDNS Standards

- mDNS (Multicast DNS) allows devices to advertise services on local networks using the `.local` domain.
- Service type should follow DNS-SD conventions: `_fastybird-panel._tcp.local` or `_http._tcp.local` with TXT records.
- Port 5353 UDP is used for mDNS multicast (handled by libraries).

## 3. Scope

### In scope

**Backend (NestJS):**
- Create a new `MdnsModule` to handle service advertisement
- Advertise the backend service on the local network with:
  - Service type: `_fastybird-panel._tcp`
  - Service name: Configurable (default: `FastyBird Smart Panel`)
  - Port: Same as HTTP server port (from `FB_BACKEND_PORT`)
  - TXT records: version, API path prefix, hostname
- Make mDNS advertising configurable (enabled/disabled via environment)
- Graceful shutdown: unpublish service on application termination

**Panel (Flutter):**
- Create a new `MdnsDiscoveryService` for backend discovery
- Implement discovery screen shown when:
  - First app launch (no stored backend URL)
  - Manual trigger from settings
  - Backend connection failure
- Update `StartupManagerService` to:
  - First attempt stored/configured backend URL
  - Fall back to mDNS discovery if connection fails
  - Store discovered backend URL for future use
- Support manual URL entry as fallback

### Out of scope

- Admin interface changes
- mDNS discovery for other services (Shelly, Home Assistant, etc.)
- IPv6 support (can be added later)
- Multiple backend discovery (only first discovered or user-selected)

## 4. Acceptance criteria

### Backend

- [ ] New `MdnsModule` created following existing module patterns
- [ ] Service advertised with correct type `_fastybird-panel._tcp`
- [ ] TXT records include: `version`, `api_prefix`, `secure` (http/https)
- [ ] Service is unpublished on graceful shutdown
- [ ] mDNS can be disabled via `FB_MDNS_ENABLED=false` environment variable
- [ ] Service name configurable via `FB_MDNS_SERVICE_NAME` environment variable
- [ ] Unit tests for mDNS service
- [ ] Logging for mDNS events (advertisement start/stop, errors)

### Panel

- [ ] New `MdnsDiscoveryService` implemented
- [ ] Discovery screen shows:
  - [ ] Searching animation while scanning
  - [ ] List of discovered backends (name, address, port)
  - [ ] Manual URL entry option
  - [ ] Refresh/rescan button
- [ ] `StartupManagerService` integration:
  - [ ] Attempts stored URL first
  - [ ] Falls back to mDNS discovery on failure
  - [ ] Persists discovered URL in secure storage
- [ ] Discovery timeout configurable (default: 10 seconds)
- [ ] Works on Android, iOS, Linux, and Windows platforms
- [ ] Proper error handling for platforms without mDNS support

## 5. Example scenarios

### Scenario: First-time setup with automatic discovery

Given I install the Smart Panel app on a new device  
And the backend is running on the same network  
And mDNS is enabled on the backend (default)  
When I launch the app for the first time  
Then the app shows a discovery screen  
And the backend appears in the list within 10 seconds  
When I tap on the discovered backend  
Then the app connects and stores the backend URL.

### Scenario: Connection failure with recovery via mDNS

Given I have previously connected to the backend at `192.168.1.100:3000`  
And the backend's IP address has changed to `192.168.1.150`  
When I launch the app  
Then the app fails to connect to the stored URL  
And automatically starts mDNS discovery  
And finds the backend at the new IP  
And reconnects and updates the stored URL.

### Scenario: Manual URL entry fallback

Given mDNS is disabled on the backend or network  
When I launch the app and discovery times out  
Then I see an option to enter the URL manually  
When I enter `http://192.168.1.100:3000`  
Then the app connects and stores this URL.

### Scenario: Backend shutdown announcement

Given the backend is running and advertising via mDNS  
When the backend receives SIGTERM/SIGINT  
Then it unpublishes the mDNS service before shutting down  
And clients are notified that the service is no longer available.

## 6. Technical constraints

### Backend

- Use `@homebridge/ciao` or `bonjour-service` npm package for mDNS (both are well-maintained, pure JavaScript, cross-platform)
- Follow existing module structure in `/apps/backend/src/modules/`
- Register mDNS service after HTTP server starts listening
- Use NestJS lifecycle hooks (`OnApplicationBootstrap`, `OnApplicationShutdown`)
- Do not block application startup if mDNS fails

### Panel

- Use `nsd` package for Flutter (supports Android, iOS, macOS, Windows, Linux)
- Alternative: `multicast_dns` package (pure Dart, more portable)
- Store discovered/configured URL in Flutter secure storage (existing pattern)
- Support compile-time override for embedded/kiosk deployments
- Keep existing `FB_APP_HOST`/`FB_BACKEND_PORT` as highest priority (for embedded deployments)

### General

- Follow existing code style and conventions from `/.ai-rules/GUIDELINES.md`
- Do not modify generated code in `lib/api/`
- Add appropriate unit tests
- Use consistent logging patterns

## 7. Implementation hints

### Backend Implementation

1. **Create mDNS module structure:**

```
apps/backend/src/modules/mdns/
├── mdns.module.ts
├── mdns.constants.ts
├── services/
│   ├── mdns.service.ts
│   └── mdns.service.spec.ts
```

2. **Service advertisement payload:**

```typescript
{
  name: 'FastyBird Smart Panel',  // FB_MDNS_SERVICE_NAME
  type: '_fastybird-panel._tcp',
  port: 3000,                      // FB_BACKEND_PORT
  txt: {
    version: '1.0.0',
    api: '/api/v1',
    secure: 'false'
  }
}
```

3. **Key NestJS patterns to follow:**
   - Look at `SystemModule` for lifecycle hook patterns
   - Look at `PlatformService` for system-level service patterns
   - Use `ConfigService` (NestJS) for environment variables

### Panel Implementation

1. **Create discovery service structure:**

```
apps/panel/lib/core/services/
├── mdns_discovery.dart          # New file
```

2. **Update StartupManagerService flow:**

```
┌─────────────────────┐
│ App Launch          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     Yes    ┌──────────────────┐
│ Has stored URL?     │───────────►│ Try connect      │
└─────────┬───────────┘            └────────┬─────────┘
          │ No                              │
          │                                 │ Fail
          ▼                                 ▼
┌─────────────────────┐            ┌──────────────────┐
│ Start mDNS discovery│◄───────────│ Start mDNS disc. │
└─────────┬───────────┘            └──────────────────┘
          │
          ▼
┌─────────────────────┐
│ Show discovery UI   │
└─────────────────────┘
```

3. **Key Flutter patterns to follow:**
   - Look at `SocketService` for service initialization patterns
   - Look at `StartupManagerService` for URL/connection handling
   - Use `SecureStorage` patterns for persistence

### Recommended npm packages for backend

| Package | Pros | Cons |
|---------|------|------|
| `@homebridge/ciao` | Well-maintained, pure JS, cross-platform, used by Homebridge | Slightly more complex API |
| `bonjour-service` | Simple API, pure JS, actively maintained | Fewer features than ciao |
| `mdns` | Native bindings, fast | Requires native compilation, platform issues |

**Recommendation:** Use `@homebridge/ciao` - it's battle-tested in Homebridge ecosystem.

### Recommended Flutter packages

| Package | Pros | Cons |
|---------|------|------|
| `nsd` | Native platform APIs, full-featured | Platform-specific implementations |
| `multicast_dns` | Pure Dart, portable | Limited platform support |
| `bonsoir` | Cross-platform, simple API | Less mature |

**Recommendation:** Use `nsd` or `bonsoir` for best cross-platform support.

## 8. AI instructions (for Junie / Claude)

- Read this file fully before implementing.
- Respect global rules in `/.ai-rules/GUIDELINES.md` and `/.ai-rules/API_CONVENTIONS.md`.
- Before implementing, propose a **step-by-step implementation plan** that:
  1. Lists files to create/modify for backend
  2. Lists files to create/modify for panel
  3. Specifies the order of implementation
  4. Identifies test requirements
- Implement backend and panel separately, testing each before integration.
- **Backend first:** Implement and test mDNS advertisement before panel changes.
- **Panel second:** Implement discovery and update startup flow.
- Use existing patterns from the codebase - do not introduce new architectural patterns.
- Ensure mDNS failures are non-blocking and logged appropriately.
- Consider embedded deployment scenarios where mDNS should be optional.

## 9. Environment variables

### Backend (new)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FB_MDNS_ENABLED` | boolean | `true` | Enable/disable mDNS service advertisement |
| `FB_MDNS_SERVICE_NAME` | string | `FastyBird Smart Panel` | Service name advertised via mDNS |
| `FB_MDNS_SERVICE_TYPE` | string | `_fastybird-panel._tcp` | mDNS service type |

### Panel (new)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FB_MDNS_DISCOVERY_ENABLED` | boolean | `true` | Enable mDNS discovery fallback |
| `FB_MDNS_DISCOVERY_TIMEOUT` | int | `10000` | Discovery timeout in milliseconds |

## 10. Security considerations

- mDNS operates on the local network only - no internet exposure
- TXT records should not contain sensitive information
- Panel should validate backend responses before trusting discovered URL
- HTTPS support can be indicated via TXT record for future secure deployments
- Consider allowing mDNS to be disabled for security-sensitive environments

## 11. Testing requirements

### Backend unit tests

- Service starts and advertises successfully
- Service unpublishes on shutdown
- Service handles network errors gracefully
- TXT records are correctly formatted
- Configuration via environment variables works

### Panel unit tests

- Discovery finds advertised services
- Discovery times out appropriately
- Discovered URL is stored correctly
- Startup flow integrates discovery correctly
- Manual URL entry fallback works

### Integration tests

- End-to-end: Panel discovers backend on same network
- Backend IP change: Panel recovers via rediscovery
- Graceful degradation: Panel handles mDNS unavailability

## 12. Future enhancements (out of scope for this task)

- Multiple backend discovery with selection UI
- IPv6 support
- Secure mDNS (mDNS over TLS)
- Admin UI for mDNS configuration
- Auto-reconnect with mDNS fallback on connection loss
- Service health status in mDNS TXT records
