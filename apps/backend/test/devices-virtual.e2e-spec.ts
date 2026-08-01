/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The test setup involves dynamic assignment and interaction with HTTP response bodies typed
as `any` by supertest, which TypeScript cannot strictly type-check. These casts are necessary for
effective testing and mirror the pattern already used by the other e2e specs in this directory.
*/
import { useContainer } from 'class-validator';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../src/modules/devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../src/modules/devices/services/property-value-source.registry.service';
import { DEVICES_VIRTUAL_TYPE } from '../src/plugins/devices-virtual/devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';

interface PropertyValueBody {
	value: string | number | boolean | null;
	last_updated: string | null;
	trend: string | null;
}

interface ChannelPropertyBody {
	id: string;
	category: PropertyCategory;
	value: PropertyValueBody | null;
	value_origin?: string;
	source_property?: string | null;
}

interface ChannelBody {
	id: string;
	category: string;
	properties: ChannelPropertyBody[];
}

interface DeviceStatusBody {
	online: boolean;
	status: string;
	last_changed: string | null;
}

interface DeviceBody {
	id: string;
	type: string;
	category: string;
	hidden: boolean;
	status: DeviceStatusBody;
	channels: ChannelBody[];
}

interface ValidationIssueBody {
	type: string;
	severity: string;
	channel_id?: string;
	property_category?: string;
	message: string;
}

interface DeviceValidationBody {
	is_valid: boolean;
	issues: ValidationIssueBody[];
}

/**
 * Polls `fetchAndCheck` until it reports `done: true`, returning its `value`. Used wherever a write
 * is followed by a fire-and-forget side effect (command forwarding, event-driven aggregation) so the
 * assertion isn't racing an in-flight promise the HTTP response didn't wait for.
 *
 * `intervalMs` is deliberately not tighter than this. DisplayAwareThrottlerGuard applies
 * `{ ttl: 60000, limit: 30 }` to a user access token, and @nestjs/throttler keys that counter per
 * *route*, not globally — so several polls of the same endpoint share one budget of 30 requests for
 * the whole run. At a 100ms interval a single three-second poll spends that entire budget by itself,
 * and the next poll of that route comes back 429 for the rest of the minute: a failure that reads as
 * "the thing under test never happened" but is really "the test asked too often".
 */
async function waitUntil<T>(
	fetchAndCheck: () => Promise<{ done: boolean; value: T }>,
	label = 'condition',
	timeoutMs = 3000,
	intervalMs = 250,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const { done, value } = await fetchAndCheck();

		if (done) {
			return value;
		}

		// `label` and the last observed value are in the message because several calls in this file poll
		// different things with the same helper: without them a timeout says only that *something* never
		// settled, which is the least useful part of what this already knows.
		if (Date.now() >= deadline) {
			throw new Error(`waitUntil: ${label} was not met within ${timeoutMs}ms (last value: ${JSON.stringify(value)})`);
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

/**
 * Deletes a device, working around a known, external, timing-dependent 500.
 *
 * `DELETE /devices/:id` is the only call in this spec that opens `DataSource.transaction()`
 * (`DevicesService.remove`) — and the only e2e spec in this whole suite that ever calls it at all.
 * SQLite only allows one transaction at a time on the shared connection, and `Zigbee2mqttService`'s
 * own background reconnect loop (confirmed pre-existing and unrelated to devices-virtual by four
 * earlier tasks — see the "Known environment issue" note this task was briefed with) intermittently
 * leaves a transaction open without committing or rolling it back, which makes the next
 * `BEGIN TRANSACTION` fail with `SQLITE_ERROR: cannot start a transaction within a transaction`.
 * Confirmed directly by temporarily un-silencing the Nest Logger during debugging: the 500 traced
 * straight to `DevicesService.remove -> EntityManager.transaction -> SqliteQueryRunner.startTransaction`,
 * with `Zigbee2mqttService`'s reconnect/sync errors interleaved around it in the log.
 *
 * A plain "retry the DELETE on 500" is not safe here: TypeORM rolls back on a mid-transaction
 * failure, but observed behaviour across repeated runs was not always a clean "device still exists,
 * try again" — occasionally a later attempt came back 404 (device already gone) after an earlier
 * attempt had reported 500, which only makes sense if that earlier attempt's transaction actually
 * committed despite the collision. So after any non-204/404 response, this checks the device's
 * *actual* state via GET rather than trusting the DELETE response's status code, and only retries the
 * DELETE itself if the device demonstrably still exists. This works around the external flake without
 * weakening what the caller asserts afterward — either way, by the time this returns, the device is
 * confirmed gone by direct observation, not by assumption.
 */
async function ensureDeviceDeleted(
	authGetFn: (path: string) => request.Test,
	authDeleteFn: (path: string) => request.Test,
	deviceId: string,
	attempts = 6,
	delayMs = 250,
): Promise<void> {
	const devicePath = `/modules/devices/devices/${deviceId}`;

	for (let attempt = 0; attempt < attempts; attempt++) {
		const response = await authDeleteFn(devicePath);

		if (response.status === 204) {
			return;
		}

		const check = await authGetFn(devicePath);

		if (check.status === 404) {
			// Gone despite the non-204 response above — the delete's transaction committed before the
			// collision surfaced. Nothing left to do.
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	throw new Error(`Failed to delete device ${deviceId} after ${attempts} attempts (still present)`);
}

// Zigbee2mqttService's background reconnect loop (see ensureDeviceDeleted's comment above) can also
// just make arbitrary, unrelated requests slow rather than fail outright — observed directly as a
// property-creation call exceeding the default 5000ms test timeout during a run that otherwise took
// 3x longer than usual. Raising the timeout for this whole file is the proportionate fix for general
// slowness from an external, pre-existing interference source; ensureDeviceDeleted above additionally
// handles the sharper failure mode (a transaction collision that surfaces as a 500).
jest.setTimeout(20_000);

describe('devices-virtual plugin (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	let dataSource: DataSource;
	let valueSourceRegistry: PropertyValueSourceRegistryService;

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture = await Test.createTestingModule({
			imports: [dynamicAppModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize
		await new Promise((resolve) => setTimeout(resolve, 100));

		dataSource = moduleFixture.get<DataSource>(DataSource);
		valueSourceRegistry = moduleFixture.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);

		// Register and login to obtain an access token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
					email: 'virtualdevicestest@example.com',
				},
			});

		const loginResponse = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
				},
			});

		const loginBody = loginResponse.body as { data?: { access_token?: string } };

		if (!loginBody.data?.access_token) {
			throw new Error(
				`E2E setup failed: login returned status ${loginResponse.status} — ${JSON.stringify(loginResponse.body)}`,
			);
		}

		accessToken = loginBody.data.access_token;
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	// Helper to make authenticated requests
	function authGet(path: string) {
		return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authPost(path: string) {
		return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authPatch(path: string) {
		return request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authDelete(path: string) {
		return request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${accessToken}`);
	}

	// ─── Full lifecycle, against a real simulator device as the source ─────────────────

	describe('virtual device lifecycle', () => {
		let sourceDeviceId: string;
		let sourceChannelId: string;
		let sourceOnPropertyId: string;
		let sourceInUsePropertyId: string;

		let virtualDeviceId: string;
		let lightChannelId: string;
		let lightOnPropertyId: string;

		it('creates a simulator source device with an outlet channel (the relay)', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.IN_USE,
										identifier: 'in_use',
										name: 'In use',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			sourceDeviceId = body.data.id;
			sourceChannelId = body.data.channels[0].id;

			const sourceProperties = body.data.channels[0].properties;

			sourceOnPropertyId = sourceProperties.find((property) => property.category === PropertyCategory.ON)?.id ?? '';
			sourceInUsePropertyId =
				sourceProperties.find((property) => property.category === PropertyCategory.IN_USE)?.id ?? '';

			expect(sourceDeviceId).toBeTruthy();
			expect(sourceOnPropertyId).toBeTruthy();
			expect(sourceInUsePropertyId).toBeTruthy();
		});

		// ─── Step 1: virtual device + light channel + on property linked to the source ───

		it('creates a virtual device with category lighting', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Virtual Light',
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			virtualDeviceId = body.data.id;

			expect(body.data.type).toBe(DEVICES_VIRTUAL_TYPE);
			expect(body.data.category).toBe(DeviceCategory.LIGHTING);
		});

		// Regression test for every virtual device being permanently uncommandable. The `status`
		// property under device_information is synthesized by DeviceConnectivityService — generic module
		// code with no `value_origin` to give — so on a virtual device it took the SOURCE column default
		// with a null source: verbatim VirtualPropertyIndexService's definition of an ORPHAN. Once the
		// device had any linked property, the next source connection change made
		// VirtualStatusListener.aggregateState() return DISCONNECTED however healthy the real sources
		// were, and PropertyCommandService rejects every command against an offline device. The property
		// is owned by the virtual device and projected from nowhere, so it must be `local`.
		it('synthesizes the connection state property as owned, not as an orphaned projection', async () => {
			// VirtualDeviceInformationListener runs fire-and-forget off DEVICE_CREATED, so poll rather
			// than assume the synthesis finished before the POST above returned.
			const statusProperty = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: null };
				}

				const body = response.body as { data: DeviceBody };

				const informationChannel = body.data.channels.find(
					(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const property = informationChannel?.properties.find(
					(candidate) => candidate.category === PropertyCategory.STATUS,
				);

				return { done: property?.value_origin === 'local', value: property ?? null };
			}, 'the synthesized connection state property becoming local');

			expect(statusProperty?.value_origin).toBe('local');
			// Owned means owned outright: `local` with a lingering source_property would still be read
			// through the source registry.
			expect(statusProperty?.source_property).toBeNull();
		});

		it('adds a light channel to the virtual device', async () => {
			const response = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light-main',
						name: 'Main Light',
						device: virtualDeviceId,
					},
				})
				.expect(201);

			const body = response.body as { data: ChannelBody };

			lightChannelId = body.data.id;

			expect(body.data.category).toBe(ChannelCategory.LIGHT);
		});

		it("adds an on property linked to the simulator's relay on", async () => {
			const response = await authPost(`/modules/devices/channels/${lightChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: sourceOnPropertyId,
					},
				})
				.expect(201);

			const body = response.body as { data: ChannelPropertyBody };

			lightOnPropertyId = body.data.id;

			expect(body.data.source_property).toBe(sourceOnPropertyId);
			expect(body.data.value_origin).toBe('source');
		});

		// ─── Step 2: GET returns the value read from the source ──────────────────────────

		it('GET /devices/:id returns the virtual device with the value read from the source', async () => {
			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);

			const body = response.body as { data: DeviceBody };
			const channel = body.data.channels.find((candidate) => candidate.id === lightChannelId);
			const property = channel?.properties.find((candidate) => candidate.id === lightOnPropertyId);

			expect(property).toBeDefined();
			expect(property?.source_property).toBe(sourceOnPropertyId);
			// The source property was created with an initial value of `false` — this is the
			// dereferencing path (PropertyValueSourceRegistryService via the STI-hydrated entity)
			// actually resolving to the source's stored value, not the virtual property's own
			// (never-written) series.
			expect(property?.value?.value).toBe(false);
		});

		// ─── Step 3: commanding the virtual property changes the source ──────────────────

		it("commanding the virtual property changes the source property's value", async () => {
			// `type` is required on the update DTO too (UpdateVirtualChannelPropertyDto.type has no
			// @IsOptional — the same pattern every plugin's update DTO uses), so it must be sent even
			// though only `value` is actually changing.
			await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, value: true } })
				.expect(200);

			// The PATCH handler's command forward to the source device's own platform is
			// fire-and-forget, so poll rather than assume the write already landed the instant the
			// HTTP response returned.
			const sourceValue = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`);
				const body = response.body as { data: ChannelPropertyBody };

				return { done: body.data.value?.value === true, value: body.data.value?.value ?? null };
			}, 'the command reaching the source property');

			expect(sourceValue).toBe(true);

			// The virtual property reads the same, shared value back too.
			const virtualResponse = await authGet(
				`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`,
			).expect(200);
			const virtualBody = virtualResponse.body as { data: ChannelPropertyBody };

			expect(virtualBody.data.value?.value).toBe(true);
		});

		// ─── Additional coverage 3: the index is maintained at runtime, not just at boot ─

		it('lists the source device through the runtime-maintained index (runtime index maintenance)', async () => {
			// GET .../devices/:id/source-devices (VirtualDevicesService.findSourceDevices) reads
			// VirtualPropertyIndexService.findByVirtualDevice() — one of the three maps
			// VirtualIndexMaintenanceListener is responsible for keeping current after boot. The test
			// database is empty when the app boots, so onApplicationBootstrap()'s one-time rebuild()
			// indexed nothing; this virtual device and its linked property were both created after
			// that, over HTTP, in the tests above. The only way this lookup can find the source device
			// is if CHANNEL_PROPERTY_CREATED triggered a runtime rebuild() — before
			// VirtualIndexMaintenanceListener existed, nothing did, and this would silently return an
			// empty list instead of 404ing or erroring.
			const response = await authGet(`/plugins/devices-virtual/devices/${virtualDeviceId}/source-devices`).expect(200);
			const body = response.body as { data: DeviceBody[] };

			expect(body.data.map((device) => device.id)).toContain(sourceDeviceId);
		});

		// ─── Additional coverage 1: STI hydration through the BASE repository ────────────

		it('resolves a linked property loaded through the BASE ChannelPropertyEntity repository (STI hydration)', async () => {
			// The child (VirtualChannelPropertyEntity) repository would trivially prove nothing here —
			// TypeORM is guaranteed to hydrate correctly when you already tell it which subclass to
			// use. The whole point is that PropertyValueService reaches properties through the generic,
			// type-unaware base repository (ChannelsPropertiesService.findOne with no `type` argument),
			// so that is exactly what must be exercised here.
			const baseRepository = dataSource.getRepository(ChannelPropertyEntity);

			const reloaded = await baseRepository.findOne({ where: { id: lightOnPropertyId } });

			expect(reloaded).not.toBeNull();
			expect(reloaded).toBeInstanceOf(VirtualChannelPropertyEntity);

			// This is the registry call PropertyValueService.write/readLatest/delete makes internally.
			// If STI hydration had silently produced a base ChannelPropertyEntity instead, `instanceof
			// VirtualChannelPropertyEntity` would be false, VirtualValueSourceService.resolve() would
			// return null, and this would resolve to the property's own id instead of the source's.
			expect(valueSourceRegistry.resolve(reloaded)).toBe(sourceOnPropertyId);
		});

		// ─── The `hidden` flag on the replaced source device ────────────────────────────

		it('hides the source device the virtual device replaces, and keeps it hidden across later edits', async () => {
			// The design's "optionally hide the source device" (see the spec's DeviceEntity.hidden
			// section). Until `hidden` was exposed on the update DTO there was no way to set it at all,
			// so `?hidden=true` could only ever return an empty list.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: true } })
				.expect(200);

			const hiddenList = await authGet('/modules/devices/devices?hidden=true').expect(200);

			expect((hiddenList.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(sourceDeviceId);

			const visibleList = await authGet('/modules/devices/devices?hidden=false').expect(200);

			expect((visibleList.body as { data: DeviceBody[] }).data.map((device) => device.id)).not.toContain(
				sourceDeviceId,
			);

			// The half that a unit test cannot show end to end: an unrelated PATCH must not silently
			// un-hide it. DeviceEntity.hidden carries no class field initializer precisely so that
			// `omitBy(toInstance(...), isUndefined)` yields no `hidden` key for a patch that omits it.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, name: 'Renamed Source' } })
				.expect(200);

			const reloaded = await authGet(`/modules/devices/devices/${sourceDeviceId}`).expect(200);

			expect((reloaded.body as { data: DeviceBody }).data.hidden).toBe(true);

			// Unhide again so the remaining lifecycle steps see the source exactly as they did before.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: false } })
				.expect(200);
		});

		// ─── Owned properties stay owned across an unrelated PATCH ──────────────────────

		it('keeps a synthesized device_information property owned when it is renamed', async () => {
			// VirtualDeviceInformationListener synthesizes manufacturer / model / serial_number as
			// `local` (owned) properties. A PATCH that only renames one must not flip it to `source`:
			// that would make it a projection with no source — an orphan — and lose its stored value.
			// VirtualChannelPropertyEntity.valueOrigin carries no class field initializer for exactly
			// this reason.
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const informationChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
			);

			expect(informationChannel).toBeDefined();

			const manufacturer = informationChannel?.properties.find(
				(property) => property.category === PropertyCategory.MANUFACTURER,
			);

			expect(manufacturer?.value_origin).toBe('local');

			const patched = await authPatch(
				`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`,
			)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, name: 'Vendor' } })
				.expect(200);

			const patchedBody = patched.body as { data: ChannelPropertyBody };

			expect(patchedBody.data.value_origin).toBe('local');
			expect(patchedBody.data.value?.value).toBe('FastyBird');
		});

		// ─── Step 4: deleting the source orphans the (still-required) property ───────────

		it('orphans a required property instead of breaking the device when its source is deleted', async () => {
			// A second `light` channel instance (the light channel category allows `multiple`), linked
			// to a *different* source property than the one used above and below — so orphaning it here
			// cannot interfere with the data-loss guard assertion, which needs `sourceOnPropertyId` to
			// still exist and still hold the value written in step 3.
			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light-secondary',
						name: 'Secondary Light',
						device: virtualDeviceId,
					},
				})
				.expect(201);

			const secondaryChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const propertyResponse = await authPost(`/modules/devices/channels/${secondaryChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: sourceInUsePropertyId,
					},
				})
				.expect(201);

			const secondaryPropertyBody = propertyResponse.body as { data: ChannelPropertyBody };
			const secondaryPropertyId = secondaryPropertyBody.data.id;

			expect(secondaryPropertyBody.data.source_property).toBe(sourceInUsePropertyId);

			// Delete the source property directly (not through the virtual device).
			await authDelete(`/modules/devices/channels/${sourceChannelId}/properties/${sourceInUsePropertyId}`).expect(204);

			// The virtual device — and its property — survive. Graceful degradation, not breakage.
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };
			const secondaryChannel = deviceBody.data.channels.find((candidate) => candidate.id === secondaryChannelId);
			const secondaryProperty = secondaryChannel?.properties.find((candidate) => candidate.id === secondaryPropertyId);

			expect(secondaryProperty).toBeDefined();
			// The FK's ON DELETE SET NULL fired: the property still exists, but no longer points at a
			// source. It was NOT switched to a `local` value_origin — it stays a dangling `source`
			// projection until a client remaps it (VirtualChannelPropertyEntity.isOrphaned).
			expect(secondaryProperty?.source_property).toBeNull();
			expect(secondaryProperty?.value_origin).toBe('source');

			// DeviceValidationService.validateChannelProperties() is a generic, category-presence
			// check: it asks "does a property of category `on` exist on this channel", not "can this
			// property currently produce a value". An orphaned property still structurally exists, so
			// no MISSING_PROPERTY issue is raised for it — this is the actual, current behavior, not
			// the brief's original guess; see the task report for the full analysis of why the two
			// diverge and whether that's worth a follow-up.
			const validationResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}/validation`).expect(200);
			const validationBody = validationResponse.body as { data: DeviceValidationBody };

			const missingPropertyIssues = validationBody.data.issues.filter(
				(issue) => issue.type === 'missing_property' && issue.channel_id === secondaryChannelId,
			);

			expect(missingPropertyIssues).toEqual([]);

			// Regression test for a virtual device staying reported as connected with nothing behind it.
			// The orphan above invalidates the device's aggregated state — aggregateState() degrades on
			// any orphaned link — but no DEVICE_CONNECTION_CHANGED event was involved in a property
			// deletion, and VirtualStatusListener runs on nothing else. The structural rebuild that
			// recorded the orphan is now what triggers the recompute, which is the only signal that can
			// reach a device whose last source is gone: such a device has dropped out of the source-device
			// reverse index entirely, so no connection event can ever select it again.
			const status = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: null };
				}

				const body = response.body as { data: DeviceBody };

				return { done: body.data.status.online === false, value: body.data.status };
			}, 'the virtual device degrading to disconnected after its source property was deleted');

			expect(status.online).toBe(false);
			expect(status.status).toBe('disconnected');
		});

		// ─── Step 5 / additional coverage 2: the data-loss guard ─────────────────────────

		it('does not delete the source device history when the virtual device is deleted (data-loss guard)', async () => {
			// Confirm the source still reads the value written back in step 3, before touching anything.
			const before = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
			).expect(200);

			expect((before.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);

			await ensureDeviceDeleted(authGet, authDelete, virtualDeviceId);

			// The virtual device is gone.
			await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(404);

			// The source device is untouched, and its property's value — the source's entire history,
			// as far as this test can observe it — still reads back exactly as it did before the
			// virtual device (and its now-deleted projecting property) ever existed. If
			// PropertyValueService.delete() dereferenced instead of guarding, deleting the virtual
			// device would have deleted the virtual property, which would have deleted the *source's*
			// series out from under it.
			const sourceDeviceResponse = await authGet(`/modules/devices/devices/${sourceDeviceId}`).expect(200);

			expect((sourceDeviceResponse.body as { data: DeviceBody }).data.id).toBe(sourceDeviceId);

			const after = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
			).expect(200);

			expect((after.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);
		});
	});

	// ─── Additional coverage 4: creation-time guards ────────────────────────────────────

	describe('creation guards', () => {
		it('rejects creating a virtual device with a blocked category', async () => {
			const response = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.HEATING_UNIT,
					name: 'E2E Blocked Virtual Device',
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('closed-loop control');
		});

		it("rejects a source_property pointing at another virtual device's property", async () => {
			// An independent virtual device/channel/property, unrelated to the lifecycle flow above, to
			// serve as "another virtual device's property". An owned (local) property is enough — the
			// guard only cares that the target property's own device is of type virtual, not how that
			// property gets its value.
			const otherDeviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Nesting Guard Source Device',
					},
				})
				.expect(201);
			const otherDeviceId = (otherDeviceResponse.body as { data: DeviceBody }).data.id;

			const otherChannelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: otherDeviceId,
					},
				})
				.expect(201);
			const otherChannelId = (otherChannelResponse.body as { data: ChannelBody }).data.id;

			const otherPropertyResponse = await authPost(`/modules/devices/channels/${otherChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_ONLY],
						data_type: DataTypeType.BOOL,
						value_origin: 'local',
					},
				})
				.expect(201);
			const otherPropertyId = (otherPropertyResponse.body as { data: ChannelPropertyBody }).data.id;

			// A separate virtual device whose property will attempt to nest onto the one above.
			const targetDeviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Nesting Guard Target Device',
					},
				})
				.expect(201);
			const targetDeviceId = (targetDeviceResponse.body as { data: DeviceBody }).data.id;

			const targetChannelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: targetDeviceId,
					},
				})
				.expect(201);
			const targetChannelId = (targetChannelResponse.body as { data: ChannelBody }).data.id;

			const rejected = await authPost(`/modules/devices/channels/${targetChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.ON,
					identifier: 'on',
					name: 'On',
					permissions: [PermissionType.READ_WRITE],
					data_type: DataTypeType.BOOL,
					source_property: otherPropertyId,
				},
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('belongs to another virtual device');
		});
	});

	// ─── Deleting the last virtual device unhides the source it replaced ────────────────

	// Regression test for the spec's "Deleting the last virtual device referencing a hidden source
	// auto-unhides it". The DEVICE_DELETED handler discarded its payload and only rebuilt the index, so
	// a physical device hidden because a virtual device replaced it stayed hidden once that replacement
	// was gone: excluded from every picker, absent from the default device list, and — since `hidden` is
	// only reachable through a PATCH the admin no longer offers for a device it does not show — with no
	// route back through the UI.
	//
	// A self-contained device pair rather than the lifecycle flow's, so the hide/delete sequence here
	// cannot perturb what those steps observe.
	describe('unhiding an abandoned source device', () => {
		let ownSourceDeviceId: string;
		let ownSourcePropertyId: string;
		let ownVirtualDeviceId: string;

		it('unhides the source once the last virtual device referencing it is deleted', async () => {
			const sourceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Unhide Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const sourceBody = sourceResponse.body as { data: DeviceBody };

			ownSourceDeviceId = sourceBody.data.id;
			ownSourcePropertyId = sourceBody.data.channels[0].properties[0].id;

			const virtualResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Unhide Virtual Light',
					},
				})
				.expect(201);

			ownVirtualDeviceId = (virtualResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: ownVirtualDeviceId,
					},
				})
				.expect(201);

			const virtualChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			await authPost(`/modules/devices/channels/${virtualChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: ownSourcePropertyId,
					},
				})
				.expect(201);

			// The source is hidden because the virtual device now stands in for it.
			await authPatch(`/modules/devices/devices/${ownSourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: true } })
				.expect(200);

			// The link has to be in the index before the deletion, or there would be no record of which
			// source the deleted device referenced — that capture is the whole mechanism.
			await waitUntil(async () => {
				const response = await authGet(`/plugins/devices-virtual/devices/${ownVirtualDeviceId}/source-devices`);
				const body = response.body as { data?: DeviceBody[] };

				return { done: !!body.data?.some((device) => device.id === ownSourceDeviceId), value: body.data ?? null };
			}, 'the source device appearing in the virtual device index');

			await ensureDeviceDeleted(authGet, authDelete, ownVirtualDeviceId);

			// The unhide runs off the rebuild that follows the deletion, which is deferred past the
			// deleting transaction's commit — so poll rather than read once.
			const hidden = await waitUntil<boolean | string>(
				async () => {
					const response = await authGet(`/modules/devices/devices/${ownSourceDeviceId}`);

					// This poll runs immediately after the only call in this spec that opens a transaction, so
					// it is the one most exposed to the Zigbee2mqtt transaction collision documented on
					// ensureDeviceDeleted() — which surfaces here as a transient 500 on an unrelated read.
					// Treated as "not settled yet" rather than dereferenced blindly: a polling loop that throws
					// on one bad sample turns an external flake into a failure of the thing under test, while
					// retrying costs nothing and leaves the assertion below just as strict.
					if (response.status !== 200) {
						return { done: false, value: `HTTP ${response.status}: ${JSON.stringify(response.body)}` };
					}

					const body = response.body as { data: DeviceBody };

					return { done: body.data.hidden === false, value: body.data.hidden };
					// Slower and longer than the default: this poll shares its route budget (see waitUntil)
					// with two other polls in this file, and it waits on the longest chain of deferred work in
					// the plugin — a deletion, a rebuild deferred past that deletion's commit, and only then
					// the unhide.
				},
				'the abandoned source device being unhidden',
				6000,
				500,
			);

			expect(hidden).toBe(false);

			// Unhidden means genuinely back in the pickers, not merely a flipped column.
			const visibleList = await authGet('/modules/devices/devices?hidden=false').expect(200);

			expect((visibleList.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(ownSourceDeviceId);
		});
	});

	// ─── Auth enforcement ────────────────────────────────────────────────────────────────

	describe('authentication', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await request(app.getHttpServer()).get('/modules/devices/devices').expect(401);
		});
	});
});
