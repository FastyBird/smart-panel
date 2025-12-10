import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DisplaysConfigModel } from '../models/config.model';
import { DISPLAYS_MODULE_NAME } from '../displays.constants';

@Injectable()
export class PermitJoinService {
	private readonly logger = new Logger(PermitJoinService.name);

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
			this.logger.warn('[PERMIT JOIN] Failed to load displays configuration, using defaults', error);

			// Return default configuration
			const defaultConfig = new DisplaysConfigModel();
			defaultConfig.type = DISPLAYS_MODULE_NAME;
			defaultConfig.deploymentMode = 'combined' as any;
			defaultConfig.permitJoinDurationMs = 120000;

			return defaultConfig;
		}
	}

	/**
	 * Activate permit join for the configured duration
	 */
	activatePermitJoin(): void {
		const config = this.getConfig();
		const duration = config.permitJoinDurationMs;

		this.permitJoinActive = true;
		this.permitJoinExpiresAt = new Date(Date.now() + duration);

		this.logger.debug(`[PERMIT JOIN] Activated for ${duration}ms, expires at ${this.permitJoinExpiresAt.toISOString()}`);
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
			this.logger.debug('[PERMIT JOIN] Expired');
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
		this.logger.debug('[PERMIT JOIN] Deactivated');
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
}
