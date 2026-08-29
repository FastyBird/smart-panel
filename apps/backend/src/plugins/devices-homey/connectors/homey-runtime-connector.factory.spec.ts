import { HomeyConnectionMode } from '../devices-homey.constants';

import { HomeyCloudConnectorFactory } from './homey-cloud-connector.factory';
import { HomeyConnector } from './homey-connector.interface';
import { HomeyLocalConnectorFactory } from './homey-local-connector.factory';
import { HomeyRuntimeConnectorFactory } from './homey-runtime-connector.factory';

describe('HomeyRuntimeConnectorFactory', () => {
	it('selects the connector from the saved mode without crossing credential boundaries', () => {
		const localConnector = {} as HomeyConnector;
		const cloudConnector = {} as HomeyConnector;
		const localFactory = { create: jest.fn().mockReturnValue(localConnector) };
		const cloudFactory = { create: jest.fn().mockReturnValue(cloudConnector) };
		const factory = new HomeyRuntimeConnectorFactory(
			localFactory as unknown as HomeyLocalConnectorFactory,
			cloudFactory as unknown as HomeyCloudConnectorFactory,
		);
		const localConfig = {
			mode: HomeyConnectionMode.LOCAL,
			url: 'http://homey.invalid:4859',
			apiKey: 'sentinel-api-key',
			connectionTimeout: 1000,
		} as const;
		const cloudConfig = { mode: HomeyConnectionMode.CLOUD, connectionTimeout: 2000 } as const;

		expect(factory.create(localConfig)).toBe(localConnector);
		expect(factory.create(cloudConfig)).toBe(cloudConnector);
		expect(localFactory.create).toHaveBeenCalledWith(localConfig);
		expect(cloudFactory.create).toHaveBeenCalledWith(cloudConfig);
	});
});
