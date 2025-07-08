import { Injectable, Logger } from '@nestjs/common';

import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { PlatformService } from '../../platform/services/platform.service';

@Injectable()
export class SystemCommandService {
	private readonly logger = new Logger(SystemCommandService.name);

	constructor(private readonly platformService: PlatformService) {}

	async reboot(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.platformService.reboot();

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}

	async powerOff(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.platformService.powerOff();

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}

	async factoryReset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.platformService.factoryReset();

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}
}
