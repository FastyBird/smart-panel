/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_TYPE,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1NotSupportedException } from '../devices-shelly-v1.exceptions';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { NormalizedDeviceEvent, ShellyDevice } from '../interfaces/shellies.interface';
import { ShellyInfoResponse, ShellySettingsResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

describe('DeviceMapperService', () => {
	let service: DeviceMapperService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let shelliesAdapter: jest.Mocked<ShelliesAdapterService>;
	let httpClient: jest.Mocked<ShellyV1HttpClientService>;
	let identities: { createDevice: jest.Mock; confirmHost: jest.Mock; expected: jest.Mock; findPin: jest.Mock };

	// Quiet logger noise

	beforeAll(() => {});

	afterAll(() => {});

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock services
		devicesService = {
			findOneBy: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		} as any;

		channelsService = {
			findOneBy: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		} as any;

		channelsPropertiesService = {
			findOneBy: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		} as any;

		deviceConnectivityService = {
			setConnectionState: jest.fn(),
		} as any;

		shelliesAdapter = {
			getDevice: jest.fn(),
			setDeviceAuthCredentials: jest.fn(),
			updateDeviceEnabledStatus: jest.fn(),
		} as any;

		httpClient = {
			getDeviceSettings: jest.fn(),
			getLoginSettings: jest.fn(),
			getDeviceInfo: jest.fn(),
			getDeviceStatus: jest.fn(),
		} as any;

		identities = {
			createDevice: jest.fn((dto) => devicesService.create(dto)),
			confirmHost: jest.fn().mockResolvedValue(true),
			findPin: jest.fn().mockResolvedValue(null),
			expected: jest.fn().mockResolvedValue('8CBFEAABC123'),
		};
		service = new DeviceMapperService(
			devicesService,
			channelsService,
			channelsPropertiesService,
			deviceConnectivityService,
			shelliesAdapter,
			httpClient,
			new DeviceProvisionQueueService(),
			identities as unknown as ShellyV1AdoptedIdentityService,
		);
	});

	const makeShellyDevice = (id = 'shelly1pm-ABC123', type = 'SHSW-PM', host = '192.168.1.100'): Partial<ShellyDevice> =>
		({
			id,
			type,
			host,
			online: true,
			relay0: false,
			on: jest.fn(),
			setAuthCredentials: jest.fn(),
		}) as any;

	const makeNormalizedEvent = (id = 'shelly1pm-ABC123', type = 'SHSW-PM'): NormalizedDeviceEvent => ({
		id,
		type,
		host: '192.168.1.100',
		online: true,
	});

	const makeMockSettings = (name = 'My Shelly Device'): Partial<ShellySettingsResponse> =>
		({
			device: {
				hostname: name,
				type: 'SHSW-PM',
				mac: '8CBFEAABC123',
			},
			wifi_ao: {
				enabled: false,
				ssid: '',
			},
			wifi_sta: {
				enabled: true,
				ssid: 'TestNetwork',
				ipv4_method: 'dhcp',
				ip: '192.168.1.100',
				gw: '192.168.1.1',
				mask: '255.255.255.0',
				dns: '192.168.1.1',
			},
			fw: '1.14.0',
			name,
			discoverable: true,
			timezone: 'UTC',
			cloud: {
				enabled: false,
				connected: false,
			},
		}) as any;

	const makeMockInfo = (): ShellyInfoResponse => ({
		type: 'SHSW-PM',
		mac: '8CBFEAABC123',
		auth: false,
		fw: '1.14.0',
		longid: 1234567890,
	});

	const makeMockStatus = (): Partial<ShellyStatusResponse> =>
		({
			wifi_sta: { connected: true, ssid: 'TestNetwork', ip: '192.168.1.100', rssi: -65 },
			cloud: { enabled: false, connected: false },
			mqtt: { connected: false },
			has_update: false,
			ram_total: 50000,
			ram_free: 35000,
			fs_size: 200000,
			fs_free: 150000,
			uptime: 12345,
			time: '10:00',
			unixtime: 1234567890,
			serial: 1,
			mac: '8CBFEAABC123',
			ram_lwm: 30000,
		}) as any;

	describe('Error handling', () => {
		it('should throw exception when device not found in adapter', async () => {
			const event = makeNormalizedEvent();
			shelliesAdapter.getDevice.mockReturnValue(undefined);

			await expect(service.mapDevice(event)).rejects.toThrow(DevicesShellyV1NotSupportedException);
			await expect(service.mapDevice(event)).rejects.toThrow('Device shelly1pm-ABC123 not found in adapter');
		});

		it('should throw exception for unsupported device type', async () => {
			const event = makeNormalizedEvent('unknown-device', 'UNKNOWN-TYPE');
			const shellyDevice = makeShellyDevice('unknown-device', 'UNKNOWN-TYPE');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);

			await expect(service.mapDevice(event)).rejects.toThrow(DevicesShellyV1NotSupportedException);
			await expect(service.mapDevice(event)).rejects.toThrow('Unsupported device type: UNKNOWN-TYPE');
		});
	});

	describe('New device mapping - SHELLY1PM', () => {
		it('should create new device with correct properties', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('Living Room Switch') as any);
			httpClient.getDeviceInfo.mockResolvedValue(makeMockInfo());
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			// No existing device
			devicesService.findOneBy.mockResolvedValue(null);

			// Mock entity creation
			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
				name: 'Living Room Switch',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			// Mock channel creation - return different channels based on identifier
			channelsService.create.mockImplementation((dto: any) => {
				const channelId = `channel-${dto.identifier}-uuid`;
				return Promise.resolve(
					Object.assign(new ShellyV1ChannelEntity(), {
						id: channelId,
						identifier: dto.identifier,
					}),
				);
			});

			// Mock property creation
			channelsPropertiesService.create.mockImplementation((dto: any) =>
				Promise.resolve(
					Object.assign(new ShellyV1ChannelPropertyEntity(), {
						id: `prop-${dto.identifier}-uuid`,
						identifier: dto.identifier,
					}),
				),
			);

			const result = await service.mapDevice(event);
			expect(identities.createDevice).toHaveBeenCalledWith(
				expect.objectContaining({ identifier: event.id, hostname: event.host }),
				'8CBFEAABC123',
				expect.any(Function),
			);

			// Verify device was created
			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'shelly1pm-ABC123',
					name: 'Living Room Switch',
					type: DEVICES_SHELLY_V1_TYPE,
					category: DESCRIPTORS.SHELLY1PM.categories[0],
				}),
			);

			// Verify device_information channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
					device: 'device-uuid',
				}),
			);

			// Verify relay channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'relay_0',
					category: ChannelCategory.SWITCHER,
					device: 'device-uuid',
				}),
			);

			// Verify relay state property was created
			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;
			const statePropertyCall = createCalls.find(
				(call) => call[1]?.identifier === 'state' && call[0] === 'channel-relay_0-uuid',
			);
			expect(statePropertyCall).toBeDefined();
			expect(statePropertyCall?.[1]).toMatchObject({
				identifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			});

			expect(result).toBe(mockDevice);
		});

		it('should use default device name when settings fetch fails', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockRejectedValue(new Error('Network error'));
			httpClient.getDeviceInfo.mockResolvedValue(makeMockInfo());
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.create.mockResolvedValue({} as any);
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Should use device ID as name when settings fetch fails
			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'shelly1pm-ABC123',
				}),
			);
		});
	});

	describe('Mode-based device - SHELLYRGBW2', () => {
		it('should create device with color mode bindings', async () => {
			const event = makeNormalizedEvent('shellyrgbw2-DEF456', 'SHRGBW2');
			const shellyDevice = makeShellyDevice('shellyrgbw2-DEF456', 'SHRGBW2');
			shellyDevice.mode = 'color';

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('RGBW Light') as any);
			httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), type: 'SHRGBW2', mac: '8CBFEADEF456' });
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shellyrgbw2-DEF456',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const mockChannel = Object.assign(new ShellyV1ChannelEntity(), {
				id: 'channel-light-uuid',
				identifier: 'light_0',
			});
			channelsService.create.mockResolvedValue(mockChannel);
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Verify light channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'light_0',
					category: ChannelCategory.LIGHT,
				}),
			);

			// Verify color mode properties were created (red, green, blue, white)
			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;

			const redPropertyCall = createCalls.find((call) => call[1]?.identifier === 'red');
			expect(redPropertyCall).toBeDefined();
			expect(redPropertyCall?.[1]).toMatchObject({
				identifier: 'red',
				category: PropertyCategory.COLOR_RED,
				data_type: DataTypeType.UCHAR,
				format: [0, 255],
			});

			const greenPropertyCall = createCalls.find((call) => call[1]?.identifier === 'green');
			expect(greenPropertyCall).toBeDefined();
			expect(greenPropertyCall?.[1]).toMatchObject({
				identifier: 'green',
				category: PropertyCategory.COLOR_GREEN,
			});

			const bluePropertyCall = createCalls.find((call) => call[1]?.identifier === 'blue');
			expect(bluePropertyCall).toBeDefined();
			expect(bluePropertyCall?.[1]).toMatchObject({
				identifier: 'blue',
				category: PropertyCategory.COLOR_BLUE,
			});
		});

		it('should create device with white mode bindings', async () => {
			const event = makeNormalizedEvent('shellyrgbw2-DEF456', 'SHRGBW2');
			const shellyDevice = makeShellyDevice('shellyrgbw2-DEF456', 'SHRGBW2');
			shellyDevice.mode = 'white';

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('RGBW Light') as any);
			httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), type: 'SHRGBW2', mac: '8CBFEADEF456' });
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shellyrgbw2-DEF456',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const mockChannel = Object.assign(new ShellyV1ChannelEntity(), {
				id: 'channel-light-uuid',
				identifier: 'light_0',
			});
			channelsService.create.mockResolvedValue(mockChannel);
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Verify brightness property was created (white mode)
			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;

			const brightnessPropertyCall = createCalls.find((call) => call[1]?.identifier === 'brightness');
			expect(brightnessPropertyCall).toBeDefined();
			expect(brightnessPropertyCall?.[1]).toMatchObject({
				identifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UCHAR,
				format: [0, 100],
			});

			// Verify color properties (red, green, blue) were NOT created in white mode
			const hasRedProperty = createCalls.some((call) => call[1]?.identifier === 'red');

			expect(hasRedProperty).toBe(false);
		});
	});

	describe('Existing device updates', () => {
		it.each(['login', 'catalog', 'status', 'stable'])(
			'keeps discovery requests on the verified endpoint when the peer changes during %s',
			async (stage) => {
				const foreignRequests: string[] = [];
				const statusAuth: (string | undefined)[] = [];
				const peer = makeShellyDevice() as ShellyDevice;
				const foreign = createServer((req, res) => {
					foreignRequests.push(req.url);
					res.end('{}');
				});
				const start = (server: Server) =>
					new Promise<string>((resolve) =>
						server.listen(0, '127.0.0.1', () => resolve(`127.0.0.1:${(server.address() as AddressInfo).port}`)),
					);
				const otherHost = await start(foreign);
				const original = createServer((req, res) => {
					let body: object = {};
					if (req.url === '/shelly') body = makeMockInfo();
					if (req.url === '/settings/login') {
						if (stage === 'login') peer.host = otherHost;
						body = { username: 'operator' };
					}
					if (req.url === '/status') {
						statusAuth.push(req.headers.authorization);
						if (stage === 'status') peer.host = otherHost;
						body = makeMockStatus();
					}
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(body));
				});
				try {
					const host = await start(original);
					peer.host = host;
					const event = { ...makeNormalizedEvent(), host };
					shelliesAdapter.getDevice.mockReturnValue(peer);
					const device = Object.assign(new ShellyV1DeviceEntity(), {
						id: 'existing',
						identifier: event.id,
						hostname: stage === 'catalog' ? 'old-host' : host,
						password: 'fixture',
					});
					devicesService.findOneBy.mockResolvedValue(device);
					devicesService.update.mockImplementation((_, dto) => {
						expect(dto).toMatchObject({ hostname: host });
						peer.host = otherHost;
						return Promise.resolve(device);
					});
					const http = new ShellyV1HttpClientService();
					httpClient.getDeviceSettings.mockImplementation(http.getDeviceSettings.bind(http));
					httpClient.getDeviceInfo.mockImplementation(http.getDeviceInfo.bind(http));
					httpClient.getLoginSettings.mockImplementation(http.getLoginSettings.bind(http));
					httpClient.getDeviceStatus.mockImplementation(http.getDeviceStatus.bind(http));
					const channel = Object.assign(new ShellyV1ChannelEntity(), { id: 'channel' });
					channelsService.findOneBy.mockResolvedValue(channel);
					channelsService.update.mockResolvedValue(channel);
					channelsPropertiesService.findOneBy.mockResolvedValue(new ShellyV1ChannelPropertyEntity());
					if (stage === 'stable') await expect(service.mapDevice(event)).resolves.toBe(device);
					else await expect(service.mapDevice(event)).rejects.toThrow('endpoint changed');
					expect(foreignRequests).toEqual([]);
					const reachedStatus = stage === 'status' || stage === 'stable';
					expect(statusAuth).toEqual(
						reachedStatus ? ['Basic ' + Buffer.from('operator:fixture').toString('base64')] : [],
					);
					expect(shelliesAdapter.setDeviceAuthCredentials).toHaveBeenCalledTimes(stage === 'login' ? 0 : 1);
					expect(devicesService.update).toHaveBeenCalledTimes(stage === 'catalog' ? 1 : 0);
				} finally {
					await Promise.all(
						[original, foreign].map(
							(server) =>
								new Promise<void>((resolve) => {
									server.closeAllConnections();
									server.close(() => resolve());
								}),
						),
					);
				}
			},
		);

		it.each([
			['missing', 'AABBCCABC123', '192.168.1.9'],
			['missing', 'AABBCCABC123', null],
			['missing', 'AABBCCABC123', ''],
			['missing', 'AABBCCABC123', '192.168.1.100'],
			['conflicting', 'AABBCCABC123', '192.168.1.9'],
			['unconfirmed legacy', null, '192.168.1.9'],
		])(
			'preserves the mapped endpoint and identity when rediscovery reports a %s identity',
			async (identity, pin, previousHost) => {
				const event = makeNormalizedEvent();
				const peer = makeShellyDevice();
				shelliesAdapter.getDevice.mockReturnValue(peer as ShellyDevice);
				devicesService.findOneBy.mockResolvedValue(
					Object.assign(new ShellyV1DeviceEntity(), {
						id: 'existing',
						identifier: event.id,
						hostname: previousHost,
						enabled: true,
					}),
				);
				identities.expected.mockResolvedValue(pin);
				if (pin) identities.findPin.mockResolvedValue({ mac: pin, verifiedHost: '192.168.1.9' });
				httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings() as ShellySettingsResponse);
				if (identity === 'missing') httpClient.getDeviceInfo.mockRejectedValue(new Error('unreachable'));
				else httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), mac: '112233ABC123' });
				await expect(service.mapDevice(event)).rejects.toThrow('adopted identity');
				expect(devicesService.update).not.toHaveBeenCalled();
				expect(channelsPropertiesService.update).not.toHaveBeenCalled();
				expect(identities.createDevice).not.toHaveBeenCalled();
			},
		);

		it.each(['AABBCCABC123', null])(
			'preserves the serial on a failed probe at its current host (pin %s)',
			async (pin) => {
				const event = makeNormalizedEvent();
				shelliesAdapter.getDevice.mockReturnValue(makeShellyDevice() as ShellyDevice);
				const existing = Object.assign(new ShellyV1DeviceEntity(), {
					id: 'existing',
					identifier: event.id,
					hostname: event.host,
					enabled: true,
				});
				devicesService.findOneBy.mockResolvedValue(existing);
				identities.expected.mockResolvedValue(pin);
				if (pin) identities.findPin.mockResolvedValue({ mac: pin, verifiedHost: event.host });
				httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings() as ShellySettingsResponse);
				httpClient.getDeviceInfo.mockRejectedValue(new Error('sleeping'));
				httpClient.getDeviceStatus.mockRejectedValue(new Error('sleeping'));
				const channel = Object.assign(new ShellyV1ChannelEntity(), { id: 'channel' });
				channelsService.findOneBy.mockResolvedValue(channel);
				channelsService.update.mockResolvedValue(channel);
				channelsPropertiesService.findOneBy.mockImplementation((_column, identifier) =>
					Promise.resolve(Object.assign(new ShellyV1ChannelPropertyEntity(), { id: String(identifier) })),
				);
				await expect(service.mapDevice(event)).resolves.toBe(existing);
				const serial = channelsPropertiesService.update.mock.calls.find(
					([id]) => id === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				);
				expect(serial).toBeDefined();
				expect(serial?.[1].value).toEqual(pin ?? undefined);
				expect(identities.createDevice).not.toHaveBeenCalled();
			},
		);

		it('should update existing device and not create duplicate', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('Updated Name') as any);
			httpClient.getDeviceInfo.mockResolvedValue(makeMockInfo());
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			// Existing device
			const existingDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
				name: 'Old Name',
			});
			devicesService.findOneBy.mockResolvedValue(existingDevice);
			devicesService.update.mockResolvedValue(existingDevice); // Return the device after update

			// Mock channel and property lookups
			const mockChannel = Object.assign(new ShellyV1ChannelEntity(), {
				id: 'channel-relay-uuid',
				identifier: 'relay_0',
			});
			channelsService.findOneBy.mockResolvedValue(mockChannel);
			channelsService.update.mockResolvedValue(mockChannel);

			const mockProperty = Object.assign(new ShellyV1ChannelPropertyEntity(), {
				id: 'prop-state-uuid',
				identifier: 'state',
			});
			channelsPropertiesService.findOneBy.mockResolvedValue(mockProperty);

			const result = await service.mapDevice(event);

			// Verify device was updated, not created
			expect(identities.createDevice).not.toHaveBeenCalled();
			expect(devicesService.create).not.toHaveBeenCalled();
			expect(devicesService.update).toHaveBeenCalledWith(
				'device-uuid',
				expect.objectContaining({
					hostname: '192.168.1.100',
					type: DEVICES_SHELLY_V1_TYPE,
				}),
			);

			expect(result).toBe(existingDevice);
		});

		it('should create missing channels and properties on existing device', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings() as any);
			httpClient.getDeviceInfo.mockResolvedValue(makeMockInfo());
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			// Existing device
			const existingDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
			});
			devicesService.findOneBy.mockResolvedValue(existingDevice);
			devicesService.update.mockResolvedValue(existingDevice); // Return the device after update

			// No existing channels - return null when looking them up
			channelsService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.findOneBy.mockResolvedValue(null);

			// Mock channel creation - return different channels based on identifier
			channelsService.create.mockImplementation((dto: any) => {
				const channelId = `channel-${dto.identifier}-uuid`;
				return Promise.resolve(
					Object.assign(new ShellyV1ChannelEntity(), {
						id: channelId,
						identifier: dto.identifier,
					}),
				);
			});
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Verify missing channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'relay_0',
				}),
			);

			// Verify missing property was created
			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;
			const statePropertyCall = createCalls.find((call) => call[1]?.identifier === 'state');
			expect(statePropertyCall).toBeDefined();
		});
	});

	describe('Synthetic properties', () => {
		it('should create connection state property on device_information channel', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings() as any);
			httpClient.getDeviceInfo.mockResolvedValue(makeMockInfo());
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const mockChannel = Object.assign(new ShellyV1ChannelEntity(), {
				id: 'channel-device-info-uuid',
				identifier: SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			});
			channelsService.create.mockResolvedValue(mockChannel);
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Verify connection state property was created
			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;
			const statusPropertyCall = createCalls.find(
				(call) => call[1]?.identifier === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.STATUS,
			);
			expect(statusPropertyCall).toBeDefined();
			expect(statusPropertyCall?.[1]).toMatchObject({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.STATUS,
				category: PropertyCategory.STATUS,
				data_type: DataTypeType.ENUM,
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			});
		});
	});

	describe('Device information channel properties', () => {
		it('should create all device info properties from HTTP responses', async () => {
			const event = makeNormalizedEvent('shelly1pm-ABC123', 'SHSW-PM');
			const shellyDevice = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings() as any);
			httpClient.getDeviceInfo.mockResolvedValue({
				type: 'SHSW-PM',
				mac: '8CBFEAABC123',
				auth: false,
				fw: '1.14.0',
				longid: 1234567890,
			});
			httpClient.getDeviceStatus.mockResolvedValue({
				wifi_sta: { connected: true, ssid: 'TestNetwork', ip: '192.168.1.100', rssi: -65 },
				cloud: { enabled: false, connected: false },
				mqtt: { connected: false },
				has_update: false,
				ram_total: 50000,
				ram_free: 35000,
				fs_size: 200000,
				fs_free: 150000,
				uptime: 12345,
			} as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uuid',
				identifier: 'shelly1pm-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const mockChannel = Object.assign(new ShellyV1ChannelEntity(), {
				id: 'channel-device-info-uuid',
				identifier: SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			});
			channelsService.create.mockResolvedValue(mockChannel);
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			const createCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;

			// Verify model property was created with correct value
			const modelPropertyCall = createCalls.find(
				(call) => call[1]?.identifier === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
			);
			expect(modelPropertyCall).toBeDefined();
			expect(modelPropertyCall?.[1]).toMatchObject({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				category: PropertyCategory.MODEL,
			});

			// Verify firmware version property was created
			const firmwarePropertyCall = createCalls.find(
				(call) => call[1]?.identifier === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
			);
			expect(firmwarePropertyCall).toBeDefined();
			expect(firmwarePropertyCall?.[1]).toMatchObject({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
				category: PropertyCategory.FIRMWARE_REVISION,
			});

			// Verify serial number (MAC) property was created
			const serialPropertyCall = createCalls.find(
				(call) => call[1]?.identifier === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
			);
			expect(serialPropertyCall).toBeDefined();
			expect(serialPropertyCall?.[1]).toMatchObject({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				category: PropertyCategory.SERIAL_NUMBER,
			});

			// Verify link quality (RSSI) property was created
			const linkQualityPropertyCall = createCalls.find(
				(call) => call[1]?.identifier === SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
			);
			expect(linkQualityPropertyCall).toBeDefined();
			expect(linkQualityPropertyCall?.[1]).toMatchObject({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
				category: PropertyCategory.LINK_QUALITY,
			});
		});
	});
	describe('Input devices mapping', () => {
		it('should provision Shelly i3 with all 3 input channels and event/detected properties', async () => {
			const event = makeNormalizedEvent('shellyi3-ABC123', 'SHIX3-1');
			const shellyDevice = makeShellyDevice('shellyi3-ABC123', 'SHIX3-1');
			shellyDevice.inputEventCounter0 = 10;
			shellyDevice.inputEventCounter1 = 20;
			shellyDevice.inputEventCounter2 = 30;

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('My i3 Controller') as any);
			httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), type: 'SHIX3-1' });
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-i3-uuid',
				identifier: 'shellyi3-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const createdChannels: any[] = [];
			channelsService.create.mockImplementation((dto: any) => {
				const ch = Object.assign(new ShellyV1ChannelEntity(), {
					id: `channel-${dto.identifier}-uuid`,
					identifier: dto.identifier,
					category: dto.category,
				});
				createdChannels.push(dto);
				return Promise.resolve(ch);
			});
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			// Verify 3 input channels created
			expect(createdChannels).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ identifier: 'input_0', category: ChannelCategory.BUTTON }),
					expect.objectContaining({ identifier: 'input_1', category: ChannelCategory.BUTTON }),
					expect.objectContaining({ identifier: 'input_2', category: ChannelCategory.BUTTON }),
				]),
			);

			// Verify properties created for each input
			const propCalls = (channelsPropertiesService.create as jest.Mock).mock.calls;
			for (let i = 0; i < 3; i++) {
				const detectedProp = propCalls.find(
					(c) => c[0] === `channel-input_${i}-uuid` && c[1]?.identifier === 'detected',
				);
				const eventProp = propCalls.find((c) => c[0] === `channel-input_${i}-uuid` && c[1]?.identifier === 'event');
				expect(detectedProp).toBeDefined();
				expect(detectedProp[1]).toMatchObject({
					identifier: 'detected',
					category: PropertyCategory.DETECTED,
					data_type: DataTypeType.BOOL,
				});
				expect(eventProp).toBeDefined();
				expect(eventProp[1]).toMatchObject({
					identifier: 'event',
					category: PropertyCategory.EVENT,
					data_type: DataTypeType.ENUM,
				});
			}
		});

		it('should provision Shelly Button1 with button input and battery channels', async () => {
			const event = makeNormalizedEvent('shellybutton1-ABC123', 'SHBTN-1');
			const shellyDevice = makeShellyDevice('shellybutton1-ABC123', 'SHBTN-1');
			shellyDevice.battery = 95;
			shellyDevice.inputEventCounter0 = 5;

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('Button 1') as any);
			httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), type: 'SHBTN-1' });
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-btn-uuid',
				identifier: 'shellybutton1-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const createdChannels: any[] = [];
			channelsService.create.mockImplementation((dto: any) => {
				const ch = Object.assign(new ShellyV1ChannelEntity(), {
					id: `channel-${dto.identifier}-uuid`,
					identifier: dto.identifier,
					category: dto.category,
				});
				createdChannels.push(dto);
				return Promise.resolve(ch);
			});
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			expect(createdChannels).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ identifier: 'input_0', category: ChannelCategory.BUTTON }),
					expect.objectContaining({ identifier: 'battery_0', category: ChannelCategory.BATTERY }),
				]),
			);
		});

		it('should provision Shelly Uni with relays, inputs, and analog voltage channels', async () => {
			const event = makeNormalizedEvent('shellyuni-ABC123', 'SHUNI-1');
			const shellyDevice = makeShellyDevice('shellyuni-ABC123', 'SHUNI-1');
			shellyDevice.voltage0 = 12.3;

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as any);
			httpClient.getDeviceSettings.mockResolvedValue(makeMockSettings('Uni Controller') as any);
			httpClient.getDeviceInfo.mockResolvedValue({ ...makeMockInfo(), type: 'SHUNI-1' });
			httpClient.getDeviceStatus.mockResolvedValue(makeMockStatus() as any);

			devicesService.findOneBy.mockResolvedValue(null);

			const mockDevice = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'device-uni-uuid',
				identifier: 'shellyuni-ABC123',
			});
			devicesService.create.mockResolvedValue(mockDevice);

			const createdChannels: any[] = [];
			channelsService.create.mockImplementation((dto: any) => {
				const ch = Object.assign(new ShellyV1ChannelEntity(), {
					id: `channel-${dto.identifier}-uuid`,
					identifier: dto.identifier,
					category: dto.category,
				});
				createdChannels.push(dto);
				return Promise.resolve(ch);
			});
			channelsPropertiesService.create.mockResolvedValue({} as any);

			await service.mapDevice(event);

			expect(createdChannels).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ identifier: 'relay_0', category: ChannelCategory.SWITCHER }),
					expect.objectContaining({ identifier: 'relay_1', category: ChannelCategory.SWITCHER }),
					expect.objectContaining({ identifier: 'input_0', category: ChannelCategory.BUTTON }),
					expect.objectContaining({ identifier: 'input_1', category: ChannelCategory.BUTTON }),
					expect.objectContaining({ identifier: 'voltage_0', category: ChannelCategory.ANALOG_INPUT }),
				]),
			);
		});
	});
});
