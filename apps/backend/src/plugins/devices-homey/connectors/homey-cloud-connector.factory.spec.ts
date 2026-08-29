import { HomeyConnectionMode } from '../devices-homey.constants';
import { HomeyCloudSdkSessionFactoryService } from '../services/homey-cloud-sdk-session.factory';

import { HomeyCloudConnectorFactory } from './homey-cloud-connector.factory';
import { HomeyCloudConnector } from './homey-cloud.connector';
import { HomeySdkClient } from './homey-sdk.client';

describe('HomeyCloudConnectorFactory', () => {
	it('opens the active cloud session through the shared SDK transport', async () => {
		const client = createSdkClient();
		const sessionFactory = { createClient: jest.fn().mockResolvedValue(client) };
		const factory = new HomeyCloudConnectorFactory(sessionFactory as unknown as HomeyCloudSdkSessionFactoryService);
		const connector = factory.create({ mode: HomeyConnectionMode.CLOUD, connectionTimeout: 1000 });

		expect(connector).toBeInstanceOf(HomeyCloudConnector);
		await connector.connect();
		await expect(connector.getSystemInfo()).resolves.toMatchObject({
			id: 'cloud-homey',
			name: 'Cloud Homey',
			version: '13.4.1',
		});
		expect(sessionFactory.createClient).toHaveBeenCalledTimes(1);
		await connector.disconnect();
		expect((client.disconnect as jest.Mock).mock.calls).toHaveLength(1);
		expect((client.destroy as jest.Mock).mock.calls).toHaveLength(1);
	});
});

const createSdkClient = (): HomeySdkClient => ({
	id: 'cloud-homey',
	name: 'Cloud Homey',
	version: '13.4.1',
	devices: {
		connect: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined),
		getDevice: jest.fn(),
		getDevices: jest.fn().mockResolvedValue({}),
		on: jest.fn(),
		setCapabilityValue: jest.fn().mockResolvedValue(undefined),
	},
	system: { getInfo: jest.fn().mockResolvedValue({ homeyVersion: '13.4.1' }) },
	zones: {
		connect: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined),
		getZones: jest.fn().mockResolvedValue({}),
		on: jest.fn(),
	},
	disconnect: jest.fn().mockResolvedValue(undefined),
	destroy: jest.fn(),
});
