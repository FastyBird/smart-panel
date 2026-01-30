import { Module, OnModuleInit } from '@nestjs/common';

import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { SecurityController } from './controllers/security.controller';
import { DefaultSecurityProvider } from './providers/default-security.provider';
import {
	SECURITY_MODULE_API_TAG_DESCRIPTION,
	SECURITY_MODULE_API_TAG_NAME,
	SECURITY_MODULE_NAME,
	SECURITY_STATE_PROVIDERS,
} from './security.constants';
import { SECURITY_SWAGGER_EXTRA_MODELS } from './security.openapi';
import { SecurityAggregatorService } from './services/security-aggregator.service';
import { SecurityService } from './services/security.service';

@ApiTag({
	tagName: SECURITY_MODULE_NAME,
	displayName: SECURITY_MODULE_API_TAG_NAME,
	description: SECURITY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [SwaggerModule, ExtensionsModule],
	controllers: [SecurityController],
	providers: [
		DefaultSecurityProvider,
		{
			provide: SECURITY_STATE_PROVIDERS,
			useFactory: (defaultProvider: DefaultSecurityProvider) => [defaultProvider],
			inject: [DefaultSecurityProvider],
		},
		SecurityAggregatorService,
		SecurityService,
	],
	exports: [SecurityService, SECURITY_STATE_PROVIDERS],
})
export class SecurityModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		for (const model of SECURITY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: SECURITY_MODULE_NAME,
			name: 'Security',
			description: 'Security status, armed state, and alert management',
			author: 'FastyBird',
			readme: `# Security Module

The Security module provides security status information for the Smart Panel display.

## Features

- **Armed State** - Track system armed state (disarmed, armed home, armed away, armed night)
- **Alarm State** - Monitor alarm state (idle, pending, triggered, silenced)
- **Alert Severity** - Aggregate alert severity across security devices
- **Extensible** - Provider-based architecture for future integrations

## Endpoints

- \`GET /api/v1/modules/security/status\` - Current security status

## Architecture

The module is designed as a state aggregation layer. Security state providers can be registered
by integration plugins (e.g., Home Assistant, Matter) to supply real device data. Without providers,
the module returns safe default values (disarmed, no alerts).`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
