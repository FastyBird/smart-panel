import {
	ModuleConfigMutationHandler,
	ModuleConfigMutationRegistryService,
} from '../config/services/module-config-mutation-registry.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { UserLifecycleMutationRegistryService } from '../users/services/user-lifecycle-mutation-registry.service';

import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { MCP_MODULE_NAME, McpCapability } from './mcp.constants';
import { McpModule } from './mcp.module';
import { MCP_SWAGGER_EXTRA_MODELS } from './mcp.openapi';
import { McpConfigModel } from './models/config.model';
import { McpStatsProvider } from './providers/mcp-stats.provider';
import { McpOAuthApproverAuthorityService } from './services/mcp-oauth-approver-authority.service';
import { McpOAuthModuleConfigMutationService } from './services/mcp-oauth-module-config-mutation.service';

describe('McpModule', () => {
	it('registers configuration, Swagger models, and disabled-by-default metadata', () => {
		const swaggerRegistry = { register: jest.fn() };
		const modulesMapperService = { registerMapping: jest.fn() };
		let mutationHandler: ModuleConfigMutationHandler<UpdateMcpConfigDto> | undefined;
		const moduleConfigMutations = {
			register: jest.fn((_module: string, handler: ModuleConfigMutationHandler<UpdateMcpConfigDto>) => {
				mutationHandler = handler;
			}),
		};
		const moduleConfigMutation = { update: jest.fn() };
		const userLifecycleMutations = { register: jest.fn() };
		const approverAuthority = {} as McpOAuthApproverAuthorityService;
		const extensionsService = { registerModuleMetadata: jest.fn() };
		const statsRegistryService = { register: jest.fn() };
		const statsProvider = {} as McpStatsProvider;
		const module = new McpModule(
			swaggerRegistry as unknown as SwaggerModelsRegistryService,
			modulesMapperService as unknown as ModulesTypeMapperService,
			moduleConfigMutations as unknown as ModuleConfigMutationRegistryService,
			moduleConfigMutation as unknown as McpOAuthModuleConfigMutationService,
			userLifecycleMutations as unknown as UserLifecycleMutationRegistryService,
			approverAuthority,
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
		expect(moduleConfigMutations.register).toHaveBeenCalledWith(MCP_MODULE_NAME, expect.any(Function));
		expect(userLifecycleMutations.register).toHaveBeenCalledWith(approverAuthority);

		if (!mutationHandler) {
			throw new Error('MCP module configuration mutation handler was not registered');
		}

		const update = new UpdateMcpConfigDto();
		const commit = jest.fn();
		void mutationHandler(update, commit);
		expect(moduleConfigMutation.update).toHaveBeenCalledWith(update, commit);

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
