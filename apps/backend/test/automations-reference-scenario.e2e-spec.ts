/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { AutomationRunRecordStatus } from '../src/modules/automations/automations.constants';
import { DELAY_NODE_TYPE } from '../src/modules/automations/nodes/delay.node-type';
import { DEVICE_PROPERTY_CHANGED_NODE_TYPE } from '../src/modules/automations/nodes/device-property-changed.node-type';
import { DEVICE_PROPERTY_COMPARE_NODE_TYPE } from '../src/modules/automations/nodes/device-property-compare.node-type';
import { DEVICE_PROPERTY_SET_NODE_TYPE } from '../src/modules/automations/nodes/device-property-set.node-type';
import { TIME_WINDOW_NODE_TYPE } from '../src/modules/automations/nodes/time-window.node-type';
import {
	AUTOMATION_ENGINE_CLOCK,
	AutomationEngineService,
} from '../src/modules/automations/services/automation-engine.service';
import { AutomationRunHistoryService } from '../src/modules/automations/services/automation-run-history.service';
import {
	AUTOMATION_TRACKER_CLOCK,
	AutomationStateTrackerService,
} from '../src/modules/automations/services/state-tracker.service';
import {
	AUTOMATION_WALL_CLOCK,
	AutomationTimeSourceService,
} from '../src/modules/automations/services/time-source.service';
import { FakeTrackerClock } from '../src/modules/automations/testing/fake-tracker-clock';
import { FakeWallClock } from '../src/modules/automations/testing/fake-wall-clock';
import { localTimeAt } from '../src/modules/automations/time/house-time';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';

/**
 * The reference scenario of the automations design (docs/superpowers/specs/2026-11-10-automations-design.md,
 * § Goal), drawn with the cards the module provides and run against simulator devices:
 *
 *   occupancy becomes detected → illuminance < 50 lx → time is 22:00–06:00 → light on at 20 %
 *                                                                        └ no → light on at 100 %
 *   occupancy becomes clear → Delay 2 min → occupancy still clear → light off
 *
 * The re-check after the Delay is what the design asks of a Delay before a state-changing action (§ Runs): the
 * sensor may have changed, or dropped offline, while the run waited.
 *
 * Time is not waited for. The engine runs its Delays on a fake monotonic clock and the time window reads a
 * fake wall clock; both are bound through the injection tokens the module leaves unbound in the application.
 */

interface PropertyBody {
	id: string;
	category: string;
}

interface ChannelBody {
	id: string;
	category: string;
	properties: PropertyBody[];
}

interface DeviceBody {
	id: string;
	channels: ChannelBody[];
}

interface Target {
	device_id: string;
	channel_id: string;
	property_id: string;
}

interface AutomationBody {
	id: string;
	mode: string;
	enabled: boolean;
	status: string;
	revision: number;
	graph: unknown;
}

const engineClock = new FakeTrackerClock();
const trackerClock = new FakeTrackerClock();
const wallClock = FakeWallClock.at('2026-11-12T12:00:00Z');

/** Binds the clocks for every module of the application, the way a test binds them for one service */
@Global()
@Module({
	providers: [
		{ provide: AUTOMATION_ENGINE_CLOCK, useValue: engineClock },
		{ provide: AUTOMATION_TRACKER_CLOCK, useValue: trackerClock },
		{ provide: AUTOMATION_WALL_CLOCK, useValue: wallClock },
	],
	exports: [AUTOMATION_ENGINE_CLOCK, AUTOMATION_TRACKER_CLOCK, AUTOMATION_WALL_CLOCK],
})
class FakeAutomationClocksModule {}

const DELAY_SECONDS = 120;

describe('Automations reference scenario (e2e)', () => {
	let app: INestApplication;
	let ownerToken: string;

	let engine: AutomationEngineService;
	let stateTracker: AutomationStateTrackerService;
	let timeSource: AutomationTimeSourceService;
	let propertiesService: ChannelsPropertiesService;
	let propertyValueService: PropertyValueService;

	let occupancy: Target;
	let illuminance: Target;
	let lightOn: Target;
	let lightBrightness: Target;

	let automationId: string;

	const base = '/modules/automations/automations';

	const createDevice = async (data: Record<string, unknown>): Promise<DeviceBody> => {
		const response = await request(app.getHttpServer())
			.post('/modules/devices/devices')
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { type: SIMULATOR_TYPE, ...data } })
			.expect(201);

		return (response.body as { data: DeviceBody }).data;
	};

	const targetOf = (device: DeviceBody, channelCategory: string, propertyCategory: string): Target => {
		const channel = device.channels.find((item) => item.category === channelCategory);
		const property = channel?.properties.find((item) => item.category === propertyCategory);

		if (!channel || !property) {
			throw new Error(`The device has no ${channelCategory}.${propertyCategory} property`);
		}

		return { device_id: device.id, channel_id: channel.id, property_id: property.id };
	};

	/** What a device would report: the value is stored and announced on the bus, as the simulator does it */
	const report = async (target: Target, value: string | number | boolean): Promise<void> => {
		await propertiesService.update(target.property_id, { type: SIMULATOR_TYPE, value });
	};

	const valueOf = async (target: Target): Promise<unknown> => {
		const property = await propertiesService.findOne(target.property_id);

		return property ? ((await propertyValueService.readLatest(property))?.value ?? null) : null;
	};

	const light = async (): Promise<{ on: unknown; brightness: unknown }> => ({
		on: await valueOf(lightOn),
		brightness: await valueOf(lightBrightness),
	});

	/** Polls the backend itself on real time: the command paths and the bus are asynchronous */
	const waitFor = async <T>(read: () => Promise<T> | T, done: (value: T) => boolean, what: string): Promise<T> => {
		const deadline = Date.now() + 10_000;

		for (;;) {
			const value = await read();

			if (done(value)) return value;

			if (Date.now() > deadline) {
				throw new Error(`Timed out waiting for ${what}; last seen ${JSON.stringify(value)}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	};

	/** The engine has followed every save, every baseline is read and every run is recorded */
	const settled = async (): Promise<void> => {
		await engine.settled();
		await stateTracker.settled();
		await engine.settled();
	};

	const started = (): number => engine.runtime(automationId)?.triggers.started ?? 0;

	/** Waits until the automation has started `count` runs in all and none of them is active */
	const runsFinished = async (count: number): Promise<void> => {
		await waitFor(
			() => engine.runtime(automationId),
			(state) => (state?.triggers.started ?? 0) >= count && state?.activeRuns === 0,
			`run ${count} of the automation to finish`,
		);
		await settled();
	};

	/** Waits until the run started by the room becoming clear is parked on its Delay, and on nothing else */
	const parkedOnDelay = async (count: number): Promise<void> => {
		await waitFor(
			() => ({ state: engine.runtime(automationId), timers: engineClock.pending() }),
			({ state, timers }) => (state?.triggers.started ?? 0) >= count && state?.activeRuns === 1 && timers === 1,
			`run ${count} to wait on the Delay`,
		);
		await settled();
	};

	/** Sets the wall clock to a local time of the house on the day of the test */
	const runHistory = (): AutomationRunHistoryService => app.get(AutomationRunHistoryService, { strict: false });

	/** The trace of the newest run of the automation */
	const lastTrace = async () => {
		const [newest] = await runHistory().findAllForAutomation(automationId);

		return (await runHistory().findOne(newest.id))?.trace;
	};

	/** Tells the backend the sensor is reachable or not, as the simulator plugin does on request */
	const setSensorConnection = async (state: ConnectionState): Promise<void> => {
		await request(app.getHttpServer())
			.post(`/plugins/simulator/simulator/${occupancy.device_id}/simulate-connection`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { state } })
			.expect(201);
	};

	const setHouseTime = (hours: number, minutes: number): void => {
		const reading = timeSource.houseNow();

		if (reading.status !== 'ok') {
			throw new Error(`The house time is not known: ${reading.reason}`);
		}

		const wanted = hours * 60 + minutes;
		const noon = Date.parse('2026-11-12T12:00:00Z');

		// The house timezone is whatever the configuration says; walk a day in minutes to find the instant
		for (let minute = -720; minute < 720; minute++) {
			const instant = noon + minute * 60_000;

			if (localTimeAt(instant, reading.timezone).minutes === wanted) {
				wallClock.setTo(new Date(instant).toISOString());

				return;
			}
		}

		throw new Error(`No instant of the day has the house time ${hours}:${minutes}`);
	};

	const referenceGraph = () => ({
		version: 1,
		nodes: [
			{
				id: 'occupied',
				type: DEVICE_PROPERTY_CHANGED_NODE_TYPE,
				position: { x: 0, y: 0 },
				config: { ...occupancy, to: true },
			},
			{
				id: 'dark',
				type: DEVICE_PROPERTY_COMPARE_NODE_TYPE,
				position: { x: 260, y: 0 },
				config: { ...illuminance, operator: 'lt', value: 50 },
			},
			{
				id: 'night',
				type: TIME_WINDOW_NODE_TYPE,
				position: { x: 520, y: 0 },
				config: { from: '22:00', to: '06:00' },
			},
			{
				id: 'dimmed',
				type: DEVICE_PROPERTY_SET_NODE_TYPE,
				position: { x: 780, y: -100 },
				config: {
					writes: [
						{ ...lightOn, value: true },
						{ ...lightBrightness, value: 20 },
					],
				},
			},
			{
				id: 'full',
				type: DEVICE_PROPERTY_SET_NODE_TYPE,
				position: { x: 780, y: 100 },
				config: {
					writes: [
						{ ...lightOn, value: true },
						{ ...lightBrightness, value: 100 },
					],
				},
			},
			{
				id: 'clear',
				type: DEVICE_PROPERTY_CHANGED_NODE_TYPE,
				position: { x: 0, y: 300 },
				config: { ...occupancy, to: false },
			},
			{ id: 'wait', type: DELAY_NODE_TYPE, position: { x: 260, y: 300 }, config: { seconds: DELAY_SECONDS } },
			{
				id: 'vacant',
				type: DEVICE_PROPERTY_COMPARE_NODE_TYPE,
				position: { x: 520, y: 300 },
				config: { ...occupancy, operator: 'eq', value: false },
			},
			{
				id: 'off',
				type: DEVICE_PROPERTY_SET_NODE_TYPE,
				position: { x: 780, y: 300 },
				config: { writes: [{ ...lightOn, value: false }] },
			},
		],
		edges: [
			{ id: 'e1', source: 'occupied', source_port: 'out', target: 'dark', target_port: 'in' },
			{ id: 'e2', source: 'dark', source_port: 'yes', target: 'night', target_port: 'in' },
			{ id: 'e3', source: 'night', source_port: 'yes', target: 'dimmed', target_port: 'in' },
			{ id: 'e4', source: 'night', source_port: 'no', target: 'full', target_port: 'in' },
			{ id: 'e5', source: 'clear', source_port: 'out', target: 'wait', target_port: 'in' },
			{ id: 'e6', source: 'wait', source_port: 'out', target: 'vacant', target_port: 'in' },
			{ id: 'e7', source: 'vacant', source_port: 'yes', target: 'off', target_port: 'in' },
		],
	});

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [FakeAutomationClocksModule, AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleFixture.createNestApplication();

		// The same pipe as src/main.ts
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: {
					enableImplicitConversion: true,
				},
				exceptionFactory: (validationErrors) => ValidationExceptionFactory.createException(validationErrors),
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize (especially module mappings)
		await new Promise((resolve) => setTimeout(resolve, 100));

		engine = app.get(AutomationEngineService, { strict: false });
		stateTracker = app.get(AutomationStateTrackerService, { strict: false });
		timeSource = app.get(AutomationTimeSourceService, { strict: false });
		propertiesService = app.get(ChannelsPropertiesService, { strict: false });
		propertyValueService = app.get(PropertyValueService, { strict: false });

		// /auth/register only ever succeeds once: the first registered account becomes the owner
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'refowner', password: 'securePassword123!', email: 'refowner@example.com' } });

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'refowner', password: 'securePassword123!' } });

		ownerToken = (login.body as { data: { access_token: string } }).data.access_token;

		expect(ownerToken).toEqual(expect.any(String));

		const sensor = await createDevice({
			category: DeviceCategory.SENSOR,
			name: 'Hallway sensor',
			channels: [
				{
					type: SIMULATOR_TYPE,
					category: ChannelCategory.OCCUPANCY,
					identifier: 'occupancy',
					name: 'Occupancy',
					properties: [
						{
							type: SIMULATOR_TYPE,
							category: PropertyCategory.DETECTED,
							identifier: 'detected',
							name: 'Detected',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.BOOL,
							value: false,
						},
					],
				},
				{
					type: SIMULATOR_TYPE,
					category: ChannelCategory.ILLUMINANCE,
					identifier: 'illuminance',
					name: 'Illuminance',
					properties: [
						{
							type: SIMULATOR_TYPE,
							category: PropertyCategory.ILLUMINANCE,
							identifier: 'illuminance',
							name: 'Illuminance',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.FLOAT,
							value: 10,
						},
					],
				},
			],
		});

		const lamp = await createDevice({
			category: DeviceCategory.LIGHTING,
			name: 'Hallway light',
			channels: [
				{
					type: SIMULATOR_TYPE,
					category: ChannelCategory.LIGHT,
					identifier: 'light',
					name: 'Light',
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
							category: PropertyCategory.BRIGHTNESS,
							identifier: 'brightness',
							name: 'Brightness',
							permissions: [PermissionType.READ_WRITE],
							data_type: DataTypeType.UCHAR,
							format: [0, 100],
							value: 50,
						},
					],
				},
			],
		});

		occupancy = targetOf(sensor, ChannelCategory.OCCUPANCY, PropertyCategory.DETECTED);
		illuminance = targetOf(sensor, ChannelCategory.ILLUMINANCE, PropertyCategory.ILLUMINANCE);
		lightOn = targetOf(lamp, ChannelCategory.LIGHT, PropertyCategory.ON);
		lightBrightness = targetOf(lamp, ChannelCategory.LIGHT, PropertyCategory.BRIGHTNESS);

		// A dark, empty room with the light off
		await report(occupancy, false);
		await report(illuminance, 10);

		const created = await request(app.getHttpServer())
			.post(base)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { name: 'Hallway light', enabled: true, graph: referenceGraph() } })
			.expect(201);

		const automation = (created.body as { data: AutomationBody }).data;

		automationId = automation.id;

		expect(automation).toMatchObject({ enabled: true, mode: 'restart', status: 'ok' });
		expect(automation.graph).toEqual(referenceGraph());

		await settled();

		expect(engine.runtime(automationId)).toMatchObject({ status: 'ok', armed: true, armedTriggers: 2 });
		expect(await light()).toEqual({ on: false, brightness: 50 });
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	it('turns on a dimmed light when somebody walks into the dark room at night', async () => {
		setHouseTime(23, 0);

		const runs = started();

		await report(occupancy, true);
		await runsFinished(runs + 1);

		expect(await light()).toEqual({ on: true, brightness: 20 });
	});

	it('turns the light off once the room has been clear for the length of the Delay', async () => {
		const runs = started();

		await report(occupancy, false);
		await parkedOnDelay(runs + 1);

		// One second short of the Delay: the light is still on
		engineClock.advanceSeconds(DELAY_SECONDS - 1);
		await settled();

		expect(engine.runtime(automationId)?.activeRuns).toBe(1);
		expect((await light()).on).toBe(true);

		engineClock.advanceSeconds(1);

		await waitFor(light, (state) => state.on === false, 'the light going off');
		await runsFinished(runs + 1);

		expect(engineClock.pending()).toBe(0);

		// The room was still clear when the Delay ended, so the re-check let the light go off
		expect(await lastTrace()).toMatchObject({
			trigger: { node_id: 'clear' },
			steps: [{ node_id: 'wait' }, { node_id: 'vacant', output: 'yes' }, { node_id: 'off' }],
		});
	});

	it('turns on the full light when somebody walks into the dark room by day', async () => {
		setHouseTime(12, 0);

		const runs = started();

		await report(occupancy, true);
		await runsFinished(runs + 1);

		expect(await light()).toEqual({ on: true, brightness: 100 });
	});

	it('keeps the light on when somebody comes back while the Delay is running', async () => {
		const runs = started();

		await report(occupancy, false);
		await parkedOnDelay(runs + 1);

		engineClock.advanceSeconds(DELAY_SECONDS / 2);
		await settled();

		// The mode is restart: the new trigger cancels the run waiting to switch the light off
		await report(occupancy, true);
		await runsFinished(runs + 2);

		expect(engineClock.pending()).toBe(0);

		// Well past the moment the cancelled run would have switched the light off
		engineClock.advanceSeconds(DELAY_SECONDS);
		await settled();

		expect(await light()).toEqual({ on: true, brightness: 100 });

		// The history says so: the waiting run was cancelled, the new one completed
		const history = runHistory();
		const [newest, cancelled] = await history.findAllForAutomation(automationId);

		expect(newest.status).toBe(AutomationRunRecordStatus.COMPLETED);
		expect(cancelled.status).toBe(AutomationRunRecordStatus.CANCELLED);

		const trace = (await history.findOne(cancelled.id))?.trace;

		// It was started by the room becoming clear and never got past the Delay
		expect(trace?.trigger.node_id).toBe('clear');
		expect(trace?.steps.map((step) => step.node_id)).toEqual(['wait']);

		// Once the room is clear again, the Delay runs in full and the light goes off
		await report(occupancy, false);
		await parkedOnDelay(runs + 3);

		engineClock.advanceSeconds(DELAY_SECONDS);

		await waitFor(light, (state) => state.on === false, 'the light going off');
		await runsFinished(runs + 3);
	});

	it('leaves the light on when the sensor drops offline while the Delay is running', async () => {
		const runs = started();

		await report(occupancy, true);
		await runsFinished(runs + 1);

		expect(await light()).toEqual({ on: true, brightness: 100 });

		await report(occupancy, false);
		await parkedOnDelay(runs + 2);

		// The sensor stops answering. Nothing is triggered by it: its last valid value is still "clear".
		await setSensorConnection(ConnectionState.LOST);
		await waitFor(
			() => stateTracker.read(occupancy.property_id).status,
			(status) => status === 'offline',
			'the sensor to be seen offline',
		);

		expect(started()).toBe(runs + 2);
		expect(engine.runtime(automationId)?.activeRuns).toBe(1);

		engineClock.advanceSeconds(DELAY_SECONDS);
		await runsFinished(runs + 2);

		// Without the re-check the light would be off now: whether the room is empty is not known
		expect(await light()).toEqual({ on: true, brightness: 100 });
		expect(await lastTrace()).toMatchObject({
			trigger: { node_id: 'clear' },
			steps: [{ node_id: 'wait' }, { node_id: 'vacant', output: 'no', reason: 'The device is offline.' }],
		});
		expect((await lastTrace())?.steps).toHaveLength(2);

		await setSensorConnection(ConnectionState.CONNECTED);
		await waitFor(
			() => stateTracker.read(occupancy.property_id).status,
			(status) => status === 'ok',
			'the sensor to be seen online',
		);
		await settled();

		// Coming back with the value it had is not a change, so nothing runs
		expect(started()).toBe(runs + 2);
	});
});
