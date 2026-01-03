import { BadRequestException, Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';
import { DisplaysConfigModel } from '../models/config.model';

@Injectable()
export class PermitJoinService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'PermitJoinService');

	private permitJoinActive: boolean = false;
	private permitJoinExpiresAt: Date | null = null;

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Get displays module configuration
	 */
	private getConfig(): DisplaysConfigModel {
		try {
			return this.configService.getModuleConfig<DisplaysConfigModel>(DISPLAYS_MODULE_NAME);
		} catch (error) {
			this.logger.warn('Failed to load displays configuration, using defaults', error);

			// Return default configuration
			const defaultConfig = new DisplaysConfigModel();
			defaultConfig.type = DISPLAYS_MODULE_NAME;
			defaultConfig.deploymentMode = DeploymentMode.COMBINED;
			defaultConfig.permitJoinDurationMs = 120000;

			return defaultConfig;
		}
	}

	/**
	 * Activate permit join for the configured duration
	 * @throws BadRequestException if deployment mode is ALL_IN_ONE
	 */
	activatePermitJoin(): void {
		const config = this.getConfig();

		// Permit join is not available in ALL_IN_ONE mode
		if (config.deploymentMode === DeploymentMode.ALL_IN_ONE) {
			this.logger.warn('Cannot activate permit join in all-in-one mode');
			throw new BadRequestException('Permit join is not available in all-in-one deployment mode');
		}

		const duration = config.permitJoinDurationMs;

		this.permitJoinActive = true;
		this.permitJoinExpiresAt = new Date(Date.now() + duration);
	}

	/**
	 * Check if permit join is currently active
	 */
	isPermitJoinActive(): boolean {
		if (!this.permitJoinActive || !this.permitJoinExpiresAt) {
			return false;
		}

		// Check if expired
		if (Date.now() >= this.permitJoinExpiresAt.getTime()) {
			this.permitJoinActive = false;
			this.permitJoinExpiresAt = null;
			return false;
		}

		return true;
	}

	/**
	 * Deactivate permit join immediately
	 */
	deactivatePermitJoin(): void {
		this.permitJoinActive = false;
		this.permitJoinExpiresAt = null;
	}

	/**
	 * Get remaining time in milliseconds, or null if not active
	 */
	getRemainingTime(): number | null {
		if (!this.isPermitJoinActive() || !this.permitJoinExpiresAt) {
			return null;
		}

		return Math.max(0, this.permitJoinExpiresAt.getTime() - Date.now());
	}

	/**
	 * Get expiration date, or null if not active
	 */
	getExpiresAt(): Date | null {
		if (!this.isPermitJoinActive() || !this.permitJoinExpiresAt) {
			return null;
		}

		return this.permitJoinExpiresAt;
	}

	/**
	 * Get deployment mode
	 */
	getDeploymentMode(): DeploymentMode {
		const config = this.getConfig();
		return config.deploymentMode;
	}
}
