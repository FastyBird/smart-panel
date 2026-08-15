import { HomeyConnector } from './homey-connector.interface';

export interface HomeyConnectorFactoryConfig {
	readonly url: string;
	readonly apiKey: string;
	readonly connectionTimeout: number;
}

/**
 * Creates a fresh connector for one saved Homey configuration generation.
 * The production transport remains behind this boundary until live SHS proof
 * selects the SDK or direct protocol adapter.
 */
export interface HomeyConnectorFactory {
	create(config: HomeyConnectorFactoryConfig): HomeyConnector;
}
