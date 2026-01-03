import { Request } from 'express';

import { CanActivate, ConflictException, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { ConfigService } from '../../config/services/config.service';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';
import { DisplaysConfigModel } from '../models/config.model';
import { DisplaysService } from '../services/displays.service';
import { PermitJoinService } from '../services/permit-join.service';
import { extractClientIp, isLocalhost } from '../utils/ip.utils';

@Injectable()
export class RegistrationGuard implements CanActivate {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'RegistrationGuard');

	constructor(
		private readonly configService: ConfigService,
		private readonly permitJoinService: PermitJoinService,
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
	) {}

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

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const clientIp = extractClientIp(request);
		const config = this.getConfig();
		const mode = config.deploymentMode;

		// Localhost registrations are always allowed without permit join in all modes
		// This allows local development and all-in-one deployments
		if (isLocalhost(clientIp)) {
			// Check if localhost display already exists
			const localhostDisplay = await this.displaysService.findByRegisteredFromIp(clientIp);
			if (localhostDisplay) {
				// Check if the existing display has any active (non-revoked) tokens
				// If all tokens are revoked, allow re-registration
				const displayTokens = await this.tokensService.findByOwnerId(localhostDisplay.id, TokenOwnerType.DISPLAY);
				const hasActiveTokens = displayTokens.some((token) => !token.revoked);

				if (hasActiveTokens) {
					this.logger.warn(`Rejected: Display already registered with localhost IP ${clientIp} and has active tokens`);
					throw new ConflictException('Display already registered with localhost IP address');
				}

				// Display exists but all tokens are revoked - allow re-registration
				return true;
			}
			return true;
		}

		// Mode 2: All-in-One - only localhost allowed
		if (mode === DeploymentMode.ALL_IN_ONE) {
			this.logger.warn(`Rejected: IP ${clientIp} is not localhost in all-in-one mode`);
			throw new ForbiddenException('Only localhost registrations are allowed in all-in-one mode');
		}

		// For non-localhost in STANDALONE or COMBINED modes, require permit join
		if (!this.permitJoinService.isPermitJoinActive()) {
			this.logger.warn(`Rejected: Permit join is not active`);
			throw new ForbiddenException(
				'Registration is not currently permitted. Please activate permit join in the admin panel.',
			);
		}
		return true;
	}
}
