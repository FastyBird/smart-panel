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
import { UpdateRemoteAccessTailscalePluginConfigDto } from './dto/update-config.dto';
import { RemoteAccessTailscalePluginConfigModel } from './models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_DESCRIPTION,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
} from './remote-access-tailscale.constants';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_SWAGGER_EXTRA_MODELS } from './remote-access-tailscale.openapi';
import { TailscaleCliService } from './services/tailscale-cli.service';
import { TailscaleLoginService } from './services/tailscale-login.service';
import { TailscaleNodeManagedService } from './services/tailscale-node-managed.service';
import { TailscaleProviderService } from './services/tailscale-provider.service';
import { TailscaleSetupService } from './services/tailscale-setup.service';
import { TailscaleStatusMapperService } from './services/tailscale-status-mapper.service';

@ApiTag({
	tagName: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	displayName: REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME,
	description: REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [RemoteAccessModule, PlatformModule, NestConfigModule],
	controllers: [StatusController, SetupController],
	providers: [
		TailscaleCliService,
		TailscaleStatusMapperService,
		TailscaleNodeManagedService,
		TailscaleProviderService,
		TailscaleSetupService,
		TailscaleLoginService,
	],
})
export class RemoteAccessTailscalePlugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly providerRegistry: RemoteAccessProviderRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
		private readonly providerService: TailscaleProviderService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<
			RemoteAccessTailscalePluginConfigModel,
			UpdateRemoteAccessTailscalePluginConfigDto
		>({
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			class: RemoteAccessTailscalePluginConfigModel,
			configDto: UpdateRemoteAccessTailscalePluginConfigDto,
		});

		for (const model of REMOTE_ACCESS_TAILSCALE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			name: 'Tailscale',
			description: 'Reach this installation over a Tailscale mesh network without opening a port.',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# Tailscale

> Plugin · by FastyBird · platform: remote-access

Connects this installation to a Tailscale tailnet, a private WireGuard-based mesh network. Once signed in, the admin UI is reachable from any device on the tailnet by its Tailscale IPv4 address or, when MagicDNS is enabled, its tailnet DNS name — no port forwarding and no public exposure required.

## What you get

- A private mesh address for this installation, reachable from every device you have signed into the same tailnet
- A MagicDNS name once your tailnet has MagicDNS enabled, so you never have to remember an IP address
- Setup, sign-in and sign-out that stay entirely within the Smart Panel admin UI (added in a follow-up release)

## Requirements

- \`raspberry\` or \`generic\` platform with systemd and the existing sudoers allowlist (Docker and the Home Assistant add-on are not supported — see the docs for alternatives)
- The \`tailscale\` package installed and \`tailscaled\` active, with the \`smart-panel\` service user granted as the Tailscale operator

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`hostname\` | Hostname advertised to the tailnet | OS hostname |
| \`login_server\` | Control-plane URL — override for a self-hosted Headscale server | \`https://controlplane.tailscale.com\` |
| \`accept_dns\` | Accept the tailnet MagicDNS configuration | \`true\` |
| \`accept_routes\` | Accept subnet routes advertised by other tailnet nodes | \`false\` |
| \`advertise_tags\` | ACL tags to advertise for this node | \`[]\` |
| \`ssh\` | Enable Tailscale SSH on this node | \`false\` |
| \`serve_https\` / \`funnel\` | Serve the admin UI over HTTPS / publish it publicly through Tailscale Serve and Funnel | applied by a follow-up release |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.providerRegistry.register(this.providerService);

		this.managedServiceManager.register(this.nodeManagedService);

		this.factoryResetRegistry.register(
			REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			(): Promise<{ success: boolean; reason?: string }> => this.nodeManagedService.factoryReset(),
			90,
		);
	}
}
