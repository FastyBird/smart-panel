import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { AUTOMATIONS_MODULE_API_TAG_NAME, AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationNodeTypesResponseModel } from '../models/automations-response.model';
import { createAutomationNodeTypeModel } from '../models/node-types.model';
import { AutomationNodeTypeRegistryService } from '../services/node-type-registry.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('node-types')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationNodeTypesController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationNodeTypesController');

	constructor(private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService) {}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve the catalogue of automation node types',
		description:
			'Fetches every node type an automation graph can be built from, as registered by the modules and plugins that are running: its type, kind, ports, human-facing name and description, and the JSON Schema of its configuration. The list is ordered by type. Requires the owner or admin role.',
		operationId: 'get-automations-module-node-types',
	})
	@ApiSuccessResponse(AutomationNodeTypesResponseModel, 'The catalogue of node types was successfully retrieved.')
	@ApiForbiddenResponse('Only owners and admins can read automation node types')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	findAll(): AutomationNodeTypesResponseModel {
		const nodeTypes = this.nodeTypeRegistry.list();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${nodeTypes.length} automation node types`);

		const response = new AutomationNodeTypesResponseModel();
		response.data = nodeTypes.map(createAutomationNodeTypeModel);

		return response;
	}
}
