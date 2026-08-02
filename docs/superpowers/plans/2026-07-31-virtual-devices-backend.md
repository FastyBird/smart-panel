# Virtual Devices — Backend & Panel Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `devices-virtual` backend plugin that lets a user build a device from properties of other devices — splitting one physical device into several, or composing one from several — controllable via REST/WebSocket and rendering on the panel.

**Architecture:** The virtual device owns real `ChannelEntity`/`ChannelPropertyEntity` rows with genuine UUIDs and FKs, so every existing consumer works untouched. Each linked property records `sourcePropertyId`, and a new `PropertyValueSourceRegistryService` lets `PropertyValueService` read and write under the *source* key — one stored series, no double-counting. Writes forward through the existing `IDevicePlatform` contract.

**Tech Stack:** NestJS 11, TypeORM 0.3 (SQLite, single-table inheritance), Jest, Flutter/Dart (panel registration only).

**Spec:** `docs/superpowers/specs/2026-07-31-virtual-devices-design.md`

## Global Constraints

- Indentation is **tabs**; print width 120; single quotes; semicolons always; trailing commas on multiline.
- Imports: external first, then relative (`../` then `./`), blank line between groups.
- Backend is the source of truth for OpenAPI. Never edit `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, or `apps/panel/lib/api/` by hand — run `pnpm run generate:openapi`. **These generated artifacts are gitignored and untracked** (commit 75738c754 removed them from version control), so regenerate them to verify your Swagger decorators are correct, but never `git add` them — the add will fail or be a no-op.
- Swagger decorators must come **before** NestJS decorators (`@Get`, `@Post`, …).
- Response schema naming: `{ModuleName}Res{Name}`; data models `{ModuleName}Data{Name}`; DTOs `{ModuleName}{Action}{Entity}`.
- Migrations are incremental and additive. **Never** modify `1000000000000-InitialSetup.ts` — alpha releases are deployed. Next free number is `1000000000007`.
- Database is SQLite: no `DROP COLUMN`, no adding FK constraints to existing columns. `ADD COLUMN … REFERENCES …` is allowed only when the default is NULL.
- Unit tests are `*.spec.ts` beside the source. Run with `pnpm run test:unit` from the repo root.
- **Never push to main.** Work on a feature branch; open a PR.

## File Structure

**Core — devices module** (generic; must never mention "virtual")

| File | Responsibility |
|---|---|
| `services/property-value-source.registry.service.ts` *(new)* | Answers "where does this property's value live?" |
| `services/property-value.service.ts` *(modify)* | Read/write under resolved key; delete never dereferences |
| `services/property-timeseries.service.ts` *(modify)* | Query history under resolved key |
| `entities/devices.entity.ts` *(modify)* | `DeviceEntity.hidden` |
| `dto/list-devices-query.dto.ts` *(new)* | `?hidden=true\|false\|all` |
| `validators/device-not-hidden-constraint.validator.ts` *(new)* | Reject hidden devices in selection DTOs |
| `src/migrations/1000000000007-AddVirtualDevicesSupport.ts` *(new)* | `hidden`, `valueOrigin`, `sourcePropertyId` |

**Aggregation guards**

| File | Responsibility |
|---|---|
| `modules/energy/listeners/energy-ingestion.listener.ts` *(modify)* | Skip projected properties |
| `modules/security/listeners/security-state.listener.ts` *(modify)* | Skip projected properties |

**Plugin — `src/plugins/devices-virtual/`**

| File | Responsibility |
|---|---|
| `devices-virtual.constants.ts` | Type discriminator, blocked categories, API tag |
| `devices-virtual.exceptions.ts` | Plugin exceptions |
| `entities/devices-virtual.entity.ts` | The three STI child entities |
| `services/virtual-value-source.service.ts` | `IPropertyValueSource` implementation |
| `services/virtual-property-index.service.ts` | `sourcePropertyId → virtual[]` and `sourceDeviceId → virtual[]` indexes |
| `services/virtual-devices.service.ts` | Creation, validation, source resolution |
| `platforms/virtual-device.platform.ts` | Command forwarding |
| `listeners/virtual-projection.listener.ts` | Re-emit value events for projections |
| `listeners/virtual-status.listener.ts` | Aggregate connection status |
| `controllers/virtual-devices.controller.ts` | `GET /devices/:id/source-devices` |
| `dto/*`, `models/*`, `devices-virtual.openapi.ts`, `devices-virtual.plugin.ts` | Standard plugin surface |

**Panel — `apps/panel/lib/plugins/devices-virtual/`**: `constants.dart`, `models/{device,channel,property}.dart`, `mappers/mappers.dart`, `plugin.dart` — registration only.

---

### Task 1: PropertyValueSourceRegistryService

The choke point the whole design rests on. Core asks a generic question; plugins answer.

**Files:**
- Create: `apps/backend/src/modules/devices/services/property-value-source.registry.service.ts`
- Test: `apps/backend/src/modules/devices/services/property-value-source.registry.service.spec.ts`
- Modify: `apps/backend/src/modules/devices/devices.module.ts` (providers + exports)

**Interfaces:**
- Consumes: `ChannelPropertyEntity` from `../entities/devices.entity`
- Produces: `IPropertyValueSource { getType(): string; resolve(property: ChannelPropertyEntity): string | null }` and `PropertyValueSourceRegistryService` with `register(source): boolean`, `resolve(property): string`, `isProjected(property): boolean`, `list(): string[]`

- [ ] **Step 1: Write the failing test**

```typescript
/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { ChannelPropertyEntity } from '../entities/devices.entity';

import { IPropertyValueSource, PropertyValueSourceRegistryService } from './property-value-source.registry.service';

describe('PropertyValueSourceRegistryService', () => {
	let service: PropertyValueSourceRegistryService;

	const property = (id: string, type: string): ChannelPropertyEntity =>
		({ id, type }) as unknown as ChannelPropertyEntity;

	const source: IPropertyValueSource = {
		getType: () => 'mock-virtual',
		resolve: (p) => (p.id === 'linked' ? 'source-id' : null),
	};

	beforeEach(() => {
		service = new PropertyValueSourceRegistryService();
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('falls back to the property id when no source is registered', () => {
		expect(service.resolve(property('own', 'mock-virtual'))).toBe('own');
		expect(service.isProjected(property('own', 'mock-virtual'))).toBe(false);
	});

	it('resolves to the source key for a registered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'mock-virtual'))).toBe('source-id');
		expect(service.isProjected(property('linked', 'mock-virtual'))).toBe(true);
	});

	it('falls back to the property id when the source returns null', () => {
		service.register(source);

		expect(service.resolve(property('owned', 'mock-virtual'))).toBe('owned');
		expect(service.isProjected(property('owned', 'mock-virtual'))).toBe(false);
	});

	it('ignores properties of an unregistered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'shelly-ng'))).toBe('linked');
	});

	it('does not register a duplicate type', () => {
		expect(service.register(source)).toBe(true);
		expect(service.register(source)).toBe(false);
		expect(service.list()).toEqual(['mock-virtual']);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- property-value-source.registry.service.spec.ts`
Expected: FAIL — `Cannot find module './property-value-source.registry.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

/**
 * Answers "where does this property's value live?".
 *
 * A property normally stores its value under its own id. A plugin may declare that some of its
 * properties read and write another property's series instead — for example a device assembled
 * from properties of other devices. Core stays unaware of any particular plugin: it only asks.
 */
export interface IPropertyValueSource {
	/** Entity discriminator this source applies to, matching `ChannelPropertyEntity.type`. */
	getType(): string;

	/** Storage key for the property, or null to use the property's own id. */
	resolve(property: ChannelPropertyEntity): string | null;
}

@Injectable()
export class PropertyValueSourceRegistryService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueSourceRegistryService');

	private readonly sources: Record<string, IPropertyValueSource> = {};

	register(source: IPropertyValueSource): boolean {
		const type = source.getType();

		if (type in this.sources) {
			this.logger.warn(`Value source already registered type=${type}`);

			return false;
		}

		this.sources[type] = source;

		this.logger.log(`Registered new value source type=${type}`);

		return true;
	}

	/**
	 * Storage key for the property. Falls back to the property's own id when no plugin claims it,
	 * so an unregistered or orphaned property simply owns its series.
	 */
	resolve(property: ChannelPropertyEntity): string {
		return this.sources[property.type]?.resolve(property) ?? property.id;
	}

	/** True when the property's value is stored under a different property's key. */
	isProjected(property: ChannelPropertyEntity): boolean {
		return this.resolve(property) !== property.id;
	}

	list(): string[] {
		return Object.keys(this.sources);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./apps/backend run test:unit -- property-value-source.registry.service.spec.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Register in the module**

In `apps/backend/src/modules/devices/devices.module.ts`, import the service, add `PropertyValueSourceRegistryService` to the `providers` array (beside `PlatformRegistryService` at line ~128) **and** to the `exports` array (beside `PlatformRegistryService` at line ~161). The export is required — the plugin registers into it.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/devices/services/property-value-source.registry.service.ts \
        apps/backend/src/modules/devices/services/property-value-source.registry.service.spec.ts \
        apps/backend/src/modules/devices/devices.module.ts
git commit -m "feat(devices): add property value source registry"
```

---

### Task 2: Dereference values in PropertyValueService

Read and write follow the resolved key. **Delete must not** — that is the data-loss guard.

**Files:**
- Modify: `apps/backend/src/modules/devices/services/property-value.service.ts`
- Test: `apps/backend/src/modules/devices/services/property-value.service.spec.ts`

**Interfaces:**
- Consumes: `PropertyValueSourceRegistryService` from Task 1
- Produces: no signature changes — `write`, `readLatest`, `delete` keep their public shapes

- [ ] **Step 1: Write the failing tests**

Append to `property-value.service.spec.ts`. Note the existing `beforeEach` builds the testing module with only `StorageService`; add the registry provider there first:

```typescript
// in the existing beforeEach providers array, after the StorageService entry:
PropertyValueSourceRegistryService,
```

and import it. Then add:

```typescript
describe('value source dereferencing', () => {
	const linked = (): ChannelPropertyEntity =>
		({
			id: 'virtual-prop',
			type: 'virtual',
			dataType: DataTypeType.FLOAT,
			format: null,
			invalid: null,
		}) as unknown as ChannelPropertyEntity;

	beforeEach(() => {
		const registry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);

		registry.register({
			getType: () => 'virtual',
			resolve: (p) => (p.id === 'virtual-prop' ? 'source-prop' : null),
		});
	});

	it('writes under the source key', async () => {
		await service.write(linked(), 21.5);

		expect(storageService.writePoints).toHaveBeenCalledWith([
			expect.objectContaining({ tags: { propertyId: 'source-prop' } }),
		]);
	});

	it('reads the value written by the source property', async () => {
		const sourceProperty = {
			id: 'source-prop',
			type: 'shelly-ng',
			dataType: DataTypeType.FLOAT,
			format: null,
			invalid: null,
		} as unknown as ChannelPropertyEntity;

		await service.write(sourceProperty, 21.5);

		const state = await service.readLatest(linked());

		expect(state?.value).toBe(21.5);
		// served from the shared cache, so storage is never queried
		expect(storageService.query).not.toHaveBeenCalled();
	});

	it('does not delete the source series when a projected property is deleted', async () => {
		await service.delete(linked());

		expect(storageService.query).not.toHaveBeenCalled();
	});

	it('deletes its own series for a non-projected property', async () => {
		const own = {
			id: 'own-prop',
			type: 'shelly-ng',
			dataType: DataTypeType.FLOAT,
		} as unknown as ChannelPropertyEntity;

		await service.delete(own);

		expect(storageService.query).toHaveBeenCalledWith(
			expect.stringContaining("DELETE FROM property_value WHERE propertyId = 'own-prop'"),
		);
	});
});
```

The existing `beforeEach` assigns `module` to a local const — promote it to a `let module: TestingModule;` declared beside `let service` so the nested `beforeEach` can reach it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- property-value.service.spec.ts`
Expected: FAIL — writes land under `propertyId: 'virtual-prop'`, and delete issues a DELETE for the source series

- [ ] **Step 3: Implement dereferencing**

Inject the registry:

```typescript
constructor(
	private readonly storageService: StorageService,
	private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
) {}
```

In `write()`, resolve once at the top and use `key` everywhere `property.id` was used for storage or caching — the cached-value lookup, the `valuesMap.set`, the `recentValuesMap` get/set, the `tags: { propertyId: key }`, and the `computeTrend` call. Leave `property.id` in log messages so they still identify the actual property:

```typescript
async write(property: ChannelPropertyEntity, value: string | boolean | number | null): Promise<boolean> {
	const key = this.valueSourceRegistry.resolve(property);
	// … existing guards unchanged …
	const cached = this.valuesMap.get(key);
	// … replace every subsequent property.id used as a storage/cache key with `key` …
}
```

In `readLatest()`, the same: `const key = this.valueSourceRegistry.resolve(property);` then use `key` for the cache lookup, the `WHERE propertyId = '${key}'` clause, `recentValuesMap`, and the final `valuesMap.set`.

Change `computeTrend` to take the resolved key, since the trend cache is keyed by it:

```typescript
private computeTrend(property: ChannelPropertyEntity, key: string): PropertyValueTrend | null {
	if (!this.isNumericDataType(property.dataType)) {
		return null;
	}

	const recent = this.recentValuesMap.get(key);
	// … rest unchanged; `property.format` still drives the threshold …
}
```

In `delete()`, add the guard **before** touching anything:

```typescript
async delete(property: ChannelPropertyEntity): Promise<void> {
	const key = this.valueSourceRegistry.resolve(property);

	// A projected property owns no series — the value belongs to its source. Deleting here would
	// destroy the source device's entire history, so bail out before clearing caches or storage.
	if (key !== property.id) {
		return;
	}

	// … existing body unchanged, using property.id …
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- property-value.service.spec.ts`
Expected: PASS — all pre-existing tests plus the 4 new ones

- [ ] **Step 5: Run the whole devices module suite for regressions**

Run: `pnpm --filter ./apps/backend run test:unit -- src/modules/devices`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/devices/services/property-value.service.ts \
        apps/backend/src/modules/devices/services/property-value.service.spec.ts
git commit -m "feat(devices): dereference property values through the value source registry"
```

---

### Task 3: Dereference timeseries queries

History must come from the source series too, or a virtual device shows an empty chart.

**Files:**
- Modify: `apps/backend/src/modules/devices/services/property-timeseries.service.ts`
- Test: `apps/backend/src/modules/devices/services/property-timeseries.service.spec.ts`

**Interfaces:**
- Consumes: `PropertyValueSourceRegistryService` from Task 1
- Produces: no signature changes

- [ ] **Step 1: Write the failing test**

```typescript
it('queries history under the source key for a projected property', async () => {
	const registry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);

	registry.register({
		getType: () => 'virtual',
		resolve: () => 'source-prop',
	});

	const property = {
		id: 'virtual-prop',
		type: 'virtual',
		dataType: DataTypeType.FLOAT,
	} as unknown as ChannelPropertyEntity;

	await service.queryTimeseries(property, new Date('2026-01-01'), new Date('2026-01-02'));

	expect(storageService.query).toHaveBeenCalledWith(expect.stringContaining("propertyId = 'source-prop'"));
});
```

Add `PropertyValueSourceRegistryService` to the spec's testing-module providers and promote `module` to an outer `let`, as in Task 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- property-timeseries.service.spec.ts`
Expected: FAIL — query contains `propertyId = 'virtual-prop'`

- [ ] **Step 3: Implement**

Inject `PropertyValueSourceRegistryService`. In `queryTimeseries`, resolve the key once and thread it into `fetchPoints` → `buildQuery` in place of `property.id`. Keep `property.id` in the log lines and in the returned payload's `property` field, so callers still see the property they asked about:

```typescript
const key = this.valueSourceRegistry.resolve(property);
// … pass `key` to fetchPoints/buildQuery; leave `property: property.id` in the response …
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- property-timeseries.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/devices/services/property-timeseries.service.ts \
        apps/backend/src/modules/devices/services/property-timeseries.service.spec.ts
git commit -m "feat(devices): dereference timeseries queries through the value source registry"
```

---

### Task 4: DeviceEntity.hidden, migration, and query filter

**Files:**
- Modify: `apps/backend/src/modules/devices/entities/devices.entity.ts`
- Create: `apps/backend/src/migrations/1000000000007-AddVirtualDevicesSupport.ts`
- Modify: `apps/backend/src/modules/devices/services/devices.service.ts` (`findAll`)
- Create: `apps/backend/src/modules/devices/dto/list-devices-query.dto.ts`
- Modify: `apps/backend/src/modules/devices/controllers/devices.controller.ts:72-85`
- Test: `apps/backend/src/modules/devices/services/devices.service.spec.ts`

**Interfaces:**
- Produces: `DeviceEntity.hidden: boolean`; `DevicesService.findAll(type?: string, hidden?: DeviceHiddenFilter)`; `enum DeviceHiddenFilter { TRUE = 'true', FALSE = 'false', ALL = 'all' }` exported from `devices.constants.ts`

This migration also adds the two virtual-property columns, so Task 5 needs no second migration.

- [ ] **Step 1: Write the failing test**

```typescript
it('returns only visible devices when hidden=false', async () => {
	const devices = await service.findAll(undefined, DeviceHiddenFilter.FALSE);

	expect(devices.every((device) => !device.hidden)).toBe(true);
});

it('returns every device by default', async () => {
	const spy = jest.spyOn(repository, 'find');

	await service.findAll();

	expect(spy).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- devices.service.spec.ts`
Expected: FAIL — `findAll` takes one argument

- [ ] **Step 3: Add the entity column**

In `devices.entity.ts`, after the `enabled` column (line ~109):

```typescript
@ApiProperty({
	description: 'Whether the device is hidden from selection UIs, e.g. because virtual devices replace it',
	type: 'boolean',
	example: false,
})
@Expose()
@IsBoolean()
@Index()
@Column({ nullable: false, default: false })
hidden: boolean = false;
```

- [ ] **Step 4: Write the migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualDevicesSupport1000000000007 implements MigrationInterface {
	name = 'AddVirtualDevicesSupport1000000000007';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "devices_module_devices" ADD COLUMN "hidden" boolean NOT NULL DEFAULT (0)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hidden" ON "devices_module_devices" ("hidden")`);

		// Virtual device support. Both columns are nullable so existing rows of other device types
		// are untouched. SQLite only permits ADD COLUMN ... REFERENCES when the default is NULL,
		// which is why the FK can be declared inline here.
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "valueOrigin" varchar`,
		);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "sourcePropertyId" varchar ` +
				`REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_channels_properties_sourcePropertyId" ` +
				`ON "devices_module_channels_properties" ("sourcePropertyId")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite cannot DROP COLUMN. All three columns are nullable or defaulted and the code
		// handles their absence, so they are left in place.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channels_properties_sourcePropertyId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_hidden"`);
	}
}
```

- [ ] **Step 5: Add the filter enum and service support**

In `devices.constants.ts`:

```typescript
export enum DeviceHiddenFilter {
	TRUE = 'true',
	FALSE = 'false',
	ALL = 'all',
}
```

In `devices.service.ts`, extend `findAll` (line 71). Default stays `ALL` for backward compatibility:

```typescript
async findAll<TDevice extends DeviceEntity>(
	type?: string,
	hidden: DeviceHiddenFilter = DeviceHiddenFilter.ALL,
): Promise<TDevice[]> {
	const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

	const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

	this.logger.debug('Fetching all devices');

	const devices = (await repository.find({
		...(hidden === DeviceHiddenFilter.ALL ? {} : { where: { hidden: hidden === DeviceHiddenFilter.TRUE } }),
		relations: [
			'controls',
			'controls.device',
			'channels',
			'channels.device',
			'channels.controls',
			'channels.controls.channel',
			'channels.properties',
			'channels.properties.channel',
			'deviceZones',
		],
	})) as TDevice[];

	this.logger.debug(`Found ${devices.length} devices`);

	return devices;
}
```

- [ ] **Step 6: Add the query DTO and wire the controller**

`dto/list-devices-query.dto.ts`:

```typescript
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

import { DeviceHiddenFilter } from '../devices.constants';

export class ListDevicesQueryDto {
	@ApiPropertyOptional({
		description: 'Filter by hidden flag. Defaults to returning every device.',
		enum: DeviceHiddenFilter,
		example: DeviceHiddenFilter.FALSE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(DeviceHiddenFilter)
	hidden?: DeviceHiddenFilter;
}
```

In `devices.controller.ts`, replace the `findAll` body at lines 72-85. Keep the existing `@ApiOperation`/`@ApiSuccessResponse` decorators above it and add `@ApiQuery` before `@Get()`:

```typescript
@ApiQuery({
	name: 'hidden',
	required: false,
	enum: DeviceHiddenFilter,
	description: 'Filter by hidden flag. Omit to return every device.',
})
@Get()
async findAll(@Query() query: ListDevicesQueryDto): Promise<DevicesResponseModel> {
	this.logger.debug('Fetching all devices');

	const devices = await this.devicesService.findAll(undefined, query.hidden ?? DeviceHiddenFilter.ALL);

	this.logger.debug(`Retrieved ${devices.length} devices`);

	const response = new DevicesResponseModel();

	response.data = devices;

	return response;
}
```

- [ ] **Step 7: Run tests and the migration**

Run: `pnpm --filter ./apps/backend run test:unit -- devices.service.spec.ts`
Expected: PASS

Run: `cd apps/backend && pnpm run typeorm:migration:run`
Expected: `AddVirtualDevicesSupport1000000000007` applied without error

- [ ] **Step 8: Regenerate OpenAPI**

Run: `pnpm run generate:openapi`
Expected: `spec/api/v1/openapi.json` gains the `hidden` field and query parameter

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/devices apps/backend/src/migrations/1000000000007-AddVirtualDevicesSupport.ts \
       
git commit -m "feat(devices): add hidden flag with query filter and virtual property columns"
```

---

### Task 5: ValidateDeviceNotHidden constraint

Hidden devices must be rejected where a user picks a device.

**Files:**
- Create: `apps/backend/src/modules/devices/validators/device-not-hidden-constraint.validator.ts`
- Test: `apps/backend/src/modules/devices/validators/device-not-hidden-constraint.validator.spec.ts`
- Modify: `apps/backend/src/modules/devices/devices.module.ts` (providers + exports)

**Interfaces:**
- Produces: `DeviceNotHiddenConstraintValidator` and the `@ValidateDeviceNotHidden()` decorator

- [ ] **Step 1: Write the failing test**

```typescript
import { DevicesService } from '../services/devices.service';

import { DeviceNotHiddenConstraintValidator } from './device-not-hidden-constraint.validator';

describe('DeviceNotHiddenConstraintValidator', () => {
	let validator: DeviceNotHiddenConstraintValidator;
	let devicesService: { findOne: jest.Mock };

	beforeEach(() => {
		devicesService = { findOne: jest.fn() };
		validator = new DeviceNotHiddenConstraintValidator(devicesService as unknown as DevicesService);
	});

	it('accepts a visible device', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'a', hidden: false });

		await expect(validator.validate('a')).resolves.toBe(true);
	});

	it('rejects a hidden device', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'a', hidden: true });

		await expect(validator.validate('a')).resolves.toBe(false);
	});

	it('rejects a missing device', async () => {
		devicesService.findOne.mockResolvedValue(null);

		await expect(validator.validate('a')).resolves.toBe(false);
	});

	it('accepts an empty value so @IsOptional stays in control', async () => {
		await expect(validator.validate(undefined)).resolves.toBe(true);
		expect(devicesService.findOne).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- device-not-hidden-constraint.validator.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement, following `device-exists-constraint.validator.ts`**

```typescript
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DevicesService } from '../services/devices.service';

@ValidatorConstraint({ name: 'DeviceNotHidden', async: true })
@Injectable()
export class DeviceNotHiddenConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly devicesService: DevicesService) {}

	async validate(deviceId: string | undefined): Promise<boolean> {
		// Empty values are @IsOptional/@IsNotEmpty's business, not ours.
		if (!deviceId) {
			return true;
		}

		const device = await this.devicesService.findOne(deviceId);

		return device !== null && !device.hidden;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"Device is hidden and can not be selected."}]`;
	}
}

export function ValidateDeviceNotHidden(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: DeviceNotHiddenConstraintValidator,
		});
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./apps/backend run test:unit -- device-not-hidden-constraint.validator.spec.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Register in the module**

Add `DeviceNotHiddenConstraintValidator` to `devices.module.ts` `providers` and `exports`, beside `DeviceExistsConstraintValidator`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/devices/validators apps/backend/src/modules/devices/devices.module.ts
git commit -m "feat(devices): add ValidateDeviceNotHidden constraint"
```

---

### Task 6: Virtual entities and plugin registration

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts`
- Create: `apps/backend/src/plugins/devices-virtual/entities/devices-virtual.entity.ts`
- Create: `apps/backend/src/plugins/devices-virtual/devices-virtual.plugin.ts`
- Create: `apps/backend/src/plugins/devices-virtual/devices-virtual.openapi.ts`
- Create: `apps/backend/src/plugins/devices-virtual/dto/{create,update}-device.dto.ts`, `{create,update}-channel.dto.ts`, `{create,update}-channel-property.dto.ts`, `update-config.dto.ts`
- Create: `apps/backend/src/plugins/devices-virtual/models/config.model.ts`
- Modify: `apps/backend/src/app.module.ts` (register the plugin)

**Interfaces:**
- Produces: `DEVICES_VIRTUAL_TYPE = 'virtual'`, `VIRTUAL_BLOCKED_CATEGORIES`, `enum VirtualValueOrigin { SOURCE = 'source', LOCAL = 'local' }`, `VirtualDeviceEntity`, `VirtualChannelEntity`, `VirtualChannelPropertyEntity` with `valueOrigin: VirtualValueOrigin` and `sourcePropertyId: string | null`

- [ ] **Step 1: Write the constants**

```typescript
import { DeviceCategory } from '../../modules/devices/devices.constants';

export const DEVICES_VIRTUAL_TYPE = 'virtual';

export const DEVICES_VIRTUAL_PLUGIN_NAME = 'devices-virtual';

export const DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME = 'Devices virtual plugin';

export const DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for devices assembled from properties of other devices.';

/**
 * Categories whose specification requires a closed-loop channel — one with a writable `on` plus a
 * required writable target for a *sensed* quantity (temperature, humidity) that the actuator cannot
 * set directly. Satisfying those needs a control algorithm, which virtual devices do not yet have,
 * so creating one would produce a device that accepts a setpoint and never acts on it.
 *
 * `thermostat` is included even though its heater/cooler channels are optional: without either it
 * validates, but it is a thermometer wearing a thermostat badge.
 *
 * Derived from spec/devices — revisit when controller support lands.
 */
export const VIRTUAL_BLOCKED_CATEGORIES: readonly DeviceCategory[] = [
	DeviceCategory.AIR_CONDITIONER,
	DeviceCategory.AIR_DEHUMIDIFIER,
	DeviceCategory.AIR_HUMIDIFIER,
	DeviceCategory.HEATING_UNIT,
	DeviceCategory.WATER_HEATER,
	DeviceCategory.THERMOSTAT,
];
```

- [ ] **Step 2: Write the entities**

Model on `plugins/devices-third-party/entities/devices-third-party.entity.ts`. The self-referencing FK mirrors `ChannelEntity.parent` in `devices.entity.ts:306-308`:

```typescript
import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

export enum VirtualValueOrigin {
	/** Value is read from and written to `sourcePropertyId`. */
	SOURCE = 'source',
	/** Value is stored under this property's own id, e.g. synthesized device information. */
	LOCAL = 'local',
}

@ApiSchema({ name: 'DevicesVirtualPluginDataDevice' })
@ChildEntity()
export class VirtualDeviceEntity extends DeviceEntity {
	@ApiProperty({ description: 'Device type', type: 'string', default: DEVICES_VIRTUAL_TYPE, example: DEVICES_VIRTUAL_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannel' })
@ChildEntity()
export class VirtualChannelEntity extends ChannelEntity {
	@ApiProperty({ description: 'Channel type', type: 'string', default: DEVICES_VIRTUAL_TYPE, example: DEVICES_VIRTUAL_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannelProperty' })
@ChildEntity()
export class VirtualChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		name: 'value_origin',
		description: 'Whether the value comes from a source property or is stored by this property itself',
		enum: VirtualValueOrigin,
		example: VirtualValueOrigin.SOURCE,
	})
	@Expose({ name: 'value_origin' })
	@IsEnum(VirtualValueOrigin)
	@Transform(
		({ obj }: { obj: { value_origin?: VirtualValueOrigin; valueOrigin?: VirtualValueOrigin } }) =>
			obj.value_origin ?? obj.valueOrigin,
		{ toClassOnly: true },
	)
	@Column({ type: 'text', enum: VirtualValueOrigin, default: VirtualValueOrigin.SOURCE })
	valueOrigin: VirtualValueOrigin = VirtualValueOrigin.SOURCE;

	@ApiPropertyOptional({
		name: 'source_property',
		description: 'Property whose value this one projects. Null once the source has been deleted.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"source_property","reason":"Source property must be a valid UUID (version 4)."}]' })
	@Transform(
		({ obj }: { obj: { source_property?: string | null; sourcePropertyId?: string | null } }) =>
			obj.source_property !== undefined ? obj.source_property : obj.sourcePropertyId,
		{ toClassOnly: true },
	)
	@Index()
	@Column({ nullable: true, default: null })
	sourcePropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;

	@ApiProperty({ description: 'Channel property type', type: 'string', default: DEVICES_VIRTUAL_TYPE, example: DEVICES_VIRTUAL_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	/** True when this property was meant to project a source that has since been deleted. */
	get isOrphaned(): boolean {
		return this.valueOrigin === VirtualValueOrigin.SOURCE && this.sourcePropertyId === null;
	}
}
```

- [ ] **Step 3: Write the DTOs and plugin registration**

Copy the six DTO files and `update-config.dto.ts`, `models/config.model.ts`, `devices-virtual.openapi.ts` and `devices-virtual.plugin.ts` from `plugins/devices-third-party/`, renaming `ThirdParty` → `Virtual` and `DEVICES_THIRD_PARTY_TYPE` → `DEVICES_VIRTUAL_TYPE` throughout. The plugin's `onModuleInit` must register, exactly as third-party does: the config mapping, the three type mappings, the platform (added in Task 8), the Swagger extra models, the nine `ExtendedDiscriminatorService` registrations, and `extensionsService.registerPluginMetadata`.

`CreateVirtualDeviceDto` has no extra fields beyond the base — the device is created empty and its channels/properties are added through the standard channel endpoints. Drop the `service_address` field third-party carries.

`CreateVirtualChannelPropertyDto` adds `value_origin` (enum, optional, defaults to `source`) and `source_property` (UUID, optional).

Register `DevicesVirtualPlugin` in `apps/backend/src/app.module.ts` beside the other `devices-*` plugins.

- [ ] **Step 4: Verify the app boots and the schema is created**

Run: `cd apps/backend && pnpm run build`
Expected: compiles clean

Run: `pnpm --filter ./apps/backend run test:unit`
Expected: PASS — no regressions from the new entities

- [ ] **Step 5: Regenerate OpenAPI**

Run: `pnpm run generate:openapi`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual apps/backend/src/app.module.ts \
       
git commit -m "feat(devices-virtual): add plugin entities and registration"
```

---

### Task 7: VirtualValueSourceService

Teaches the registry where a virtual property's value lives.

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/services/virtual-value-source.service.ts`
- Test: `apps/backend/src/plugins/devices-virtual/services/virtual-value-source.service.spec.ts`
- Modify: `apps/backend/src/plugins/devices-virtual/devices-virtual.plugin.ts`

**Interfaces:**
- Consumes: `IPropertyValueSource` (Task 1), `VirtualChannelPropertyEntity`, `VirtualValueOrigin` (Task 6)
- Produces: `VirtualValueSourceService implements IPropertyValueSource`

- [ ] **Step 1: Write the failing test**

```typescript
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualValueSourceService } from './virtual-value-source.service';

describe('VirtualValueSourceService', () => {
	let service: VirtualValueSourceService;

	const virtualProperty = (overrides: Partial<VirtualChannelPropertyEntity>): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, { id: 'virtual-prop', valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: null }, overrides);

		return property;
	};

	beforeEach(() => {
		service = new VirtualValueSourceService();
	});

	it('registers for the virtual discriminator', () => {
		expect(service.getType()).toBe(DEVICES_VIRTUAL_TYPE);
	});

	it('resolves a linked property to its source', () => {
		expect(service.resolve(virtualProperty({ sourcePropertyId: 'source-prop' }))).toBe('source-prop');
	});

	it('returns null for an owned property so it keeps its own series', () => {
		expect(service.resolve(virtualProperty({ valueOrigin: VirtualValueOrigin.LOCAL }))).toBeNull();
	});

	it('returns null for an orphaned property so it falls back to its own empty series', () => {
		expect(service.resolve(virtualProperty({ sourcePropertyId: null }))).toBeNull();
	});

	it('returns null for a property that is not a virtual entity', () => {
		expect(service.resolve({ id: 'x' } as ChannelPropertyEntity)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-value-source.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IPropertyValueSource } from '../../../modules/devices/services/property-value-source.registry.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

@Injectable()
export class VirtualValueSourceService implements IPropertyValueSource {
	getType(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	resolve(property: ChannelPropertyEntity): string | null {
		if (!(property instanceof VirtualChannelPropertyEntity)) {
			return null;
		}

		// An owned property stores its own value. An orphaned one has no source left, so it also
		// falls back to its own — empty — series rather than silently reading someone else's.
		if (property.valueOrigin !== VirtualValueOrigin.SOURCE) {
			return null;
		}

		return property.sourcePropertyId;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-value-source.service.spec.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Register it**

Add `VirtualValueSourceService` to the plugin module `providers`, inject it into `DevicesVirtualPlugin`, and in `onModuleInit` call:

```typescript
this.propertyValueSourceRegistry.register(this.virtualValueSourceService);
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): resolve property values to their source"
```

---

### Task 8: VirtualDevicePlatform — command forwarding

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/platforms/virtual-device.platform.ts`
- Test: `apps/backend/src/plugins/devices-virtual/platforms/virtual-device.platform.spec.ts`
- Modify: `apps/backend/src/plugins/devices-virtual/devices-virtual.plugin.ts`

**Interfaces:**
- Consumes: `IDevicePlatform`, `IDevicePropertyData` from `modules/devices/platforms/device.platform`; `PlatformRegistryService`, `DevicesService`, `ChannelsService`, `ChannelsPropertiesService`
- Produces: `VirtualDevicePlatform implements IDevicePlatform`

- [ ] **Step 1: Write the failing tests**

```typescript
describe('VirtualDevicePlatform', () => {
	// … construct the platform with mocked DevicesService, ChannelsService,
	//     ChannelsPropertiesService and PlatformRegistryService …

	it('forwards a linked property write to the source device platform', async () => {
		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(true);
		expect(sourcePlatform.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ device: sourceDevice, property: sourceProperty, value: true }),
		]);
	});

	it('groups updates by source device', async () => {
		await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedToA, value: true },
			{ device: virtualDevice, channel: virtualChannel, property: linkedToB, value: false },
		]);

		expect(platformA.processBatch).toHaveBeenCalledTimes(1);
		expect(platformB.processBatch).toHaveBeenCalledTimes(1);
	});

	it('rejects a write to an orphaned property', async () => {
		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: orphanedProperty, value: true },
		]);

		expect(result).toBe(false);
		expect(sourcePlatform.processBatch).not.toHaveBeenCalled();
	});

	it('rejects a write to an owned property, since none are writable yet', async () => {
		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: ownedProperty, value: 'x' },
		]);

		expect(result).toBe(false);
	});

	it('refuses to forward to another virtual device', async () => {
		sourceDevice.type = DEVICES_VIRTUAL_TYPE;

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(false);
	});

	it('rejects the batch when a source device is offline', async () => {
		sourceDevice.status = { online: false, status: ConnectionState.DISCONNECTED, lastChanged: null };

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-device.platform.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

@Injectable()
export class VirtualDevicePlatform implements IDevicePlatform {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDevicePlatform');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	getType(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	async process(data: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([data]);
	}

	async processBatch(updates: IDevicePropertyData[]): Promise<boolean> {
		const bySourceDevice = new Map<string, { device: DeviceEntity; updates: IDevicePropertyData[] }>();

		for (const update of updates) {
			const property = update.property;

			if (!(property instanceof VirtualChannelPropertyEntity)) {
				this.logger.error(`Property id=${property.id} is not a virtual property`);

				return false;
			}

			// Owned properties are read-only in this release — the only ones that exist are the
			// synthesized device information strings. Writable setpoints arrive with controller support.
			if (property.valueOrigin === VirtualValueOrigin.LOCAL) {
				this.logger.warn(`Property id=${property.id} is owned and not writable`);

				return false;
			}

			if (property.sourcePropertyId === null) {
				this.logger.warn(`Property id=${property.id} has no source, it was deleted`);

				return false;
			}

			const resolved = await this.resolveSource(property.sourcePropertyId);

			if (!resolved) {
				return false;
			}

			const { device, channel, property: sourceProperty } = resolved;

			// Nesting is rejected at creation; this is the backstop against a stale or hand-edited row.
			if (device.type === DEVICES_VIRTUAL_TYPE) {
				this.logger.error(`Source device id=${device.id} is itself virtual, refusing to forward`);

				return false;
			}

			if (!device.status.online && device.status.status !== ConnectionState.UNKNOWN) {
				this.logger.warn(`Source device id=${device.id} is offline`);

				return false;
			}

			const group = bySourceDevice.get(device.id) ?? { device, updates: [] };

			group.updates.push({ device, channel, property: sourceProperty, value: update.value });

			bySourceDevice.set(device.id, group);
		}

		// Resolve every group's platform BEFORE forwarding to any of them. get() is a pure
		// synchronous registry lookup, so this costs nothing and keeps a missing platform from
		// being discovered only after an earlier group's hardware has already moved.
		const resolvedGroups: Array<{ platform: IDevicePlatform; updates: IDevicePropertyData[] }> = [];

		for (const { device, updates: sourceUpdates } of bySourceDevice.values()) {
			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.logger.warn(`No platform registered for source device id=${device.id} type=${device.type}`);

				return false;
			}

			resolvedGroups.push({ platform, updates: sourceUpdates });
		}

		// Past this point a multi-source batch is NOT atomic: if a later group's processBatch
		// fails, earlier groups have already been applied. IDevicePlatform exposes no pre-flight
		// hook, and adding one would change a contract shared by eight plugins, so this is an
		// accepted tradeoff rather than an oversight. A test pins the behaviour.
		for (const { platform, updates: sourceUpdates } of resolvedGroups) {
			const success = await platform.processBatch(sourceUpdates);

			if (!success) {
				this.logger.error(`Forwarded batch failed for source device id=${device.id}`);

				return false;
			}
		}

		return true;
	}

	private async resolveSource(
		sourcePropertyId: string,
	): Promise<{ device: DeviceEntity; channel: ChannelEntity; property: ChannelPropertyEntity } | null> {
		const property = await this.channelsPropertiesService.findOne(sourcePropertyId);

		if (!property) {
			this.logger.warn(`Source property id=${sourcePropertyId} not found`);

			return null;
		}

		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		const channel = channelId ? await this.channelsService.findOne(channelId) : null;

		if (!channel) {
			this.logger.warn(`Source channel for property id=${sourcePropertyId} not found`);

			return null;
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const device = deviceId ? await this.devicesService.findOne(deviceId) : null;

		if (!device) {
			this.logger.warn(`Source device for property id=${sourcePropertyId} not found`);

			return null;
		}

		return { device, channel, property };
	}
}
```

Add the missing `ChannelEntity`/`ChannelPropertyEntity` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-device.platform.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Register the platform**

In `devices-virtual.plugin.ts` `onModuleInit`: `this.platformRegistryService.register(this.virtualDevicePlatform);`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): forward property commands to source devices"
```

---

### Task 9: VirtualPropertyIndexService

The projection listener fires on every property value change in the system, so lookups must be in memory.

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/services/virtual-property-index.service.ts`
- Test: `apps/backend/src/plugins/devices-virtual/services/virtual-property-index.service.spec.ts`

**Interfaces:**
- Produces: `VirtualPropertyIndexService` with `onApplicationBootstrap(): Promise<void>`, `findBySourceProperty(id: string): VirtualChannelPropertyEntity[]`, `findVirtualDeviceIdsBySourceDevice(id: string): string[]`, `add(property, sourceDeviceId)`, `removeVirtualDevice(id: string)`, `rebuild(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
it('is empty before hydration', () => {
	expect(service.findBySourceProperty('source-prop')).toEqual([]);
});

it('indexes virtual properties by source property on bootstrap', async () => {
	repository.find.mockResolvedValue([linkedProperty]);

	await service.onApplicationBootstrap();

	expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
});

it('indexes several virtual properties sharing one source', async () => {
	repository.find.mockResolvedValue([linkedA, linkedB]);

	await service.onApplicationBootstrap();

	expect(service.findBySourceProperty('source-prop')).toHaveLength(2);
});

it('skips owned and orphaned properties', async () => {
	repository.find.mockResolvedValue([ownedProperty, orphanedProperty]);

	await service.onApplicationBootstrap();

	expect(service.findBySourceProperty('source-prop')).toEqual([]);
});

it('maps a source device to the virtual devices projecting it', async () => {
	repository.find.mockResolvedValue([linkedProperty]);

	await service.onApplicationBootstrap();

	expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device']);
});

it('drops every entry for a removed virtual device', async () => {
	repository.find.mockResolvedValue([linkedProperty]);

	await service.onApplicationBootstrap();
	service.removeVirtualDevice('virtual-device');

	expect(service.findBySourceProperty('source-prop')).toEqual([]);
	expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-property-index.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Hydrate on `onApplicationBootstrap` (not `onModuleInit`) so every plugin's entities are registered first. Load `VirtualChannelPropertyEntity` rows with `relations: ['channel', 'channel.device', 'sourceProperty', 'sourceProperty.channel', 'sourceProperty.channel.device']` so both indexes can be built in one query, keyed as:

The two `.device` hops are load-bearing and were missing from an earlier draft of this plan. Without them TypeORM leaves `channel.device` and `sourceProperty.channel.device` undefined, so the device-level index is permanently empty in production — while a mocked-repository unit test stays green, because the mock returns whatever fixture shape the test author wrote. Pin this with a test that asserts the relations array actually requested, or with a real round-trip.

- `bySourceProperty: Map<string, VirtualChannelPropertyEntity[]>`
- `bySourceDevice: Map<string, Set<string>>` — source device id → virtual device ids
- `byVirtualDevice: Map<string, VirtualChannelPropertyEntity[]>` — for cheap removal

`rebuild()` clears all three and re-runs the load; `add`/`removeVirtualDevice` keep them current after CRUD without a full reload.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-property-index.service.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): index virtual properties by source"
```

---

### Task 10: Projection listener

Without this, a client displaying a virtual property never sees it change.

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/listeners/virtual-projection.listener.ts`
- Test: `apps/backend/src/plugins/devices-virtual/listeners/virtual-projection.listener.spec.ts`

**Interfaces:**
- Consumes: `VirtualPropertyIndexService` (Task 9), `EventType.CHANNEL_PROPERTY_VALUE_SET`, `EventEmitter2`
- Produces: `VirtualProjectionListener`

- [ ] **Step 1: Write the failing tests**

```typescript
it('re-emits a value event for each virtual property projecting the source', () => {
	index.findBySourceProperty.mockReturnValue([virtualA, virtualB]);

	listener.handlePropertyValueSet(sourceProperty);

	expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_VALUE_SET, virtualA);
	expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_VALUE_SET, virtualB);
});

it('emits nothing when no virtual property projects the source', () => {
	index.findBySourceProperty.mockReturnValue([]);

	listener.handlePropertyValueSet(sourceProperty);

	expect(eventEmitter.emit).not.toHaveBeenCalled();
});

it('does not recurse when handed a virtual property', () => {
	index.findBySourceProperty.mockReturnValue([]);

	listener.handlePropertyValueSet(virtualA);

	expect(index.findBySourceProperty).toHaveBeenCalledWith(virtualA.id);
	expect(eventEmitter.emit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-projection.listener.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

/**
 * A source write emits a value event carrying the *source* property's id, which the WebSocket
 * gateway rebroadcasts verbatim. Clients holding a virtual property would never see their own
 * property change, so re-emit one event per projection.
 *
 * Nesting is rejected at creation, so a virtual property is never anyone's source: the index
 * lookup returns empty for the events this listener itself emits, and recursion terminates.
 */
@Injectable()
export class VirtualProjectionListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualProjectionListener');

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	@OnEvent(EventType.CHANNEL_PROPERTY_VALUE_SET)
	handlePropertyValueSet(property: ChannelPropertyEntity): void {
		const projections = this.index.findBySourceProperty(property.id);

		if (projections.length === 0) {
			return;
		}

		for (const projection of projections) {
			// The value itself is already shared — both properties resolve to the same storage key,
			// so the projection carries the source's state without a second read.
			projection.value = property.value;

			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, projection);
		}

		this.logger.debug(`Projected value of property id=${property.id} to ${projections.length} virtual properties`);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-projection.listener.spec.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): re-emit value events for projected properties"
```

---

### Task 11: Aggregation guards in energy and security

Without these, a virtual device's projected power counts the same watts twice.

**Files:**
- Modify: `apps/backend/src/modules/energy/listeners/energy-ingestion.listener.ts:71`
- Modify: `apps/backend/src/modules/security/listeners/security-state.listener.ts:82`
- Test: `apps/backend/src/modules/energy/listeners/energy-ingestion.listener.spec.ts`

**Interfaces:**
- Consumes: `PropertyValueSourceRegistryService.isProjected` (Task 1)

- [ ] **Step 1: Write the failing test**

```typescript
it('ignores a projected property so the same consumption is not counted twice', async () => {
	jest.spyOn(valueSourceRegistry, 'isProjected').mockReturnValue(true);

	await listener.handlePropertyValueSet(consumptionProperty);

	expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- energy-ingestion.listener.spec.ts`
Expected: FAIL — the listener still queries the channel

- [ ] **Step 3: Implement in energy**

Inject `PropertyValueSourceRegistryService` and add the guard at the very top of `processPropertyValue`, before the category check:

```typescript
private async processPropertyValue(property: ChannelPropertyEntity): Promise<void> {
	// A projected property shares its series with the source, which was already ingested when the
	// source emitted. Counting it again would double the household total.
	if (this.valueSourceRegistry.isProjected(property)) {
		return;
	}

	// … existing body …
}
```

Add `DevicesModule` to `EnergyModule` imports if it is not already there, so the registry can be injected.

- [ ] **Step 4: Implement the same guard in security**

Add the identical early return at the top of `security-state.listener.ts`'s `@OnEvent(CHANNEL_PROPERTY_VALUE_SET)` handler, with the same comment adapted to sensor aggregation.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- src/modules/energy src/modules/security`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/energy apps/backend/src/modules/security
git commit -m "fix(energy,security): skip projected properties during aggregation"
```

---

### Task 12: Connection status aggregation

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/listeners/virtual-status.listener.ts`
- Test: `apps/backend/src/plugins/devices-virtual/listeners/virtual-status.listener.spec.ts`

**Interfaces:**
- Consumes: `VirtualPropertyIndexService` (Task 9); `DeviceConnectivityService.setConnectionState(deviceId: string, state: { state: ConnectionState; reason?: string; ts?: number })`, exported from `DevicesModule`
- Produces: `VirtualStatusListener`

**Important:** do **not** call `DeviceConnectionStateService.write()` directly — it requires a `ChannelPropertyEntity` whose category is `PropertyCategory.STATUS` and rejects anything else (`device-connection-state.service.ts:85-92`). `DeviceConnectivityService.setConnectionState` is the correct entry point: it finds-or-creates the device's `device_information` channel and `status` property, writes the state, and emits the event (`device-connectivity.service.ts:31,96`). It creates that channel with `type: device.type`, so a virtual device gets a `VirtualChannelEntity` automatically.

The event payload is `{ device, state, reason }` — **not** a bare device.

- [ ] **Step 1: Write the failing tests**

```typescript
it('marks the virtual device online when every source is online', async () => {
	index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
	sourcesFor('virtual-device', [{ online: true }, { online: true }]);

	await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

	expect(connectivity.setConnectionState).toHaveBeenCalledWith(
		'virtual-device',
		expect.objectContaining({ state: ConnectionState.CONNECTED }),
	);
});

it('marks the virtual device offline when any source is offline', async () => {
	index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
	sourcesFor('virtual-device', [{ online: true }, { online: false }]);

	await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.DISCONNECTED });

	expect(connectivity.setConnectionState).toHaveBeenCalledWith(
		'virtual-device',
		expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
	);
});

it('marks the virtual device offline when any property is orphaned', async () => {
	index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
	sourcesFor('virtual-device', [{ online: true }], { orphaned: true });

	await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

	expect(connectivity.setConnectionState).toHaveBeenCalledWith(
		'virtual-device',
		expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
	);
});

it('ignores devices that no virtual device projects', async () => {
	index.findVirtualDeviceIdsBySourceDevice.mockReturnValue([]);

	await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

	expect(connectivity.setConnectionState).not.toHaveBeenCalled();
});

it('ignores its own emissions so status does not recurse', async () => {
	const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;

	await listener.handleConnectionChanged({ device: virtualDevice, state: ConnectionState.CONNECTED });

	expect(index.findVirtualDeviceIdsBySourceDevice).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-status.listener.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
@OnEvent(EventType.DEVICE_CONNECTION_CHANGED)
async handleConnectionChanged(payload: { device: DeviceEntity; state: ConnectionState; reason?: string }): Promise<void> {
	// setConnectionState re-emits this event for the virtual device we are about to update.
	// Nesting is forbidden, so the index would return empty anyway, but bailing out here keeps
	// the recursion obvious rather than incidental.
	if (payload.device.type === DEVICES_VIRTUAL_TYPE) {
		return;
	}

	for (const virtualDeviceId of this.index.findVirtualDeviceIdsBySourceDevice(payload.device.id)) {
		await this.deviceConnectivityService.setConnectionState(virtualDeviceId, {
			state: await this.aggregateState(virtualDeviceId),
			reason: 'aggregated from source devices',
		});
	}
}
```

`aggregateState` returns `CONNECTED` when every distinct source device is online **and** no property of the virtual device is orphaned; otherwise `DISCONNECTED`. A virtual device with only owned properties has no sources and is always `CONNECTED`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-status.listener.spec.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): aggregate connection status from source devices"
```

---

### Task 12a: Index maintenance listener

**Added mid-execution.** Tasks 9 and 12 revealed that `VirtualPropertyIndexService` is populated **only** at `onApplicationBootstrap` — nothing calls `add()`, `rebuild()` or `removeVirtualDevice()` at runtime. Three consequences, all user-visible:

- A virtual device created after boot is absent from the index, so the projection listener never fires for it and its properties look frozen until the backend restarts.
- When a source property is deleted, the FK sets `sourcePropertyId` to null in the database, but the index still holds a stale in-memory entity with it set — so status never degrades and the spec's "orphaned" state is unreachable at runtime.
- A deleted virtual device leaves entries behind, so the projection listener keeps emitting events for properties that no longer exist.

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/listeners/virtual-index-maintenance.listener.ts`
- Test: `apps/backend/src/plugins/devices-virtual/listeners/virtual-index-maintenance.listener.spec.ts`
- Modify: `apps/backend/src/plugins/devices-virtual/devices-virtual.plugin.ts` (providers)

**Approach: coalesced rebuild.** Subscribe to the structural events — `DEVICE_CREATED`, `DEVICE_UPDATED`, `DEVICE_DELETED`, `DEVICE_RESET`, `CHANNEL_PROPERTY_CREATED`, `CHANNEL_PROPERTY_UPDATED`, `CHANNEL_PROPERTY_DELETED`, `CHANNEL_PROPERTY_RESET`, `MODULE_RESET` — and schedule one `rebuild()` rather than mutating the maps incrementally.

**`CHANNEL_PROPERTY_VALUE_SET` must NOT be subscribed.** It fires on every property report from every device; rebuilding on it would put a database query on the hot path this index exists to keep off.

Coalesce so a burst of provisioning events costs one reload, not one per event, and so a rebuild already in flight is not run concurrently with itself. A full rebuild is a single relation-loaded query and structural changes are rare, so precision here buys less than the partial-state bugs incremental maintenance would risk.

---

### Task 13: VirtualDevicesService — creation validation and source listing

**Files:**
- Create: `apps/backend/src/plugins/devices-virtual/services/virtual-devices.service.ts`
- Create: `apps/backend/src/plugins/devices-virtual/devices-virtual.exceptions.ts`
- Create: `apps/backend/src/plugins/devices-virtual/controllers/virtual-devices.controller.ts`
- Create: `apps/backend/src/plugins/devices-virtual/models/virtual-response.model.ts`
- Test: `apps/backend/src/plugins/devices-virtual/services/virtual-devices.service.spec.ts`

**Interfaces:**
- Consumes: `VIRTUAL_BLOCKED_CATEGORIES` (Task 6), `DeviceValidationService`, `VirtualPropertyIndexService`
- Produces: `VirtualDevicesService.assertCategoryAllowed(category)`, `.assertSourceNotVirtual(sourcePropertyId)`, `.assertPermissionsCompatible(specPermissions, sourceProperty)`, `.findSourceDevices(virtualDeviceId): Promise<DeviceEntity[]>`

- [ ] **Step 1: Write the failing tests**

```typescript
it('rejects a category that needs closed-loop control', () => {
	expect(() => service.assertCategoryAllowed(DeviceCategory.HEATING_UNIT)).toThrow(VirtualCategoryNotSupportedException);
});

it('accepts a category that only needs wiring', () => {
	expect(() => service.assertCategoryAllowed(DeviceCategory.LIGHTING)).not.toThrow();
});

it('rejects a source property that belongs to another virtual device', async () => {
	await expect(service.assertSourceNotVirtual('virtual-source')).rejects.toThrow(VirtualNestingNotAllowedException);
});

it('rejects a read-only source for a writable spec slot', () => {
	expect(() => service.assertPermissionsCompatible([PermissionType.READ_WRITE], readOnlySource)).toThrow();
});

it('accepts a read-write source for a read-only spec slot', () => {
	expect(() => service.assertPermissionsCompatible([PermissionType.READ_ONLY], readWriteSource)).not.toThrow();
});

it('lists the distinct source devices behind a virtual device', async () => {
	await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([deviceA, deviceB]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-devices.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service and exceptions**

Permission compatibility mirrors `DeviceValidationService.permissionSatisfied` at `device-validation.service.ts:685` — `READ_WRITE` satisfies both `READ_ONLY` and `WRITE_ONLY`. Reuse that rule rather than restating it.

- [ ] **Step 4: Add the controller**

`GET /devices/:id/source-devices` returning a `VirtualSourceDevicesResponseModel` extending `BaseSuccessResponseModel<DeviceEntity[]>`. Follow `plugins/devices-third-party/controllers/third-party-demo.controller.ts` for the decorator stack: `@ApiTags`, `@ApiOperation` with `operationId`, `@ApiSuccessResponse`, then `@Get(':id/source-devices')`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-devices.service.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Regenerate OpenAPI and commit**

```bash
pnpm run generate:openapi
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): validate creation and expose source devices"
```

---

### Task 14: E2E lifecycle test

Proves the pieces work together, including the two behaviours most likely to regress silently.

**Files:**
- Create: `apps/backend/test/devices-virtual.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Cover, using a simulator device as the source:

1. Create a virtual device with `category: lighting`, add a `light` channel and an `on` property linked to the simulator's relay `on`.
2. `GET /devices/:id` returns the virtual device with its channel and the value read from the source.
3. Command the virtual property; assert the **source** property's value changed.
4. Delete the source property; assert the virtual device still exists, its property is orphaned, and validation reports the missing required property.
5. Delete the virtual device; assert the source device's history is intact.

Step 5 is the data-loss guard from Task 2 — assert the source's value still reads back after the virtual device is gone.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter ./apps/backend run test:e2e -- devices-virtual`
Expected: FAIL

- [ ] **Step 3: Fix whatever the E2E surfaces**

Do not weaken the test to make it pass.

- [ ] **Step 4: Run the full suite**

Run: `pnpm run test:unit && pnpm run test:e2e`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/devices-virtual.e2e-spec.ts
git commit -m "test(devices-virtual): cover the full lifecycle end to end"
```

---

### Task 15: Panel plugin registration

**Files:**
- Create: `apps/panel/lib/plugins/devices-virtual/constants.dart`
- Create: `apps/panel/lib/plugins/devices-virtual/models/{device,channel,property}.dart`
- Create: `apps/panel/lib/plugins/devices-virtual/mappers/mappers.dart`
- Create: `apps/panel/lib/plugins/devices-virtual/plugin.dart`
- Modify: the panel's plugin registry, beside the other `devices-*` entries

**Interfaces:**
- Consumes: the regenerated Dart API client from Task 13

Registration only — virtual devices render through the existing category-based detail pages because their category and channel structure match the spec.

- [ ] **Step 1: Rebuild the generated client**

Run: `melos rebuild-all`
Expected: `apps/panel/lib/api/` and `apps/panel/lib/spec/` include the virtual schemas

- [ ] **Step 2: Copy the third-party plugin structure**

Mirror `apps/panel/lib/plugins/devices-third-party/`, renaming `ThirdParty` → `Virtual`. `models/property.dart` gains `valueOrigin` and `sourceProperty`. Package imports only, `snake_case.dart` filenames.

- [ ] **Step 3: Register the plugin**

Add it beside the other `devices-*` plugins in the panel's registry.

- [ ] **Step 4: Analyze**

Run: `melos analyze`
Expected: no issues

- [ ] **Step 5: Commit**

```bash
git add apps/panel/lib
git commit -m "feat(panel): register the virtual devices plugin"
```

---

### Task 16: Update task docs and roadmap

The spec supersedes three planned task documents that still describe the rejected design.

**Files:**
- Modify: `tasks/epics/EPIC-VIRTUAL-DEVICES.md`
- Modify: `tasks/features/FEATURE-DEVICE-SPLITTER-PLUGIN.md`
- Modify: `tasks/features/FEATURE-DEVICE-COMPOSITE-PLUGIN.md`
- Modify: `tasks/ROADMAP.md`

- [ ] **Step 1: Mark the two feature tasks superseded**

Set `Status: superseded` in each header and add a note at the top pointing to `docs/superpowers/specs/2026-07-31-virtual-devices-design.md`, stating that the two plugins collapsed into one `devices-virtual`.

- [ ] **Step 2: Rewrite the epic's child task table**

Replace the two rows with a single `FEATURE-DEVICE-VIRTUAL-PLUGIN` row, and update "Key Architectural Decisions" — decision #2 (channel mapping, shared IDs) is rejected; record owned rows with dereferenced values instead.

- [ ] **Step 3: Update the roadmap**

In §8, replace the two planned rows with one, and correct the counts table — the `Virtual Devices` row currently reads `0 | 0 | 2 | 2`.

- [ ] **Step 4: Commit**

```bash
git add tasks/
git commit -m "docs(tasks): supersede split and composite plugin tasks"
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: value dereferencing → 1-3; `hidden` → 4-5; entities and plugin → 6; value source → 7; write path → 8; event path → 9-10; aggregation guard → 11; status → 12; creation validation and category boundary → 13; degradation → covered by the `SET NULL` FK (Task 4 migration) plus orphan handling in Tasks 7, 8, 12 and asserted in Task 14; panel → 15; supersession → 16.

**Not covered here, by design:** the admin wizard, `hidden` filtering in the admin pickers, and the device-list toggle. Those are Plan B, which depends on the API this plan produces.

**Type consistency.** `resolve()` returns `string | null` on `IPropertyValueSource` but `string` on the registry, which absorbs the fallback — deliberate, and the tests pin both. `VirtualValueOrigin.SOURCE`/`LOCAL` are used identically in Tasks 6, 7 and 8. `isProjected` is defined in Task 1 and consumed in Task 11. `findBySourceProperty` and `findVirtualDeviceIdsBySourceDevice` are defined in Task 9 and consumed in Tasks 10 and 12 under the same names.

**Verified against the codebase:** `DeviceCategory` contains all six blocked members. `ChannelsPropertiesService.findOne(id, channelId?, type?)` accepts the single-argument form used in Task 8. `DeviceConnectivityService.setConnectionState(deviceId, state)` is exported from `DevicesModule` and is the correct status entry point — Task 12 was corrected after finding that `DeviceConnectionStateService.write()` rejects any property whose category is not `STATUS`, and that the `DEVICE_CONNECTION_CHANGED` payload is `{ device, state, reason }` rather than a bare device.

**One consequence worth carrying into Task 13:** `setConnectionState` auto-creates the `device_information` channel and its `status` property, so Task 13's creation flow only needs to synthesize the three remaining owned properties — `manufacturer`, `model` and `serial_number`.
