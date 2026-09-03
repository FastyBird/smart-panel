import { FastifyRequest } from 'fastify';

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ClientAddressService, ResolvedClientAddress } from '../../api/services/client-address.service';
import { TokensService } from '../../auth/services/tokens.service';
import { ConfigService } from '../../config/services/config.service';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';
import { DisplaysConfigModel } from '../models/config.model';
import { DisplaysService } from '../services/displays.service';
import { PermitJoinService } from '../services/permit-join.service';
import { isLocalhost } from '../utils/ip.utils';

@Injectable()
export class RegistrationGuard implements CanActivate {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'RegistrationGuard');

	constructor(
		private readonly configService: ConfigService,
		private readonly permitJoinService: PermitJoinService,
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
		private readonly clientAddressService: ClientAddressService,
	) {}

	/**
	 * Get displays module configuration
	 */
	private getConfig(): DisplaysConfigModel {
		try {
			return this.configService.getModuleConfig<DisplaysConfigModel>(DISPLAYS_MODULE_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load displays configuration, using defaults',
				error instanceof Error ? error : String(error),
			);

			// Return default configuration
			const defaultConfig = new DisplaysConfigModel();
			defaultConfig.type = DISPLAYS_MODULE_NAME;
			defaultConfig.deploymentMode = DeploymentMode.COMBINED;
			defaultConfig.permitJoinDurationMs = 120000;

			return defaultConfig;
		}
	}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const resolved = this.clientAddressService.resolve(request);
		const clientIp = resolved.address;
		const config = this.getConfig();
		const mode = config.deploymentMode;

		// Localhost registrations are always allowed without permit join in all modes.
		// This allows local development and all-in-one deployments. Requires a
		// genuinely direct connection — neither of these may borrow the bypass:
		//   - `ignoredForwardedHeaders`: the peer itself is untrusted but sent
		//     forwarding headers (e.g. an unrecognised reverse proxy bound to
		//     loopback — cloudflared, `tailscale serve`, a local nginx).
		//     ClientAddressService already ignored those headers, so `clientIp`
		//     is just the proxy's own loopback address, not the real client.
		//   - `forwarded`: a *trusted* proxy's right-most-untrusted
		//     X-Forwarded-For entry happens to be a loopback address — that is
		//     the proxy relaying what its own client claimed, not this backend's
		//     own loopback interface.
		// Falling through to the permit-join gate below in either case is what
		// keeps that remote client from getting an unauthenticated display token.
		// Multiple localhost displays are allowed (each has unique MAC address)
		if (isLocalhost(clientIp) && !resolved.forwarded && !resolved.ignoredForwardedHeaders) {
			return true;
		}

		// Mode 2: All-in-One - only localhost allowed
		if (mode === DeploymentMode.ALL_IN_ONE) {
			this.logger.warn(`Rejected: ${this.describeNonLocalReason(resolved)} in all-in-one mode`);
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

	/**
	 * Human-readable reason the loopback bypass above was refused, for the
	 * all-in-one-mode rejection log. `resolved.address` can itself be a
	 * loopback address here — an untrusted peer's ignored headers, or a
	 * trusted proxy's forwarded address, can both resolve to `127.0.0.1` —
	 * so a flat "IP is not localhost" would misstate why the request was
	 * actually rejected.
	 */
	private describeNonLocalReason(resolved: ResolvedClientAddress): string {
		if (resolved.ignoredForwardedHeaders) {
			return `forwarding headers from an untrusted peer (${resolved.peer})`;
		}

		if (resolved.forwarded) {
			return `a forwarded address (${resolved.address} via trusted peer ${resolved.peer})`;
		}

		return `IP ${resolved.address} is not localhost`;
	}
}
