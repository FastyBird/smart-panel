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
			readme: `# mDNS

> Module · by FastyBird

Advertises the Smart Panel on the local network using Multicast DNS (Bonjour / Avahi) so admin browsers and panel displays can auto-discover the backend without a hard-coded IP address. This is what makes "just plug it in and find it on the LAN" actually work.

## What it gives you

- Newly flashed displays connect to the backend on first boot without any manual IP entry
- The admin UI bookmarks survive DHCP IP changes — the hostname is what's resolved
- Multiple Smart Panel installations can coexist on the same network and be told apart by hostname

## Features

- **Zero-conf discovery** — clients find the panel automatically on the LAN by looking up the advertised service name
- **Custom hostname** — pick the name advertised on the network; defaults to the system hostname
- **Service metadata** — advertises the API base path, scheme (http/https) and version so clients can build URLs from the discovery record alone
- **Toggleable** — disable advertisement on networks where mDNS is filtered or undesirable
- **Live re-broadcast** — when the configuration changes the advertisement is updated without needing a restart

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`enabled\` | Toggle mDNS advertisement | \`true\` |
| \`hostname\` | Hostname advertised on the network | system hostname |

## Service Record

\`\`\`
_smart-panel._tcp.local
\`\`\`

## Requirements

- Discovering clients must share the same network segment as the panel
- mDNS uses UDP port \`5353\` — make sure it isn't blocked by host or network firewalls`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
