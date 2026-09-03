import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ApiModule } from '../api/api.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { RemoteAccessController } from './controllers/remote-access.controller';
import { UpdateRemoteAccessConfigDto } from './dto/update-config.dto';
import { RemoteAccessConfigModel } from './models/config.model';
import {
	REMOTE_ACCESS_MODULE_API_TAG_DESCRIPTION,
	REMOTE_ACCESS_MODULE_API_TAG_NAME,
	REMOTE_ACCESS_MODULE_NAME,
} from './remote-access.constants';
import { REMOTE_ACCESS_SWAGGER_EXTRA_MODELS } from './remote-access.openapi';
import { RemoteAccessPostureService } from './services/remote-access-posture.service';
import { RemoteAccessProviderRegistryService } from './services/remote-access-provider-registry.service';
import { RemoteAccessProxyContributionService } from './services/remote-access-proxy-contribution.service';
import { RemoteAccessStatusService } from './services/remote-access-status.service';
import { RemoteAccessUrlService } from './services/remote-access-url.service';

@ApiTag({
	tagName: REMOTE_ACCESS_MODULE_NAME,
	displayName: REMOTE_ACCESS_MODULE_API_TAG_NAME,
	description: REMOTE_ACCESS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ApiModule, NestConfigModule],
	controllers: [RemoteAccessController],
	providers: [
		RemoteAccessProviderRegistryService,
		RemoteAccessStatusService,
		RemoteAccessUrlService,
		RemoteAccessPostureService,
		RemoteAccessProxyContributionService,
	],
	exports: [
		RemoteAccessProviderRegistryService,
		RemoteAccessStatusService,
		RemoteAccessUrlService,
		RemoteAccessPostureService,
	],
})
export class RemoteAccessModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<RemoteAccessConfigModel, UpdateRemoteAccessConfigDto>({
			type: REMOTE_ACCESS_MODULE_NAME,
			class: RemoteAccessConfigModel,
			configDto: UpdateRemoteAccessConfigDto,
		});

		for (const model of REMOTE_ACCESS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: REMOTE_ACCESS_MODULE_NAME,
			name: 'Remote access',
			description: 'Internal/external URL registry, proxy trust and remote-access provider status',
			author: 'FastyBird',
			readme: `# Remote access

> Module · by FastyBird

Owns the "how is this installation reachable" model for the Smart Panel. Tracks the internal URL, an optional manual external URL and every remote-access provider plugin's status, ranks them into a single URL registry, and contributes trusted proxy addresses so the platform resolves the real client behind a tunnel or reverse proxy.

## What it gives you

- **Internal URL** — derived from \`FB_APP_HOST\`/\`FB_BACKEND_PORT\`, or an explicit \`internal_url\` override
- **External URLs** — a manually configured \`external_url\` plus every endpoint published by a connected provider plugin (e.g. Tailscale), ranked HTTPS before HTTP and public before private
- **Trusted proxies** — an allow-list of proxy addresses (\`trusted_proxies\`, gated by \`trust_forwarded_headers\`) plus every connected provider's own proxy addresses, contributed to the platform's shared trusted-proxy registry so forwarded-identity headers are only honoured from a peer that is actually allowed to send them
- **Posture advisories** — flags an insecure (HTTP) external URL, forwarded-header trust with no trusted proxies configured, and any public-facing endpoint

## Provider plugins

This module never shells out and never knows a provider's binary. A remote-access provider plugin (e.g. \`remote-access-tailscale\`) registers itself against this module's provider registry in its own \`onModuleInit\` and reports its status (state, endpoints, proxy addresses, advisories) on demand and whenever it changes. The module aggregates every registered provider into a single status view and folds connected providers' endpoints into the URL registry.

## API Endpoints

- \`GET /api/v1/modules/remote-access/status\` — enabled state, every provider, the URL registry and advisories
- \`GET /api/v1/modules/remote-access/providers\` — every registered provider's live status
- \`GET /api/v1/modules/remote-access/providers/:type\` — a single provider's live status
- \`GET /api/v1/modules/remote-access/urls\` — internal URL, display-only candidates, ranked external URLs and the primary URL`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
