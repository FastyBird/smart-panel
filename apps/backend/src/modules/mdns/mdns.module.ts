import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateMdnsConfigDto } from './dto/update-config.dto';
import { MDNS_MODULE_NAME } from './mdns.constants';
import { MDNS_MODULE_SWAGGER_EXTRA_MODELS } from './mdns.openapi';
import { MdnsConfigModel } from './models/config.model';
import { MdnsService } from './services/mdns.service';

@ApiTag({
	tagName: MDNS_MODULE_NAME,
	displayName: 'mDNS module',
	description: 'Endpoints related to mDNS service advertisement configuration.',
})
@Module({
	imports: [NestConfigModule, ConfigModule, ExtensionsModule, SwaggerModule],
	providers: [MdnsService],
	exports: [MdnsService],
})
export class MdnsModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<MdnsConfigModel, UpdateMdnsConfigDto>({
			type: MDNS_MODULE_NAME,
			class: MdnsConfigModel,
			configDto: UpdateMdnsConfigDto,
		});

		for (const model of MDNS_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: MDNS_MODULE_NAME,
			name: 'mDNS',
			description: 'Multicast DNS service advertisement for network discovery',
			author: 'FastyBird',
			readme: `# mDNS Module

The mDNS (Multicast DNS) module enables automatic network discovery of the Smart Panel using Bonjour/Avahi protocols.

## Features

- **Service Advertisement** - Broadcasts Smart Panel presence on the local network
- **Zero Configuration** - Clients can discover the panel without manual IP configuration
- **Custom Naming** - Configure a custom hostname for the panel

## How It Works

When enabled, the Smart Panel advertises itself on the local network as:

\`\`\`
_smart-panel._tcp.local
\`\`\`

This allows:
- Mobile apps to auto-discover the panel
- Other services to find the panel's IP address
- Easy setup without manual network configuration

## Configuration

- **Enabled** - Toggle mDNS advertisement on/off
- **Hostname** - Custom name for network identification

## Requirements

- The Smart Panel must be on the same network segment as discovering clients
- mDNS uses UDP port 5353`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
