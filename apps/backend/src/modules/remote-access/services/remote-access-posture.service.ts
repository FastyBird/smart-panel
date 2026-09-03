import { Injectable } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessConfigModel } from '../models/config.model';
import { RemoteAccessAdvisoryModel } from '../models/provider.model';
import { RemoteAccessAdvisorySeverity } from '../platforms/remote-access-provider.platform';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { RemoteAccessStatusService } from './remote-access-status.service';
import { RemoteAccessUrlService } from './remote-access-url.service';

/**
 * Module-level posture advisories, recomputed fresh on every call (no
 * caching, since it is only ever read on demand by the `/status` endpoint):
 * `external-url-insecure` (the manual `external_url` is HTTP),
 * `forwarded-headers-without-proxies` (header trust on, empty allow-list),
 * `public-exposure` (any ranked external endpoint is public scope), plus a
 * pass-through of every cached provider's own advisories.
 */
@Injectable()
export class RemoteAccessPostureService {
	constructor(
		private readonly configService: ConfigService,
		private readonly urlService: RemoteAccessUrlService,
		private readonly statusService: RemoteAccessStatusService,
	) {}

	getAdvisories(): RemoteAccessAdvisoryModel[] {
		const config = this.configService.getModuleConfig<RemoteAccessConfigModel>(REMOTE_ACCESS_MODULE_NAME);
		const advisories: RemoteAccessAdvisoryModel[] = [];

		if (config.externalUrl && config.externalUrl.startsWith('http://')) {
			advisories.push(
				this.build(
					'external-url-insecure',
					'warning',
					'The manual external URL uses HTTP; traffic between a remote client and this installation is not encrypted.',
				),
			);
		}

		if (config.trustForwardedHeaders && config.trustedProxies.length === 0) {
			advisories.push(
				this.build(
					'forwarded-headers-without-proxies',
					'warning',
					'Forwarded headers are trusted, but no trusted proxy addresses are configured, so no peer can present them.',
				),
			);
		}

		if (this.urlService.getUrls().external.some((endpoint) => endpoint.scope === 'public')) {
			advisories.push(
				this.build(
					'public-exposure',
					'warning',
					'This installation is reachable from the public internet through at least one endpoint.',
				),
			);
		}

		for (const status of this.statusService.getCachedStatuses()) {
			for (const advisory of status.advisories) {
				advisories.push(
					toInstance(RemoteAccessAdvisoryModel, { ...advisory, provider: advisory.provider ?? status.type }),
				);
			}
		}

		return advisories;
	}

	private build(code: string, severity: RemoteAccessAdvisorySeverity, message: string): RemoteAccessAdvisoryModel {
		return toInstance(RemoteAccessAdvisoryModel, { code, severity, message });
	}
}
