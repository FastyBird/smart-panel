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
							z2mDevice: {
								ieeeAddress: '0x00158d0001a1b2c3',
								friendlyName: 'living_room_lamp',
								manufacturer: 'Philips',
								model: 'LCT001',
								description: null,
							},
							suggestedDevice: { category: 'lighting', name: 'Light', confidence: 'high' },
							exposes: [
								{
									exposeName: 'light',
									exposeType: 'light',
									status: 'mapped',
									suggestedChannel: { category: 'light', name: 'Light', confidence: 'high' },
									suggestedProperties: [
										{
											category: 'on',
											name: 'On',
											z2mProperty: 'state',
											dataType: 'bool',
											permissions: ['rw'],
											format: null,
											required: true,
											currentValue: null,
										},
									],
									missingRequiredProperties: [],
								},
							],
							warnings: [],
							readyToAdopt: true,
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
			expect(snapshot.devices[0]?.suggestedCategory).toBe('lighting');
			expect(snapshot.devices[0]?.previewChannelCount).toBe(1);
			expect(snapshot.devices[0]?.previewChannelIdentifiers).toContain('light');
		});

		it('marks already_registered when device has matching adopted record', async () => {
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
			const findAll = (service as any).devicesService.findAll;
			findAll.mockResolvedValueOnce([
				{ id: 'adopted-1', identifier: 'living_room_lamp', name: 'Existing Lamp', category: 'lighting' },
			]);
			const snapshot = await service.start();
			expect(snapshot.devices[0]?.status).toBe('already_registered');
			expect(snapshot.devices[0]?.registeredDeviceId).toBe('adopted-1');
		});

		it('marks unsupported when mapping preview returns no channels', async () => {
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
			const previewService = (service as any).mappingPreviewService;
			previewService.generatePreview.mockResolvedValueOnce({
				z2mDevice: {
					ieeeAddress: '0x00158d0001a1b2c3',
					friendlyName: 'living_room_lamp',
					manufacturer: null,
					model: null,
					description: null,
				},
				suggestedDevice: { category: 'generic', name: 'Generic', confidence: 'low' },
				exposes: [],
				warnings: [],
				readyToAdopt: false,
			});
			const snapshot = await service.start();
			expect(snapshot.devices[0]?.status).toBe('unsupported');
		});
	});

	describe('permit_join', () => {
		it('enablePermitJoin() sets active=true and remainingSeconds≈254', async () => {
			const started = await service.start();
			const updated = await service.enablePermitJoin(started.id);
			expect(updated?.permitJoin.active).toBe(true);
			expect(updated?.permitJoin.remainingSeconds).toBeGreaterThan(250);
			expect(zigbee2mqttService.setPermitJoin).toHaveBeenCalledWith(254);
		});

		it('disablePermitJoin() sets active=false and remainingSeconds=0', async () => {
			const started = await service.start();
			await service.enablePermitJoin(started.id);
			const updated = await service.disablePermitJoin(started.id);
			expect(updated?.permitJoin.active).toBe(false);
			expect(updated?.permitJoin.remainingSeconds).toBe(0);
			expect(zigbee2mqttService.setPermitJoin).toHaveBeenLastCalledWith(0);
		});

		it('returns null for unknown session id', async () => {
			expect(await service.enablePermitJoin('nope')).toBeNull();
			expect(await service.disablePermitJoin('nope')).toBeNull();
		});

		it('throws when bridge fails to activate permit_join', async () => {
			const started = await service.start();
			zigbee2mqttService.setPermitJoin.mockResolvedValueOnce(false);
			await expect(service.enablePermitJoin(started.id)).rejects.toThrow();
		});
	});

	describe('adopt', () => {
		const ieee = '0x00158d0001a1b2c3';
		const sampleZ2mDevice = {
			ieeeAddress: ieee,
			friendlyName: 'living_room_lamp',
			type: 'Router',
			modelId: 'LCT001',
			supported: true,
			available: true,
			definition: { vendor: 'Philips', model: 'LCT001', description: 'Hue', exposes: [{ type: 'light' }] },
		};

		beforeEach(() => {
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([sampleZ2mDevice as any]);
		});

		it('returns created result on successful adoption', async () => {
			const adoptionService = (service as any).deviceAdoptionService;
			adoptionService.adoptDevice.mockResolvedValueOnce({ id: 'd1', name: 'Living Room Lamp' });
			const started = await service.start();
			const out = await service.adopt(started.id, [
				{ ieeeAddress: ieee, name: 'Living Room Lamp', category: 'lighting' as any },
			]);
			expect(out).toEqual([{ ieeeAddress: ieee, name: 'Living Room Lamp', status: 'created', error: null }]);
			expect(adoptionService.adoptDevice).toHaveBeenCalledWith(
				expect.objectContaining({
					ieeeAddress: ieee,
					name: 'Living Room Lamp',
					category: 'lighting',
					channels: expect.arrayContaining([expect.objectContaining({ category: 'light' })]),
				}),
			);
		});

		it('returns updated result when device was already adopted (race fallback)', async () => {
			const started = await service.start();
			const session = (service as any).sessions.get(started.id);
			session.devices.get(ieee).status = 'already_registered';
			session.devices.get(ieee).registeredDeviceId = 'd1';
			const devicesService = (service as any).devicesService;
			devicesService.update = jest.fn().mockResolvedValue({ id: 'd1' });
			const out = await service.adopt(started.id, [{ ieeeAddress: ieee, name: 'X', category: 'lighting' as any }]);
			expect(out[0]?.status).toBe('updated');
			expect(devicesService.update).toHaveBeenCalledWith(
				'd1',
				expect.objectContaining({ name: 'X', category: 'lighting' }),
			);
		});

		it('returns failed result when adoption throws', async () => {
			const adoptionService = (service as any).deviceAdoptionService;
			adoptionService.adoptDevice.mockRejectedValueOnce(new Error('boom'));
			const started = await service.start();
			const out = await service.adopt(started.id, [{ ieeeAddress: ieee, name: 'X', category: 'lighting' as any }]);
			expect(out[0]?.status).toBe('failed');
			expect(out[0]?.error).toBe('boom');
		});

		it('returns null for unknown session id (so the controller can 404)', async () => {
			const out = await service.adopt('nope', []);
			expect(out).toBeNull();
		});

		it('returns failed when device not in session', async () => {
			const started = await service.start();
			const out = await service.adopt(started.id, [
				{ ieeeAddress: '0xnotinsession', name: 'X', category: 'lighting' as any },
			]);
			expect(out?.[0]?.status).toBe('failed');
			expect(out?.[0]?.error).toContain('not in session');
		});
	});
});
