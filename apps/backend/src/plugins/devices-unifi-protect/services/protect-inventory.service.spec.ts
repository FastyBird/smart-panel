import { readFileSync } from 'fs';
import { join } from 'path';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ProtectApiClient } from '../client/protect-api.client';
import { ProtectCamera, ProtectLight, ProtectSensor } from '../client/protect-api.types';
import { ProtectConsoleUnavailableError, ProtectDeviceNotFoundError } from '../errors/protect-adoption.error';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';

import { ProtectConnectorService } from './protect-connector.service';
import { ProtectInventoryService } from './protect-inventory.service';

const fixture = (name: string): Record<string, unknown>[] =>
	JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8')) as Record<string, unknown>[];

const wrap = (raw: Record<string, unknown>) => ({ id: raw.id as string, raw });

const IDENTITY = { nvrId: '68b3ace392bf98c9fb76f70c', nvrMacKey: '0cea14003a69' };
const FRONT_DOOR = '600cefafd5f365d6f83c4ef3';

describe('ProtectInventoryService', () => {
	let client: {
		listCameras: jest.Mock;
		listSensors: jest.Mock;
		listLights: jest.Mock;
		getCamera: jest.Mock;
		getSensor: jest.Mock;
		getLight: jest.Mock;
	};
	let connector: { getClient: jest.Mock; getConsoleIdentity: jest.Mock };
	let devicesService: { findAll: jest.Mock };
	let service: ProtectInventoryService;

	beforeEach(() => {
		client = {
			listCameras: jest.fn(() =>
				Promise.resolve([...fixture('cameras.json'), ...fixture('cameras-doorbell.json')].map(wrap)),
			),
			listSensors: jest.fn(() => Promise.resolve(fixture('sensors.json').map(wrap))),
			listLights: jest.fn(() => Promise.resolve(fixture('lights.json').map(wrap))),
			getCamera: jest.fn(),
			getSensor: jest.fn(),
			getLight: jest.fn(),
		};
		connector = {
			getClient: jest.fn(() => client as unknown as ProtectApiClient),
			getConsoleIdentity: jest.fn(() => IDENTITY),
		};
		devicesService = { findAll: jest.fn(() => Promise.resolve([])) };

		const loader = new ProtectMappingLoaderService();

		loader.onModuleInit();
		service = new ProtectInventoryService(
			connector as unknown as ProtectConnectorService,
			devicesService as unknown as DevicesService,
			loader,
		);
	});

	it('lists cameras, doorbells, sensors and floodlights with mapping support', async () => {
		const devices = await service.findAll();

		expect(devices).toHaveLength(6);
		expect(devices.map((device) => device.name)).toEqual([
			'Front door',
			'Garage',
			'Synthetic doorbell',
			'Synthetic doorbell with package camera',
			'Synthetic UP-Sense',
			'Synthetic floodlight',
		]);
		expect(devices.map((device) => device.suggestedCategory)).toEqual([
			'camera',
			'camera',
			'doorbell',
			'doorbell',
			'sensor',
			'lighting',
		]);
		expect(devices.map((device) => device.modelKey)).toEqual([
			'camera',
			'camera',
			'camera',
			'camera',
			'sensor',
			'light',
		]);
		expect(devices.every((device) => device.supported && !device.adopted && device.adoptedDeviceId === null)).toBe(
			true,
		);
		expect(devices[0]).toMatchObject({
			id: FRONT_DOOR,
			identifier: `0cea14003a69:${FRONT_DOOR}`,
			mappingName: 'camera',
			model: 'UVC G5 Dome',
		});
	});

	it('marks an entry adopted when a Protect device has its identifier', async () => {
		devicesService.findAll.mockResolvedValue([
			{ id: 'b1f1a1d0-0000-4000-8000-000000000001', identifier: `0cea14003a69:${FRONT_DOOR}` },
		]);

		const devices = await service.findAll();

		expect(devices[0]).toMatchObject({ adopted: true, adoptedDeviceId: 'b1f1a1d0-0000-4000-8000-000000000001' });
		expect(devices[1].adopted).toBe(false);
	});

	it('keeps the first entry when the console lists an id twice', async () => {
		const devices = await service.findAll();
		const sensors = devices.filter((device) => device.modelKey === 'sensor');
		const first = fixture('sensors.json')[0];

		expect(sensors).toHaveLength(1);
		expect(sensors[0].state).toBe(first.state);
		expect(sensors[0].id).toBe(first.id);
	});

	it('throws unavailable without a client or a console identity', async () => {
		connector.getClient.mockReturnValue(null);

		await expect(service.findAll()).rejects.toEqual(new ProtectConsoleUnavailableError(null));
		await expect(service.fetchDevice(FRONT_DOOR, 'camera')).rejects.toBeInstanceOf(ProtectConsoleUnavailableError);

		connector.getClient.mockReturnValue(client);
		connector.getConsoleIdentity.mockReturnValue(null);

		await expect(service.findOne(FRONT_DOOR)).rejects.toBeInstanceOf(ProtectConsoleUnavailableError);
	});

	it('maps a 404 to not found and other console failures to unavailable', async () => {
		client.getCamera.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.NOT_FOUND, 'cameras/{id}'));
		await expect(service.fetchDevice(FRONT_DOOR, 'camera')).rejects.toBeInstanceOf(ProtectDeviceNotFoundError);

		client.getCamera.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}'));
		await expect(service.fetchDevice(FRONT_DOOR, 'camera')).rejects.toMatchObject({
			name: 'ProtectConsoleUnavailableError',
			category: ProtectErrorCategory.TIMEOUT,
		});

		client.listSensors.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.AUTHENTICATION, 'sensors'));
		await expect(service.findAll()).rejects.toMatchObject({
			name: 'ProtectConsoleUnavailableError',
			category: ProtectErrorCategory.AUTHENTICATION,
		});

		await expect(service.findOne('missing')).rejects.toBeInstanceOf(ProtectDeviceNotFoundError);
	});

	it('reads a sensor and a light by id with their own endpoint', async () => {
		const sensor = fixture('sensors.json')[0];
		const light = fixture('lights.json')[0];

		client.getSensor.mockResolvedValue({ id: sensor.id, raw: sensor } as unknown as ProtectSensor);
		client.getLight.mockResolvedValue({ id: light.id, raw: light } as unknown as ProtectLight);
		client.getCamera.mockResolvedValue({ id: FRONT_DOOR, raw: { id: FRONT_DOOR } } as unknown as ProtectCamera);

		const freshSensor = await service.fetchDevice(sensor.id as string, 'sensor');
		const freshLight = await service.fetchDevice(light.id as string, 'light');

		expect(freshSensor.entry).toEqual({ modelKey: 'sensor', id: sensor.id, raw: sensor });
		expect(freshSensor.identity).toEqual(IDENTITY);
		expect(freshSensor.client).toBe(client);
		expect(freshLight.entry.modelKey).toBe('light');
		expect(client.getSensor).toHaveBeenCalledWith(sensor.id);
		expect(client.getLight).toHaveBeenCalledWith(light.id);
		expect(client.getCamera).not.toHaveBeenCalled();
		expect(client.listCameras).not.toHaveBeenCalled();
		expect(client.listSensors).not.toHaveBeenCalled();
		expect(client.listLights).not.toHaveBeenCalled();
	});

	it('shares one set of console reads between concurrent listings', async () => {
		const [first, second] = await Promise.all([service.findAll(), service.findAll(), service.findOne(FRONT_DOOR)]);

		expect(first).toHaveLength(6);
		expect(second).toHaveLength(6);
		expect(client.listCameras).toHaveBeenCalledTimes(1);

		await service.findAll();

		expect(client.listCameras).toHaveBeenCalledTimes(2);
	});

	it('returns only the documented fields', async () => {
		const [device] = await service.findAll();

		expect(Object.keys(device).sort()).toEqual(
			[
				'id',
				'modelKey',
				'name',
				'model',
				'mac',
				'state',
				'connected',
				'supported',
				'mappingName',
				'suggestedCategory',
				'identifier',
				'adopted',
				'adoptedDeviceId',
			].sort(),
		);
		expect(JSON.stringify(device)).not.toMatch(/rtsps|apiKey|PROTECT_SENTINEL/i);
	});
});
