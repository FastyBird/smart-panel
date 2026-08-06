import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { McpClientsController } from './controllers/mcp-clients.controller';
import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { McpClientEntity } from './entities/mcp-client.entity';
import { McpInstallationEntity } from './entities/mcp-installation.entity';
import {
	MCP_MODULE_API_TAG_DESCRIPTION,
	MCP_MODULE_API_TAG_NAME,
	MCP_MODULE_NAME,
	McpCapability,
} from './mcp.constants';
import { MCP_SWAGGER_EXTRA_MODELS } from './mcp.openapi';
import { McpConfigModel } from './models/config.model';
import { McpClientService } from './services/mcp-client.service';
import { McpInstallationService } from './services/mcp-installation.service';

@ApiTag({
	tagName: MCP_MODULE_NAME,
	displayName: MCP_MODULE_API_TAG_NAME,
	description: MCP_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [AuthModule, SwaggerModule, TypeOrmModule.forFeature([McpClientEntity, McpInstallationEntity])],
	controllers: [McpClientsController],
	providers: [McpClientService, McpInstallationService],
	exports: [McpClientService, McpInstallationService],
})
export class McpModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
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
- Exposes only explicitly registered tools and resources; it is not an OpenAPI proxy
- Rechecks the installation capability ceiling and client grant for every operation
- Targets trusted LAN or VPN deployments for the initial static-bearer release

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`enabled\` | Accept MCP protocol requests | \`false\` |
| \`capabilities\` | Allowed combination of \`read\`, \`write\`, and \`trigger\` | \`read\` |
| \`allowed_origins\` | Additional browser origins allowed to call the endpoint | empty |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
