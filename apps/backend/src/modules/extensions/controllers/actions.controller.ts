import { Body, Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqExecuteActionDto } from '../dto/execute-action.dto';
import { EXTENSIONS_MODULE_API_TAG_NAME, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import { ActionResultResponseModel, ExtensionActionsResponseModel } from '../models/actions-response.model';
import { ExtensionActionRegistryService } from '../services/extension-action-registry.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('extensions/:type/actions')
export class ActionsController {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ActionsController');

	constructor(private readonly actionRegistry: ExtensionActionRegistryService) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-extension-actions',
		summary: 'List extension actions',
		description:
			'Returns available actions for an extension with resolved dynamic parameter options. Each action includes an `allowed` field based on the current user role.',
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiSuccessResponse(ExtensionActionsResponseModel, 'Returns the list of available actions')
	@ApiNotFoundResponse('Extension not found')
	async getActions(
		@Param('type') type: string,
		@Req() req: AuthenticatedRequest,
	): Promise<ExtensionActionsResponseModel> {
		this.logger.debug(`Fetching actions for extension '${type}'`);

		const userRole = this.getUserRole(req);
		const actions = await this.actionRegistry.getActions(type, userRole);

		const response = new ExtensionActionsResponseModel();
		response.data = actions as ExtensionActionsResponseModel['data'];

		return response;
	}

	@Post(':actionId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'execute-extensions-module-extension-action',
		summary: 'Execute an extension action',
		description:
			"Executes an immediate action with the provided parameters. Requires the user role to match the action's required roles.",
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiParam({ name: 'actionId', type: 'string', description: 'Action identifier' })
	@ApiBody({ type: ReqExecuteActionDto, description: 'Action parameters' })
	@ApiSuccessResponse(ActionResultResponseModel, 'Returns the action execution result')
	@ApiNotFoundResponse('Extension or action not found')
	@ApiBadRequestResponse('Action is not executable (wrong mode) or invalid parameters')
	@ApiForbiddenResponse('Insufficient permissions to execute this action')
	async executeAction(
		@Param('type') type: string,
		@Param('actionId') actionId: string,
		@Body() body: ReqExecuteActionDto,
		@Req() req: AuthenticatedRequest,
	): Promise<ActionResultResponseModel> {
		const userRole = this.getUserRole(req);

		// null = action not found → let execute() throw proper 404
		// false = action exists but user lacks permission → 403
		const allowed = this.actionRegistry.isAllowed(type, actionId, userRole);

		if (allowed === false) {
			throw new ForbiddenException(`Insufficient permissions to execute action '${actionId}'`);
		}

		this.logger.log(`Executing action '${actionId}' for extension '${type}'`);

		const result = await this.actionRegistry.execute(type, actionId, body.data.params ?? {});

		const response = new ActionResultResponseModel();
		response.data = result as ActionResultResponseModel['data'];

		return response;
	}

	private getUserRole(req: AuthenticatedRequest): UserRole {
		if (!req.auth?.role) {
			// Fail closed — deny by default if auth data is missing
			throw new ForbiddenException('Unable to determine user role');
		}

		return req.auth.role;
	}
}
