import { Injectable } from '@nestjs/common';

import { HomeyCloudSdkSessionFactoryService } from '../services/homey-cloud-sdk-session.factory';

import { HomeyCloudConnector } from './homey-cloud.connector';
import { HomeyCloudConnectorFactoryConfig } from './homey-connector.factory';
import { HomeyConnector } from './homey-connector.interface';
import { HomeySdkTransport } from './homey-sdk.transport';

@Injectable()
export class HomeyCloudConnectorFactory {
	constructor(private readonly sessionFactory: HomeyCloudSdkSessionFactoryService) {}

	create(config: HomeyCloudConnectorFactoryConfig): HomeyConnector {
		return new HomeyCloudConnector(new HomeySdkTransport(config, this.sessionFactory));
	}
}
