import { Inject, Injectable } from '@nestjs/common';

import { HomeyLocalConnectorFactoryConfig } from './homey-connector.factory';
import { HomeyConnector } from './homey-connector.interface';
import { HomeyLocalConnector } from './homey-local.connector';
import { HomeySdkClientFactory, HomeySdkClientFactoryService } from './homey-sdk.client';
import { HomeySdkTransport } from './homey-sdk.transport';

@Injectable()
export class HomeyLocalConnectorFactory {
	constructor(
		@Inject(HomeySdkClientFactoryService)
		private readonly sdkFactory: HomeySdkClientFactory,
	) {}

	create(config: HomeyLocalConnectorFactoryConfig): HomeyConnector {
		return new HomeyLocalConnector(
			new HomeySdkTransport(config, {
				createClient: () => this.sdkFactory.createLocalApi({ address: config.url, token: config.apiKey }),
			}),
		);
	}
}
