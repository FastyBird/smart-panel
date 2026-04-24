# Zigbee2MQTT Device Adoption Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-device adoption wizard to the `devices-zigbee2mqtt` plugin, modeled on shelly-ng's wizard, with two-mode discovery (existing-unadopted + permit_join), auto-mapping, humanized friendly_names, and category overrides.

**Architecture:** Backend `Z2mWizardService` keeps in-memory wizard sessions, subscribes to existing z2m events, exposes 6 REST endpoints, and reuses `Z2mDeviceAdoptionService` / `Z2mMappingPreviewService`. Admin adds 4 Vue components (top-level + 3 step components), 2 composables, and i18n keys, registered as the plugin's `deviceWizard` slot. Existing single-device add form stays unchanged.

**Tech Stack:** NestJS + class-validator + Swagger decorators (backend), Vue 3 Composition API + Element Plus + natural-orderby + Vitest (admin), Jest (backend tests), pnpm workspaces.

**Spec:** [`docs/superpowers/specs/2026-04-30-zigbee2mqtt-device-wizard-design.md`](../specs/2026-04-30-zigbee2mqtt-device-wizard-design.md)

**Conventions:**
- Backend file path prefix: `apps/backend/src/plugins/devices-zigbee2mqtt/`
- Admin file path prefix: `apps/admin/src/plugins/devices-zigbee2mqtt/`
- Schema name prefix: `DevicesZigbee2mqttPluginRes*`, `DevicesZigbee2mqttPluginReq*`, `DevicesZigbee2mqttPluginData*`
- Backend logger: `createExtensionLogger(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, '<ClassName>')`
- Run lint with `pnpm run lint:js` and tests with `pnpm run test:unit` (backend) / `pnpm --filter ./apps/admin run test:unit` (admin)

**Reference files** (read before starting, do not modify):
- Backend wizard reference: [`apps/backend/src/plugins/devices-shelly-ng/services/shelly-ng-discovery.service.ts`](../../../apps/backend/src/plugins/devices-shelly-ng/services/shelly-ng-discovery.service.ts), [`controllers/shelly-ng-devices.controller.ts`](../../../apps/backend/src/plugins/devices-shelly-ng/controllers/shelly-ng-devices.controller.ts), [`models/shelly-ng.model.ts`](../../../apps/backend/src/plugins/devices-shelly-ng/models/shelly-ng.model.ts)
- Admin wizard reference: [`apps/admin/src/plugins/devices-shelly-ng/components/shelly-ng-devices-wizard.vue`](../../../apps/admin/src/plugins/devices-shelly-ng/components/shelly-ng-devices-wizard.vue), [`composables/useDevicesWizard.ts`](../../../apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.ts)
- Existing zigbee2mqtt service & adapter: [`apps/backend/src/plugins/devices-zigbee2mqtt/services/zigbee2mqtt.service.ts`](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/zigbee2mqtt.service.ts), [`base-client-adapter.ts`](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/base-client-adapter.ts), [`mqtt-client-adapter.service.ts`](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/mqtt-client-adapter.service.ts), [`ws-client-adapter.service.ts`](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/ws-client-adapter.service.ts)

---

## File Inventory

### Backend — new files

| Path | Responsibility |
|---|---|
| `services/wizard.service.ts` | Wizard session lifecycle, permit_join control, batch adoption, z2m event subscription |
| `services/wizard.service.spec.ts` | Unit tests for wizard service |
| `controllers/zigbee2mqtt-wizard.controller.ts` | Six REST endpoints under `/wizard` |
| `controllers/zigbee2mqtt-wizard.controller.spec.ts` | Unit tests for wizard controller |
| `models/wizard.model.ts` | Data models: `Z2mWizardDeviceSnapshotModel`, `Z2mWizardSessionModel`, `Z2mWizardAdoptionResultModel`, `Z2mWizardPermitJoinModel` |
| `dto/wizard-adopt.dto.ts` | `Z2mWizardAdoptDeviceDto`, `Z2mWizardAdoptDto`, `ReqZ2mWizardAdoptDto` |

### Backend — modified files

| Path | Change |
|---|---|
| `services/base-client-adapter.ts` | Add abstract `setPermitJoin(seconds: number): Promise<boolean>` method |
| `services/mqtt-client-adapter.service.ts` | Implement `setPermitJoin` — publish `<baseTopic>/bridge/request/permit_join` with `{value, time}` |
| `services/ws-client-adapter.service.ts` | Implement `setPermitJoin` — send websocket `bridge/request/permit_join` event |
| `services/zigbee2mqtt.service.ts` | Add `setPermitJoin(seconds)` proxy + `subscribeToDeviceJoined(cb): () => void` event subscription |
| `models/zigbee2mqtt-response.model.ts` | Add four response wrappers for wizard models |
| `devices-zigbee2mqtt.plugin.ts` | Register `Zigbee2mqttWizardController` and `Z2mWizardService` |
| `devices-zigbee2mqtt.openapi.ts` | Register new schemas in OpenAPI registry |

### Admin — new files

| Path | Responsibility |
|---|---|
| `components/zigbee2mqtt-devices-wizard.vue` | Top-level wizard, step orchestrator, registered as `deviceWizard` |
| `components/zigbee2mqtt-wizard-discovery-step.vue` | Step 1: list of devices + permit_join button + countdown |
| `components/zigbee2mqtt-wizard-categorize-step.vue` | Step 2: sortable table with editable name/category + channel badge |
| `components/zigbee2mqtt-wizard-results-step.vue` | Step 3: read-only adoption outcomes |
| `composables/useDevicesWizard.ts` | Wizard state (session, selection, overrides), polling, adopt action |
| `composables/useDevicesWizard.spec.ts` | Unit tests for `useDevicesWizard` |
| `composables/useFriendlyNameHumanizer.ts` | snake/kebab/camel → Title Case |
| `composables/useFriendlyNameHumanizer.spec.ts` | Unit tests for humanizer |

### Admin — modified files

| Path | Change |
|---|---|
| `components/components.ts` | Export new wizard component |
| `composables/composables.ts` | Export new composables |
| `schemas/devices.types.ts` | Add `IZ2mWizardSession`, `IZ2mWizardDevice`, `IZ2mWizardPermitJoin`, `IZ2mWizardAdoptionResult` types |
| `utils/devices.transformers.ts` | Add `transformWizardSessionResponse()` |
| `devices-zigbee2mqtt.plugin.ts` | Register `deviceWizard: Zigbee2mqttDevicesWizard` |
| `locales/en-US.json` (and other locales matching shelly's locale set) | Add `plugins.devices-zigbee2mqtt.wizard.*` keys |

### Generated files (DO NOT edit; regenerated by `pnpm run generate:openapi`)

- `spec/api/v1/openapi.json`
- `apps/admin/src/openapi.ts`

---

## Task 1: Add `setPermitJoin` to base adapter and implementations

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/base-client-adapter.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/mqtt-client-adapter.service.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/ws-client-adapter.service.ts`

- [ ] **Step 1: Add abstract method to base adapter**

In `base-client-adapter.ts`, add the abstract method next to the other abstracts:

```ts
/**
 * Toggle the bridge's permit_join state for a bounded number of seconds.
 * Returns true on successful publish/send, false otherwise.
 * Pass 0 to disable pairing immediately.
 */
abstract setPermitJoin(seconds: number): Promise<boolean>;
```

- [ ] **Step 2: Implement `setPermitJoin` in MQTT adapter**

In `mqtt-client-adapter.service.ts`, add (after `requestState` or wherever `publishCommand` lives):

```ts
async setPermitJoin(seconds: number): Promise<boolean> {
    if (!this.client?.connected) {
        this.logger.warn('Cannot toggle permit_join: not connected to MQTT broker');
        return false;
    }

    const topic = `${this.baseTopic}/bridge/request/permit_join`;
    const value = seconds > 0;
    const message = JSON.stringify({ value, time: seconds });

    this.logger.debug(`Publishing permit_join to ${topic}: ${message}`);

    return new Promise<boolean>((resolve) => {
        this.client?.publish(topic, message, { qos: 1 }, (error) => {
            if (error) {
                this.logger.error(`Failed to publish permit_join to ${topic}`, {
                    message: error.message,
                });
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}
```

- [ ] **Step 3: Implement `setPermitJoin` in WS adapter**

In `ws-client-adapter.service.ts`, add an analogous method that sends the same payload over the websocket connection. The shape is the same — `bridge/request/permit_join` topic with `{value, time}` body. Reuse the websocket `send` mechanism already used by `publishCommand` in this file.

- [ ] **Step 4: Run typecheck to confirm no compile errors**

Run: `pnpm run lint:js`
Expected: PASS (no new errors)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/base-client-adapter.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/mqtt-client-adapter.service.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/ws-client-adapter.service.ts
git commit -m "Z2M wizard: add setPermitJoin to bridge adapters"
```

---

## Task 2: Expose `setPermitJoin` and `subscribeToDeviceJoined` on `Zigbee2mqttService`

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/zigbee2mqtt.service.ts`

- [ ] **Step 1: Locate the active adapter accessor**

Read `zigbee2mqtt.service.ts` to find how it accesses the active adapter (likely a private field set during `start()` based on config.connectionType). The new methods must proxy through this.

- [ ] **Step 2: Add `setPermitJoin` proxy method**

Add the public method on `Zigbee2mqttService`:

```ts
async setPermitJoin(seconds: number): Promise<boolean> {
    if (!this.isBridgeOnline()) {
        return false;
    }

    if (!this.activeAdapter) {
        return false;
    }

    return this.activeAdapter.setPermitJoin(seconds);
}
```

(Replace `this.activeAdapter` with the actual private field name.)

- [ ] **Step 3: Add `subscribeToDeviceJoined` event subscription**

Identify how device-joined events are currently raised inside `Zigbee2mqttService` (look for `emit`, `EventEmitter`, or callback registries). Expose an `(cb: (device: Z2mRegisteredDevice) => void) => () => void` subscription that fires whenever a new device appears. If the service already has an internal event emitter, just add the public method that wraps it; if not, add a small subscriber set:

```ts
private readonly deviceJoinedSubscribers = new Set<(d: Z2mRegisteredDevice) => void>();

subscribeToDeviceJoined(cb: (d: Z2mRegisteredDevice) => void): () => void {
    this.deviceJoinedSubscribers.add(cb);
    return () => this.deviceJoinedSubscribers.delete(cb);
}

private notifyDeviceJoined(device: Z2mRegisteredDevice): void {
    for (const cb of this.deviceJoinedSubscribers) {
        try { cb(device); } catch (e) {
            this.logger.warn('Device-joined subscriber threw', { message: (e as Error).message });
        }
    }
}
```

Then call `notifyDeviceJoined(device)` wherever the service currently registers a newly joined Z2M device.

- [ ] **Step 4: Run typecheck**

Run: `pnpm run lint:js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/zigbee2mqtt.service.ts
git commit -m "Z2M wizard: expose setPermitJoin and device-joined subscription"
```

---

## Task 3: Backend wizard data models

**Files:**
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/models/wizard.model.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/models/zigbee2mqtt-response.model.ts`

- [ ] **Step 1: Create `wizard.model.ts` with all wizard data classes**

Create `apps/backend/src/plugins/devices-zigbee2mqtt/models/wizard.model.ts`. Use shelly-ng `models/shelly-ng.model.ts` as the structural template (class-validator + class-transformer + Swagger decorators with `@ApiSchema({ name: 'DevicesZigbee2mqttPluginData<Name>' })`).

Required classes:

```ts
import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardPermitJoin' })
export class Z2mWizardPermitJoinModel {
    @ApiProperty({ description: 'Whether bridge is currently in pairing mode', example: false })
    @Expose()
    @IsBoolean()
    active: boolean;

    @ApiPropertyOptional({ description: 'Permit_join expiry timestamp', nullable: true, example: '2026-04-30T12:04:14.000Z' })
    @Expose()
    @IsString()
    @IsOptional()
    expiresAt: string | null;

    @ApiProperty({ description: 'Remaining permit_join seconds (0 when inactive)', example: 0 })
    @Expose()
    @IsInt()
    remainingSeconds: number;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardDevice' })
export class Z2mWizardDeviceSnapshotModel {
    @ApiProperty({ description: 'Device IEEE address (unique key)', example: '0x00158d0001a1b2c3' })
    @Expose()
    @IsString()
    ieeeAddress: string;

    @ApiProperty({ description: 'Z2M friendly name (raw, as configured in zigbee2mqtt)', example: 'living_room_lamp' })
    @Expose()
    @IsString()
    friendlyName: string;

    @ApiPropertyOptional({ description: 'Manufacturer (vendor)', nullable: true, example: 'Philips' })
    @Expose()
    @IsString()
    @IsOptional()
    manufacturer: string | null;

    @ApiPropertyOptional({ description: 'Model identifier', nullable: true, example: 'LCT001' })
    @Expose()
    @IsString()
    @IsOptional()
    model: string | null;

    @ApiPropertyOptional({ description: 'Human-readable model description', nullable: true, example: 'Hue White and Color Ambiance E27' })
    @Expose()
    @IsString()
    @IsOptional()
    description: string | null;

    @ApiProperty({
        description: 'Wizard candidate status',
        enum: ['ready', 'unsupported', 'already_registered', 'failed'],
        example: 'ready',
    })
    @Expose()
    @IsIn(['ready', 'unsupported', 'already_registered', 'failed'])
    status: string;

    @ApiProperty({
        description: 'Available target device categories',
        type: 'array',
        items: { type: 'string', enum: Object.values(DeviceCategory) },
        example: [DeviceCategory.LIGHTING],
    })
    @Expose()
    @IsArray()
    @IsString({ each: true })
    categories: DeviceCategory[];

    @ApiPropertyOptional({
        description: 'Suggested target device category from descriptor',
        nullable: true,
        enum: DeviceCategory,
        example: DeviceCategory.LIGHTING,
    })
    @Expose()
    @IsString()
    @IsOptional()
    suggestedCategory: DeviceCategory | null;

    @ApiProperty({ description: 'Channel count predicted by the mapping preview', example: 4 })
    @Expose()
    @IsInt()
    previewChannelCount: number;

    @ApiProperty({
        description: 'Identifiers of channels that would be created (for tooltip)',
        type: 'array',
        items: { type: 'string' },
        example: ['light', 'illuminance', 'battery'],
    })
    @Expose()
    @IsArray()
    @IsString({ each: true })
    previewChannelIdentifiers: string[];

    @ApiPropertyOptional({ description: 'Already registered device id', nullable: true, example: null })
    @Expose() @IsString() @IsOptional()
    registeredDeviceId: string | null;

    @ApiPropertyOptional({ description: 'Already registered device name', nullable: true, example: null })
    @Expose() @IsString() @IsOptional()
    registeredDeviceName: string | null;

    @ApiPropertyOptional({ description: 'Already registered device category', nullable: true, enum: DeviceCategory, example: null })
    @Expose() @IsIn(Object.values(DeviceCategory)) @IsOptional()
    registeredDeviceCategory: DeviceCategory | null;

    @ApiPropertyOptional({ description: 'Last lookup error message', nullable: true, example: null })
    @Expose() @IsString() @IsOptional()
    error: string | null;

    @ApiProperty({ description: 'Last time this candidate was observed', example: '2026-04-30T12:00:00.000Z' })
    @Expose() @IsString()
    lastSeenAt: string;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardSession' })
export class Z2mWizardSessionModel {
    @ApiProperty({ description: 'Wizard session id', example: 'c66808d8-0af1-4b93-bd61-4131cf62f20f' })
    @Expose() @IsString() id: string;

    @ApiProperty({ description: 'Whether bridge is currently online', example: true })
    @Expose() @IsBoolean() bridgeOnline: boolean;

    @ApiProperty({ description: 'Wizard session start timestamp', example: '2026-04-30T12:00:00.000Z' })
    @Expose() @IsString() startedAt: string;

    @ApiProperty({ description: 'Permit_join state', type: () => Z2mWizardPermitJoinModel })
    @Expose() @ValidateNested() @Type(() => Z2mWizardPermitJoinModel)
    permitJoin: Z2mWizardPermitJoinModel;

    @ApiProperty({
        description: 'Discovered Zigbee device candidates',
        type: 'array',
        items: { $ref: getSchemaPath(Z2mWizardDeviceSnapshotModel) },
    })
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Z2mWizardDeviceSnapshotModel)
    devices: Z2mWizardDeviceSnapshotModel[];
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardAdoptionResult' })
export class Z2mWizardAdoptionResultModel {
    @ApiProperty({ description: 'Device IEEE address', example: '0x00158d0001a1b2c3' })
    @Expose() @IsString() ieeeAddress: string;

    @ApiProperty({ description: 'Resolved Smart Panel device name', example: 'Living Room Lamp' })
    @Expose() @IsString() name: string;

    @ApiProperty({ description: 'Adoption outcome', enum: ['created', 'updated', 'failed'], example: 'created' })
    @Expose() @IsIn(['created', 'updated', 'failed']) status: string;

    @ApiPropertyOptional({ description: 'Failure message', nullable: true, example: null })
    @Expose() @IsString() @IsOptional() error: string | null;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardAdoption' })
export class Z2mWizardAdoptionModel {
    @ApiProperty({
        description: 'Per-device adoption results',
        type: 'array',
        items: { $ref: getSchemaPath(Z2mWizardAdoptionResultModel) },
    })
    @Expose() @IsArray() @ValidateNested({ each: true })
    @Type(() => Z2mWizardAdoptionResultModel)
    results: Z2mWizardAdoptionResultModel[];
}
```

- [ ] **Step 2: Add response wrappers in `zigbee2mqtt-response.model.ts`**

Append to `models/zigbee2mqtt-response.model.ts`:

```ts
import {
    Z2mWizardSessionModel,
    Z2mWizardAdoptionModel,
} from './wizard.model';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginResWizardSession' })
export class Z2mWizardSessionResponseModel extends BaseSuccessResponseModel<Z2mWizardSessionModel> {
    @ApiProperty({ description: 'The actual data payload returned by the API', type: () => Z2mWizardSessionModel })
    @Expose()
    declare data: Z2mWizardSessionModel;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginResWizardAdoption' })
export class Z2mWizardAdoptionResponseModel extends BaseSuccessResponseModel<Z2mWizardAdoptionModel> {
    @ApiProperty({ description: 'The actual data payload returned by the API', type: () => Z2mWizardAdoptionModel })
    @Expose()
    declare data: Z2mWizardAdoptionModel;
}
```

(Match the existing import style in this file. If `BaseSuccessResponseModel` and `Expose` are already imported, do not duplicate.)

- [ ] **Step 3: Run typecheck**

Run: `pnpm run lint:js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/models/
git commit -m "Z2M wizard: backend response models"
```

---

## Task 4: Backend wizard adopt DTO

**Files:**
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/dto/wizard-adopt.dto.ts`

- [ ] **Step 1: Create the DTO**

Use `dto/mapping-preview.dto.ts` (`ReqAdoptDeviceDto`) as the structural reference for the request envelope shape (`{ data: ... }` pattern).

```ts
import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdoptDevice' })
export class Z2mWizardAdoptDeviceDto {
    @ApiProperty({ description: 'Device IEEE address from the wizard session', example: '0x00158d0001a1b2c3' })
    @Expose() @IsString() ieeeAddress: string;

    @ApiProperty({ description: 'Display name override', example: 'Living Room Lamp' })
    @Expose() @IsString() name: string;

    @ApiProperty({ description: 'Target device category', enum: DeviceCategory, example: DeviceCategory.LIGHTING })
    @Expose() @IsIn(Object.values(DeviceCategory)) category: DeviceCategory;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdopt' })
export class Z2mWizardAdoptDto {
    @ApiProperty({
        description: 'Devices to adopt with display name and category overrides',
        type: 'array',
        items: { $ref: getSchemaPath(Z2mWizardAdoptDeviceDto) },
    })
    @Expose() @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true })
    @Type(() => Z2mWizardAdoptDeviceDto)
    devices: Z2mWizardAdoptDeviceDto[];
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdoptWrap' })
export class ReqZ2mWizardAdoptDto {
    @ApiProperty({ description: 'Wizard adoption payload', type: () => Z2mWizardAdoptDto })
    @Expose() @ValidateNested() @Type(() => Z2mWizardAdoptDto)
    data: Z2mWizardAdoptDto;
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run lint:js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/dto/wizard-adopt.dto.ts
git commit -m "Z2M wizard: adopt request DTO"
```

---

## Task 5: Backend wizard service — session lifecycle (write tests first)

**Files:**
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts`
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts`

- [ ] **Step 1: Write the failing test for `start()` returning a session snapshot**

Use shelly-ng `services/shelly-ng-discovery.service.spec.ts` as the testing-style template (NestJS `Test.createTestingModule` with mocked dependencies).

Create `wizard.service.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { Z2mWizardService } from './wizard.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';
import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';

describe('Z2mWizardService', () => {
    let service: Z2mWizardService;
    let zigbee2mqttService: jest.Mocked<Zigbee2mqttService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                Z2mWizardService,
                { provide: Zigbee2mqttService, useValue: {
                    isBridgeOnline: jest.fn().mockReturnValue(true),
                    getRegisteredDevices: jest.fn().mockReturnValue([]),
                    setPermitJoin: jest.fn().mockResolvedValue(true),
                    subscribeToDeviceJoined: jest.fn().mockReturnValue(() => {}),
                }},
                { provide: Z2mDeviceAdoptionService, useValue: { adoptDevice: jest.fn() } },
                { provide: Z2mMappingPreviewService, useValue: {
                    generatePreview: jest.fn().mockResolvedValue({
                        suggestedCategory: 'LIGHTING',
                        channels: [{ identifier: 'light', name: 'Light', properties: [] }],
                        warnings: [],
                        readyToAdopt: true,
                        exposes: [],
                    }),
                }},
                { provide: DevicesService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
            ],
        }).compile();

        service = module.get(Z2mWizardService);
        zigbee2mqttService = module.get(Zigbee2mqttService);
    });

    it('start() returns a session with bridgeOnline=true and an id', async () => {
        const snapshot = await service.start();
        expect(snapshot.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(snapshot.bridgeOnline).toBe(true);
        expect(snapshot.permitJoin.active).toBe(false);
        expect(snapshot.devices).toEqual([]);
    });

    it('get() returns null for unknown id', () => {
        expect(service.get('does-not-exist')).toBeNull();
    });

    it('get() returns the same snapshot after start()', async () => {
        const started = await service.start();
        const fetched = service.get(started.id);
        expect(fetched?.id).toBe(started.id);
    });

    it('end() removes the session and disables permit_join', async () => {
        const started = await service.start();
        await service.end(started.id);
        expect(service.get(started.id)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: FAIL with "Cannot find module './wizard.service'"

- [ ] **Step 3: Implement minimal `Z2mWizardService` to pass the lifecycle tests**

Create `wizard.service.ts` with the session map, randomUUID-based id, in-memory storage, and `start`/`get`/`end` methods. Reference shelly's `ShellyNgDiscoveryService` for the session shape pattern. Skeleton:

```ts
import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
    DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
    DEVICES_ZIGBEE2MQTT_TYPE,
} from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

export type Z2mWizardDeviceStatus = 'ready' | 'unsupported' | 'already_registered' | 'failed';

export interface Z2mWizardDeviceSnapshot {
    ieeeAddress: string;
    friendlyName: string;
    manufacturer: string | null;
    model: string | null;
    description: string | null;
    status: Z2mWizardDeviceStatus;
    categories: DeviceCategory[];
    suggestedCategory: DeviceCategory | null;
    previewChannelCount: number;
    previewChannelIdentifiers: string[];
    registeredDeviceId: string | null;
    registeredDeviceName: string | null;
    registeredDeviceCategory: DeviceCategory | null;
    error: string | null;
    lastSeenAt: string;
}

export interface Z2mWizardSessionSnapshot {
    id: string;
    bridgeOnline: boolean;
    startedAt: string;
    permitJoin: { active: boolean; expiresAt: string | null; remainingSeconds: number };
    devices: Z2mWizardDeviceSnapshot[];
}

interface Z2mWizardSession {
    id: string;
    startedAt: Date;
    permitJoin: { active: boolean; expiresAt: Date | null; timer?: NodeJS.Timeout };
    devices: Map<string, Z2mWizardDeviceSnapshot>;
    unsubscribeJoined?: () => void;
    idleTimer?: NodeJS.Timeout;
}

@Injectable()
export class Z2mWizardService implements OnModuleDestroy {
    private static readonly IDLE_TTL_MS = 10 * 60_000;
    private static readonly PERMIT_JOIN_DURATION_S = 254;

    private readonly logger: ExtensionLoggerService = createExtensionLogger(
        DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, 'Z2mWizardService',
    );
    private readonly sessions = new Map<string, Z2mWizardSession>();

    constructor(
        private readonly zigbee2mqttService: Zigbee2mqttService,
        private readonly deviceAdoptionService: Z2mDeviceAdoptionService,
        private readonly mappingPreviewService: Z2mMappingPreviewService,
        private readonly devicesService: DevicesService,
    ) {}

    async start(): Promise<Z2mWizardSessionSnapshot> {
        const id = randomUUID();
        const session: Z2mWizardSession = {
            id,
            startedAt: new Date(),
            permitJoin: { active: false, expiresAt: null },
            devices: new Map(),
        };

        this.sessions.set(id, session);
        this.refreshIdleTimer(session);

        await this.populateInitialDevices(session);

        session.unsubscribeJoined = this.zigbee2mqttService.subscribeToDeviceJoined((device) => {
            void this.handleDeviceJoined(session, device);
        });

        return this.toSnapshot(session);
    }

    get(id: string): Z2mWizardSessionSnapshot | null {
        const session = this.sessions.get(id);
        if (!session) return null;
        this.refreshIdleTimer(session);
        return this.toSnapshot(session);
    }

    async end(id: string): Promise<void> {
        const session = this.sessions.get(id);
        if (!session) return;
        await this.disablePermitJoinInternal(session);
        session.unsubscribeJoined?.();
        if (session.idleTimer) clearTimeout(session.idleTimer);
        this.sessions.delete(id);
    }

    async onModuleDestroy(): Promise<void> {
        for (const session of this.sessions.values()) {
            await this.disablePermitJoinInternal(session);
            session.unsubscribeJoined?.();
            if (session.idleTimer) clearTimeout(session.idleTimer);
        }
        this.sessions.clear();
    }

    // populateInitialDevices, handleDeviceJoined, computeSnapshot, refreshIdleTimer,
    // disablePermitJoinInternal — added in later tasks

    private toSnapshot(session: Z2mWizardSession): Z2mWizardSessionSnapshot {
        return {
            id: session.id,
            bridgeOnline: this.zigbee2mqttService.isBridgeOnline(),
            startedAt: session.startedAt.toISOString(),
            permitJoin: {
                active: session.permitJoin.active,
                expiresAt: session.permitJoin.expiresAt?.toISOString() ?? null,
                remainingSeconds: session.permitJoin.expiresAt
                    ? Math.max(0, Math.ceil((session.permitJoin.expiresAt.getTime() - Date.now()) / 1_000))
                    : 0,
            },
            devices: Array.from(session.devices.values()),
        };
    }

    private refreshIdleTimer(session: Z2mWizardSession): void {
        if (session.idleTimer) clearTimeout(session.idleTimer);
        session.idleTimer = setTimeout(() => { void this.end(session.id); }, Z2mWizardService.IDLE_TTL_MS);
    }

    private async disablePermitJoinInternal(session: Z2mWizardSession): Promise<void> {
        if (!session.permitJoin.active) return;
        if (session.permitJoin.timer) clearTimeout(session.permitJoin.timer);
        try {
            await this.zigbee2mqttService.setPermitJoin(0);
        } catch (e) {
            this.logger.warn('Failed to disable permit_join during cleanup', { message: (e as Error).message });
        }
        session.permitJoin = { active: false, expiresAt: null };
    }

    private async populateInitialDevices(_session: Z2mWizardSession): Promise<void> {
        // Implemented in Task 6
    }

    private async handleDeviceJoined(_session: Z2mWizardSession, _device: unknown): Promise<void> {
        // Implemented in Task 6
    }
}
```

- [ ] **Step 4: Run the lifecycle tests to verify they pass**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts
git commit -m "Z2M wizard: service skeleton with session lifecycle"
```

---

## Task 6: Wizard service — device snapshot building

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts`

- [ ] **Step 1: Add a failing test for snapshot building**

Append to the spec:

```ts
describe('device snapshots', () => {
    const sampleZ2mDevice = {
        ieeeAddress: '0x00158d0001a1b2c3',
        friendlyName: 'living_room_lamp',
        type: 'Router',
        modelId: 'LCT001',
        powerSource: 'Mains',
        supported: true,
        available: true,
        definition: {
            vendor: 'Philips',
            model: 'LCT001',
            description: 'Hue White and Color Ambiance E27',
            exposes: [
                { type: 'light', name: 'light', features: [], property: undefined, label: undefined, access: 7 },
            ],
        },
    };

    it('marks ready when device has descriptor and is unadopted', async () => {
        zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
        const snapshot = await service.start();
        expect(snapshot.devices).toHaveLength(1);
        expect(snapshot.devices[0]?.status).toBe('ready');
        expect(snapshot.devices[0]?.suggestedCategory).toBe('LIGHTING');
        expect(snapshot.devices[0]?.previewChannelCount).toBe(1);
    });

    it('marks already_registered when device has matching adopted record', async () => {
        zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
        const devicesService = { findAll: jest.fn().mockResolvedValue([
            { id: 'adopted-1', identifier: 'living_room_lamp', name: 'Existing Lamp', category: 'LIGHTING' },
        ]) };
        // Re-create module with this devicesService...
        // OR override the existing mock:
        const findAll = (service as any).devicesService.findAll;
        findAll.mockResolvedValueOnce([
            { id: 'adopted-1', identifier: 'living_room_lamp', name: 'Existing Lamp', category: 'LIGHTING' },
        ]);
        const snapshot = await service.start();
        expect(snapshot.devices[0]?.status).toBe('already_registered');
        expect(snapshot.devices[0]?.registeredDeviceId).toBe('adopted-1');
    });

    it('marks unsupported when mapping preview returns no channels', async () => {
        zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
        const previewService = (service as any).mappingPreviewService;
        previewService.generatePreview.mockResolvedValueOnce({
            suggestedCategory: null, channels: [], warnings: [], readyToAdopt: false, exposes: [],
        });
        const snapshot = await service.start();
        expect(snapshot.devices[0]?.status).toBe('unsupported');
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: FAIL — `expect(received).toHaveLength(1)` (still 0 because populateInitialDevices is empty)

- [ ] **Step 3: Implement `populateInitialDevices` and `handleDeviceJoined`**

Replace the placeholders in `wizard.service.ts`:

```ts
private async populateInitialDevices(session: Z2mWizardSession): Promise<void> {
    if (!this.zigbee2mqttService.isBridgeOnline()) return;

    const z2mDevices = this.zigbee2mqttService.getRegisteredDevices();
    const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);

    for (const z2mDevice of z2mDevices) {
        const snapshot = await this.computeSnapshot(z2mDevice, adopted);
        session.devices.set(snapshot.ieeeAddress, snapshot);
    }
}

private async handleDeviceJoined(session: Z2mWizardSession, z2mDevice: any): Promise<void> {
    try {
        const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
        const snapshot = await this.computeSnapshot(z2mDevice, adopted);
        session.devices.set(snapshot.ieeeAddress, snapshot);
    } catch (e) {
        this.logger.warn('Failed to handle device-joined event', {
            session: session.id,
            ieeeAddress: z2mDevice?.ieeeAddress,
            message: (e as Error).message,
        });
    }
}

private async computeSnapshot(
    z2mDevice: any,
    adopted: Zigbee2mqttDeviceEntity[],
): Promise<Z2mWizardDeviceSnapshot> {
    const adoptedRecord = adopted.find((d) => d.identifier === z2mDevice.friendlyName) ?? null;

    let preview: Awaited<ReturnType<Z2mMappingPreviewService['generatePreview']>> | null = null;
    let previewError: string | null = null;
    try {
        preview = await this.mappingPreviewService.generatePreview(z2mDevice.ieeeAddress);
    } catch (e) {
        previewError = (e as Error).message;
    }

    let status: Z2mWizardDeviceStatus;
    if (previewError) {
        status = 'failed';
    } else if (adoptedRecord) {
        status = 'already_registered';
    } else if (!preview || preview.channels.length === 0) {
        status = 'unsupported';
    } else {
        status = 'ready';
    }

    const suggestedCategory = (preview?.suggestedCategory ?? null) as DeviceCategory | null;
    const categories: DeviceCategory[] = suggestedCategory ? [suggestedCategory] : [];
    const previewChannelCount = preview?.channels.length ?? 0;
    const previewChannelIdentifiers = preview?.channels.map((c: any) => c.identifier) ?? [];

    return {
        ieeeAddress: z2mDevice.ieeeAddress,
        friendlyName: z2mDevice.friendlyName,
        manufacturer: z2mDevice.definition?.vendor ?? null,
        model: z2mDevice.definition?.model ?? null,
        description: z2mDevice.definition?.description ?? null,
        status,
        categories,
        suggestedCategory,
        previewChannelCount,
        previewChannelIdentifiers,
        registeredDeviceId: adoptedRecord?.id ?? null,
        registeredDeviceName: adoptedRecord?.name ?? null,
        registeredDeviceCategory: adoptedRecord?.category ?? null,
        error: previewError,
        lastSeenAt: new Date().toISOString(),
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: PASS (all tests in this file)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts
git commit -m "Z2M wizard: device snapshot building"
```

---

## Task 7: Wizard service — permit_join lifecycle

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts`

- [ ] **Step 1: Write failing tests for permit_join enable/disable**

Append:

```ts
describe('permit_join', () => {
    it('enablePermitJoin() sets active=true and remainingSeconds≈254', async () => {
        const started = await service.start();
        const updated = await service.enablePermitJoin(started.id);
        expect(updated?.permitJoin.active).toBe(true);
        expect(updated?.permitJoin.remainingSeconds).toBeGreaterThan(250);
        expect(zigbee2mqttService.setPermitJoin).toHaveBeenCalledWith(254);
    });

    it('disablePermitJoin() sets active=false and remainingSeconds=0', async () => {
        const started = await service.start();
        await service.enablePermitJoin(started.id);
        const updated = await service.disablePermitJoin(started.id);
        expect(updated?.permitJoin.active).toBe(false);
        expect(updated?.permitJoin.remainingSeconds).toBe(0);
        expect(zigbee2mqttService.setPermitJoin).toHaveBeenLastCalledWith(0);
    });

    it('returns null for unknown session id', async () => {
        expect(await service.enablePermitJoin('nope')).toBeNull();
        expect(await service.disablePermitJoin('nope')).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: FAIL with "service.enablePermitJoin is not a function"

- [ ] **Step 3: Implement permit_join methods**

Add to `Z2mWizardService`:

```ts
async enablePermitJoin(id: string): Promise<Z2mWizardSessionSnapshot | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    this.refreshIdleTimer(session);

    const ok = await this.zigbee2mqttService.setPermitJoin(Z2mWizardService.PERMIT_JOIN_DURATION_S);
    if (!ok) {
        this.logger.warn('Failed to enable permit_join', { session: id });
        return this.toSnapshot(session);
    }

    if (session.permitJoin.timer) clearTimeout(session.permitJoin.timer);

    session.permitJoin = {
        active: true,
        expiresAt: new Date(Date.now() + Z2mWizardService.PERMIT_JOIN_DURATION_S * 1_000),
        timer: setTimeout(() => {
            session.permitJoin = { active: false, expiresAt: null };
        }, Z2mWizardService.PERMIT_JOIN_DURATION_S * 1_000),
    };

    return this.toSnapshot(session);
}

async disablePermitJoin(id: string): Promise<Z2mWizardSessionSnapshot | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    this.refreshIdleTimer(session);
    await this.disablePermitJoinInternal(session);
    return this.toSnapshot(session);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts
git commit -m "Z2M wizard: permit_join lifecycle"
```

---

## Task 8: Wizard service — batch adoption with race fallback

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts`

- [ ] **Step 1: Write failing tests for adopt**

Read the existing `Z2mDeviceAdoptionService.adoptDevice()` signature in `services/device-adoption.service.ts` first to know what arguments to pass and what it returns. The DTO it accepts is `AdoptDeviceRequestDto` (from `dto/mapping-preview.dto.ts`) and it returns a `DeviceEntity`. The existing service may also throw `DevicesZigbee2mqttValidationException` for already-adopted cases — use that as the signal for the race fallback.

Append:

```ts
describe('adopt', () => {
    const ieee = '0x00158d0001a1b2c3';
    const sampleZ2mDevice = {
        ieeeAddress: ieee,
        friendlyName: 'living_room_lamp',
        type: 'Router',
        modelId: 'LCT001',
        supported: true,
        available: true,
        definition: { vendor: 'Philips', model: 'LCT001', description: 'Hue', exposes: [{ type: 'light' }] },
    };

    beforeEach(() => {
        zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
    });

    it('returns created result on successful adoption', async () => {
        (service as any).deviceAdoptionService.adoptDevice.mockResolvedValueOnce({ id: 'd1', name: 'Living Room Lamp' });
        const started = await service.start();
        const out = await service.adopt(started.id, [{ ieeeAddress: ieee, name: 'Living Room Lamp', category: 'LIGHTING' as any }]);
        expect(out).toEqual([{ ieeeAddress: ieee, name: 'Living Room Lamp', status: 'created', error: null }]);
    });

    it('returns updated result when device was already adopted (race fallback)', async () => {
        const started = await service.start();
        // Force the wizard to see it as already_registered after the snapshot was built:
        const session = (service as any).sessions.get(started.id);
        session.devices.get(ieee).status = 'already_registered';
        session.devices.get(ieee).registeredDeviceId = 'd1';
        const out = await service.adopt(started.id, [{ ieeeAddress: ieee, name: 'X', category: 'LIGHTING' as any }]);
        expect(out[0]?.status).toBe('updated');
    });

    it('returns failed result when adoption throws', async () => {
        (service as any).deviceAdoptionService.adoptDevice.mockRejectedValueOnce(new Error('boom'));
        const started = await service.start();
        const out = await service.adopt(started.id, [{ ieeeAddress: ieee, name: 'X', category: 'LIGHTING' as any }]);
        expect(out[0]?.status).toBe('failed');
        expect(out[0]?.error).toBe('boom');
    });

    it('returns empty array for unknown session id', async () => {
        const out = await service.adopt('nope', []);
        expect(out).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: FAIL — `service.adopt is not a function`

- [ ] **Step 3: Implement `adopt`**

Look at `Z2mDeviceAdoptionService.adoptDevice` signature first — read `services/device-adoption.service.ts`. It expects an `AdoptDeviceRequestDto` shape with `ieeeAddress`, `name`, `category`, etc. Adapt the call:

```ts
async adopt(
    id: string,
    requests: { ieeeAddress: string; name: string; category: DeviceCategory }[],
): Promise<{ ieeeAddress: string; name: string; status: 'created' | 'updated' | 'failed'; error: string | null }[]> {
    const session = this.sessions.get(id);
    if (!session) return [];
    this.refreshIdleTimer(session);

    // Refresh-before-adopt: rebuild snapshots so we have current registered status
    const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
    for (const z2mDevice of this.zigbee2mqttService.getRegisteredDevices()) {
        const snapshot = await this.computeSnapshot(z2mDevice, adopted);
        session.devices.set(snapshot.ieeeAddress, snapshot);
    }

    const results: { ieeeAddress: string; name: string; status: 'created' | 'updated' | 'failed'; error: string | null }[] = [];

    for (const req of requests) {
        const current = session.devices.get(req.ieeeAddress);

        if (!current) {
            results.push({ ieeeAddress: req.ieeeAddress, name: req.name, status: 'failed', error: 'Device not in session' });
            continue;
        }

        try {
            if (current.status === 'already_registered' && current.registeredDeviceId) {
                // Race fallback: device was adopted between session start and adopt call.
                // Update name/category via DevicesService instead of creating.
                await this.devicesService.update(current.registeredDeviceId, {
                    name: req.name,
                    category: req.category,
                } as any);

                // Refresh snapshot so the response reflects the updated state.
                session.devices.set(req.ieeeAddress, {
                    ...current,
                    registeredDeviceName: req.name,
                    registeredDeviceCategory: req.category,
                });

                results.push({ ieeeAddress: req.ieeeAddress, name: req.name, status: 'updated', error: null });
                continue;
            }

            const created = await this.deviceAdoptionService.adoptDevice({
                ieeeAddress: req.ieeeAddress,
                name: req.name,
                category: req.category,
            } as any);

            // Refresh the snapshot to reflect the adoption.
            session.devices.set(req.ieeeAddress, {
                ...current,
                status: 'already_registered',
                registeredDeviceId: created.id,
                registeredDeviceName: req.name,
                registeredDeviceCategory: req.category,
            });

            results.push({ ieeeAddress: req.ieeeAddress, name: req.name, status: 'created', error: null });
        } catch (e) {
            results.push({ ieeeAddress: req.ieeeAddress, name: req.name, status: 'failed', error: (e as Error).message });
        }
    }

    return results;
}
```

> Note for the implementer: the exact `adoptDevice()` argument shape and `devicesService.update()` signature must match what's actually in the codebase. Read those files and adjust the call sites — do NOT invent fields.

- [ ] **Step 4: Run tests**

Run: `pnpm run test:unit -- --testPathPattern wizard.service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.ts apps/backend/src/plugins/devices-zigbee2mqtt/services/wizard.service.spec.ts
git commit -m "Z2M wizard: batch adoption with race fallback"
```

---

## Task 9: Wizard controller (with tests)

**Files:**
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/controllers/zigbee2mqtt-wizard.controller.ts`
- Create: `apps/backend/src/plugins/devices-zigbee2mqtt/controllers/zigbee2mqtt-wizard.controller.spec.ts`

- [ ] **Step 1: Write failing controller tests**

Reference shelly-ng's `controllers/shelly-ng-devices.controller.spec.ts` for the testing pattern — it constructs the controller with mocked services and asserts response shape + 404 behavior.

```ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Zigbee2mqttWizardController } from './zigbee2mqtt-wizard.controller';
import { Z2mWizardService } from '../services/wizard.service';

describe('Zigbee2mqttWizardController', () => {
    let controller: Zigbee2mqttWizardController;
    let wizardService: jest.Mocked<Z2mWizardService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [Zigbee2mqttWizardController],
            providers: [{
                provide: Z2mWizardService,
                useValue: {
                    start: jest.fn(),
                    get: jest.fn(),
                    end: jest.fn(),
                    enablePermitJoin: jest.fn(),
                    disablePermitJoin: jest.fn(),
                    adopt: jest.fn(),
                },
            }],
        }).compile();
        controller = module.get(Zigbee2mqttWizardController);
        wizardService = module.get(Z2mWizardService);
    });

    it('POST /wizard returns the new session', async () => {
        const session = { id: 'a', bridgeOnline: true, startedAt: 't', permitJoin: { active: false, expiresAt: null, remainingSeconds: 0 }, devices: [] };
        wizardService.start.mockResolvedValueOnce(session as any);
        const res = await controller.startSession();
        expect(res.data).toEqual(session);
    });

    it('GET /wizard/:id throws 404 for unknown id', () => {
        wizardService.get.mockReturnValue(null);
        expect(() => controller.getSession('nope')).toThrow(NotFoundException);
    });

    it('DELETE /wizard/:id calls service.end()', async () => {
        wizardService.end.mockResolvedValueOnce(undefined);
        await controller.endSession('a');
        expect(wizardService.end).toHaveBeenCalledWith('a');
    });

    it('POST /wizard/:id/permit-join returns updated session', async () => {
        const updated = { id: 'a', bridgeOnline: true, startedAt: 't', permitJoin: { active: true, expiresAt: 'x', remainingSeconds: 254 }, devices: [] };
        wizardService.enablePermitJoin.mockResolvedValueOnce(updated as any);
        const res = await controller.enablePermitJoin('a');
        expect(res.data).toEqual(updated);
    });

    it('POST /wizard/:id/permit-join throws 404 when service returns null', async () => {
        wizardService.enablePermitJoin.mockResolvedValueOnce(null);
        await expect(controller.enablePermitJoin('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('POST /wizard/:id/adopt returns adoption results', async () => {
        wizardService.adopt.mockResolvedValueOnce([
            { ieeeAddress: 'x', name: 'X', status: 'created', error: null },
        ]);
        const res = await controller.adopt('a', { data: { devices: [{ ieeeAddress: 'x', name: 'X', category: 'LIGHTING' as any }] } } as any);
        expect(res.data.results).toHaveLength(1);
        expect(res.data.results[0]?.status).toBe('created');
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm run test:unit -- --testPathPattern zigbee2mqtt-wizard.controller`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement the controller**

Reference: `apps/backend/src/plugins/devices-shelly-ng/controllers/shelly-ng-devices.controller.ts`. Use the same Swagger decorator pattern (`@ApiOperation`, `@ApiSuccessResponse`, etc.) and the same `@ApiTags(DEVICES_ZIGBEE2MQTT_API_TAG_NAME)`.

```ts
import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
    ApiBadRequestResponse, ApiCreatedSuccessResponse, ApiInternalServerErrorResponse,
    ApiNotFoundResponse, ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_ZIGBEE2MQTT_API_TAG_NAME, DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';
import { ReqZ2mWizardAdoptDto } from '../dto/wizard-adopt.dto';
import {
    Z2mWizardAdoptionResponseModel, Z2mWizardSessionResponseModel,
} from '../models/zigbee2mqtt-response.model';
import { Z2mWizardService } from '../services/wizard.service';

@ApiTags(DEVICES_ZIGBEE2MQTT_API_TAG_NAME)
@Controller('wizard')
export class Zigbee2mqttWizardController {
    private readonly logger: ExtensionLoggerService = createExtensionLogger(
        DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, 'WizardController',
    );

    constructor(private readonly wizardService: Z2mWizardService) {}

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'Start Zigbee2MQTT adoption wizard session',
        description: 'Creates a wizard session, returning the list of currently unadopted Zigbee devices with mapping previews.',
        operationId: 'create-devices-zigbee2mqtt-plugin-wizard',
    })
    @ApiCreatedSuccessResponse(Z2mWizardSessionResponseModel, 'Wizard session was started successfully')
    @ApiInternalServerErrorResponse('Internal server error')
    @Post()
    async startSession(): Promise<Z2mWizardSessionResponseModel> {
        const response = new Z2mWizardSessionResponseModel();
        response.data = await this.wizardService.start();
        return response;
    }

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'Get Zigbee2MQTT wizard session state',
        description: 'Returns the current state of the wizard session, including any newly-paired devices that arrived since the last poll and remaining permit_join time.',
        operationId: 'get-devices-zigbee2mqtt-plugin-wizard',
    })
    @ApiParam({ name: 'id', type: 'string' })
    @ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Wizard session was successfully retrieved.')
    @ApiNotFoundResponse('Wizard session could not be found')
    @ApiInternalServerErrorResponse('Internal server error')
    @Get(':id')
    getSession(@Param('id') id: string): Z2mWizardSessionResponseModel {
        const session = this.wizardService.get(id);
        if (!session) throw new NotFoundException('Wizard session could not be found');
        const response = new Z2mWizardSessionResponseModel();
        response.data = session;
        return response;
    }

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'End Zigbee2MQTT wizard session',
        description: 'Terminates the wizard session. If permit_join is active for this session it is disabled.',
        operationId: 'delete-devices-zigbee2mqtt-plugin-wizard',
    })
    @ApiParam({ name: 'id', type: 'string' })
    @ApiInternalServerErrorResponse('Internal server error')
    @Delete(':id')
    async endSession(@Param('id') id: string): Promise<void> {
        await this.wizardService.end(id);
    }

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'Enable Zigbee2MQTT pairing mode (permit_join)',
        description: 'Enables permit_join on the bridge for 254 seconds, scoped to this wizard session.',
        operationId: 'enable-devices-zigbee2mqtt-plugin-wizard-permit-join',
    })
    @ApiParam({ name: 'id', type: 'string' })
    @ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Pairing mode enabled')
    @ApiNotFoundResponse('Wizard session could not be found')
    @Post(':id/permit-join')
    async enablePermitJoin(@Param('id') id: string): Promise<Z2mWizardSessionResponseModel> {
        const session = await this.wizardService.enablePermitJoin(id);
        if (!session) throw new NotFoundException('Wizard session could not be found');
        const response = new Z2mWizardSessionResponseModel();
        response.data = session;
        return response;
    }

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'Disable Zigbee2MQTT pairing mode (permit_join)',
        description: 'Disables permit_join on the bridge.',
        operationId: 'disable-devices-zigbee2mqtt-plugin-wizard-permit-join',
    })
    @ApiParam({ name: 'id', type: 'string' })
    @ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Pairing mode disabled')
    @ApiNotFoundResponse('Wizard session could not be found')
    @Delete(':id/permit-join')
    async disablePermitJoin(@Param('id') id: string): Promise<Z2mWizardSessionResponseModel> {
        const session = await this.wizardService.disablePermitJoin(id);
        if (!session) throw new NotFoundException('Wizard session could not be found');
        const response = new Z2mWizardSessionResponseModel();
        response.data = session;
        return response;
    }

    @ApiOperation({
        tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
        summary: 'Adopt selected devices from wizard',
        description: 'Adopts each requested device with the supplied display name and category. Devices already adopted in another flow are updated instead of created.',
        operationId: 'adopt-devices-zigbee2mqtt-plugin-wizard',
    })
    @ApiParam({ name: 'id', type: 'string' })
    @ApiBody({ type: ReqZ2mWizardAdoptDto })
    @ApiSuccessResponse(Z2mWizardAdoptionResponseModel, 'Adoption results returned')
    @ApiBadRequestResponse('Invalid request data')
    @ApiNotFoundResponse('Wizard session could not be found')
    @Post(':id/adopt')
    async adopt(@Param('id') id: string, @Body() body: ReqZ2mWizardAdoptDto): Promise<Z2mWizardAdoptionResponseModel> {
        const results = await this.wizardService.adopt(id, body.data.devices);
        const response = new Z2mWizardAdoptionResponseModel();
        response.data = { results } as any;
        return response;
    }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm run test:unit -- --testPathPattern zigbee2mqtt-wizard.controller`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/controllers/zigbee2mqtt-wizard.controller.ts apps/backend/src/plugins/devices-zigbee2mqtt/controllers/zigbee2mqtt-wizard.controller.spec.ts
git commit -m "Z2M wizard: REST controller"
```

---

## Task 10: Wire wizard into plugin module + OpenAPI registry

**Files:**
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts`
- Modify: `apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.openapi.ts`

- [ ] **Step 1: Read both files to find where existing controllers/services/models are registered**

Run: `cat apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts`
Run: `cat apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.openapi.ts`

- [ ] **Step 2: Register `Zigbee2mqttWizardController` and `Z2mWizardService` in the plugin module**

In `devices-zigbee2mqtt.plugin.ts`, add the controller to the `controllers` array of the `@Module` decorator (or wherever the existing `Zigbee2mqttDiscoveredDevicesController` is registered) and `Z2mWizardService` to `providers`. Also export `Z2mWizardService` if other modules import services from this plugin (mirror the pattern of `Z2mDeviceAdoptionService`).

- [ ] **Step 3: Register new schemas in OpenAPI registry**

In `devices-zigbee2mqtt.openapi.ts`, add the new model classes to the schema registration list. Look at how `Zigbee2mqttDiscoveredDeviceModel` is registered and follow the exact same pattern for:
- `Z2mWizardPermitJoinModel`
- `Z2mWizardDeviceSnapshotModel`
- `Z2mWizardSessionModel`
- `Z2mWizardAdoptionResultModel`
- `Z2mWizardAdoptionModel`
- `Z2mWizardSessionResponseModel`
- `Z2mWizardAdoptionResponseModel`
- `Z2mWizardAdoptDeviceDto`
- `Z2mWizardAdoptDto`
- `ReqZ2mWizardAdoptDto`

- [ ] **Step 4: Run typecheck and existing test suite to confirm nothing regressed**

Run: `pnpm run lint:js && pnpm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts apps/backend/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.openapi.ts
git commit -m "Z2M wizard: wire controller and service into plugin module"
```

---

## Task 11: Regenerate OpenAPI spec & admin types

**Files:**
- Modify (auto-generated): `spec/api/v1/openapi.json`
- Modify (auto-generated): `apps/admin/src/openapi.ts`

- [ ] **Step 1: Run the generator**

Run: `pnpm run generate:openapi`
Expected: Completes without errors. Diff shows new wizard schemas/operations.

- [ ] **Step 2: Spot-check the spec**

Run: `grep -c 'devices-zigbee2mqtt-plugin-wizard' spec/api/v1/openapi.json`
Expected: Output ≥ 6 (the operationIds we registered).

- [ ] **Step 3: Confirm admin types regenerated**

Run: `grep -c 'DevicesZigbee2mqttPluginCreate.*Wizard' apps/admin/src/openapi.ts`
Expected: Output ≥ 1.

- [ ] **Step 4: Commit generated files**

```bash
git add spec/api/v1/openapi.json apps/admin/src/openapi.ts apps/admin/src/openapi.constants.ts apps/panel/lib/api/ apps/panel/lib/spec/ 2>/dev/null
git commit -m "Z2M wizard: regenerate OpenAPI spec and clients"
```

(If the generator does not modify panel files, drop those paths from the `git add`.)

---

## Task 12: Admin types and transformers

**Files:**
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/schemas/devices.types.ts` (or whichever schemas file the plugin uses — check first)
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/utils/devices.transformers.ts` (or the analogous transformer file)

- [ ] **Step 1: Locate existing schema and transformer files**

Run: `ls apps/admin/src/plugins/devices-zigbee2mqtt/schemas/ apps/admin/src/plugins/devices-zigbee2mqtt/utils/`

Adjust target paths in steps 2-3 if the plugin uses a different layout.

- [ ] **Step 2: Add wizard types**

Append to the schemas types file:

```ts
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export type IZ2mWizardDeviceStatus = 'ready' | 'unsupported' | 'already_registered' | 'failed';

export interface IZ2mWizardPermitJoin {
    active: boolean;
    expiresAt: string | null;
    remainingSeconds: number;
}

export interface IZ2mWizardDevice {
    ieeeAddress: string;
    friendlyName: string;
    manufacturer: string | null;
    model: string | null;
    description: string | null;
    status: IZ2mWizardDeviceStatus;
    categories: DevicesModuleDeviceCategory[];
    suggestedCategory: DevicesModuleDeviceCategory | null;
    previewChannelCount: number;
    previewChannelIdentifiers: string[];
    registeredDeviceId: string | null;
    registeredDeviceName: string | null;
    registeredDeviceCategory: DevicesModuleDeviceCategory | null;
    error: string | null;
    lastSeenAt: string;
}

export interface IZ2mWizardSession {
    id: string;
    bridgeOnline: boolean;
    startedAt: string;
    permitJoin: IZ2mWizardPermitJoin;
    devices: IZ2mWizardDevice[];
}

export interface IZ2mWizardAdoptionResult {
    ieeeAddress: string;
    name: string;
    status: 'created' | 'updated' | 'failed';
    error: string | null;
}
```

- [ ] **Step 3: Add a response transformer**

Append to the transformers file:

```ts
import type { components } from '../../../openapi';
import type { IZ2mWizardSession } from '../schemas/devices.types';

type WizardSessionResponse = components['schemas']['DevicesZigbee2mqttPluginDataWizardSession'];

export const transformWizardSessionResponse = (raw: WizardSessionResponse): IZ2mWizardSession => ({
    id: raw.id,
    bridgeOnline: raw.bridgeOnline,
    startedAt: raw.startedAt,
    permitJoin: {
        active: raw.permitJoin.active,
        expiresAt: raw.permitJoin.expiresAt ?? null,
        remainingSeconds: raw.permitJoin.remainingSeconds,
    },
    devices: raw.devices.map((d) => ({
        ieeeAddress: d.ieeeAddress,
        friendlyName: d.friendlyName,
        manufacturer: d.manufacturer ?? null,
        model: d.model ?? null,
        description: d.description ?? null,
        status: d.status as IZ2mWizardSession['devices'][number]['status'],
        categories: d.categories ?? [],
        suggestedCategory: d.suggestedCategory ?? null,
        previewChannelCount: d.previewChannelCount,
        previewChannelIdentifiers: d.previewChannelIdentifiers ?? [],
        registeredDeviceId: d.registeredDeviceId ?? null,
        registeredDeviceName: d.registeredDeviceName ?? null,
        registeredDeviceCategory: d.registeredDeviceCategory ?? null,
        error: d.error ?? null,
        lastSeenAt: d.lastSeenAt,
    })),
});
```

(If `components['schemas']` typing isn't how this codebase imports OpenAPI types, follow the existing pattern in `devices.transformers.ts`.)

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter ./apps/admin run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/schemas/devices.types.ts apps/admin/src/plugins/devices-zigbee2mqtt/utils/devices.transformers.ts
git commit -m "Z2M wizard: admin types and response transformer"
```

---

## Task 13: `useFriendlyNameHumanizer` composable (TDD)

**Files:**
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useFriendlyNameHumanizer.ts`
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useFriendlyNameHumanizer.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `useFriendlyNameHumanizer.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { useFriendlyNameHumanizer } from './useFriendlyNameHumanizer';

describe('useFriendlyNameHumanizer', () => {
    const { humanize } = useFriendlyNameHumanizer();

    it('humanizes snake_case', () => {
        expect(humanize('living_room_lamp')).toBe('Living Room Lamp');
    });

    it('humanizes kebab-case', () => {
        expect(humanize('kitchen-light-1')).toBe('Kitchen Light 1');
    });

    it('humanizes camelCase', () => {
        expect(humanize('frontDoorSensor')).toBe('Front Door Sensor');
    });

    it('humanizes single word', () => {
        expect(humanize('thermostat')).toBe('Thermostat');
    });

    it('preserves trailing numbers as separate tokens', () => {
        expect(humanize('sensor_3')).toBe('Sensor 3');
    });

    it('handles already-humanized names', () => {
        expect(humanize('Living Room Lamp')).toBe('Living Room Lamp');
    });

    it('returns empty string for empty input', () => {
        expect(humanize('')).toBe('');
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter ./apps/admin run test:unit -- useFriendlyNameHumanizer`
Expected: FAIL

- [ ] **Step 3: Implement the composable**

Create `useFriendlyNameHumanizer.ts`:

```ts
export interface IUseFriendlyNameHumanizer {
    humanize: (input: string) => string;
}

export const useFriendlyNameHumanizer = (): IUseFriendlyNameHumanizer => {
    const humanize = (input: string): string => {
        if (!input) return '';

        return input
            // camelCase boundary: insert space before each uppercase letter
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // letter→digit boundary: "sensor3" → "sensor 3"
            .replace(/([a-zA-Z])(\d)/g, '$1 $2')
            // delimiters
            .replace(/[_\-]+/g, ' ')
            // collapse whitespace
            .replace(/\s+/g, ' ')
            .trim()
            // Title-case each word
            .split(' ')
            .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
            .join(' ');
    };

    return { humanize };
};
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./apps/admin run test:unit -- useFriendlyNameHumanizer`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/composables/useFriendlyNameHumanizer.ts apps/admin/src/plugins/devices-zigbee2mqtt/composables/useFriendlyNameHumanizer.spec.ts
git commit -m "Z2M wizard: friendly name humanizer composable"
```

---

## Task 14: `useDevicesWizard` composable

**Files:**
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.ts`
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.spec.ts`

The shape mirrors shelly-ng's `useDevicesWizard` ([reference](../../../apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.ts)) with these substitutions:
- `hostname` key → `ieeeAddress` key everywhere
- No `manual` entry, no scan-progress percentage, no password fields
- New: `permitJoin` reactive state + `enablePermitJoin()` / `disablePermitJoin()` methods
- New: name pre-fill uses `humanize(friendlyName)`
- Polling interval: 1s; only running when a session exists

- [ ] **Step 1: Write failing tests for the composable**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDevicesWizard } from './useDevicesWizard';

// Mock backend HTTP. Replicate the pattern used in
// apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.spec.ts —
// look up `useBackend()` mocks there and reuse the same shape.

describe('useDevicesWizard', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('startSession() populates session and pre-fills humanized names', async () => {
        // ... mock POST /wizard to return a session with one device named 'living_room_lamp'
        // expect nameByIeee[ieee] === 'Living Room Lamp'
    });

    it('auto-selects ready devices and pre-fills suggestedCategory', async () => {
        // ... session with one ready device, suggestedCategory=LIGHTING
        // expect selected[ieee] === true
        // expect categoryByIeee[ieee] === 'LIGHTING'
    });

    it('deselects when status transitions ready → already_registered', async () => {
        // start with ready, poll updates to already_registered
        // expect selected[ieee] === false
    });

    it('canContinue is false when any selected device has empty name', async () => {
        // selected, but nameByIeee[ieee] = ''
        // expect canContinue === false
    });

    it('adoptSelected returns adoption results from the API', async () => {
        // mock POST /wizard/:id/adopt
        // expect adoptionResults to contain {status: 'created', ...}
    });
});
```

> Use the spec at `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.spec.ts` as a literal template for the mock setup (`useBackend`, `useFlashMessage`, devices store) — only the URL paths and key names differ.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/admin run test:unit -- useDevicesWizard.spec`
Expected: FAIL

- [ ] **Step 3: Implement the composable**

Create `useDevicesWizard.ts`. Use shelly-ng's composable as the base; substitute `hostname → ieeeAddress`, drop `manual`/`scanPercentage`/`passwordByHostname`/`addManualDevice`, and add `permitJoin` / `enablePermitJoin` / `disablePermitJoin`.

Public surface (interface):

```ts
import type { ComputedRef, Reactive, Ref } from 'vue';
import type { FormResultType } from '../../../modules/devices';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IZ2mWizardSession, IZ2mWizardDevice, IZ2mWizardAdoptionResult } from '../schemas/devices.types';

export interface IUseDevicesWizard {
    session: ComputedRef<IZ2mWizardSession | null>;
    devices: ComputedRef<IZ2mWizardDevice[]>;
    selectedDevices: ComputedRef<IZ2mWizardDevice[]>;
    permitJoin: ComputedRef<IZ2mWizardSession['permitJoin']>;
    bridgeOnline: ComputedRef<boolean>;
    formResult: ComputedRef<FormResultType>;
    selected: Reactive<Record<string, boolean>>;
    categoryByIeee: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
    nameByIeee: Reactive<Record<string, string>>;
    adoptionResults: ComputedRef<IZ2mWizardAdoptionResult[]>;
    canContinue: ComputedRef<boolean>;
    startSession: () => Promise<void>;
    refreshSession: () => Promise<void>;
    endSession: () => Promise<void>;
    enablePermitJoin: () => Promise<void>;
    disablePermitJoin: () => Promise<void>;
    adoptSelected: () => Promise<IZ2mWizardAdoptionResult[]>;
    categoryOptions: (device: IZ2mWizardDevice) => { value: DevicesModuleDeviceCategory; label: string }[];
}

export const isAdoptableStatus = (s: IZ2mWizardDevice['status']): boolean =>
    s === 'ready' || s === 'already_registered';

export const useDevicesWizard = (): IUseDevicesWizard => {
    // 1. Construct reactive state (session, selected, categoryByIeee, nameByIeee, etc.)
    // 2. Wire up backend calls to the wizard endpoints — paths:
    //    POST   ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard         → start
    //    GET    ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard/:id     → refresh
    //    DELETE ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard/:id     → end
    //    POST   ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard/:id/permit-join   → enable
    //    DELETE ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard/:id/permit-join   → disable
    //    POST   ${PLUGINS_PREFIX}/devices-zigbee2mqtt/wizard/:id/adopt         → adopt
    // 3. Pre-fill nameByIeee from humanize(friendlyName), categoryByIeee from suggestedCategory
    // 4. 1s polling tick while session exists; refresh devices/permitJoin
    // 5. `selected` watcher: deselect when status transitions ready → already_registered
    // 6. `canContinue`: every selected has non-empty name + non-null category
    // 7. adoptSelected: snapshot selections, refresh, then call /adopt
    //
    // Refer to apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.ts for
    // the polling/lifecycle/cleanup pattern (tryOnMounted/tryOnUnmounted, setTimeout chain).
};
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter ./apps/admin run test:unit -- useDevicesWizard.spec`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.ts apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.spec.ts
git commit -m "Z2M wizard: useDevicesWizard composable"
```

---

## Task 15: Wizard step components

**Files:**
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-discovery-step.vue`
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-categorize-step.vue`
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-results-step.vue`

Each step is a presentational component that receives wizard state as props and emits events back to the parent. The parent owns the composable; steps stay focused. Reference: shelly-ng's monolithic `shelly-ng-devices-wizard.vue` — split its three step blocks into three files.

- [ ] **Step 1: Discovery step**

`zigbee2mqtt-wizard-discovery-step.vue`. Responsibilities:
- Show `bridgeOnline=false` banner with link to plugin config (use existing route helper used by `zigbee2mqtt-config-form.vue`)
- Show "Pair new device" button (disabled when bridge offline). Click → emit `enable-permit-join`
- When `permitJoin.active === true`: show countdown bar (`remainingSeconds / 254`), "Cancel pairing" button → emit `disable-permit-join`
- Sortable table of devices (use `natural-orderby` with the same comparator pattern as shelly's wizard). Columns: checkbox, Name (display only — friendlyName), Manufacturer/Model, Status (tag with color matching shelly's: success for ready, info for already_registered, warning for unsupported, danger for failed). Adoptable rows have a checkbox bound to `selected` map.
- Header actions: "Auto-pick all" / "Clear selection"

Props: `devices: IZ2mWizardDevice[]`, `selected: Record<string, boolean>`, `permitJoin: IZ2mWizardPermitJoin`, `bridgeOnline: boolean`.
Emits: `(e: 'enable-permit-join'): void`, `(e: 'disable-permit-join'): void`.

- [ ] **Step 2: Categorize step**

`zigbee2mqtt-wizard-categorize-step.vue`. Responsibilities:
- Sortable table — natural-orderby with reactive maps. Columns: checkbox, Name (`<el-input>` bound to `nameByIeee[ieee]`), Friendly name (read-only monospace), Manufacturer/Model (secondary text), Status (tag: "will create" for ready, "will update" for already_registered), Category (`<el-select>` bound to `categoryByIeee[ieee]`, options from `categoryOptions(device)`), Channels (badge `{{ device.previewChannelCount }}` with `<el-tooltip>` listing `previewChannelIdentifiers.join(', ')`)
- Sort comparators same shape as shelly-ng's categorize step (look at the existing wizard for the natural-orderby `getValue` lambdas)

Props: `devices: IZ2mWizardDevice[]`, `selected: Record<string, boolean>`, `nameByIeee: Record<string, string>`, `categoryByIeee: Record<string, DevicesModuleDeviceCategory | null>`, `categoryOptions: (d) => Option[]`.

- [ ] **Step 3: Results step**

`zigbee2mqtt-wizard-results-step.vue`. Responsibilities:
- Sortable read-only table. Columns: Status (tag: success for created, info for updated, danger for failed), Name, Friendly name, Manufacturer/Model, Error message
- "Done" button → emit `done`. "Add more" button → emit `restart`

Props: `results: IZ2mWizardAdoptionResult[]`, `devices: IZ2mWizardDevice[]` (for joining results back to friendlyName/manufacturer).
Emits: `(e: 'done'): void`, `(e: 'restart'): void`.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter ./apps/admin run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-discovery-step.vue apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-categorize-step.vue apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-results-step.vue
git commit -m "Z2M wizard: step components (discovery, categorize, results)"
```

---

## Task 16: Top-level wizard component

**Files:**
- Create: `apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-devices-wizard.vue`
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/components/components.ts`

- [ ] **Step 1: Implement the orchestrator component**

`zigbee2mqtt-devices-wizard.vue`. Responsibilities:
- Use `useDevicesWizard()` to get all wizard state
- Use `useFriendlyNameHumanizer()` for the pre-fill on session start (the composable should already do this internally, but the wizard wires the hook into name fields)
- Use `<el-steps>` (or whatever the existing shelly wizard uses) with three steps: Discovery / Categorize / Results
- Step navigation:
  - Step 1 → Step 2: enabled when `selectedDevices.length > 0`
  - Step 2 → Step 3 (Adopt): enabled when `canContinue === true`. Click invokes `adoptSelected()` and advances on resolution
  - Step 3 → Done: emits `done` → close dialog (parent listens)
  - Step 3 → Add more: clears state and resets to Step 1
- On step transition out of Step 1: if `permitJoin.active`, prompt before disabling — or just call `disablePermitJoin()` silently (decide based on what feels least surprising; recommend silent disable + a brief toast)
- On unmount/dialog close: call `endSession()` to clean up server-side

- [ ] **Step 2: Export from `components.ts`**

Add `export { default as Zigbee2mqttDevicesWizard } from './zigbee2mqtt-devices-wizard.vue';` (match existing export style in this file).

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter ./apps/admin run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-devices-wizard.vue apps/admin/src/plugins/devices-zigbee2mqtt/components/components.ts
git commit -m "Z2M wizard: top-level wizard component"
```

---

## Task 17: Plugin registration

**Files:**
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts`

- [ ] **Step 1: Register the wizard component**

In the existing `registerComponents` block (where `deviceAddForm: Zigbee2mqttDeviceAddFormMultiStep` lives), add:

```ts
deviceWizard: Zigbee2mqttDevicesWizard,
```

Import it from `./components` (or `./components/components`). Match the existing import style.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter ./apps/admin run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts
git commit -m "Z2M wizard: register deviceWizard component"
```

---

## Task 18: i18n keys

**Files:**
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/locales/en-US.json` (and other locales matching shelly's locale set)

- [ ] **Step 1: Identify which locales the plugin uses**

Run: `ls apps/admin/src/plugins/devices-zigbee2mqtt/locales/`

- [ ] **Step 2: Look up shelly's wizard i18n keys to mirror them**

Run: `grep -A 200 '"wizard"' apps/admin/src/plugins/devices-shelly-ng/locales/en-US.json | head -200`

- [ ] **Step 3: Add a `wizard` block under `plugins.devices-zigbee2mqtt`**

Required keys (add to every locale, English values shown — translate to other locales):
- `title`, `subtitle`
- `bridge.offline.title`, `bridge.offline.message`, `bridge.offline.openConfig`
- `steps.discovery.title`, `steps.discovery.permitJoin`, `steps.discovery.cancelPairing`, `steps.discovery.pairingActive` (with `{remaining}` slot), `steps.discovery.autoPickAll`, `steps.discovery.clearSelection`, `steps.discovery.empty`
- `steps.categorize.title`, `steps.categorize.willCreate`, `steps.categorize.willUpdate`, `steps.categorize.channels` (with `{count}` slot)
- `steps.results.title`, `steps.results.created`, `steps.results.updated`, `steps.results.failed`, `steps.results.done`, `steps.results.addMore`
- `columns.name`, `columns.friendlyName`, `columns.manufacturer`, `columns.model`, `columns.status`, `columns.category`, `columns.channels`, `columns.error`
- `status.ready`, `status.unsupported`, `status.alreadyRegistered`, `status.failed`
- `actions.next`, `actions.back`, `actions.adopt`, `actions.cancel`
- `validation.nameRequired`, `validation.categoryRequired`

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter ./apps/admin run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt/locales/
git commit -m "Z2M wizard: i18n keys"
```

---

## Task 19: Final verification

**Files:** none modified.

- [ ] **Step 1: Run full lint suite**

Run: `pnpm run lint:js`
Expected: PASS

- [ ] **Step 2: Run full backend test suite**

Run: `pnpm run test:unit`
Expected: PASS (no regressions; new wizard tests included)

- [ ] **Step 3: Run admin test suite**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Start backend (`pnpm run start:dev`), open admin, navigate to Devices → Add via wizard → choose Zigbee2MQTT plugin. Walk through:
1. Step 1 — verify bridge status shows correctly; click "Pair new device" if a real coordinator is available, watch countdown, optionally cancel
2. Step 2 — verify name pre-fill is humanized, category pre-fill matches descriptor, channel badge tooltip lists identifiers
3. Step 3 — verify results table shows correct outcome; click "Add more" → returns to Step 1 with a fresh session

Document any deviations in a follow-up task; do not silently fix issues outside the plan's scope.

- [ ] **Step 5: Open PR**

```bash
git push -u origin claude/friendly-elion-e3c803
gh pr create --title "Z2M wizard: multi-device adoption flow" --body "$(cat <<'EOF'
## Summary
- Adds a multi-device adoption wizard to the zigbee2mqtt plugin, modeled on the shelly-ng wizard
- Two-mode discovery: lists already-paired-but-unadopted devices and exposes a permit_join button for new pairings
- Auto-mapping with humanized friendly_names, suggested categories editable in Step 2
- Existing single-device add form is unchanged

## Test plan
- [ ] Backend unit tests: `pnpm run test:unit -- --testPathPattern wizard`
- [ ] Admin unit tests: `pnpm --filter ./apps/admin run test:unit -- wizard`
- [ ] Lint: `pnpm run lint:js`
- [ ] Manual smoke test against a real Zigbee bridge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes on parallelism

The tasks are largely sequential because each builds on the last. However, these pairs can be parallelized once their predecessors land:

- Task 13 (`useFriendlyNameHumanizer`) is independent of Tasks 12 / 14 — can land in parallel with Task 12.
- Task 18 (i18n) only requires knowing the key names; it can be drafted in parallel with Tasks 15-17.

If running with subagent-driven-development, dispatch sequentially through Task 11 (the OpenAPI regen gate), then Tasks 12 and 13 in parallel, then 14, then 15-18 in parallel, then 19.
