import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { MCP_MODULE_NAME, McpCapability } from './mcp.constants';
import { McpModule } from './mcp.module';
import { MCP_SWAGGER_EXTRA_MODELS } from './mcp.openapi';
import { McpConfigModel } from './models/config.model';
import { McpStatsProvider } from './providers/mcp-stats.provider';

describe('McpModule', () => {
	it('registers configuration, Swagger models, and disabled-by-default metadata', () => {
		const swaggerRegistry = { register: jest.fn() };
		const modulesMapperService = { registerMapping: jest.fn() };
		const extensionsService = { registerModuleMetadata: jest.fn() };
		const statsRegistryService = { register: jest.fn() };
		const statsProvider = {} as McpStatsProvider;
		const module = new McpModule(
			swaggerRegistry as unknown as SwaggerModelsRegistryService,
			modulesMapperService as unknown as ModulesTypeMapperService,
			extensionsService as unknown as ExtensionsService,
			statsRegistryService as unknown as StatsRegistryService,
			statsProvider,
		);

		module.onModuleInit();

		expect(modulesMapperService.registerMapping).toHaveBeenCalledWith({
			type: MCP_MODULE_NAME,
			class: McpConfigModel,
			configDto: UpdateMcpConfigDto,
		});
		expect(swaggerRegistry.register).toHaveBeenCalledTimes(MCP_SWAGGER_EXTRA_MODELS.length);

		for (const model of MCP_SWAGGER_EXTRA_MODELS) {
			expect(swaggerRegistry.register).toHaveBeenCalledWith(model);
		}
		expect(extensionsService.registerModuleMetadata).toHaveBeenCalledWith(
			expect.objectContaining({
				type: MCP_MODULE_NAME,
				name: 'Model Context Protocol',
				defaultEnabled: false,
				capabilities: Object.values(McpCapability),
			}),
		);
		expect(statsRegistryService.register).toHaveBeenCalledWith(MCP_MODULE_NAME, statsProvider);
	});
});
