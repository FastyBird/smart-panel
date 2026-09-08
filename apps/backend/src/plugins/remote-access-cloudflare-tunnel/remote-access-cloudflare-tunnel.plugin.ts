import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { PlatformModule } from '../../modules/platform/platform.module';
import { RemoteAccessModule } from '../../modules/remote-access/remote-access.module';
import { RemoteAccessProviderRegistryService } from '../../modules/remote-access/services/remote-access-provider-registry.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { SetupController } from './controllers/setup.controller';
import { StatusController } from './controllers/status.controller';
import { UpdateRemoteAccessCloudflareTunnelPluginConfigDto } from './dto/update-config.dto';
import { RemoteAccessCloudflareTunnelPluginConfigModel } from './models/config.model';
import {
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_DESCRIPTION,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from './remote-access-cloudflare-tunnel.constants';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_SWAGGER_EXTRA_MODELS } from './remote-access-cloudflare-tunnel.openapi';
import { CloudflareTunnelManagedService } from './services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from './services/cloudflare-tunnel-provider.service';
import { CloudflareTunnelSetupService } from './services/cloudflare-tunnel-setup.service';
import { CloudflaredCliService } from './services/cloudflared-cli.service';
import { CloudflaredMetricsService } from './services/cloudflared-metrics.service';
import { CloudflaredProcessService } from './services/cloudflared-process.service';

@ApiTag({
	tagName: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
	displayName: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME,
	description: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [RemoteAccessModule, PlatformModule, NestConfigModule],
	controllers: [StatusController, SetupController],
	providers: [
		CloudflaredCliService,
		CloudflaredProcessService,
		CloudflaredMetricsService,
		CloudflareTunnelManagedService,
		CloudflareTunnelProviderService,
		CloudflareTunnelSetupService,
	],
})
export class RemoteAccessCloudflareTunnelPlugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly providerRegistry: RemoteAccessProviderRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly tunnelManagedService: CloudflareTunnelManagedService,
		private readonly providerService: CloudflareTunnelProviderService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<
			RemoteAccessCloudflareTunnelPluginConfigModel,
			UpdateRemoteAccessCloudflareTunnelPluginConfigDto
		>({
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			class: RemoteAccessCloudflareTunnelPluginConfigModel,
			configDto: UpdateRemoteAccessCloudflareTunnelPluginConfigDto,
			secretFields: [
				{
					path: 'tunnel_token',
					configuredPath: 'tunnel_token_configured',
					inputPaths: ['tunnelToken'],
				},
			],
		});

		for (const model of REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			name: 'Cloudflare Tunnel',
			description: 'Publish this installation to the internet through a Cloudflare Tunnel, without opening a port.',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# Cloudflare Tunnel

> Plugin · by FastyBird · platform: remote-access

Publishes this installation to the public internet through a Cloudflare Tunnel: an outbound-only, encrypted connection from this device to the Cloudflare edge. Once a tunnel token is configured, the admin UI is reachable at your own hostname over HTTPS — no port forwarding, no public IP address, and no inbound firewall rule required.

## What you get

- A public HTTPS hostname of your choosing (e.g. \`panel.example.com\`), backed by Cloudflare's own TLS certificate
- The tunnel connector managed entirely from the Smart Panel admin UI — install, connect, disconnect and remove, all without a terminal
- The option to protect the published hostname further with Cloudflare Access, layering an identity check in front of the Smart Panel login

## Requirements

- \`raspberry\` or \`generic\` platform with systemd and the existing sudoers allowlist (Docker and the Home Assistant add-on are not supported — see the docs for alternatives)
- A tunnel already created in the Cloudflare Zero Trust dashboard, and its token pasted into the setup wizard here

## Security

Once connected, this installation is reachable from the public internet through the published hostname; only the Smart Panel login protects it unless you also configure Cloudflare Access. Review who else has access to the account before publishing sensitive installations.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`public_hostname\` | Public hostname the tunnel publishes, e.g. \`panel.example.com\` | — |
| \`protocol\` | Protocol cloudflared uses to connect to the Cloudflare edge | \`auto\` |
| \`tunnel_token\` | Tunnel token from the Cloudflare Zero Trust dashboard | — |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.providerRegistry.register(this.providerService);

		this.managedServiceManager.register(this.tunnelManagedService);

		this.factoryResetRegistry.register(
			REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			(): Promise<{ success: boolean; reason?: string }> => this.tunnelManagedService.factoryReset(),
			90,
		);
	}
}
