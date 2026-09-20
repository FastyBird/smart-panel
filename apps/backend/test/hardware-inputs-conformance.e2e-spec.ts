/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
*/
/*
Reason: Supertest HTTP response bodies are typed dynamically, following the established e2e test conventions.
*/
import { useContainer } from 'class-validator';
import request from 'supertest';
import 'systeminformation';
import { v4 as uuidv4 } from 'uuid';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType as DevicesEventType,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelInputOccurrencePayload } from '../src/modules/devices/models/channel-input-occurrence.model';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../src/plugins/devices-virtual/devices-virtual.constants';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';

describe('Hardware Input Conformance (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	let eventEmitter: EventEmitter2;
	let devicesService: DevicesService;
	let channelsPropertiesService: ChannelsPropertiesService;

	// Test devices and IDs
	let inputControllerId: string;
	let btn1ChannelId: string;
	let btn1EventPropId: string;
	let btn2ChannelId: string;
	let btn2EventPropId: string;
	let btn3ChannelId: string;
	let btn3EventPropId: string;

	let mixedDeviceId: string;
	let lightChannelId: string;
	let lightOnPropId: string;
	let lightBrightnessPropId: string;
	let mixedBtnChannelId: string;
	let mixedBtnEventPropId: string;
	let mixedBinInputChannelId: string;
	let mixedBinInputStatePropId: string;

	let auxControllerId: string;
	let binaryInputChannelId: string;
	let binaryInputStatePropId: string;
	let analogInputChannelId: string;
	let analogInputValuePropId: string;

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
		await new Promise((resolve) => setTimeout(resolve, 100));

		eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
		devicesService = moduleFixture.get<DevicesService>(DevicesService);
		channelsPropertiesService = moduleFixture.get<ChannelsPropertiesService>(ChannelsPropertiesService);

		// Register and login for auth token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'inputconformance',
					password: 'securePassword123!',
					email: 'inputconformance@example.com',
				},
			});

		const loginRes = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'inputconformance',
					password: 'securePassword123!',
				},
			});

		accessToken = loginRes.body.data.access_token;

		// 1. Create Dedicated 4-Button Input Controller
		inputControllerId = uuidv4();
		btn1ChannelId = uuidv4();
		btn1EventPropId = uuidv4();
		btn2ChannelId = uuidv4();
		btn2EventPropId = uuidv4();
		btn3ChannelId = uuidv4();
		btn3EventPropId = uuidv4();

		await devicesService.create({
			id: inputControllerId,
			type: SIMULATOR_TYPE,
			category: DeviceCategory.INPUT_CONTROLLER,
			name: 'Conformance Wall Button Controller',
			channels: [
				{
					id: btn1ChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BUTTON,
					name: 'Button 1',
					properties: [
						{
							id: btn1EventPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.EVENT,
							name: 'Event',
							permissions: [PermissionType.EVENT_ONLY],
							data_type: DataTypeType.ENUM,
							format: ['press', 'double_press', 'long_press', 'triple_press', 'down', 'up'],
						},
						{
							id: uuidv4(),
							type: SIMULATOR_TYPE,
							category: PropertyCategory.DETECTED,
							name: 'Detected',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.BOOL,
							value: false,
						},
					],
				},
				{
					id: btn2ChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BUTTON,
					name: 'Button 2',
					properties: [
						{
							id: btn2EventPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.EVENT,
							name: 'Event',
							permissions: [PermissionType.EVENT_ONLY],
							data_type: DataTypeType.ENUM,
							format: ['press', 'double_press', 'long_press', 'triple_press', 'down', 'up'],
						},
						{
							id: uuidv4(),
							type: SIMULATOR_TYPE,
							category: PropertyCategory.DETECTED,
							name: 'Detected',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.BOOL,
							value: false,
						},
					],
				},
				{
					id: btn3ChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BUTTON,
					name: 'Button 3',
					properties: [
						{
							id: btn3EventPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.EVENT,
							name: 'Event',
							permissions: [PermissionType.EVENT_ONLY],
							data_type: DataTypeType.ENUM,
							format: ['press', 'double_press', 'long_press', 'triple_press', 'down', 'up'],
						},
					],
				},
			],
		});

		// 2. Create Mixed Dimmer Switch with light output and hardware inputs
		mixedDeviceId = uuidv4();
		lightChannelId = uuidv4();
		lightOnPropId = uuidv4();
		lightBrightnessPropId = uuidv4();
		mixedBtnChannelId = uuidv4();
		mixedBtnEventPropId = uuidv4();
		mixedBinInputChannelId = uuidv4();
		mixedBinInputStatePropId = uuidv4();

		await devicesService.create({
			id: mixedDeviceId,
			type: SIMULATOR_TYPE,
			category: DeviceCategory.LIGHTING,
			name: 'Conformance Mixed Dimmer Switch',
			channels: [
				{
					id: lightChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.LIGHT,
					name: 'Light Output',
					properties: [
						{
							id: lightOnPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.ON,
							name: 'On',
							permissions: [PermissionType.READ_WRITE],
							data_type: DataTypeType.BOOL,
							value: false,
						},
						{
							id: lightBrightnessPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.BRIGHTNESS,
							name: 'Brightness',
							permissions: [PermissionType.READ_WRITE],
							data_type: DataTypeType.UCHAR,
							format: [0, 100],
							value: 50,
						},
					],
				},
				{
					id: mixedBtnChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BUTTON,
					name: 'SW1 Push Button',
					properties: [
						{
							id: mixedBtnEventPropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.EVENT,
							name: 'Event',
							permissions: [PermissionType.EVENT_ONLY],
							data_type: DataTypeType.ENUM,
							format: ['press', 'double_press', 'long_press'],
						},
					],
				},
				{
					id: mixedBinInputChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BINARY_INPUT,
					name: 'SW2 Toggle Switch',
					properties: [
						{
							id: mixedBinInputStatePropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.STATE,
							name: 'State',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.BOOL,
							value: false,
						},
					],
				},
			],
		});

		// 3. Create Auxiliary Controller (Binary Switch + Analog Input)
		auxControllerId = uuidv4();
		binaryInputChannelId = uuidv4();
		binaryInputStatePropId = uuidv4();
		analogInputChannelId = uuidv4();
		analogInputValuePropId = uuidv4();

		await devicesService.create({
			id: auxControllerId,
			type: SIMULATOR_TYPE,
			category: DeviceCategory.INPUT_CONTROLLER,
			name: 'Conformance Auxiliary Controller',
			channels: [
				{
					id: binaryInputChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.BINARY_INPUT,
					name: 'Binary Wall Switch',
					properties: [
						{
							id: binaryInputStatePropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.STATE,
							name: 'State',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.BOOL,
							value: false,
						},
					],
				},
				{
					id: analogInputChannelId,
					type: SIMULATOR_TYPE,
					category: ChannelCategory.ANALOG_INPUT,
					name: 'Analog Potentiometer',
					properties: [
						{
							id: analogInputValuePropId,
							type: SIMULATOR_TYPE,
							category: PropertyCategory.VALUE,
							name: 'Value',
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.FLOAT,
							value: 0.0,
						},
					],
				},
			],
		});
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Scenario 1: Wall button 1.1 single click occurrence ingestion', () => {
		it('emits a single press occurrence and dispatches event to internal bus', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				const response = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: btn1ChannelId,
							event: 'press',
						},
					})
					.expect(201);

				expect(response.body.data.success).toBe(true);
				expect(response.body.data.dropped).toBe(false);
				expect(response.body.data.event).toBe('press');
				expect(response.body.data.channel_id).toBe(btn1ChannelId);
				expect(response.body.data.property_id).toBe(btn1EventPropId);
				expect(response.body.data.occurrence_id).toBeDefined();

				expect(eventsReceived).toHaveLength(1);
				expect(eventsReceived[0]).toEqual(
					expect.objectContaining({
						id: response.body.data.occurrence_id,
						deviceId: inputControllerId,
						channelId: btn1ChannelId,
						propertyId: btn1EventPropId,
						event: 'press',
					}),
				);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 2: Wall button 1.2 double click occurrence', () => {
		it('emits double_press gesture occurrence independently', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				const response = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: btn2ChannelId,
							event: 'double_press',
						},
					})
					.expect(201);

				expect(response.body.data.success).toBe(true);
				expect(response.body.data.dropped).toBe(false);
				expect(response.body.data.event).toBe('double_press');
				expect(response.body.data.channel_id).toBe(btn2ChannelId);

				expect(eventsReceived).toHaveLength(1);
				expect(eventsReceived[0].event).toBe('double_press');
				expect(eventsReceived[0].channelId).toBe(btn2ChannelId);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 3: Repeated identical clicks -> distinct occurrences', () => {
		it('delivers each click as a distinct occurrence without deduplication when no source ID is set', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				const res1 = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'press' } })
					.expect(201);

				const res2 = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'press' } })
					.expect(201);

				const res3 = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'press' } })
					.expect(201);

				expect(res1.body.data.dropped).toBe(false);
				expect(res2.body.data.dropped).toBe(false);
				expect(res3.body.data.dropped).toBe(false);

				// Each occurrence has a unique ID
				const ids = new Set([res1.body.data.occurrence_id, res2.body.data.occurrence_id, res3.body.data.occurrence_id]);
				expect(ids.size).toBe(3);

				expect(eventsReceived).toHaveLength(3);
				expect(eventsReceived.every((e) => e.event === 'press')).toBe(true);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 4: Multiple inputs at once -> independent identities', () => {
		it('handles concurrent presses on different channels maintaining separate identities', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				const [resBtn1, resBtn3] = await Promise.all([
					request(app.getHttpServer())
						.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
						.set('Authorization', `Bearer ${accessToken}`)
						.send({ data: { channel_id: btn1ChannelId, event: 'press' } }),
					request(app.getHttpServer())
						.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
						.set('Authorization', `Bearer ${accessToken}`)
						.send({ data: { channel_id: btn3ChannelId, event: 'press' } }),
				]);

				expect(resBtn1.status).toBe(201);
				expect(resBtn3.status).toBe(201);

				expect(resBtn1.body.data.channel_id).toBe(btn1ChannelId);
				expect(resBtn3.body.data.channel_id).toBe(btn3ChannelId);

				expect(eventsReceived).toHaveLength(2);
				const channelIds = eventsReceived.map((e) => e.channelId);
				expect(channelIds).toContain(btn1ChannelId);
				expect(channelIds).toContain(btn3ChannelId);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 5: Down/up + completed gesture separation', () => {
		it('emits raw down/up edges and completed press as separate occurrences', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'down' } })
					.expect(201);

				await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'up' } })
					.expect(201);

				await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { channel_id: btn1ChannelId, event: 'press' } })
					.expect(201);

				expect(eventsReceived).toHaveLength(3);
				expect(eventsReceived[0].event).toBe('down');
				expect(eventsReceived[1].event).toBe('up');
				expect(eventsReceived[2].event).toBe('press');
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 6: Initial state / retained payload / reconnect anti-replay', () => {
		it('does not retain event occurrences as static property state and avoids reconnect replay', async () => {
			// Query the event property value
			const propertyRes = await request(app.getHttpServer())
				.get(`/modules/devices/channels/${btn1ChannelId}/properties/${btn1EventPropId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			// Value must be null for EVENT_ONLY property
			expect(propertyRes.body.data.value).toBeNull();

			// Listen for any occurrences during reconnect
			const reconnectedEvents: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				reconnectedEvents.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				// Simulate disconnect
				await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-connection`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { state: ConnectionState.DISCONNECTED } })
					.expect(201);

				// Simulate reconnect
				await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-connection`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ data: { state: ConnectionState.CONNECTED } })
					.expect(201);

				// Anti-replay: no spurious button occurrences during reconnection
				expect(reconnectedEvents).toHaveLength(0);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 7: Identifiable redelivery deduplication', () => {
		it('drops duplicate occurrences with identical source_occurrence_id on the same channel', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				// First delivery: accepted
				const firstRes = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: btn1ChannelId,
							event: 'press',
							source_occurrence_id: 'shelly-seq-42',
						},
					})
					.expect(201);

				expect(firstRes.body.data.dropped).toBe(false);
				expect(firstRes.body.data.occurrence_id).not.toBeNull();
				expect(eventsReceived).toHaveLength(1);

				// Redelivery (duplicate packet): dropped by deduplication
				const duplicateRes = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: btn1ChannelId,
							event: 'press',
							source_occurrence_id: 'shelly-seq-42',
						},
					})
					.expect(201);

				expect(duplicateRes.body.data.dropped).toBe(true);
				expect(duplicateRes.body.data.occurrence_id).toBeNull();
				// Event emitter still only has 1 event (no duplicate dispatched)
				expect(eventsReceived).toHaveLength(1);

				// Delivery with same sequence ID but on a DIFFERENT channel: accepted
				const differentChannelRes = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${inputControllerId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: btn2ChannelId,
							event: 'press',
							source_occurrence_id: 'shelly-seq-42',
						},
					})
					.expect(201);

				expect(differentChannelRes.body.data.dropped).toBe(false);
				expect(eventsReceived).toHaveLength(2);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});

	describe('Scenario 8: Binary transition and analog range semantics', () => {
		it('properly represents binary input toggle state', async () => {
			// Initial state is false
			const initialRes = await request(app.getHttpServer())
				.get(`/modules/devices/channels/${binaryInputChannelId}/properties/${binaryInputStatePropId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(initialRes.body.data.value.value).toBe(false);

			// Transition to true
			await channelsPropertiesService.update(binaryInputStatePropId, {
				type: SIMULATOR_TYPE,
				value: true,
			});

			const updatedRes = await request(app.getHttpServer())
				.get(`/modules/devices/channels/${binaryInputChannelId}/properties/${binaryInputStatePropId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(updatedRes.body.data.value.value).toBe(true);

			// Transition back to false
			await channelsPropertiesService.update(binaryInputStatePropId, {
				type: SIMULATOR_TYPE,
				value: false,
			});

			const finalRes = await request(app.getHttpServer())
				.get(`/modules/devices/channels/${binaryInputChannelId}/properties/${binaryInputStatePropId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(finalRes.body.data.value.value).toBe(false);
		});

		it('properly represents continuous analog input updates', async () => {
			await channelsPropertiesService.update(analogInputValuePropId, {
				type: SIMULATOR_TYPE,
				value: 7.35,
			});

			const res = await request(app.getHttpServer())
				.get(`/modules/devices/channels/${analogInputChannelId}/properties/${analogInputValuePropId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(res.body.data.value.value).toBe(7.35);
		});
	});

	describe('Scenario 9: Virtual source plus aliases', () => {
		it('allows a virtual device channel to link to a hardware input property', async () => {
			const res = await request(app.getHttpServer())
				.post('/modules/devices/devices')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.GENERIC,
						name: 'Virtual Wall Switch Mirror',
						channels: [
							{
								type: DEVICES_VIRTUAL_TYPE,
								category: ChannelCategory.BINARY_INPUT,
								name: 'Mirrored Switch',
								properties: [
									{
										type: DEVICES_VIRTUAL_TYPE,
										category: PropertyCategory.STATE,
										name: 'State',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.BOOL,
										source_property: binaryInputStatePropId,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const virtualProp = res.body.data.channels[0].properties[0];
			expect(virtualProp.source_property).toBe(binaryInputStatePropId);
			expect(virtualProp.category).toBe(PropertyCategory.STATE);
		});
	});

	describe('Scenario 10: Mixed actuator device command/state isolation', () => {
		it('guarantees actuator commands do not trigger input occurrences and input events do not mutate actuator state', async () => {
			const eventsReceived: ChannelInputOccurrencePayload[] = [];
			const listener = (payload: ChannelInputOccurrencePayload) => {
				eventsReceived.push(payload);
			};

			eventEmitter.on(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);

			try {
				// 1. Send actuator command to light channel
				await channelsPropertiesService.update(lightOnPropId, {
					type: SIMULATOR_TYPE,
					value: true,
				});
				await channelsPropertiesService.update(lightBrightnessPropId, {
					type: SIMULATOR_TYPE,
					value: 85,
				});

				// Verify light state updated
				const lightRes = await request(app.getHttpServer())
					.get(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(200);
				expect(lightRes.body.data.value.value).toBe(true);

				// Actuator change MUST NOT emit any input occurrences
				expect(eventsReceived).toHaveLength(0);

				// 2. Emit hardware button occurrence on mixed device
				const simOccRes = await request(app.getHttpServer())
					.post(`/plugins/simulator/simulator/${mixedDeviceId}/simulate-occurrence`)
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						data: {
							channel_id: mixedBtnChannelId,
							event: 'press',
						},
					})
					.expect(201);

				expect(simOccRes.body.data.dropped).toBe(false);
				expect(eventsReceived).toHaveLength(1);
				expect(eventsReceived[0].channelId).toBe(mixedBtnChannelId);

				// Actuator state remains completely preserved without unintended mutation
				const lightResAfter = await request(app.getHttpServer())
					.get(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(200);
				expect(lightResAfter.body.data.value.value).toBe(true);

				const brightnessResAfter = await request(app.getHttpServer())
					.get(`/modules/devices/channels/${lightChannelId}/properties/${lightBrightnessPropId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(200);
				expect(brightnessResAfter.body.data.value.value).toBe(85);
			} finally {
				eventEmitter.off(DevicesEventType.CHANNEL_INPUT_OCCURRENCE, listener);
			}
		});
	});
});
