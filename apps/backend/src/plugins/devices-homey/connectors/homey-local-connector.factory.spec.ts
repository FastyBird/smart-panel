import { HomeyLocalConnectorFactory } from './homey-local-connector.factory';
import { HomeyLocalConnector } from './homey-local.connector';
import { HomeySdkClientFactoryService } from './homey-sdk.client';

describe('HomeyLocalConnectorFactory', () => {
	it('creates a distinct connector core for each saved configuration generation', () => {
		const sdkFactory = { createLocalApi: jest.fn() };
		const factory = new HomeyLocalConnectorFactory(sdkFactory as unknown as HomeySdkClientFactoryService);
		const config = {
			url: 'http://homey.invalid:4859',
			apiKey: 'sentinel-api-key',
			connectionTimeout: 1000,
		};

		const first = factory.create(config);
		const second = factory.create(config);

		expect(first).toBeInstanceOf(HomeyLocalConnector);
		expect(second).toBeInstanceOf(HomeyLocalConnector);
		expect(second).not.toBe(first);
		expect(sdkFactory.createLocalApi).not.toHaveBeenCalled();
	});
});
