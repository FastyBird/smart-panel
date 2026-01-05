# Implementation Plan: Backend Intent Orchestration + Panel Anti-Jitter

**Task:** EPIC-INTENTS-ORCHESTRATION
**Status:** Planning
**Scope:** Backend (NestJS) + Panel (Flutter/Dart)

---

## Overview

This plan implements a short-lived **Intent** system that coordinates user actions across multiple clients, preventing UI jitter and providing partial-failure visibility. The backend manages intent lifecycle (create → complete/expire) and broadcasts events via Socket.IO. The panel applies an **optimistic overlay** that ignores conflicting device-state updates while an intent is active.

---

## Phase 1: Backend IntentsModule Core

**Task:** TECH-BE-INTENTS-MODULE

### Step 1.1: Create IntentsModule Structure

Create the module skeleton at `apps/backend/src/modules/intents/`:

```
intents/
├── intents.module.ts          # Module definition
├── intents.constants.ts       # Event types, TTL defaults, status enum
├── services/
│   └── intents.service.ts     # Core intent registry logic
├── models/
│   └── intent.model.ts        # IntentRecord, IntentTarget, IntentResult
└── intents.service.spec.ts    # Unit tests
```

### Step 1.2: Define Intent Data Models

**IntentRecord:**
```typescript
interface IntentRecord {
  id: string;                    // UUID
  type: string;                  // e.g., 'light.setBrightness', 'scene.run'
  scope?: {                      // Optional context
    roomId?: string;
    roleId?: string;
    sceneId?: string;
  };
  targets: IntentTarget[];       // Affected devices/properties
  value: unknown;                // Target value (brightness: 50, color: '#FF0000')
  status: IntentStatus;          // pending | completed_success | completed_partial | completed_failed | expired
  ttlMs: number;                 // Time-to-live in milliseconds
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  results?: IntentTargetResult[]; // Per-device results on completion
}

interface IntentTarget {
  deviceId: string;
  channelId?: string;
  propertyKey?: string;          // e.g., 'brightness', 'color', 'on'
}

interface IntentTargetResult {
  deviceId: string;
  status: 'success' | 'failed' | 'timeout' | 'skipped';
  error?: string;
}
```

### Step 1.3: Implement IntentsService

```typescript
@Injectable()
export class IntentsService implements OnModuleInit, OnModuleDestroy {
  private readonly intents = new Map<string, IntentRecord>();
  private cleanupInterval: NodeJS.Timeout;

  // TTL defaults (configurable)
  private readonly DEFAULT_TTL_SLIDER = 3000;  // 3s for device commands
  private readonly DEFAULT_TTL_SCENE = 5000;   // 5s for scene execution
  private readonly CLEANUP_INTERVAL = 500;     // Check every 500ms

  onModuleInit() {
    this.cleanupInterval = setInterval(() => this.expireIntents(), this.CLEANUP_INTERVAL);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  createIntent(input: CreateIntentInput): IntentRecord;
  completeIntent(intentId: string, results: IntentTargetResult[]): IntentRecord;
  getIntent(intentId: string): IntentRecord | undefined;
  findActiveIntents(query: { deviceId?: string; roomId?: string; sceneId?: string }): IntentRecord[];

  private expireIntents(): void;  // Called by cleanup loop
}
```

### Step 1.4: Add Unit Tests

Test cases:
- Create intent → stored with correct TTL
- Complete intent → status updated, expiry stopped
- Expire intent → status = 'expired', event emitted
- Find active intents by deviceId, roomId, sceneId
- Cleanup loop removes expired intents

---

## Phase 2: Socket.IO Intent Events

**Task:** TECH-BE-INTENTS-SOCKET-EVENTS

### Step 2.1: Define Socket Event Constants

```typescript
// intents.constants.ts
export enum IntentEvent {
  CREATED = 'IntentsModule.Intent.Created',
  COMPLETED = 'IntentsModule.Intent.Completed',
  EXPIRED = 'IntentsModule.Intent.Expired',
}
```

### Step 2.2: Create IntentsGateway (or extend WebsocketGateway)

**Option A:** Extend existing WebsocketGateway with intent methods
**Option B:** Create dedicated IntentsGateway (preferred for separation)

```typescript
@Injectable()
export class IntentsGateway implements OnModuleInit {
  constructor(
    private readonly websocketGateway: WebsocketGateway,
    private readonly intentsService: IntentsService,
  ) {}

  emitIntentCreated(intent: IntentRecord): void {
    this.websocketGateway.broadcastToAll(IntentEvent.CREATED, this.toPayload(intent));
  }

  emitIntentCompleted(intent: IntentRecord): void {
    this.websocketGateway.broadcastToAll(IntentEvent.COMPLETED, this.toPayload(intent));
  }

  emitIntentExpired(intent: IntentRecord): void {
    this.websocketGateway.broadcastToAll(IntentEvent.EXPIRED, this.toPayload(intent));
  }

  private toPayload(intent: IntentRecord): IntentEventPayload {
    return {
      intentId: intent.id,
      type: intent.type,
      scope: intent.scope,
      targets: intent.targets,
      value: intent.value,
      status: intent.status,
      ttlMs: intent.ttlMs,
      createdAt: intent.createdAt.toISOString(),
      expiresAt: intent.expiresAt.toISOString(),
      completedAt: intent.completedAt?.toISOString(),
      results: intent.results,
    };
  }
}
```

### Step 2.3: Wire Events to IntentsService

Modify IntentsService to emit events via IntentsGateway:
- On `createIntent()` → emit `intent.created`
- On `completeIntent()` → emit `intent.completed`
- On `expireIntents()` (for each expired) → emit `intent.expired`

### Step 2.4: Add Gateway Tests

Test that gateway emits correct events with mocked WebsocketGateway.

---

## Phase 3: Device Commands Integration

**Task:** FEATURE-BE-DEVICES-INTENTS-INTEGRATION

### Step 3.1: Identify Command Entry Points

From codebase exploration, device commands flow through:
- `PropertyCommandService.handleInternal()` - WebSocket commands
- Potentially REST endpoints in `DevicesController`

### Step 3.2: Create Intent Wrapper for Device Commands

Modify `PropertyCommandService` or create a new `IntentDeviceCommandService`:

```typescript
async handlePropertyCommand(
  user: ClientUserDto,
  payload: PropertyCommandDto,
): Promise<IntentCommandResult> {
  // 1. Create intent
  const intent = this.intentsService.createIntent({
    type: this.determineIntentType(payload),  // 'light.setBrightness', etc.
    targets: payload.properties.map(p => ({
      deviceId: p.device,
      channelId: p.channel,
      propertyKey: this.getPropertyKey(p.property),
    })),
    value: payload.properties[0]?.value,  // Primary value
    scope: { roomId: payload.roomId, roleId: payload.roleId },
    ttlMs: 3000,
  });

  // 2. Execute commands per device
  const results: IntentTargetResult[] = [];
  for (const prop of payload.properties) {
    try {
      const success = await this.executeWithTimeout(prop, 2500);
      results.push({
        deviceId: prop.device,
        status: success ? 'success' : 'failed',
      });
    } catch (e) {
      if (e instanceof TimeoutError) {
        results.push({ deviceId: prop.device, status: 'timeout' });
      } else {
        results.push({ deviceId: prop.device, status: 'failed', error: e.message });
      }
    }
  }

  // 3. Complete intent
  const completedIntent = this.intentsService.completeIntent(intent.id, results);

  return {
    intentId: intent.id,
    status: completedIntent.status,
    results,
  };
}
```

### Step 3.3: Determine Intent Type from Command

Map property types to intent types:
- `brightness` property → `light.setBrightness`
- `on` property → `light.toggle`
- `color` property → `light.setColor`
- `color_temp` property → `light.setColorTemp`
- `white` property → `light.setWhite`

### Step 3.4: Add Timeout Handling

Wrap platform command execution with timeout:
```typescript
private async executeWithTimeout(prop: PropertyCommandValueDto, timeoutMs: number): Promise<boolean> {
  return Promise.race([
    this.platform.process(prop),
    new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new TimeoutError()), timeoutMs)
    ),
  ]);
}
```

### Step 3.5: Add Unit Tests

- Success case: all devices succeed → status `completed_success`
- Partial case: some succeed, some fail → status `completed_partial`
- Failure case: all fail → status `completed_failed`
- Timeout case: device times out → result `timeout`, intent still completes

---

## Phase 4: Scenes Integration

**Task:** FEATURE-BE-SCENES-INTENTS-INTEGRATION

### Step 4.1: Wrap Scene Execution with Intent

Modify `SceneExecutorService.triggerScene()`:

```typescript
async triggerScene(sceneId: string, triggeredBy?: string): Promise<SceneExecutionResultModel> {
  const scene = await this.scenesService.getOneOrThrow(sceneId);

  // 1. Create scene intent
  const deviceIds = this.extractDeviceIds(scene.actions);
  const intent = this.intentsService.createIntent({
    type: 'scene.run',
    scope: { sceneId, roomId: scene.roomId },
    targets: deviceIds.map(id => ({ deviceId: id })),
    value: { sceneName: scene.name },
    ttlMs: 5000,
  });

  // 2. Execute scene (existing logic)
  const result = await this.executeSceneActions(scene);

  // 3. Map action results to intent results
  const intentResults = this.mapActionResultsToIntentResults(result.actionResults);

  // 4. Complete intent
  this.intentsService.completeIntent(intent.id, intentResults);

  return result;
}
```

### Step 4.2: Map Scene Action Results to Intent Results

```typescript
private mapActionResultsToIntentResults(
  actionResults: ActionExecutionResultModel[]
): IntentTargetResult[] {
  return actionResults.map(ar => ({
    deviceId: ar.deviceId || ar.actionId,  // Use deviceId if available
    status: ar.success ? 'success' : 'failed',
    error: ar.error,
  }));
}
```

### Step 4.3: Add Unit Tests

- Scene with 3 devices: 2 succeed, 1 fails → `completed_partial`
- Scene times out mid-execution → intent expires with status `expired`

---

## Phase 5: Panel Intent Overlay Store

**Task:** FEATURE-PANEL-INTENT-OVERLAY-STORE

### Step 5.1: Create IntentOverlayService

Location: `apps/panel/lib/modules/devices/services/intent_overlay_service.dart`

```dart
class IntentOverlayService extends ChangeNotifier {
  final SocketService _socketService;

  // Active intents indexed by intentId
  final Map<String, IntentOverlay> _activeIntents = {};

  // Quick lookup: deviceId+propertyKey → intentId
  final Map<String, String> _targetIndex = {};

  void initialize() {
    _socketService.registerEventHandler(
      'IntentsModule.Intent.Created',
      _handleIntentCreated,
    );
    _socketService.registerEventHandler(
      'IntentsModule.Intent.Completed',
      _handleIntentCompleted,
    );
    _socketService.registerEventHandler(
      'IntentsModule.Intent.Expired',
      _handleIntentExpired,
    );
  }

  /// Check if a property is locked by an active intent
  bool isLocked(String deviceId, String propertyKey) {
    final key = '$deviceId:$propertyKey';
    return _targetIndex.containsKey(key);
  }

  /// Get the overlay value for a locked property
  dynamic getOverlayValue(String deviceId, String propertyKey) {
    final key = '$deviceId:$propertyKey';
    final intentId = _targetIndex[key];
    if (intentId == null) return null;
    return _activeIntents[intentId]?.value;
  }

  /// Get intent status for a device (for showing failure indicators)
  IntentTargetResult? getTargetResult(String deviceId) {
    // Find completed intent with this device in results
    ...
  }

  void _handleIntentCreated(String event, Map<String, dynamic> payload) {
    final overlay = IntentOverlay.fromJson(payload);
    _activeIntents[overlay.intentId] = overlay;
    for (final target in overlay.targets) {
      final key = '${target.deviceId}:${target.propertyKey}';
      _targetIndex[key] = overlay.intentId;
    }
    notifyListeners();
  }

  void _handleIntentCompleted(String event, Map<String, dynamic> payload) {
    final intentId = payload['intentId'] as String;
    _clearIntent(intentId);
    // Store results briefly for failure indicators
    _storeResults(intentId, payload['results']);
    notifyListeners();
  }

  void _handleIntentExpired(String event, Map<String, dynamic> payload) {
    final intentId = payload['intentId'] as String;
    _clearIntent(intentId);
    notifyListeners();
  }

  void _clearIntent(String intentId) {
    final overlay = _activeIntents.remove(intentId);
    if (overlay != null) {
      for (final target in overlay.targets) {
        final key = '${target.deviceId}:${target.propertyKey}';
        if (_targetIndex[key] == intentId) {
          _targetIndex.remove(key);
        }
      }
    }
  }
}
```

### Step 5.2: Create IntentOverlay Model

```dart
class IntentOverlay {
  final String intentId;
  final String type;
  final List<IntentTarget> targets;
  final dynamic value;
  final String status;
  final DateTime expiresAt;

  factory IntentOverlay.fromJson(Map<String, dynamic> json) { ... }
}

class IntentTarget {
  final String deviceId;
  final String? channelId;
  final String? propertyKey;
}

class IntentTargetResult {
  final String deviceId;
  final String status;  // success, failed, timeout, skipped
  final String? error;
}
```

### Step 5.3: Register in Module and DI

Add to `apps/panel/lib/modules/devices/module.dart`:
```dart
final _intentOverlayService = IntentOverlayService(socketService: locator<SocketService>());
locator.registerSingleton(_intentOverlayService);
```

Add to MultiProvider in `apps/panel/lib/app/app.dart`:
```dart
ChangeNotifierProvider.value(value: locator<IntentOverlayService>()),
```

### Step 5.4: Add Unit Tests

- Intent created → targets locked, overlay value available
- Intent completed → targets unlocked, results available briefly
- Intent expired → targets unlocked
- Multiple intents for different devices → independent locking

---

## Phase 6: Panel Lighting UI Integration

**Task:** FEATURE-PANEL-LIGHTING-ROLE-DETAIL-INTENTS

### Step 6.1: Modify Property Value Display

In lighting detail views, use overlay value when locked:

```dart
Widget _buildBrightnessSlider(ChannelPropertyView property) {
  final overlayService = context.watch<IntentOverlayService>();
  final isLocked = overlayService.isLocked(property.deviceId, 'brightness');
  final displayValue = isLocked
    ? overlayService.getOverlayValue(property.deviceId, 'brightness')
    : property.value;

  return Slider(
    value: displayValue,
    onChanged: (value) => _handleBrightnessChange(property, value),
    // Visual indicator for locked state
    activeColor: isLocked ? Colors.orange : Theme.of(context).primaryColor,
  );
}
```

### Step 6.2: Apply Optimistic Overlay on Interaction

Modify `ChannelPropertiesRepository.setValue()` to create local overlay immediately:

```dart
Future<bool> setValue(String id, dynamic value) async {
  // Create local optimistic overlay
  final intentOverlayService = locator<IntentOverlayService>();
  intentOverlayService.createLocalOverlay(
    deviceId: property.deviceId,
    propertyKey: property.key,
    value: value,
  );

  // Existing: send command to backend
  await _sendCommandToBackend(channel, property, completer);

  // Backend intent events will manage actual overlay lifecycle
  return completer.future;
}
```

### Step 6.3: Show Partial Failure Indicators

In device list items within role detail:

```dart
Widget _buildDeviceListItem(DeviceView device) {
  final overlayService = context.watch<IntentOverlayService>();
  final result = overlayService.getTargetResult(device.id);
  final isFailed = result?.status == 'failed' || result?.status == 'timeout';

  return ListTile(
    title: Text(device.name),
    trailing: isFailed
      ? Icon(Icons.warning, color: Colors.orange)
      : null,
    subtitle: isFailed ? Text('Not synced') : null,
  );
}
```

### Step 6.4: Handle Expiration Gracefully

When intent expires, allow state-driven rendering to resume:
- Clear overlay
- Show actual device state (may differ from user's target)
- Brief visual transition (fade) to avoid jarring change

---

## Files to Create/Modify

### Backend (Create)

| File | Description |
|------|-------------|
| `apps/backend/src/modules/intents/intents.module.ts` | Module definition |
| `apps/backend/src/modules/intents/intents.constants.ts` | Events, enums, TTL defaults |
| `apps/backend/src/modules/intents/services/intents.service.ts` | Core registry logic |
| `apps/backend/src/modules/intents/services/intents-gateway.service.ts` | Socket.IO event emission |
| `apps/backend/src/modules/intents/models/intent.model.ts` | Data models |
| `apps/backend/src/modules/intents/intents.service.spec.ts` | Unit tests |
| `apps/backend/src/modules/intents/intents-gateway.service.spec.ts` | Gateway tests |

### Backend (Modify)

| File | Description |
|------|-------------|
| `apps/backend/src/modules/devices/services/property-command.service.ts` | Wrap with intent creation |
| `apps/backend/src/modules/scenes/services/scene-executor.service.ts` | Wrap with intent creation |
| `apps/backend/src/app.module.ts` | Import IntentsModule |

### Panel (Create)

| File | Description |
|------|-------------|
| `apps/panel/lib/modules/devices/services/intent_overlay_service.dart` | Overlay store |
| `apps/panel/lib/modules/devices/models/intent_overlay.dart` | Overlay models |
| `apps/panel/test/modules/devices/services/intent_overlay_service_test.dart` | Unit tests |

### Panel (Modify)

| File | Description |
|------|-------------|
| `apps/panel/lib/modules/devices/module.dart` | Register IntentOverlayService |
| `apps/panel/lib/app/app.dart` | Add ChangeNotifierProvider |
| `apps/panel/lib/modules/devices/views/devices/lighting.dart` | Use overlay for display |
| `apps/panel/lib/modules/devices/repositories/channel_properties.dart` | Optimistic overlay creation |

---

## Acceptance Criteria Mapping

| Criterion | Implementation Step |
|-----------|---------------------|
| IntentsModule with in-memory registry, TTL, cleanup | Phase 1 (Steps 1.1-1.4) |
| Socket.IO intent lifecycle events | Phase 2 (Steps 2.1-2.4) |
| Device commands create intents with per-device results | Phase 3 (Steps 3.1-3.5) |
| Scene execution creates single intent with aggregated results | Phase 4 (Steps 4.1-4.3) |
| Panel overlay prevents UI jitter | Phase 5 + 6 |
| Intents expire automatically, UI returns to state-driven | Phase 5 (Step 5.4), Phase 6 (Step 6.4) |
| Unit tests for backend and panel | All phases include tests |

---

## Estimated Order of Implementation

1. **Phase 1:** Backend IntentsModule core (foundation)
2. **Phase 2:** Socket.IO events (enables frontend testing)
3. **Phase 5:** Panel overlay store (can test with manual events)
4. **Phase 3:** Device commands integration
5. **Phase 4:** Scenes integration
6. **Phase 6:** Panel UI integration

---

## Open Questions / Decisions

1. **IntentsGateway location:** Separate gateway service vs. extending WebsocketGateway? → Recommend separate for modularity
2. **TTL configuration:** Hardcoded vs. ConfigService? → Start hardcoded, add config later if needed
3. **Optimistic overlay timing:** Create local overlay immediately vs. wait for backend event? → Recommend immediate for responsive UX
4. **Failure indicator duration:** How long to show "not synced" badge? → 10s, configurable

---

*Ready for review and approval.*
