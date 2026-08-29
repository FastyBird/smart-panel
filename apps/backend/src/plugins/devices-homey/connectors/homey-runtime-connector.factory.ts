import { Injectable } from '@nestjs/common';

import { HomeyConnectionMode } from '../devices-homey.constants';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';

import { HomeyCloudConnectorFactory } from './homey-cloud-connector.factory';
import { HomeyConnectorFactory, HomeyConnectorFactoryConfig } from './homey-connector.factory';
import { HomeyConnector } from './homey-connector.interface';
import { HomeyLocalConnectorFactory } from './homey-local-connector.factory';

@Injectable()
export class HomeyRuntimeConnectorFactory implements HomeyConnectorFactory {
	constructor(
		private readonly localFactory: HomeyLocalConnectorFactory,
		private readonly cloudFactory: HomeyCloudConnectorFactory,
	) {}

	create(config: HomeyConnectorFactoryConfig): HomeyConnector {
		switch (config.mode) {
			case HomeyConnectionMode.LOCAL:
				return this.localFactory.create(config);
			case HomeyConnectionMode.CLOUD:
				return this.cloudFactory.create(config);
			default:
				throw new HomeyConnectorError(HomeyConnectorErrorCategory.UNSUPPORTED, HomeyConnectorOperation.CONNECT);
		}
	}
}
