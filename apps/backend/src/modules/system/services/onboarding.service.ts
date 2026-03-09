import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../config/services/config.service';
import { DevicesService } from '../../devices/services/devices.service';
import { DisplaysService } from '../../displays/services/displays.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { UsersService } from '../../users/services/users.service';
import { SystemConfigModel } from '../models/config.model';
import { OnboardingStatusModel } from '../models/onboarding.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

@Injectable()
export class OnboardingService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'OnboardingService');

	constructor(
		private readonly usersService: UsersService,
		private readonly devicesService: DevicesService,
		private readonly spacesService: SpacesService,
		private readonly displaysService: DisplaysService,
		private readonly configService: ConfigService,
	) {}

	async getStatus(): Promise<OnboardingStatusModel> {
		this.logger.debug('Fetching onboarding status');

		const [owner, devicesCount, spaces, displays] = await Promise.all([
			this.usersService.findOwner(),
			this.devicesService.getCount(),
			this.spacesService.findAll(),
			this.displaysService.findAll(),
		]);

		const config = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);

		return toInstance(OnboardingStatusModel, {
			hasOwner: owner !== null,
			onboardingCompleted: config.onboardingCompleted ?? false,
			devicesCount,
			spacesCount: spaces.length,
			displaysCount: displays.length,
		});
	}

	async markComplete(): Promise<void> {
		this.logger.log('Marking onboarding as completed');

		this.configService.setModuleConfig(SYSTEM_MODULE_NAME, {
			type: SYSTEM_MODULE_NAME,
			onboarding_completed: true,
		});
	}
}
