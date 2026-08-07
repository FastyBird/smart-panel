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
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	DeviceHiddenBy,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../src/modules/devices/entities/devices.entity';
import { DeviceConnectivityService } from '../src/modules/devices/services/device-connectivity.service';
import { PropertyValueSourceRegistryService } from '../src/modules/devices/services/property-value-source.registry.service';
import { DEVICES_VIRTUAL_TYPE } from '../src/plugins/devices-virtual/devices-virtual.constants';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
} from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualStatusListener } from '../src/plugins/devices-virtual/listeners/virtual-status.listener';
import { VirtualPropertyIndexService } from '../src/plugins/devices-virtual/services/virtual-property-index.service';
import { SimulatorDevicePlatform } from '../src/plugins/simulator/platforms/simulator-device.platform';
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
	enabled: boolean;
	hidden: boolean;
	hidden_by: string | null;
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
 * `{ ttl: 60000, limit: 30 }`, and @nestjs/throttler keys that counter per *client and route
 * handler* — the client being the address, which is loopback for every request this file makes. So
 * every poll of a given endpoint, in every test here, shares one budget of 30 requests, and the whole
 * file runs well inside a single 60-second window. At a 100ms interval a single three-second poll
 * spends that entire budget by itself, and every later request to that handler — from any test —
 * comes back 429 for the rest of the minute: a failure that reads as "the thing under test never
 * happened" but is really "the test asked too often", and which lands on whichever test happens to be
 * running rather than on the one that overspent.
 *
 * Prefer awaiting the in-process call a fire-and-forget handler would have made (see "reports the
 * source device connected") over polling for its effect, whenever the test can reach it. That costs
 * nothing from this budget and is deterministic besides.
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
 * Waits for VirtualPropertyIndexService's in-memory maps to catch up with a link that has already
 * been written.
 *
 * Read off the service in the test's own process rather than through an endpoint, because no
 * endpoint reports the maps any more and none should: `GET /devices/:id/source-devices` deliberately
 * resolves the wiring from the database on every call, so that a client which has just written sees
 * its own write (read-after-write). That makes it useless as a synchronisation point for the tests
 * below, which need the *index* to be current — the auto-unhide and the connection-state recompute
 * are both driven by rebuild() diffing the previous index against the new one, so a structural change
 * that lands before the index has caught up produces no transition and no recompute at all.
 *
 * Polled tightly and without HTTP: this touches no route, so it is outside the throttler budget
 * `waitUntil` has to respect, and the rebuild it waits on is a single query.
 */
async function waitForIndexedLink(
	index: VirtualPropertyIndexService,
	virtualDeviceId: string,
	timeoutMs = 5000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (index.findLinksByVirtualDevice(virtualDeviceId).length === 0) {
		if (Date.now() >= deadline) {
			throw new Error(`waitForIndexedLink: virtual device ${virtualDeviceId} had no indexed link after ${timeoutMs}ms`);
		}

		await new Promise((resolve) => setTimeout(resolve, 25));
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
	let moduleRef: TestingModule;
	let dataSource: DataSource;
	let valueSourceRegistry: PropertyValueSourceRegistryService;
	let virtualPropertyIndex: VirtualPropertyIndexService;

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

		moduleRef = moduleFixture;
		dataSource = moduleFixture.get<DataSource>(DataSource);
		valueSourceRegistry = moduleFixture.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);
		virtualPropertyIndex = moduleFixture.get<VirtualPropertyIndexService>(VirtualPropertyIndexService);

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
		let sourceSecondaryOnPropertyId: string;
		let sourceSecondaryChannelId: string;

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
							// A second relay on the same physical device — `outlet` is `multiple` for this
							// category. The orphaning test needs a source it can delete without disturbing
							// `sourceOnPropertyId`, and it has to be writable: the slot it feeds is `light.on`,
							// which requires a writable source, so the read-only `in_use` it used to borrow is
							// refused now that compatibility is enforced at persistence.
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet-secondary',
								name: 'Outlet 2',
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

			const body = response.body as { data: DeviceBody };

			sourceDeviceId = body.data.id;

			// ChannelBody carries no identifier, and both relays share the `outlet` category, so they are
			// told apart by content: only the first was given an `in_use` property.
			const outletChannels = body.data.channels.filter(
				(channel) => channel.category === String(ChannelCategory.OUTLET),
			);
			const primaryChannel = outletChannels.find((channel) =>
				channel.properties.some((property) => property.category === PropertyCategory.IN_USE),
			);
			const secondaryChannel = outletChannels.find(
				(channel) => !channel.properties.some((property) => property.category === PropertyCategory.IN_USE),
			);

			expect(primaryChannel).toBeDefined();
			expect(secondaryChannel).toBeDefined();

			sourceChannelId = primaryChannel.id;
			sourceSecondaryChannelId = secondaryChannel.id;

			const sourceProperties = primaryChannel.properties;

			sourceOnPropertyId = sourceProperties.find((property) => property.category === PropertyCategory.ON)?.id ?? '';
			sourceInUsePropertyId =
				sourceProperties.find((property) => property.category === PropertyCategory.IN_USE)?.id ?? '';
			sourceSecondaryOnPropertyId =
				secondaryChannel.properties.find((property) => property.category === PropertyCategory.ON)?.id ?? '';

			expect(sourceSecondaryOnPropertyId).toBeTruthy();

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

		// ─── The configuration-time write guard ─────────────────────────────────────────
		//
		// The mirror of the data-loss guard asserted at the end of this block. `value` is inherited from
		// the generic create DTO, and `ChannelsPropertiesService.create()` writes it through
		// `PropertyValueService`, which for a linked property resolves the storage key to the *source's*
		// id — so the number would be persisted as a real measurement of a device that was never
		// commanded and never reported it. Unlike the PATCH path there is no command dispatch behind a
		// POST at all, so the value could only ever have been that fabrication.
		//
		// Linked against `in_use` rather than the relay, so this test cannot disturb the value the
		// lifecycle steps around it assert on. A refused create persists nothing, so no property is
		// added to the virtual device either.
		it("refuses a value supplied when linking a property, leaving the source's series untouched", async () => {
			const before = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceInUsePropertyId}`,
			).expect(200);
			const beforeBody = (before.body as { data: ChannelPropertyBody }).data;

			expect(beforeBody.value?.value).toBe(false);

			const response = await authPost(`/modules/devices/channels/${lightChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.IN_USE,
					identifier: 'in_use',
					name: 'In use',
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.BOOL,
					source_property: sourceInUsePropertyId,
					value: true,
				},
			});

			expect(response.status).toBe(422);

			// The source's stored series — its latest value, and the timestamp that would have moved had
			// a point been written — is exactly what it was. This is the assertion that matters: a
			// rejection alone would not prove the write never reached the source.
			const after = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceInUsePropertyId}`,
			).expect(200);
			const afterBody = (after.body as { data: ChannelPropertyBody }).data;

			expect(afterBody.value?.value).toBe(false);
			expect(afterBody.value?.last_updated).toBe(beforeBody.value?.last_updated);

			// And nothing was half-created: the refused property is not on the channel.
			const channelProperties = await authGet(`/modules/devices/channels/${lightChannelId}/properties`).expect(200);

			expect(
				(channelProperties.body as { data: ChannelPropertyBody[] }).data.map((property) => property.category),
			).not.toContain(PropertyCategory.IN_USE);
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

		/**
		 * The state the whole command path below runs in, and a regression test for follow-up 2.12.
		 *
		 * The simulator plugin is disabled by default and so never reports a connection state, which
		 * makes this source exactly the common case: `DeviceConnectionStateService.readLatest()` answers
		 * `{online: false, status: UNKNOWN}` for it — as it does for *every* source on a fresh install,
		 * right after a restart, or whenever storage is unavailable.
		 *
		 * `aggregateState()` used to collapse that into DISCONNECTED, and PropertyCommandService refuses
		 * every command against a device that is definitively offline — so the virtual device rendered
		 * fine, showed plausible values read straight through from the source, and silently refused
		 * every command, while VirtualDevicePlatform (which applies the same UNKNOWN-is-commandable rule
		 * to the source) would have forwarded happily had it ever been asked. UNKNOWN now propagates
		 * instead, which is both what is true and what keeps the device commandable.
		 *
		 * The aggregation is awaited directly rather than polled over HTTP. `ThrottlerGuard` keys its
		 * `30 req / 60s` budget per client *and route handler*, and every request in this file comes from
		 * the same loopback address inside a single 60-second window — so a poll of `GET /devices/:id`
		 * spends a budget eight other tests here already share, and exhausting it 429s everything
		 * downstream rather than failing anything locally. `recompute()` is the exact call the
		 * fire-and-forget handlers make, so awaiting it is both cheaper and more deterministic.
		 */
		it('reports unknown, not disconnected, while its source has never reported a connection state', async () => {
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			// aggregateState() reads the index, so the link has to be in it before the recompute can see
			// the source at all. Polled off the service, without HTTP, exactly as elsewhere in this file.
			await waitForIndexedLink(virtualPropertyIndex, virtualDeviceId);

			await statusListener.recompute(virtualDeviceId, 'e2e: aggregating over a source that never reported');

			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.UNKNOWN);
			// UNKNOWN is not online — the point is precisely that `online: false` alone must stop meaning
			// "definitively offline", not that the device pretends to be up.
			expect(status.online).toBe(false);
		});

		it("commanding the virtual property changes the source property's value", async () => {
			// Proves the *forward* rather than only its outcome. The value assertion below is necessary
			// but was not sufficient on its own: it passed for the wrong reason for as long as
			// `ChannelsPropertiesService.update()` dereferenced a projected write into the source's own
			// series, which moved the source's value whether or not any command was ever dispatched.
			// Spying on the source device's own platform closes that gap directly — the simulator
			// platform is the last hop, reached only via PropertyCommandService -> VirtualDevicePlatform
			// -> PlatformRegistryService, so a call here cannot have come from anywhere else.
			const simulatorPlatform = moduleRef.get<SimulatorDevicePlatform>(SimulatorDevicePlatform, { strict: false });
			const forwarded = jest.spyOn(simulatorPlatform, 'processBatch');

			try {
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
					const response = await authGet(
						`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
					);
					const body = response.body as { data: ChannelPropertyBody };

					return { done: body.data.value?.value === true, value: body.data.value?.value ?? null };
				}, 'the command reaching the source property');

				expect(sourceValue).toBe(true);

				// The source's platform was asked to move the source's own property to the commanded
				// value — the device, channel and property in the forwarded batch are all the *source's*,
				// which is what "the command reached the source" means. Read off `mock.calls` and reduced
				// to plain ids rather than asserted with nested `expect.objectContaining`, which returns
				// `any` and would need the unsafe-assignment rule silenced to nest at all.
				const forwardedBatches = forwarded.mock.calls.map(([updates]) =>
					updates.map((update) => ({
						deviceId: update.device.id,
						channelId: update.channel.id,
						propertyId: update.property.id,
						value: update.value,
					})),
				);

				expect(forwardedBatches).toContainEqual([
					{
						deviceId: sourceDeviceId,
						channelId: sourceChannelId,
						propertyId: sourceOnPropertyId,
						value: true,
					},
				]);
			} finally {
				forwarded.mockRestore();
			}

			// The virtual property reads the same, shared value back too.
			const virtualResponse = await authGet(
				`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`,
			).expect(200);
			const virtualBody = virtualResponse.body as { data: ChannelPropertyBody };

			expect(virtualBody.data.value?.value).toBe(true);
		});

		/**
		 * The other end of the aggregation, so the UNKNOWN case above cannot pass by the rule simply
		 * never reporting CONNECTED: once the source's integration does report, the virtual device
		 * follows it up.
		 *
		 * Driven through DeviceConnectivityService rather than an endpoint because there is none — a
		 * device's connection state is written by its integration, not by the API. This models the
		 * integration. Awaited directly rather than polled for the same throttler-budget reason as above.
		 */
		it('reports connected once its source integration reports connected', async () => {
			const connectivity = moduleRef.get<DeviceConnectivityService>(DeviceConnectivityService);
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			await connectivity.setConnectionState(sourceDeviceId, {
				state: ConnectionState.CONNECTED,
				reason: 'e2e: standing in for the source integration',
			});

			await statusListener.recompute(virtualDeviceId, 'e2e: standing in for the source integration');

			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.CONNECTED);
			expect(status.online).toBe(true);
		});

		// ─── The same guard on the PATCH path, where the value is a real command ─────────
		//
		// A PATCH carrying a value is not refused the way a POST is: both property controllers dispatch
		// it to the device's platform straight afterwards, and for a virtual device that platform
		// forwards it to the source's — so the request is coherent and rejecting it would remove the
		// only way to command a virtual device over REST (the step above depends on it). What must not
		// happen is the *optimistic echo* landing in the source's series before, or instead of, the
		// hardware confirming anything.
		//
		// Disabling the virtual device is what makes that observable: VirtualDevicePlatform refuses to
		// forward for a disabled device, so nothing downstream can write the value, and any change to
		// the source's series could only have come from the echo.
		it("does not write a commanded value into the source's series when the command is refused", async () => {
			await authPatch(`/modules/devices/devices/${virtualDeviceId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, enabled: false } })
				.expect(200);

			try {
				// The relay is `true` from the step above; command the opposite, so an echo is impossible
				// to confuse with the value already there.
				await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
					.send({ data: { type: DEVICES_VIRTUAL_TYPE, value: false } })
					.expect(200);

				// The command forward is fire-and-forget, so give it comfortably longer than the refusal
				// takes before concluding the source was left alone.
				await new Promise((resolve) => setTimeout(resolve, 750));

				const source = await authGet(
					`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
				).expect(200);

				expect((source.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);
			} finally {
				await authPatch(`/modules/devices/devices/${virtualDeviceId}`)
					.send({ data: { type: DEVICES_VIRTUAL_TYPE, enabled: true } })
					.expect(200);
			}
		});

		// ─── Additional coverage 3: the source-device read resolves the live wiring ──────

		it('lists the source device behind a virtual device, resolved live from the wiring', async () => {
			// GET .../devices/:id/source-devices (VirtualDevicesService.findSourceDevices) walks
			// property -> sourceProperty -> channel -> device in the database on every call
			// (VirtualPropertyIndexService.loadLinksByVirtualDevice), then loads each distinct source
			// device by id so the caller gets a current connection status rather than a cached one.
			//
			// It deliberately does *not* read the in-memory index maps. Those only catch up once
			// VirtualIndexMaintenanceListener's fire-and-forget rebuild has run, and no mutation
			// response waits for it — so a client that had just linked, remapped or unlinked a property
			// could be handed the wiring from before its own write. The maps stay for the two consumers
			// that genuinely need an O(1), no-I/O answer on system-wide per-event traffic (the
			// projection and connection-status listeners); this is a once-per-request read of a single
			// device, where a query is the cheaper mistake to make.
			//
			// This whole chain was created over HTTP in the tests above, after a boot whose one-time
			// hydration ran against an empty database — so the relations resolved here are the ones
			// those requests wrote.
			const response = await authGet(`/plugins/devices-virtual/devices/${virtualDeviceId}/source-devices`).expect(200);
			const body = response.body as { data: DeviceBody[] };

			expect(body.data.map((device) => device.id)).toContain(sourceDeviceId);
		});

		// Regression test for the same route accepting any device that merely exists. The simulator
		// device below is a real, ordinary physical device with no linked virtual properties of its own,
		// so an existence-only check let it through to a 200 with `data: []` — the identical response a
		// genuine virtual device assembled purely from owned properties gives, which made "this device
		// draws from nothing" and "you asked the wrong kind of question" indistinguishable to a client.
		// 422 rather than 404 because the device demonstrably exists; see the controller for the
		// codebase precedent that split follows.
		it('rejects a non-virtual device on the source-devices route instead of reporting no sources', async () => {
			await authGet(`/plugins/devices-virtual/devices/${sourceDeviceId}/source-devices`).expect(422);
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

		// ─── A partial PATCH cannot merge into `local` + a source ───────────────────────
		//
		// The one (value_origin, source_property) pair VirtualChannelPropertyEntity's state model has
		// no state for. `ValidateOwnedPropertyHasNoSource` on the DTO rejects it when both halves are
		// in one payload, but a PATCH carrying only one half validates perfectly on its own and only
		// becomes that pair once ChannelsPropertiesService.update() merges it into the stored row —
		// producing a property that neither mirrors (VirtualValueSourceService resolves an owned
		// property to its own key) nor forwards (it is not in the index, so VirtualDevicePlatform
		// refuses the write). Both directions are checked, and each asserts the row is *unchanged*
		// rather than merely that the request failed.

		it('rejects switching a linked property to local without dropping its source', async () => {
			await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, value_origin: 'local' } })
				.expect(422);

			const response = await authGet(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`);
			const body = response.body as { data: ChannelPropertyBody };

			expect(body.data.value_origin).toBe('source');
			expect(body.data.source_property).toBe(sourceOnPropertyId);
		});

		it('rejects giving an owned property a source without dropping its local origin', async () => {
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const informationChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
			);
			const manufacturer = informationChannel?.properties.find(
				(property) => property.category === PropertyCategory.MANUFACTURER,
			);

			expect(manufacturer?.value_origin).toBe('local');

			await authPatch(`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, source_property: sourceOnPropertyId } })
				.expect(422);

			const response = await authGet(
				`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`,
			);
			const body = response.body as { data: ChannelPropertyBody };

			expect(body.data.value_origin).toBe('local');
			expect(body.data.source_property).toBeNull();
			// The stored value survives too: had the source landed, the property would have started
			// reading the relay's series instead of its own synthesized one.
			expect(body.data.value?.value).toBe('FastyBird');
		});

		it('still rejects both halves in one payload, at the DTO layer', async () => {
			const rejected = await authPatch(
				`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`,
			).send({
				data: { type: DEVICES_VIRTUAL_TYPE, value_origin: 'local', source_property: sourceOnPropertyId },
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('an owned property stores its own value');
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
						source_property: sourceSecondaryOnPropertyId,
					},
				})
				.expect(201);

			const secondaryPropertyBody = propertyResponse.body as { data: ChannelPropertyBody };
			const secondaryPropertyId = secondaryPropertyBody.data.id;

			expect(secondaryPropertyBody.data.source_property).toBe(sourceSecondaryOnPropertyId);

			// Delete the source property directly (not through the virtual device).
			await authDelete(
				`/modules/devices/channels/${sourceSecondaryChannelId}/properties/${sourceSecondaryOnPropertyId}`,
			).expect(204);

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

		// A virtual device's channels and properties are derived from its category, and a device PATCH
		// writes no property, so no property-level guard ever sees a recategorisation. The admin does not
		// offer the field; an API client can still send it.
		it('rejects recategorising a populated device to a category its structure does not satisfy', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Recategorisation Guard Device',
					},
				})
				.expect(201);
			const deviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: deviceId,
					},
				})
				.expect(201);
			const channelId = (channelResponse.body as { data: ChannelBody }).data.id;

			await authPost(`/modules/devices/channels/${channelId}/properties`)
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

			const response = await authPatch(`/modules/devices/devices/${deviceId}`).send({
				data: { type: DEVICES_VIRTUAL_TYPE, category: DeviceCategory.DOOR },
			});

			expect(response.status).toBe(422);
			expect(JSON.stringify(response.body)).toContain('cannot change category');

			// Refused before the write, so the stored category is untouched.
			const readBack = await authGet(`/modules/devices/devices/${deviceId}`).expect(200);

			expect((readBack.body as { data: DeviceBody }).data.category).toBe(DeviceCategory.LIGHTING);
		});

		// Every other PATCH keeps working: the guard only runs when the category actually moves, so a
		// device whose structure would fail today's specification can still be renamed.
		it('allows an unrelated PATCH on a populated device', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Rename Device',
					},
				})
				.expect(201);
			const deviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: deviceId,
					},
				})
				.expect(201);

			await authPatch(`/modules/devices/devices/${deviceId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, name: 'E2E Renamed Device' } })
				.expect(200);

			// Read back rather than trusting the response envelope, so this pins what was stored.
			const readBack = await authGet(`/modules/devices/devices/${deviceId}`).expect(200);

			expect((readBack.body as { data: DeviceBody & { name: string } }).data.name).toBe('E2E Renamed Device');
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

	// ─── Atomic creation: device, channel and linked property in one POST ───────────────

	// Regression test for the whole nested-creation shape being rejected outright. `@Type` metadata is
	// inherited, so CreateVirtualDeviceDto.channels built its children as the generic
	// CreateDeviceChannelDto / CreateDeviceChannelPropertyDto — neither of which declares
	// `source_property` or `value_origin` — and both the controller and DevicesService validate with
	// `whitelist: true` + `forbidNonWhitelisted: true`. So the request came back 400 "property
	// source_property should not exist" before ChannelsPropertiesTypeMapperService could pick the
	// virtual DTO for the insert, and the only way to build a virtual device was the three-request
	// sequence the lifecycle block above uses.
	//
	// This is also the shape the plugin's ordering work exists to serve: nested properties emit
	// CHANNEL_PROPERTY_CREATED *before* the device's own DEVICE_CREATED, which is what
	// VirtualDeviceInformationListener's `afterCreate` ownership claim and its aggregated-and-serialized
	// initial status were written for. Until this fix that path was unreachable for a linked property,
	// so those guards had never actually been exercised end to end by anything.
	describe('creating a virtual device with its wiring nested in one request', () => {
		let atomicSourceDeviceId: string;
		let atomicSourcePropertyId: string;
		let atomicReadOnlySourcePropertyId: string;
		let atomicVirtualDeviceId: string;

		it('creates the source device it will draw from', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Atomic Source Outlet',
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
										value: true,
									},
									// A read-only sibling on the same channel, so the compatibility test below can
									// project something the spec slot genuinely refuses without needing a second
									// device. `outlet.in_use` is `ro` in the spec and `light.on` requires a
									// writable source, so the pair is incompatible on permissions alone.
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.IN_USE,
										identifier: 'in_use',
										name: 'In use',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.BOOL,
										value: true,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			atomicSourceDeviceId = body.data.id;

			// Selected by category, not by index: the response's property order is not the request's, and
			// picking positionally here silently swapped the writable source for the read-only one.
			const sourceProperties = body.data.channels[0].properties;

			const writableSource = sourceProperties.find((property) => property.category === PropertyCategory.ON);
			const readOnlySource = sourceProperties.find((property) => property.category === PropertyCategory.IN_USE);

			expect(writableSource).toBeDefined();
			expect(readOnlySource).toBeDefined();

			atomicSourcePropertyId = writableSource.id;
			atomicReadOnlySourcePropertyId = readOnlySource.id;

			expect(atomicSourcePropertyId).toBeTruthy();
			expect(atomicReadOnlySourcePropertyId).toBeTruthy();
			expect(atomicSourcePropertyId).not.toBe(atomicReadOnlySourcePropertyId);
		});

		it('accepts the device, its channel and its linked property in a single POST', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Atomic Virtual Light',
						channels: [
							{
								type: DEVICES_VIRTUAL_TYPE,
								category: ChannelCategory.LIGHT,
								identifier: 'light',
								name: 'Light',
								properties: [
									{
										type: DEVICES_VIRTUAL_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										source_property: atomicSourcePropertyId,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			atomicVirtualDeviceId = body.data.id;

			const lightChannel = body.data.channels.find((channel) => channel.category === String(ChannelCategory.LIGHT));
			const onProperty = lightChannel?.properties.find((property) => property.category === PropertyCategory.ON);

			// The nested property was created as a *virtual* property, with the wiring the request asked
			// for — not as a generic one with the two virtual fields quietly dropped.
			expect(onProperty?.source_property).toBe(atomicSourcePropertyId);
			expect(onProperty?.value_origin).toBe('source');
			// And it projects: the source was created holding `true`, and this reads through to it rather
			// than to the virtual property's own (never-written) series.
			expect(onProperty?.value?.value).toBe(true);
		});

		// The device_information synthesis has to survive being raced by the nested property's own
		// CHANNEL_PROPERTY_CREATED, which on this path is emitted *before* DEVICE_CREATED — so
		// DeviceConnectivityService's find-or-create for that same channel, driven by the rebuild's
		// recompute, is genuinely in flight while VirtualDeviceInformationListener runs its own. That
		// collision used to leave roughly one run in four with no device_information channel at all; see
		// ensureDeviceInformationChannel()'s docstring.
		//
		// Polled through `/devices/:id/channels` rather than `/devices/:id`: the throttler budgets 30
		// requests per 60s per route across the whole run (see waitUntil), and `/devices/:id` is the
		// busiest route in this file. On a timeout the poll reports what it *did* see rather than a bare
		// `null`, because "the channel never appeared" and "the channel appeared without the property"
		// are different failures with different causes.
		it('still synthesizes the connection state property as owned', async () => {
			const observed = await waitUntil<{ property: ChannelPropertyBody | null; seenChannels: string[] }>(async () => {
				const response = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}/channels`);

				if (response.status !== 200) {
					return { done: false, value: { property: null, seenChannels: [`HTTP ${response.status}`] } };
				}

				const channels = (response.body as { data: ChannelBody[] }).data;

				const informationChannel = channels.find(
					(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const property =
					informationChannel?.properties.find((candidate) => candidate.category === PropertyCategory.STATUS) ?? null;

				return {
					done: !!property,
					value: { property, seenChannels: channels.map((channel) => channel.category) },
				};
			}, 'the synthesized connection state property on an atomically created device');

			// Owned, not an orphaned projection — the `afterCreate` claim doing its job on the one path
			// that can actually race it.
			expect(observed.property?.value_origin).toBe('local');
			expect(observed.property?.source_property).toBeNull();
		});

		// The initial status write is what the serialized recompute exists to protect: on this path a
		// rebuild-driven recompute (which sees the link) and the DEVICE_CREATED synthesis (which may not
		// yet) genuinely overlap, and whichever landed second used to win regardless of which had read
		// the fresher index. Whatever the interleaving, the settled answer must be the one the wiring
		// implies — UNKNOWN here, since this source has never reported a connection state.
		it('settles on the state its wiring implies, not on whichever write landed last', async () => {
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			await waitForIndexedLink(virtualPropertyIndex, atomicVirtualDeviceId);

			await statusListener.recompute(atomicVirtualDeviceId, 'e2e: settling the atomically created device');

			const response = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.UNKNOWN);
		});

		// The wiring is real, not merely recorded on the row: the source-devices endpoint resolves it
		// from the database and names the device the nested property was linked to.
		it('resolves the source device behind the atomically created wiring', async () => {
			const response = await authGet(`/plugins/devices-virtual/devices/${atomicVirtualDeviceId}/source-devices`).expect(
				200,
			);

			expect((response.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(atomicSourceDeviceId);
		});

		// The plugin's own constraints still reach three levels down — retyping the nested DTOs widened
		// the schema to the virtual fields, it did not switch validation off for them.
		it('rejects a nested owned property that also names a source', async () => {
			const rejected = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.LIGHTING,
					name: 'E2E Atomic Invalid Virtual Light',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'light',
							name: 'Light',
							properties: [
								{
									type: DEVICES_VIRTUAL_TYPE,
									category: PropertyCategory.ON,
									identifier: 'on',
									name: 'On',
									permissions: [PermissionType.READ_WRITE],
									data_type: DataTypeType.BOOL,
									value_origin: 'local',
									source_property: atomicSourcePropertyId,
								},
							],
						},
					],
				},
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('an owned property stores its own value');
		});

		// The wizard previews compatibility before it writes, but the preview is not atomic with the
		// write and a direct POST like this one never makes it at all. Without enforcement at
		// persistence, a read-only source lands on a writable slot and only fails much later, when a
		// command is forwarded to a source that cannot accept it.
		it('rejects a nested property projecting a read-only source onto a writable slot', async () => {
			const rejected = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.LIGHTING,
					name: 'E2E Atomic Incompatible Virtual Light',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'light',
							name: 'Light',
							properties: [
								{
									type: DEVICES_VIRTUAL_TYPE,
									category: PropertyCategory.ON,
									identifier: 'on',
									name: 'On',
									permissions: [PermissionType.READ_WRITE],
									data_type: DataTypeType.BOOL,
									value_origin: 'source',
									source_property: atomicReadOnlySourcePropertyId,
								},
							],
						},
					],
				},
			});

			// Refused at persistence, so nothing is written. The nested device-create path reports its own
			// generic envelope rather than the guard's reason — the same shape every other nested failure
			// gets here — so the status is what this pins; the reason itself is covered by the service's
			// own unit tests.
			expect(rejected.status).toBe(422);

			// Not just "the response carried no device": the parent device row is saved before its channels
			// are built, so a rejection here has to roll it back or the client sees a failure while the
			// database keeps a half-built device, and a retry adds a second one.
			//
			// Asked of the rejected device by name rather than by comparing totals before and after. The app
			// under test is live — the simulator plugin discovers devices of its own on a timer — so a
			// total is only stable if nothing else happens to create one inside this window, which is a
			// race rather than an invariant, and it broke as soon as two tests were added ahead of this
			// one. The name states exactly what the rollback is being held to, and costs one request
			// instead of two.
			const after = await authGet('/modules/devices/devices?hidden=all').expect(200);
			const afterDevices = (after.body as { data: (DeviceBody & { name: string })[] }).data;

			expect(afterDevices.filter((entry) => entry.name === 'E2E Atomic Incompatible Virtual Light')).toHaveLength(0);
		});

		// The remap path, which is the one the preview covers least well: the wizard checked this pairing
		// before it wrote, and a source's permissions can change afterwards. The update hook has to judge
		// the merged row, not the payload — the PATCH here carries only `source_property`.
		it('rejects remapping a linked property onto a read-only source', async () => {
			const deviceResponse = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const lightChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.LIGHT),
			);
			const onProperty = lightChannel?.properties.find((property) => property.category === PropertyCategory.ON);

			expect(lightChannel).toBeDefined();
			expect(onProperty?.id).toBeTruthy();

			await authPatch(`/modules/devices/channels/${lightChannel.id}/properties/${onProperty.id}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, source_property: atomicReadOnlySourcePropertyId } })
				.expect(422);

			// The stored link is untouched — a refused remap must not half-apply.
			const after = await authGet(`/modules/devices/channels/${lightChannel.id}/properties/${onProperty.id}`).expect(
				200,
			);

			expect((after.body as { data: ChannelPropertyBody }).data.source_property).toBe(atomicSourcePropertyId);
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
	// ─── A connection-state property deleted by hand comes back owned ────────────────────

	// Regression test for follow-up 2.7. VirtualDeviceInformationListener synthesizes the
	// connection-state property as owned, but only on DEVICE_CREATED. The property is deletable
	// through DELETE /channels/:id/properties/:id, and the next setConnectionState recreated it
	// through the generic DeviceConnectivityService find-or-create — module code with no
	// `value_origin` to give, so it came back with the SOURCE column default and a null source: an
	// orphan. Nothing re-ran the synthesis, VirtualStatusListener.aggregateState() returns
	// DISCONNECTED for any device with an orphaned property however healthy its real sources are, and
	// PropertyCommandService refuses every command against an offline device. The device was
	// permanently offline and uncommandable, exactly as before the original fix.
	//
	// Fixed by claiming the property inside ChannelsPropertiesService.create() itself, through the
	// plugin's afterCreate mapping hook — so the recreation comes back owned whoever performed it,
	// with no deletion event to subscribe to and no special case on a generic endpoint.
	describe('recreating a manually deleted connection state property', () => {
		it('brings it back owned, and leaves the device online', async () => {
			const sourceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Resynthesis Source Outlet',
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

			const resynthSourcePropertyId = (sourceResponse.body as { data: DeviceBody }).data.channels[0].properties[0].id;

			const virtualResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Resynthesis Virtual Light',
					},
				})
				.expect(201);

			const resynthVirtualDeviceId = (virtualResponse.body as { data: DeviceBody }).data.id;

			// Synthesis is fire-and-forget off DEVICE_CREATED, so poll for it rather than assume the POST
			// above waited for it. Polled through `/devices/:id/channels` rather than `/devices/:id`
			// because the throttler budgets 30 requests per 60s *per route* across the whole run (see
			// waitUntil), and `/devices/:id` is already the busiest route in this file — this one is
			// otherwise unused, and carries the channel's properties just the same.
			const synthesized = await waitUntil<{ channelId: string; statusPropertyId: string }>(async () => {
				const response = await authGet(`/modules/devices/devices/${resynthVirtualDeviceId}/channels`);

				if (response.status !== 200) {
					return { done: false, value: { channelId: '', statusPropertyId: '' } };
				}

				const channel = (response.body as { data: ChannelBody[] }).data.find(
					(candidate) => candidate.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const status = channel?.properties.find((property) => property.category === PropertyCategory.STATUS);

				return {
					done: !!status,
					value: { channelId: channel?.id ?? '', statusPropertyId: status?.id ?? '' },
				};
			}, 'the synthesized device_information channel and its connection state property');

			const propertiesPath = `/modules/devices/channels/${synthesized.channelId}/properties`;

			expect(synthesized.statusPropertyId).toBeTruthy();

			// A linked property, so that deleting it later re-wires the virtual device and makes the
			// index rebuild recompute its connection state — which is what drives setConnectionState
			// into recreating the property this test deletes.
			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: resynthVirtualDeviceId,
					},
				})
				.expect(201);

			const resynthLightChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const linkedResponse = await authPost(`/modules/devices/channels/${resynthLightChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: resynthSourcePropertyId,
					},
				})
				.expect(201);

			const linkedPropertyId = (linkedResponse.body as { data: ChannelPropertyBody }).data.id;

			// Read immediately, with no polling — findSourceDevices() resolves the wiring from the
			// database on every call, so the link the POST above just created is visible to the very
			// next request. This is a read-after-write assertion in its own right: answering it from the
			// in-memory index instead, as it once did, would return an empty list here.
			const linkedSources = await authGet(
				`/plugins/devices-virtual/devices/${resynthVirtualDeviceId}/source-devices`,
			).expect(200);

			expect((linkedSources.body as { data: DeviceBody[] }).data).not.toHaveLength(0);

			// Separately, the *index* has to hold the link before the deletion below, or removing it is
			// not a transition and no recompute follows. That is a different fact from the one just
			// asserted, and since the endpoint above stopped reporting the index it needs its own wait.
			await waitForIndexedLink(virtualPropertyIndex, resynthVirtualDeviceId);

			// The deletion the finding is about. Reachable by any admin through the public API.
			await authDelete(`${propertiesPath}/${synthesized.statusPropertyId}`).expect(204);

			// Removing the only link re-wires the virtual device, which makes the rebuild recompute its
			// state, which calls setConnectionState — the path that recreates the property just deleted.
			await authDelete(`/modules/devices/channels/${resynthLightChannelId}/properties/${linkedPropertyId}`).expect(204);

			const recreated = await waitUntil<ChannelPropertyBody | null>(
				async () => {
					const response = await authGet(propertiesPath);

					if (response.status !== 200) {
						return { done: false, value: null };
					}

					const property =
						(response.body as { data: ChannelPropertyBody[] }).data.find(
							(candidate) => candidate.category === PropertyCategory.STATUS,
						) ?? null;

					// `local` is the assertion; the value confirms the device did not simply come back
					// offline, which is the harm the orphan actually caused.
					return { done: property?.value_origin === 'local' && !!property.value?.value, value: property };
				},
				'the connection state property being recreated as owned',
				6000,
				500,
			);

			expect(recreated?.value_origin).toBe('local');
			// Owned means owned outright — `local` with a lingering source would still be read through
			// the source registry.
			expect(recreated?.source_property).toBeNull();
			// No links left at all, so the aggregate is vacuously connected. An orphaned status property
			// would have forced `disconnected` here instead, permanently.
			expect(recreated?.value?.value).toBe('connected');
		});
	});

	describe('unhiding an abandoned source device', () => {
		let ownSourceDeviceId: string;
		let ownSourcePropertyId: string;
		let ownVirtualDeviceId: string;

		it('unhides the source once the last virtual device referencing it is deleted, without re-enabling it', async () => {
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

			// The source is hidden because the virtual device now stands in for it, and disabled because
			// the user does not want it polled either. The auto-unhide must give back exactly the one
			// flag it took: `DevicesService.update()` builds the mapped entity class from the DTO before
			// saving, and DeviceEntity.enabled carries a `= true` class field initializer that
			// class-transformer cannot drop, so a patch of `{hidden: false}` alone silently re-enables a
			// device the user had explicitly disabled (follow-up 3.1, whose root fix is blocked on
			// devices-shelly-v1's afterInsert subscriber).
			//
			// `hidden_by: system` is the provenance the admin's own hide carries, and it is load-bearing
			// twice over. The auto-unhide only reverses a hide the *system* performed — an operator's own
			// hide of a device a virtual device happened to reference is theirs to keep — so without it
			// nothing below would fire at all. And it is what the unhide then has to clear, which is the
			// one part of an unhide UpdateDeviceDto cannot express (its `@Transform` reads an explicit
			// `null` as "field not provided") and therefore the one part no mocked test can prove against
			// the real schema.
			await authPatch(`/modules/devices/devices/${ownSourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: true, enabled: false, hidden_by: DeviceHiddenBy.SYSTEM } })
				.expect(200);

			// Read immediately, with no polling — the same read-after-write assertion as in the
			// re-synthesis test above, here also confirming the endpoint names the right source device.
			const ownSources = await authGet(`/plugins/devices-virtual/devices/${ownVirtualDeviceId}/source-devices`).expect(
				200,
			);

			expect((ownSources.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(ownSourceDeviceId);

			// And the index has to hold the link before the deletion, or there would be no record of
			// which source the deleted device referenced — that capture is the whole mechanism.
			await waitForIndexedLink(virtualPropertyIndex, ownVirtualDeviceId);

			await ensureDeviceDeleted(authGet, authDelete, ownVirtualDeviceId);

			// The unhide runs off the rebuild that follows the deletion, which is deferred past the
			// deleting transaction's commit — so poll rather than read once.
			const unhidden = await waitUntil<DeviceBody | string>(
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

					// Both halves of the unhide, because they are two writes: DevicesService.update() clears
					// `hidden`, and a targeted column update clears `hidden_by` immediately after it. Polling
					// on `hidden` alone would sample the row in between and read a stale provenance.
					return { done: body.data.hidden === false && body.data.hidden_by === null, value: body.data };
					// Slower and longer than the default: this poll shares its route budget (see waitUntil)
					// with two other polls in this file, and it waits on the longest chain of deferred work in
					// the plugin — a deletion, a rebuild deferred past that deletion's commit, and only then
					// the unhide.
				},
				'the abandoned source device being unhidden and its provenance cleared',
				6000,
				500,
			);

			expect(typeof unhidden === 'string' ? unhidden : unhidden.hidden).toBe(false);
			// The unhide gives back the flag it took and nothing else — a device the user disabled stays
			// disabled.
			expect(typeof unhidden === 'string' ? unhidden : unhidden.enabled).toBe(false);
			// And the row is left clean: a device that is no longer hidden must not keep claiming who hid
			// it. This write cannot go through the update DTO at all, so this is the only place it is
			// exercised against the real STI schema.
			expect(typeof unhidden === 'string' ? unhidden : unhidden.hidden_by).toBeNull();

			// Unhidden means genuinely back in the pickers, not merely a flipped column.
			const visibleList = await authGet('/modules/devices/devices?hidden=false').expect(200);

			expect((visibleList.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(ownSourceDeviceId);
		});
	});

	// ─── Containment: nothing virtual ever hangs off a device that is not virtual ────────

	/**
	 * The virtual layer is strictly additive: it may not degrade a device that is not part of it.
	 *
	 * `type` is chosen from the request payload, so the generic property route happily built a
	 * VirtualChannelPropertyEntity inside an ordinary physical channel, and nothing downstream
	 * re-checked the owner. VirtualPropertyIndexService resolves a virtual property's owning device
	 * from its own channel relation and files it under `byVirtualDevice` — so the *physical* device
	 * became, to the index, a virtual device. From there VirtualStatusListener would overwrite that
	 * device's real connectivity with the projection aggregate (a source-less property indexes as an
	 * orphan, which aggregates to DISCONNECTED), and PropertyCommandService refuses every command
	 * against an offline device: a real device's own commands start failing, caused entirely by a
	 * plugin it was never enrolled in.
	 *
	 * The same shape exists one level up — `POST /channels` takes `device` from the payload too, so a
	 * virtual channel could be hung off a physical device and then filled with virtual properties.
	 *
	 * The assertion at the end of this block is the property itself, read straight from the database
	 * rather than inferred from status codes: *no* virtual row, of either kind, is reachable from a
	 * non-virtual device. Status codes alone would only say that the request shapes tried here are
	 * refused; this says the state cannot exist.
	 */
	describe('containment: no virtual row attaches to a non-virtual device', () => {
		let physicalDeviceId: string;
		let physicalChannelId: string;

		const strayProperty = {
			type: DEVICES_VIRTUAL_TYPE,
			category: PropertyCategory.ON,
			name: 'Stray On',
			permissions: [PermissionType.READ_ONLY],
			data_type: DataTypeType.BOOL,
		};

		it('creates the physical device the attachments will be attempted against', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Containment Physical Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			physicalDeviceId = body.data.id;
			physicalChannelId =
				body.data.channels.find((channel) => channel.category === String(ChannelCategory.OUTLET))?.id ?? '';

			expect(physicalChannelId).toBeTruthy();
		});

		it('refuses a virtual property posted into a physical channel (channel-scoped route)', async () => {
			const response = await authPost(`/modules/devices/channels/${physicalChannelId}/properties`).send({
				data: { ...strayProperty, identifier: 'stray_channel_scoped' },
			});

			expect(response.status).toBe(422);
		});

		it('refuses a virtual property posted into a physical channel (device-scoped route)', async () => {
			const response = await authPost(
				`/modules/devices/devices/${physicalDeviceId}/channels/${physicalChannelId}/properties`,
			).send({
				data: { ...strayProperty, identifier: 'stray_device_scoped' },
			});

			expect(response.status).toBe(422);
		});

		// One level up: the channel route takes `device` from the payload, so this is the same gap with
		// one more hop in it. Rejected at the DTO layer, hence 400 rather than 422 — the offending value
		// is a field of the request, so the error can name it.
		it('refuses a virtual channel hung off a physical device', async () => {
			const response = await authPost('/modules/devices/channels').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: ChannelCategory.LIGHT,
					identifier: 'stray_light',
					name: 'Stray Light',
					device: physicalDeviceId,
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('virtual device');
		});

		// The nested shape, which re-validates each channel through ChannelsService.create() rather than
		// through the device DTO — so a guard placed only on the standalone route would miss it.
		it('refuses a virtual channel nested into a physical device create', async () => {
			const response = await authPost('/modules/devices/devices').send({
				data: {
					type: SIMULATOR_TYPE,
					category: DeviceCategory.OUTLET,
					name: 'E2E Containment Nested Stray',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'stray_nested_light',
							name: 'Stray Nested Light',
						},
					],
				},
			});

			expect(response.status).toBe(422);
		});

		// The update path, which on this branch has repeatedly reached states a create-time check
		// missed. Here it cannot, and for a structural reason rather than a guard: neither update DTO
		// declares the parent link at all — UpdateChannelDto has no `device` and UpdateChannelPropertyDto
		// has no `channel` — and both controllers validate with `forbidNonWhitelisted`, so an attempt to
		// re-parent is rejected as an unknown field rather than silently ignored. These two assertions
		// are what would notice if either field were ever added without a matching guard.
		it('offers no way to re-parent a virtual channel or property onto a physical device', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Containment Reparent Target',
					},
				})
				.expect(201);
			const reparentDeviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: reparentDeviceId,
					},
				})
				.expect(201);
			const reparentChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const propertyResponse = await authPost(`/modules/devices/channels/${reparentChannelId}/properties`)
				.send({
					data: { ...strayProperty, identifier: 'reparent_on' },
				})
				.expect(201);
			const reparentPropertyId = (propertyResponse.body as { data: ChannelPropertyBody }).data.id;

			const movedChannel = await authPatch(`/modules/devices/channels/${reparentChannelId}`).send({
				data: { type: DEVICES_VIRTUAL_TYPE, device: physicalDeviceId },
			});

			expect(movedChannel.status).toBe(400);

			const movedProperty = await authPatch(
				`/modules/devices/channels/${reparentChannelId}/properties/${reparentPropertyId}`,
			).send({
				data: { type: DEVICES_VIRTUAL_TYPE, channel: physicalChannelId },
			});

			expect(movedProperty.status).toBe(400);
		});

		// The property this block is actually about: not "those requests were refused" but "the state
		// they were reaching for does not exist anywhere in the database".
		//
		// A relation that came back unloaded (a bare id string) counts as a stray rather than a pass:
		// this assertion is only worth anything if it can actually see the owner, so "could not tell"
		// has to fail loudly instead of quietly reporting containment.
		it('leaves no virtual channel or property reachable from a non-virtual device', async () => {
			const ownerIsVirtual = (channel: ChannelEntity | string): boolean =>
				typeof channel !== 'string' &&
				typeof channel.device !== 'string' &&
				channel.device.type === DEVICES_VIRTUAL_TYPE;

			const strayProperties = (
				await dataSource.getRepository(VirtualChannelPropertyEntity).find({ relations: ['channel', 'channel.device'] })
			).filter((property) => !ownerIsVirtual(property.channel));

			expect(strayProperties.map((property) => property.id)).toEqual([]);

			const strayChannels = (
				await dataSource.getRepository(VirtualChannelEntity).find({ relations: ['device'] })
			).filter((channel) => typeof channel.device === 'string' || channel.device.type !== DEVICES_VIRTUAL_TYPE);

			expect(strayChannels.map((channel) => channel.id)).toEqual([]);
		});
	});

	// ─── v1 has no write semantics for an owned property ─────────────────────────────────

	/**
	 * An owned property (`value_origin: local`) stores its own value and forwards nothing.
	 * VirtualDevicePlatform.processBatch() therefore refuses every one of them outright — "owned
	 * properties are read-only in this release". The API used to accept writable permissions on one
	 * anyway, producing a control that can never work.
	 *
	 * It is worse than inert. `ChannelsPropertiesService.update()` writes the optimistic value into the
	 * property's own series *before* the controller dispatches the command, and the dispatch is
	 * fire-and-forget — so the switch visibly moves, the refusal lands in a log nobody is reading, and
	 * nothing at all happens in the house.
	 *
	 * The scope decision here is deliberate and recorded (TECH-VIRTUAL-DEVICES-FOLLOWUPS, controller
	 * support): v1 is wiring only, and the only owned properties that exist are the synthesized,
	 * read-only device_information strings. So this restricts rather than implements — writable owned
	 * properties come back with the release that can actually act on them.
	 */
	describe('an owned property cannot be writable while v1 has no write semantics', () => {
		let ownedDeviceId: string;
		let ownedChannelId: string;
		let ownedPropertyId: string;
		let orphanPropertyId: string;

		it('creates a virtual device with a channel to hold the owned properties', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Owned Writable Guard Device',
					},
				})
				.expect(201);

			ownedDeviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: ownedDeviceId,
					},
				})
				.expect(201);

			ownedChannelId = (channelResponse.body as { data: ChannelBody }).data.id;
		});

		// The exact payload the P2 report names: a switcher's `on` as an owned control.
		it('refuses creating an owned property with writable permissions', async () => {
			const response = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.ON,
					identifier: 'owned_on',
					name: 'On',
					permissions: [PermissionType.READ_WRITE],
					data_type: DataTypeType.BOOL,
					value_origin: 'local',
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('read-only');
		});

		it('accepts the same owned property when it is read-only', async () => {
			const response = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'owned_on',
						name: 'On',
						permissions: [PermissionType.READ_ONLY],
						data_type: DataTypeType.BOOL,
						value_origin: 'local',
					},
				})
				.expect(201);

			const body = (response.body as { data: ChannelPropertyBody }).data;

			ownedPropertyId = body.id;

			expect(body.value_origin).toBe('local');
		});

		// The PATCH that reaches the same state the create-time check refuses. Judged on the merged row,
		// since the payload carries only one half of the pair.
		it('refuses making an existing owned property writable by PATCH', async () => {
			const response = await authPatch(
				`/modules/devices/channels/${ownedChannelId}/properties/${ownedPropertyId}`,
			).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					permissions: [PermissionType.READ_WRITE],
				},
			});

			expect(response.status).toBe(422);

			const readBack = await authGet(
				`/modules/devices/channels/${ownedChannelId}/properties/${ownedPropertyId}`,
			).expect(200);

			expect((readBack.body as { data: { permissions: string[] } }).data.permissions).toEqual([
				PermissionType.READ_ONLY,
			]);
		});

		// The other half of the same merged-row hole, approached from the opposite side: a *writable
		// orphan* is legal (it is a projection waiting to be remapped), and switching its origin to local
		// would land on exactly the state the create-time check refuses.
		it('refuses switching a writable orphan to local', async () => {
			const orphanResponse = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.BRIGHTNESS,
						identifier: 'orphan_brightness',
						name: 'Brightness',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.UCHAR,
					},
				})
				.expect(201);

			orphanPropertyId = (orphanResponse.body as { data: ChannelPropertyBody }).data.id;

			const response = await authPatch(
				`/modules/devices/channels/${ownedChannelId}/properties/${orphanPropertyId}`,
			).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					value_origin: 'local',
				},
			});

			expect(response.status).toBe(422);
		});

		// The guard must not block this plugin's own listeners. Every synthesized device_information
		// field is owned *and* read-only, so all four have to survive validation that the plugin's own
		// creation path performs on itself — a guard that rejected them would leave the device with no
		// connection state at all, which is a permanently offline device.
		it('still synthesizes all four owned device_information properties, owned and read-only', async () => {
			const informationProperties = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${ownedDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: [] as ChannelPropertyBody[] };
				}

				const properties =
					(response.body as { data: DeviceBody }).data.channels.find(
						(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
					)?.properties ?? [];

				return { done: properties.length >= 4, value: properties };
			}, 'the four synthesized device_information properties appearing');

			expect(informationProperties.map((property) => property.category).sort()).toEqual(
				[
					PropertyCategory.MANUFACTURER,
					PropertyCategory.MODEL,
					PropertyCategory.SERIAL_NUMBER,
					PropertyCategory.STATUS,
				].sort(),
			);

			for (const property of informationProperties) {
				expect(property.value_origin).toBe('local');
				expect((property as unknown as { permissions: string[] }).permissions).toEqual([PermissionType.READ_ONLY]);
			}
		});
	});

	// ─── Auth enforcement ────────────────────────────────────────────────────────────────

	describe('authentication', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await request(app.getHttpServer()).get('/modules/devices/devices').expect(401);
		});
	});
});
