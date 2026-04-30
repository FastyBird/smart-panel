import { Test, TestingModule } from '@nestjs/testing';

import { DevicesService } from '../../../modules/devices/services/devices.service';

import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { Z2mWizardService } from './wizard.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

describe('Z2mWizardService', () => {
	let service: Z2mWizardService;
	let zigbee2mqttService: jest.Mocked<Zigbee2mqttService>;

	beforeEach(async () => {
		jest.useFakeTimers();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Z2mWizardService,
				{
					provide: Zigbee2mqttService,
					useValue: {
						isBridgeOnline: jest.fn().mockReturnValue(true),
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						setPermitJoin: jest.fn().mockResolvedValue(true),
						subscribeToDeviceJoined: jest.fn().mockReturnValue(() => {}),
					},
				},
				{ provide: Z2mDeviceAdoptionService, useValue: { adoptDevice: jest.fn() } },
				{
					provide: Z2mMappingPreviewService,
					useValue: {
						generatePreview: jest.fn().mockResolvedValue({
							suggestedCategory: 'LIGHTING',
							channels: [{ identifier: 'light', name: 'Light', properties: [] }],
							warnings: [],
							readyToAdopt: true,
							exposes: [],
						}),
					},
				},
				{ provide: DevicesService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
			],
		}).compile();

		service = module.get(Z2mWizardService);
		zigbee2mqttService = module.get(Zigbee2mqttService);
	});

	afterEach(async () => {
		await service.onModuleDestroy();
		jest.useRealTimers();
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
		expect(zigbee2mqttService).toBeDefined();
	});
});
