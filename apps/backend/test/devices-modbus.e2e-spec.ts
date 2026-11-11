/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: supertest types HTTP response bodies as `any`; the bodies are narrowed to the local interfaces below, the
same pattern the other e2e specs in this directory use.
*/
import { useContainer } from 'class-validator';
import { ServerTCP } from 'modbus-serial';
import { createServer } from 'node:net';
import request from 'supertest';
import { v4 as uuid } from 'uuid';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelInputOccurrencePayload } from '../src/modules/devices/models/channel-input-occurrence.model';
import { ChannelInputOccurrencesService } from '../src/modules/devices/services/channel-input-occurrences.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { UserRole } from '../src/modules/users/users.constants';
import {
	DEVICES_MODBUS_TYPE,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../src/plugins/devices-modbus/devices-modbus.constants';

/** Poll interval of the simulated relay board; short so the suite stays fast. */
const POLL_INTERVAL_MS = 200;
const REQUEST_TIMEOUT_MS = 300;
const RELAYS = [1, 2, 3, 4, 5, 6, 7, 8];
/** Any live sample younger than this counts as current; the suite is far shorter. */
const LIVE_SAMPLE_MAX_AGE_MS = 60_000;

/** N4D8B08 command words: writing these to a relay register switches it (it reads back as 1 / 0). */
const RELAY_ON_COMMAND = 256;
const RELAY_OFF_COMMAND = 512;

interface PropertyBody {
	id: string;
	category: PropertyCategory;
	value: { value: string | number | boolean | null } | null;
}

interface ChannelBody {
	id: string;
	identifier: string;
	category: ChannelCategory;
	properties: PropertyBody[];
}

interface DeviceBody {
	id: string;
	type: string;
	status: { online: boolean; status: string };
	channels: ChannelBody[];
}

/** Picks a currently free loopback TCP port. `ServerTCP` treats port 0 as "use 502", so it cannot pick one itself. */
const freePort = (): Promise<number> =>
	new Promise((resolve, reject) => {
		const probe = createServer();

		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();

			probe.close(() => {
				if (address && typeof address === 'object') {
					resolve(address.port);
				} else {
					reject(new Error('Could not resolve a free port'));
				}
			});
		});
	});

/** Discrete input of the simulated board that the button device reads as its level. */
const BUTTON_INPUT = 0;

/**
 * Simulated Eletechsup N4D8B08 relay board on a Modbus TCP server: holding registers 1–8 read `1` (on) or `0` (off);
 * a write of `256` to register n switches relay n on, `512` switches it off. Every write is recorded. Discrete input
 * `BUTTON_INPUT` is a push button. The server answers every unit id, so a second device can use another unit.
 */
class RelayBoardSimulator {
	readonly registers = new Map<number, number>(RELAYS.map((relay) => [relay, 0]));
	readonly discreteInputs = new Map<number, boolean>([[BUTTON_INPUT, false]]);
	readonly writes: { address: number; value: number }[] = [];

	private server: ServerTCP | null = null;

	constructor(readonly port: number) {}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const server = new ServerTCP(
				{
					getDiscreteInput: (address: number): boolean => {
						const value = this.discreteInputs.get(address);

						if (value === undefined) {
							throw Object.assign(new Error('Illegal data address'), { modbusErrorCode: 0x02 });
						}

						return value;
					},
					getHoldingRegister: (address: number): number => this.read(address),
					getMultipleHoldingRegisters: (address: number, length: number): number[] =>
						Array.from({ length }, (_, index) => this.read(address + index)),
					setRegister: (address: number, value: number): void => {
						this.writes.push({ address, value });

						if (!this.registers.has(address)) {
							throw Object.assign(new Error('Illegal data address'), { modbusErrorCode: 0x02 });
						}

						if (value === RELAY_ON_COMMAND) {
							this.registers.set(address, 1);
						} else if (value === RELAY_OFF_COMMAND) {
							this.registers.set(address, 0);
						}
					},
				},
				// 255: answer every unit id.
				{ host: '127.0.0.1', port: this.port, unitID: 255 },
			);

			server.on('initialized', () => resolve());
			server.on('serverError', (error: Error | null) => reject(error ?? new Error('Modbus server failed')));
			// The runtime drops sockets on purpose (timeouts, restarts); a reset socket is not a test failure.
			server.on('socketError', () => undefined);

			this.server = server;
		});
	}

	stop(): Promise<void> {
		const server = this.server;

		this.server = null;

		if (!server) {
			return Promise.resolve();
		}

		return new Promise((resolve) => server.close(() => resolve()));
	}

	private read(address: number): number {
		const value = this.registers.get(address);

		if (value === undefined) {
			throw Object.assign(new Error('Illegal data address'), { modbusErrorCode: 0x02 });
		}

		return value;
	}
}

/** Polls `check` until it returns a defined value; fails with the last observation after `timeoutMs`. */
async function waitFor<T>(
	label: string,
	check: () => Promise<T | undefined>,
	timeoutMs: number,
	intervalMs = 50,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let lastError = 'none';

	for (;;) {
		try {
			const value = await check();

			if (value !== undefined) {
				return value;
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : JSON.stringify(error);
		}

		if (Date.now() >= deadline) {
			throw new Error(`waitFor: ${label} was not met within ${timeoutMs}ms (last error: ${lastError})`);
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

const relayChannel = (relay: number) => ({
	identifier: `relay_${relay}`,
	name: `Relay ${relay}`,
	category: ChannelCategory.SWITCHER,
	properties: [
		{
			category: PropertyCategory.ON,
			data_type: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			read: {
				register_type: ModbusRegisterType.HOLDING_REGISTER,
				address: relay,
				data_type: ModbusDataType.UINT16,
				value_map: [
					{ raw: 1, value: true },
					{ raw: 0, value: false },
				],
			},
			write: {
				register_type: ModbusRegisterType.HOLDING_REGISTER,
				address: relay,
				data_type: ModbusDataType.UINT16,
				value_map: [
					{ raw: RELAY_ON_COMMAND, value: true },
					{ raw: RELAY_OFF_COMMAND, value: false },
				],
				write_function: ModbusWriteFunction.SINGLE,
			},
		},
	],
});

describe('devices-modbus plugin (e2e)', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let accessToken: string;
	let simulator: RelayBoardSimulator;
	let endpointId: string;
	let device: DeviceBody;

	const authGet = (path: string) =>
		request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	const authPost = (path: string) =>
		request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);
	const authPatch = (path: string) =>
		request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${accessToken}`);
	const authPut = (path: string, token = accessToken) =>
		request(app.getHttpServer()).put(path).set('Authorization', `Bearer ${token}`);
	const authDelete = (path: string) =>
		request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${accessToken}`);

	const relayProperty = (relay: number): PropertyBody => {
		const channel = device.channels.find((candidate) => candidate.identifier === `relay_${relay}`);
		const property = channel?.properties.find((candidate) => candidate.category === PropertyCategory.ON);

		if (!channel || !property) {
			throw new Error(`Relay ${relay} has no on property`);
		}

		return property;
	};

	const relayChannelOf = (relay: number): ChannelBody => {
		const channel = device.channels.find((candidate) => candidate.identifier === `relay_${relay}`);

		if (!channel) {
			throw new Error(`Relay ${relay} channel is missing`);
		}

		return channel;
	};

	/**
	 * Reads the device in-process. Waiting loops use this instead of HTTP: the global throttler allows each client
	 * 30 requests per route handler per minute, which a polling loop would exhaust. Every waited-for state is then
	 * asserted once more through the HTTP API.
	 *
	 * `values` are the stored (last known) property values the API serves; `live` are the current live samples, which
	 * the core revokes when a provider reports a property invalid (`null`) — the stored value is kept as last known.
	 */
	const readDevice = async (): Promise<{
		state: ConnectionState;
		values: Map<string, unknown>;
		live: Map<string, unknown>;
	}> => {
		const entity = await moduleRef.get(DevicesService).getOneOrThrow(device.id);
		const propertyValues = moduleRef.get(PropertyValueService);
		const values = new Map<string, unknown>();
		const live = new Map<string, unknown>();

		for (const channel of entity.channels ?? []) {
			for (const property of channel.properties ?? []) {
				values.set(property.id, property.value?.value ?? null);
				live.set(property.id, propertyValues.readQualifiedSample(property, LIVE_SAMPLE_MAX_AGE_MS)?.value ?? null);
			}
		}

		return { state: entity.status.status, values, live };
	};

	const fetchDevice = async (): Promise<DeviceBody> => {
		const response = await authGet(`/modules/devices/devices/${device.id}`).expect(200);

		return (response.body as { data: DeviceBody }).data;
	};

	const httpValueOf = (body: DeviceBody, propertyId: string): unknown =>
		body.channels.flatMap((channel) => channel.properties).find((property) => property.id === propertyId)?.value
			?.value ?? null;

	beforeAll(async () => {
		simulator = new RelayBoardSimulator(await freePort());

		await simulator.start();

		moduleRef = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleRef.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(moduleRef, { fallbackOnErrors: true });

		await app.listen(0, '127.0.0.1');

		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'modbustest', password: 'securePassword123!', email: 'modbustest@example.com' } });

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'modbustest', password: 'securePassword123!' } });
		const token = (login.body as { data?: { access_token?: string } }).data?.access_token;

		if (!token) {
			throw new Error(`E2E setup failed: login returned ${login.status} — ${JSON.stringify(login.body)}`);
		}

		accessToken = token;
	}, 60_000);

	afterAll(async () => {
		await app?.close();
		await simulator?.stop();
	});

	it('creates an endpoint and a relay device over the API', async () => {
		const endpointResponse = await authPost('/plugins/devices-modbus/endpoints')
			.send({
				data: {
					name: 'Relay board gateway',
					host: '127.0.0.1',
					port: simulator.port,
					framing: ModbusFraming.TCP,
					connect_timeout_ms: 500,
					request_timeout_ms: REQUEST_TIMEOUT_MS,
				},
			})
			.expect(201);

		endpointId = (endpointResponse.body as { data: { id: string } }).data.id;

		expect(endpointId).toEqual(expect.any(String));

		const deviceResponse = await authPost('/plugins/devices-modbus/devices')
			.send({
				data: {
					name: 'N4D8B08',
					category: DeviceCategory.SWITCHER,
					endpoint_id: endpointId,
					unit_id: 1,
					poll_interval_ms: POLL_INTERVAL_MS,
					manufacturer: 'Eletechsup',
					model: 'N4D8B08',
					channels: RELAYS.map(relayChannel),
				},
			})
			.expect(201);

		device = (deviceResponse.body as { data: DeviceBody }).data;

		expect(device.type).toBe(DEVICES_MODBUS_TYPE);

		const switchers = device.channels.filter((channel) => channel.category === ChannelCategory.SWITCHER);

		expect(switchers).toHaveLength(8);
		// The plugin adds the device_information channel core requires.
		expect(device.channels).toHaveLength(9);
		expect(device.channels.map((channel) => channel.category)).toContain(ChannelCategory.DEVICE_INFORMATION);

		const bindings = await authGet(`/plugins/devices-modbus/devices/${device.id}/bindings`).expect(200);

		// One read and one write binding per relay.
		expect((bindings.body as { data: unknown[] }).data).toHaveLength(16);

		await waitFor(
			'device connected',
			async () => ((await readDevice()).state === ConnectionState.CONNECTED ? true : undefined),
			5000,
		);

		expect((await fetchDevice()).status.status).toBe(ConnectionState.CONNECTED);
	});

	it('refuses creating a Modbus device through the core devices route', async () => {
		const id = uuid();
		const refused = await authPost('/modules/devices/devices')
			.send({
				data: {
					id,
					type: DEVICES_MODBUS_TYPE,
					name: 'Bypass',
					category: DeviceCategory.SWITCHER,
					endpoint_id: uuid(),
					unit_id: 1,
				},
			})
			.expect(422);

		expect(JSON.stringify(refused.body)).toContain('/plugins/devices-modbus/devices');
		await authGet(`/modules/devices/devices/${id}`).expect(404);
	});

	it('polls relay state', async () => {
		const relay3 = relayProperty(3);

		// Wait for the initial poll so the change below is a change, not the first sample.
		await waitFor(
			'relay 3 reports off',
			async () => ((await readDevice()).values.get(relay3.id) === false ? true : undefined),
			2000,
		);

		simulator.registers.set(3, 1);

		const startedAt = Date.now();

		await waitFor(
			'relay 3 reports on',
			async () => ((await readDevice()).values.get(relay3.id) === true ? true : undefined),
			// Two poll intervals, plus slack for the sample write on a loaded test machine.
			2 * POLL_INTERVAL_MS + 1000,
			20,
		);

		expect(Date.now() - startedAt).toBeLessThanOrEqual(2 * POLL_INTERVAL_MS + 1000);
		expect(httpValueOf(await fetchDevice(), relay3.id)).toBe(true);
	});

	it('switches a relay from a property command', async () => {
		const relay5 = relayProperty(5);

		expect(simulator.registers.get(5)).toBe(0);

		const response = await authPost('/modules/devices/property-commands')
			.send({
				request_id: uuid(),
				properties: [{ device: device.id, channel: relayChannelOf(5).id, property: relay5.id, value: true }],
			})
			.expect(200);

		expect((response.body as { data: { success: boolean } }).data.success).toBe(true);
		expect(simulator.writes).toContainEqual({ address: 5, value: RELAY_ON_COMMAND });
		expect(simulator.registers.get(5)).toBe(1);

		// Read-back after the write reports the new state.
		await waitFor(
			'relay 5 reports on',
			async () => ((await readDevice()).values.get(relay5.id) === true ? true : undefined),
			2000,
		);

		expect(httpValueOf(await fetchDevice(), relay5.id)).toBe(true);
	});

	it('reports lost and recovers', async () => {
		const relayIds = RELAYS.map((relay) => relayProperty(relay).id);

		// Every relay has a live sample while the board answers.
		const before = await readDevice();

		for (const id of relayIds) {
			expect(before.live.get(id)).not.toBeNull();
		}

		await simulator.stop();

		const lost = await waitFor(
			'device lost',
			async () => {
				const snapshot = await readDevice();

				return snapshot.state === ConnectionState.LOST ? snapshot : undefined;
			},
			10_000,
		);

		// The relay properties were reported invalid (`null`): the core revoked every live sample. It keeps the stored
		// value as the last known one (null reports never overwrite it); `lost` is what marks it as not current.
		for (const id of relayIds) {
			expect(lost.live.get(id)).toBeNull();
			expect(lost.values.get(id)).toBe(before.values.get(id));
		}

		expect((await fetchDevice()).status.status).toBe(ConnectionState.LOST);

		// Same port: the endpoint keeps pointing at it.
		await simulator.start();

		const recovered = await waitFor(
			'device connected again with live relay values',
			async () => {
				const snapshot = await readDevice();

				return snapshot.state === ConnectionState.CONNECTED && relayIds.every((id) => snapshot.live.get(id) !== null)
					? snapshot
					: undefined;
			},
			// Reconnect backoff starts at ~1 s and grows (with jitter) while the server is down.
			20_000,
		);

		expect(recovered.live.get(relayProperty(3).id)).toBe(true);
		expect(recovered.live.get(relayProperty(5).id)).toBe(true);
		expect(recovered.live.get(relayProperty(1).id)).toBe(false);

		const recoveredBody = await fetchDevice();

		expect(recoveredBody.status.status).toBe(ConnectionState.CONNECTED);
		expect(httpValueOf(recoveredBody, relayProperty(3).id)).toBe(true);
	}, 40_000);

	it('applies and validates Modbus fields of a core device PATCH', async () => {
		const updated = await authPatch(`/modules/devices/devices/${device.id}`)
			.send({ data: { type: DEVICES_MODBUS_TYPE, max_read_registers: 100, template_revision: '1.0.0+abc123' } })
			.expect(200);

		expect((updated.body as { data: Record<string, unknown> }).data).toMatchObject({
			max_read_registers: 100,
			template_revision: '1.0.0+abc123',
		});

		const refused = await authPatch(`/modules/devices/devices/${device.id}`)
			.send({ data: { type: DEVICES_MODBUS_TYPE, endpoint_id: uuid() } })
			.expect(400);

		expect(JSON.stringify(refused.body)).toContain('endpoint_id');

		const nullUnit = await authPatch(`/modules/devices/devices/${device.id}`)
			.send({ data: { type: DEVICES_MODBUS_TYPE, unit_id: null } })
			.expect(400);

		expect(JSON.stringify(nullUnit.body)).toContain('unit_id');
		expect((await fetchDevice()) as unknown as Record<string, unknown>).toMatchObject({
			endpoint_id: endpointId,
			unit_id: 1,
		});
	});

	it('PUT structure updates bindings and keeps ids', async () => {
		// Relay 7 moves to register 8 and relay 8 is dropped; every other point is sent unchanged with its IDs.
		const keptRelays = RELAYS.filter((relay) => relay !== 8);
		const relay7Property = relayProperty(7).id;
		const relay8Channel = relayChannelOf(8).id;
		const information = device.channels.find((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);
		const channels = keptRelays.map((relay) => {
			const point = relayChannel(relay);
			const address = relay === 7 ? 8 : relay;

			return {
				...point,
				id: relayChannelOf(relay).id,
				properties: point.properties.map((property) => ({
					...property,
					id: relayProperty(relay).id,
					read: { ...property.read, address },
					write: { ...property.write, address },
				})),
			};
		});

		const response = await authPut(`/plugins/devices-modbus/devices/${device.id}/structure`)
			.send({ data: { category: DeviceCategory.SWITCHER, channels } })
			.expect(200);
		const updated = (response.body as { data: DeviceBody }).data;

		expect(updated.channels.map((channel) => channel.id).sort()).toEqual(
			[...keptRelays.map((relay) => relayChannelOf(relay).id), information?.id].sort(),
		);
		expect(updated.channels.some((channel) => channel.id === relay8Channel)).toBe(false);

		const bindings = await authGet(`/plugins/devices-modbus/devices/${device.id}/bindings`).expect(200);
		const rows = (bindings.body as { data: { property_id: string; address: number }[] }).data;

		expect(rows).toHaveLength(14);
		expect(rows.filter((row) => row.property_id === relay7Property).map((row) => row.address)).toEqual([8, 8]);

		device = updated;
	});

	it('PUT structure is refused for viewers', async () => {
		// Self-registration only ever creates the owner, so a USER account is created through the users route.
		await authPost('/modules/users/users')
			.send({
				data: {
					username: 'modbusviewer',
					password: 'securePassword123!',
					email: 'modbusviewer@example.com',
					role: UserRole.USER,
				},
			})
			.expect(201);

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'modbusviewer', password: 'securePassword123!' } });
		const viewerToken = (login.body as { data: { access_token: string } }).data.access_token;

		await authPut(`/plugins/devices-modbus/devices/${device.id}/structure`, viewerToken)
			.send({ data: { category: DeviceCategory.SWITCHER, channels: [relayChannel(1)] } })
			.expect(403);

		const bindings = await authGet(`/plugins/devices-modbus/devices/${device.id}/bindings`).expect(200);

		expect((bindings.body as { data: unknown[] }).data).toHaveLength(14);
	});

	it('button point emits events', async () => {
		const occurrences: ChannelInputOccurrencePayload[] = [];
		const unsubscribe = moduleRef
			.get(ChannelInputOccurrencesService)
			.subscribe((occurrence) => void occurrences.push(occurrence));
		let buttonDeviceId: string | null = null;

		try {
			const response = await authPost('/plugins/devices-modbus/devices')
				.send({
					data: {
						name: 'Push button',
						category: DeviceCategory.INPUT_CONTROLLER,
						endpoint_id: endpointId,
						unit_id: 2,
						poll_interval_ms: POLL_INTERVAL_MS,
						channels: [
							{
								identifier: 'button_1',
								name: 'Button 1',
								category: ChannelCategory.BUTTON,
								properties: [
									{
										category: PropertyCategory.EVENT,
										data_type: DataTypeType.ENUM,
										permissions: [PermissionType.EVENT_ONLY],
										format: ['press', 'long_press', 'double_press', 'triple_press', 'down', 'up'],
										read: {
											register_type: ModbusRegisterType.DISCRETE_INPUT,
											address: BUTTON_INPUT,
											data_type: ModbusDataType.BOOL,
											// The longest allowed: a loaded test machine never turns the short press into a long one.
											long_press_ms: 10_000,
										},
									},
								],
							},
						],
					},
				})
				.expect(201);
			const buttonDevice = (response.body as { data: DeviceBody }).data;

			buttonDeviceId = buttonDevice.id;
			const buttonChannel = buttonDevice.channels.find((channel) => channel.category === ChannelCategory.BUTTON);
			const eventProperty = buttonChannel?.properties.find((property) => property.category === PropertyCategory.EVENT);

			if (!buttonChannel || !eventProperty) {
				throw new Error('Button device has no button event property');
			}

			const status = async (): Promise<ConnectionState> =>
				(await moduleRef.get(DevicesService).getOneOrThrow(buttonDevice.id)).status.status;

			// Connected means the first poll ran: the released level is the baseline.
			await waitFor(
				'button device connected',
				async () => ((await status()) === ConnectionState.CONNECTED ? true : undefined),
				5000,
			);

			const events = (): string[] =>
				occurrences
					.filter((occurrence) => occurrence.propertyId === eventProperty.id)
					.map((occurrence) => occurrence.event);

			expect(events()).toEqual([]);

			simulator.discreteInputs.set(BUTTON_INPUT, true);

			await waitFor('down event', () => Promise.resolve(events().includes('down') ? true : undefined), 2000, 20);

			simulator.discreteInputs.set(BUTTON_INPUT, false);

			await waitFor('press event', () => Promise.resolve(events().includes('press') ? true : undefined), 2000, 20);

			expect(events()).toEqual(['down', 'up', 'press']);
			expect(occurrences.find((occurrence) => occurrence.event === 'down')).toMatchObject({
				deviceId: buttonDevice.id,
				channelId: buttonChannel.id,
				propertyId: eventProperty.id,
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				integration: DEVICES_MODBUS_TYPE,
				sourceOccurrenceId: expect.any(String) as string,
				sourceTimestamp: expect.any(String) as string,
			});
		} finally {
			unsubscribe();

			// Removed even when an assertion failed, so the endpoint test below still runs against one device.
			if (buttonDeviceId) {
				await authDelete(`/modules/devices/devices/${buttonDeviceId}`).expect(204);
			}
		}
	});

	it('refuses deleting the endpoint while the device exists', async () => {
		await authDelete(`/plugins/devices-modbus/endpoints/${endpointId}`).expect(400);

		await authDelete(`/modules/devices/devices/${device.id}`).expect(204);
		await authGet(`/modules/devices/devices/${device.id}`).expect(404);

		await authDelete(`/plugins/devices-modbus/endpoints/${endpointId}`).expect(204);
		await authGet(`/plugins/devices-modbus/endpoints/${endpointId}`).expect(404);
	});
});
