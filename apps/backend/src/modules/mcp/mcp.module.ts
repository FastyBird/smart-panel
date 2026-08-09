import { AuthInfo, McpServer } from '@modelcontextprotocol/server';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { EnergyModule } from '../energy/energy.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ScenesModule } from '../scenes/scenes.module';
import { SecurityModule } from '../security/security.module';
import { SpacesModule } from '../spaces/spaces.module';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { ToolsModule } from '../tools/tools.module';
import { WeatherModule } from '../weather/weather.module';

import { McpClientsController } from './controllers/mcp-clients.controller';
import { McpOAuthClientsController } from './controllers/mcp-oauth-clients.controller';
import { McpOAuthInteractionsController } from './controllers/mcp-oauth-interactions.controller';
import { McpOAuthManagementController } from './controllers/mcp-oauth-management.controller';
import { McpController } from './controllers/mcp.controller';
import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { McpClientEntity } from './entities/mcp-client.entity';
import { McpInstallationEntity } from './entities/mcp-installation.entity';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthAuthorizationCodeEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
	McpOAuthServerStateEntity,
} from './entities/mcp-oauth.entity';
import { McpClientGuard } from './guards/mcp-client.guard';
import { McpConfigListener } from './listeners/mcp-config.listener';
import {
	MCP_CATALOG_REGISTRAR,
	MCP_MODULE_API_TAG_DESCRIPTION,
	MCP_MODULE_API_TAG_NAME,
	MCP_MODULE_NAME,
	McpCapability,
} from './mcp.constants';
import { MCP_SWAGGER_EXTRA_MODELS } from './mcp.openapi';
import { McpConfigModel } from './models/config.model';
import { McpOAuthProviderFactory } from './oauth/mcp-oauth-provider.factory';
import { McpStatsProvider } from './providers/mcp-stats.provider';
import { McpAuditService } from './services/mcp-audit.service';
import { McpClientService } from './services/mcp-client.service';
import { McpContextService } from './services/mcp-context.service';
import { McpInstallationService } from './services/mcp-installation.service';
import { McpOAuthArtifactService } from './services/mcp-oauth-artifact.service';
import { McpOAuthClientService } from './services/mcp-oauth-client.service';
import { McpOAuthInteractionService } from './services/mcp-oauth-interaction.service';
import { McpOAuthManagementService } from './services/mcp-oauth-management.service';
import { McpOAuthProxyPolicyService } from './services/mcp-oauth-proxy-policy.service';
import { McpOAuthPublicUrlService } from './services/mcp-oauth-public-url.service';
import { McpOAuthRefreshTokenService } from './services/mcp-oauth-refresh-token.service';
import { McpOAuthResourceServerService } from './services/mcp-oauth-resource-server.service';
import { McpOAuthRuntimeService } from './services/mcp-oauth-runtime.service';
import { McpPolicyService } from './services/mcp-policy.service';
import { McpServerService } from './services/mcp-server.service';
import { McpSubscriptionRegistryService } from './services/mcp-subscription-registry.service';
import { McpReadToolService } from './tools/mcp-read-tool.service';
import { McpTargetDiscoveryToolService } from './tools/mcp-target-discovery-tool.service';

@ApiTag({
	tagName: MCP_MODULE_NAME,
	displayName: MCP_MODULE_API_TAG_NAME,
	description: MCP_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		AuthModule,
		DevicesModule,
		EnergyModule,
		NestConfigModule,
		ScenesModule,
		SecurityModule,
		SpacesModule,
		StatsModule,
		SwaggerModule,
		TypeOrmModule.forFeature([
			McpClientEntity,
			McpInstallationEntity,
			McpOAuthAccessTokenEntity,
			McpOAuthAuthorizationCodeEntity,
			McpOAuthClientEntity,
			McpOAuthGrantEntity,
			McpOAuthInteractionEntity,
			McpOAuthProviderArtifactEntity,
			McpOAuthProviderRevokedGrantEntity,
			McpOAuthProviderRevokedRefreshFamilyEntity,
			McpOAuthRefreshTokenEntity,
			McpOAuthRefreshTokenFamilyEntity,
			McpOAuthServerStateEntity,
		]),
		ToolsModule,
		WeatherModule,
	],
	controllers: [
		McpClientsController,
		McpOAuthClientsController,
		McpOAuthInteractionsController,
		McpOAuthManagementController,
		McpController,
	],
	providers: [
		McpClientGuard,
		McpClientService,
		McpConfigListener,
		McpContextService,
		McpInstallationService,
		McpOAuthArtifactService,
		McpOAuthClientService,
		McpOAuthInteractionService,
		McpOAuthManagementService,
		McpOAuthProxyPolicyService,
		McpOAuthProviderFactory,
		McpOAuthPublicUrlService,
		McpOAuthRefreshTokenService,
		McpOAuthResourceServerService,
		McpOAuthRuntimeService,
		McpPolicyService,
		McpServerService,
		McpAuditService,
		McpStatsProvider,
		McpSubscriptionRegistryService,
		McpReadToolService,
		McpTargetDiscoveryToolService,
		{
			provide: MCP_CATALOG_REGISTRAR,
			useFactory: (readTools: McpReadToolService, targetDiscoveryTools: McpTargetDiscoveryToolService) => ({
				register(server: McpServer, authInfo?: AuthInfo): void {
					readTools.register(server, authInfo);
					targetDiscoveryTools.register(server, authInfo);
				},
			}),
			inject: [McpReadToolService, McpTargetDiscoveryToolService],
		},
	],
	exports: [
		McpAuditService,
		McpClientService,
		McpInstallationService,
		McpOAuthArtifactService,
		McpOAuthClientService,
		McpOAuthInteractionService,
		McpOAuthManagementService,
		McpOAuthProxyPolicyService,
		McpOAuthProviderFactory,
		McpOAuthPublicUrlService,
		McpOAuthRefreshTokenService,
		McpOAuthResourceServerService,
		McpOAuthRuntimeService,
		McpPolicyService,
		McpServerService,
	],
})
export class McpModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly statsProvider: McpStatsProvider,
	) {}

	onModuleInit(): void {
		this.modulesMapperService.registerMapping<McpConfigModel, UpdateMcpConfigDto>({
			type: MCP_MODULE_NAME,
			class: McpConfigModel,
			configDto: UpdateMcpConfigDto,
		});

		for (const model of MCP_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.statsRegistryService.register(MCP_MODULE_NAME, this.statsProvider);

		this.extensionsService.registerModuleMetadata({
			type: MCP_MODULE_NAME,
			name: 'Model Context Protocol',
			description: 'Curated, capability-scoped agent access to this Smart Panel installation',
			author: 'FastyBird',
			defaultEnabled: false,
			capabilities: Object.values(McpCapability),
			readme: `# Model Context Protocol

> Module · by FastyBird

Connects trusted MCP-compatible agents to a curated set of Smart Panel tools and resources. The module is disabled by default and its read, direct-write, and higher-level trigger capabilities can be enabled independently.

## Security posture

- Uses installation-local MCP credentials rather than ordinary user, display, or REST tokens
- Returns each finite-lived credential once; rotate it if the secret was not saved or may have leaked
- Exposes only explicitly registered tools and resources; it is not an OpenAPI proxy
- Rechecks the installation capability ceiling and client grant for every operation
- Targets trusted LAN or VPN deployments behind HTTPS for the initial static-bearer release
- Requires users to verify the installation hostname and reported name before approving write or trigger tools

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`enabled\` | Accept MCP protocol requests | \`false\` |
| \`capabilities\` | Allowed combination of \`read\`, \`write\`, and \`trigger\` | \`read\` |
| \`allowed_origins\` | Additional browser origins allowed to call the endpoint | empty |
| \`oauth_public_base_url\` | Canonical HTTPS base used by the inactive OAuth foundation | empty |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs/admin-management/mcp',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
