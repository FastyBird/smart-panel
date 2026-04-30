/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
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
		// permit_join was never enabled in this session, so end() should NOT have called setPermitJoin
		expect(zigbee2mqttService.setPermitJoin).not.toHaveBeenCalled();
	});

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
				exposes: [{ type: 'light', name: 'light', features: [], property: undefined, label: undefined, access: 7 }],
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
				suggestedCategory: null,
				channels: [],
				warnings: [],
				readyToAdopt: false,
				exposes: [],
			});
			const snapshot = await service.start();
			expect(snapshot.devices[0]?.status).toBe('unsupported');
		});
	});
});
