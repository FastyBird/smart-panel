import Bonjour from 'bonjour-service';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

import { HaMdnsDiscovererService } from './ha-mdns-discoverer.service';

jest.mock('bonjour-service', () => ({
	__esModule: true,
	default: jest.fn(),
}));

const browser = {
	stop: jest.fn(),
};
const bonjour = {
	find: jest.fn(() => browser),
	destroy: jest.fn(),
};
const BonjourMock = Bonjour as unknown as jest.Mock;

describe('HaMdnsDiscovererService', () => {
	let service: HaMdnsDiscovererService;

	beforeEach(() => {
		browser.stop.mockReset();
		bonjour.find.mockReset().mockReturnValue(browser);
		bonjour.destroy.mockReset();
		BonjourMock.mockReset().mockImplementation(() => bonjour);
		service = new HaMdnsDiscovererService({ emit: jest.fn() } as unknown as EventEmitter2);
	});

	it('identifies itself as an always-active plugin service', () => {
		expect(service.owner).toEqual({ kind: 'plugin', type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME });
		expect(service.serviceId).toBe('discovery');
		expect(service.activationPolicy).toBe('always');
	});

	it('starts and stops discovery idempotently', async () => {
		await service.start();
		await service.start();

		expect(BonjourMock).toHaveBeenCalledTimes(1);
		expect(bonjour.find).toHaveBeenCalledWith({ type: 'home-assistant' }, expect.any(Function));
		expect(service.getState()).toBe('started');
		expect(service.isDiscoveryRunning()).toBe(true);
		expect(await service.isHealthy()).toBe(true);

		await service.stop();
		await service.stop();

		expect(browser.stop).toHaveBeenCalledTimes(1);
		expect(bonjour.destroy).toHaveBeenCalledTimes(1);
		expect(service.getState()).toBe('stopped');
		expect(await service.isHealthy()).toBe(false);
	});

	it('refreshes discovery through its managed lifecycle', async () => {
		await service.start();
		await service.refresh();

		expect(BonjourMock).toHaveBeenCalledTimes(2);
		expect(browser.stop).toHaveBeenCalledTimes(1);
		expect(bonjour.destroy).toHaveBeenCalledTimes(1);
		expect(service.getState()).toBe('started');
	});

	it('cleans up partial startup and reports an error when browser creation fails', async () => {
		bonjour.find.mockImplementationOnce(() => {
			throw new Error('Bonjour unavailable');
		});

		await expect(service.start()).rejects.toThrow('Bonjour unavailable');

		expect(bonjour.destroy).toHaveBeenCalledTimes(1);
		expect(service.getState()).toBe('error');
		expect(await service.isHealthy()).toBe(false);
	});
});
