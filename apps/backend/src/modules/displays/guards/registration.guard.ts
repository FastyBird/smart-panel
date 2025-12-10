import { Request } from 'express';

import {
	CanActivate,
	ConflictException,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	Logger,
} from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';
import { DisplaysConfigModel } from '../models/config.model';
import { DisplaysService } from '../services/displays.service';
import { PermitJoinService } from '../services/permit-join.service';
import { extractClientIp, isLocalhost } from '../utils/ip.utils';

@Injectable()
export class RegistrationGuard implements CanActivate {
	private readonly logger = new Logger(RegistrationGuard.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly permitJoinService: PermitJoinService,
		private readonly displaysService: DisplaysService,
	) {}

	/**
	 * Get displays module configuration
	 */
	private getConfig(): DisplaysConfigModel {
		try {
			return this.configService.getModuleConfig<DisplaysConfigModel>(DISPLAYS_MODULE_NAME);
		} catch (error) {
			this.logger.warn('[REGISTRATION GUARD] Failed to load displays configuration, using defaults', error);

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

		this.logger.debug(`[REGISTRATION GUARD] Registration attempt from IP=${clientIp}, mode=${mode}`);

		// Mode 2: All-in-One - trust localhost only
		if (mode === DeploymentMode.ALL_IN_ONE) {
			if (!isLocalhost(clientIp)) {
				this.logger.warn(`[REGISTRATION GUARD] Rejected: IP ${clientIp} is not localhost in all-in-one mode`);
				throw new ForbiddenException('Only localhost registrations are allowed in all-in-one mode');
			}

			// Check if localhost display already exists
			const localhostDisplay = await this.displaysService.findByRegisteredFromIp(clientIp);
			if (localhostDisplay) {
				this.logger.warn(`[REGISTRATION GUARD] Rejected: Display already registered with localhost IP ${clientIp}`);
				throw new ConflictException('Display already registered with localhost IP address');
			}

			this.logger.debug(`[REGISTRATION GUARD] Allowed: localhost registration in all-in-one mode`);
			return true;
		}

		// Modes 1 & 3: Standalone and Combined
		// Localhost registrations are always allowed in COMBINED mode, even without permit join
		if (mode === DeploymentMode.COMBINED && isLocalhost(clientIp)) {
			// Check if localhost display already exists
			const localhostDisplay = await this.displaysService.findByRegisteredFromIp(clientIp);
			if (localhostDisplay) {
				this.logger.warn(`[REGISTRATION GUARD] Rejected: Display already registered with localhost IP ${clientIp}`);
				throw new ConflictException('Display already registered with localhost IP address');
			}

			this.logger.debug(
				`[REGISTRATION GUARD] Allowed: localhost registration in combined mode (no permit join required)`,
			);
			return true;
		}

		// For non-localhost in STANDALONE or COMBINED modes, require permit join
		if (!this.permitJoinService.isPermitJoinActive()) {
			this.logger.warn(`[REGISTRATION GUARD] Rejected: Permit join is not active`);
			throw new ForbiddenException(
				'Registration is not currently permitted. Please activate permit join in the admin panel.',
			);
		}

		this.logger.debug(`[REGISTRATION GUARD] Allowed: permit join is active`);
		return true;
	}
}
