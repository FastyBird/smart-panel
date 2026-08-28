import { Inject, Injectable } from '@nestjs/common';

import { HomeyConnectorFactory, HomeyConnectorFactoryConfig } from './homey-connector.factory';
import { HomeyConnector } from './homey-connector.interface';
import { HomeyLocalConnector } from './homey-local.connector';
import { HomeySdkClientFactory, HomeySdkClientFactoryService } from './homey-sdk.client';
import { HomeySdkTransport } from './homey-sdk.transport';

@Injectable()
export class HomeyLocalConnectorFactory implements HomeyConnectorFactory {
	constructor(
		@Inject(HomeySdkClientFactoryService)
		private readonly sdkFactory: HomeySdkClientFactory,
	) {}

	create(config: HomeyConnectorFactoryConfig): HomeyConnector {
		return new HomeyLocalConnector(new HomeySdkTransport(config, this.sdkFactory));
	}
}
