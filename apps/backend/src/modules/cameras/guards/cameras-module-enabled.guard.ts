import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasConfigModel } from '../models/config.model';

/**
 * Refuses every cameras route while the module is switched off, the same way the MCP endpoint answers 404 when its
 * module is disabled. The provider registry stays injectable, so provider plugins keep working.
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
			this.logger.warn(
				'Failed to load cameras configuration, assuming the module is enabled',
				error instanceof Error ? error : String(error),
			);

			return true;
		}
	}
}
