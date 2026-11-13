import { CanActivate, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { errorName } from '../cameras.exceptions';
import { CamerasConfigModel } from '../models/config.model';

/**
 * Refuses every cameras route while the module is switched off, the same way the MCP endpoint answers 404 when its
 * module is disabled. The provider registry stays injectable, so provider plugins keep working.
 *
 * Fails closed: when the configuration cannot be read the guard answers 503 instead of letting requests through.
 * `ConfigService` fills a default (enabled) entry for every registered module, so an installation upgraded from a
 * version without the cameras module still resolves to enabled and only an unreadable or invalid configuration
 * reaches the failure path.
 */
@Injectable()
export class CamerasModuleEnabledGuard implements CanActivate {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CamerasModuleEnabledGuard');

	constructor(private readonly configService: ConfigService) {}

	canActivate(): boolean {
		if (!this.isEnabled()) {
			throw new NotFoundException('Cameras module is disabled');
		}

		return true;
	}

	private isEnabled(): boolean {
		try {
			return this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME).enabled;
		} catch (error) {
			this.logger.error(`Failed to load cameras configuration, refusing the request (${errorName(error)})`);

			throw new ServiceUnavailableException('Cameras module configuration is unavailable');
		}
	}
}
