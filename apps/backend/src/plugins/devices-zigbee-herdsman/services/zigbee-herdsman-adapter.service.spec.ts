import { Test, TestingModule } from '@nestjs/testing';

import { ZigbeeHerdsmanAdapterService } from './zigbee-herdsman-adapter.service';

describe('ZigbeeHerdsmanAdapterService', () => {
	let service: ZigbeeHerdsmanAdapterService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ZigbeeHerdsmanAdapterService],
		}).compile();

		service = module.get<ZigbeeHerdsmanAdapterService>(ZigbeeHerdsmanAdapterService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('initial state', () => {
		it('should not be started initially', () => {
			expect(service.isStarted()).toBe(false);
		});

		it('should not have permit join enabled', () => {
			expect(service.isPermitJoinEnabled()).toBe(false);
		});

		it('should have empty discovered devices', () => {
			expect(service.getDiscoveredDevices()).toEqual([]);
		});

		it('should return null for coordinator info when not started', async () => {
			expect(await service.getCoordinatorInfo()).toBeNull();
		});
	});

	describe('setCallbacks', () => {
		it('should accept callbacks without error', () => {
			expect(() => {
				service.setCallbacks({
					onDeviceJoined: async () => {},
					onMessage: async () => {},
				});
			}).not.toThrow();
		});
	});

	describe('stop', () => {
		it('should handle stop when not started', async () => {
			await expect(service.stop()).resolves.toBeUndefined();
		});
	});

	describe('permitJoin', () => {
		it('should throw when adapter not started', async () => {
			await expect(service.permitJoin(true)).rejects.toThrow('Adapter not started');
		});
	});

	describe('removeDevice', () => {
		it('should throw when adapter not started', async () => {
			await expect(service.removeDevice('0x00124b002216a490')).rejects.toThrow('Adapter not started');
		});
	});

	describe('sendCommand', () => {
		it('should throw when adapter not started', async () => {
			await expect(service.sendCommand('0x00124b002216a490', 1, 'genOnOff', 'toggle', {})).rejects.toThrow(
				'Adapter not started',
			);
		});
	});
});
