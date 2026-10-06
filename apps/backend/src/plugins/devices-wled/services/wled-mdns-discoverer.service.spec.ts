import Bonjour, { Service } from 'bonjour-service';

import { ExtensionLoggerService } from '../../../common/logger';

import { WledMdnsDiscovererService } from './wled-mdns-discoverer.service';

jest.mock('bonjour-service', () => ({
	__esModule: true,
	default: jest.fn(),
}));

const browser = { stop: jest.fn() };
const bonjour = {
	find: jest.fn((_options: unknown, _onFound: (service: Service) => void) => browser),
	destroy: jest.fn(),
};
const BonjourMock = Bonjour as unknown as jest.Mock;

describe('WledMdnsDiscovererService', () => {
	beforeEach(() => {
		browser.stop.mockReset();
		bonjour.find.mockReset().mockReturnValue(browser);
		bonjour.destroy.mockReset();
		BonjourMock.mockReset().mockImplementation(() => bonjour);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('logs late response-send failures and preserves discovery and stop/start', () => {
		const warn = jest.spyOn(ExtensionLoggerService.prototype, 'warn').mockImplementation();
		const service = new WledMdnsDiscovererService();
		const onDeviceDiscovered = jest.fn();
		service.setCallbacks({ onDeviceDiscovered });
		service.start();
		const [, onError] = BonjourMock.mock.calls[0] as [unknown, (error: Error) => void];
		const error = Object.assign(new Error('send ENETUNREACH 224.0.0.251:5353'), { code: 'ENETUNREACH' });

		expect(() => onError(error)).not.toThrow();
		expect(warn).toHaveBeenCalledWith(`mDNS response send failed: ${error.message}`, error);
		expect(service.isDiscoveryRunning()).toBe(true);
		expect(bonjour.destroy).not.toHaveBeenCalled();

		const onFound = bonjour.find.mock.calls[0][1] as (service: Service) => void;
		onFound({ name: 'LED strip', addresses: ['192.0.2.10'], port: 80, txt: {} } as Service);
		expect(onDeviceDiscovered).toHaveBeenCalledWith(expect.objectContaining({ host: '192.0.2.10' }));

		service.stop();
		service.start();
		expect(browser.stop).toHaveBeenCalledTimes(1);
		expect(bonjour.destroy).toHaveBeenCalledTimes(1);
		expect(BonjourMock).toHaveBeenCalledTimes(2);
		expect(service.isDiscoveryRunning()).toBe(true);
		service.stop();
	});
});
