import { HomeyConnectionMode } from '../devices-homey.constants';

import { HomeyConnector } from './homey-connector.interface';

interface HomeyConnectorFactoryBaseConfig {
	readonly connectionTimeout: number;
}

export interface HomeyLocalConnectorFactoryConfig extends HomeyConnectorFactoryBaseConfig {
	readonly mode: HomeyConnectionMode.LOCAL;
	readonly url: string;
	readonly apiKey: string;
}

export interface HomeyCloudConnectorFactoryConfig extends HomeyConnectorFactoryBaseConfig {
	readonly mode: HomeyConnectionMode.CLOUD;
}

export type HomeyConnectorFactoryConfig = HomeyLocalConnectorFactoryConfig | HomeyCloudConnectorFactoryConfig;

/**
 * Creates a fresh connector for one saved Homey configuration generation.
 * The production transport remains behind this boundary until live SHS proof
 * selects the SDK or direct protocol adapter.
 */
export interface HomeyConnectorFactory {
	create(config: HomeyConnectorFactoryConfig): HomeyConnector;
}
