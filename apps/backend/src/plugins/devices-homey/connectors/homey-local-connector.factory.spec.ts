import { HomeyLocalConnectorFactory } from './homey-local-connector.factory';
import { HomeyLocalConnector } from './homey-local.connector';
import { HomeySdkClientFactory } from './homey-sdk.client';

describe('HomeyLocalConnectorFactory', () => {
	it('creates a distinct connector core for each saved configuration generation', () => {
		const createLocalApi = jest.fn();
		const sdkFactory: HomeySdkClientFactory = { createLocalApi };
		const factory = new HomeyLocalConnectorFactory(sdkFactory);
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
		expect(createLocalApi).not.toHaveBeenCalled();
	});
});
