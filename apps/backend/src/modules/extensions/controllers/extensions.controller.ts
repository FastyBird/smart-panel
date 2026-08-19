import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqBulkUpdateExtensionsDto } from '../dto/bulk-extensions.dto';
import { ReqUpdateExtensionDto } from '../dto/update-extension.dto';
import { EXTENSIONS_MODULE_API_TAG_NAME, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import {
	BulkResultResponseModel,
	ExtensionResponseModel,
	ExtensionsResponseModel,
} from '../models/extensions-response.model';
import { ExtensionsBulkService } from '../services/extensions-bulk.service';
import { ExtensionsService } from '../services/extensions.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('extensions')
export class ExtensionsController {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ExtensionsController');

	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly extensionsBulkService: ExtensionsBulkService,
	) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-extensions',
		summary: 'List all extensions',
		description: 'Retrieves a list of all registered extensions (modules and plugins). Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of extensions')
	findAll(): ExtensionsResponseModel {
		const extensions = this.extensionsService.findAll();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get('modules')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-modules',
		summary: 'List all modules',
		description: 'Retrieves a list of all registered modules. Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of modules')
	findAllModules(): ExtensionsResponseModel {
		const extensions = this.extensionsService.findAllModules();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get('plugins')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-plugins',
		summary: 'List all plugins',
		description: 'Retrieves a list of all registered plugins. Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of plugins')
	findAllPlugins(): ExtensionsResponseModel {
		const extensions = this.extensionsService.findAllPlugins();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get(':type')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-extension',
		summary: 'Get extension by type',
		description: 'Retrieves a specific extension by its type identifier. Requires owner or admin role.',
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiSuccessResponse(ExtensionResponseModel, 'Returns the extension')
	@ApiNotFoundResponse('Extension not found')
	findOne(@Param('type') type: string): ExtensionResponseModel {
		const extension = this.extensionsService.findOne(type);

		const response = new ExtensionResponseModel();
		response.data = extension;

		return response;
	}

	@Patch(':type')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'update-extensions-module-extension',
		summary: 'Update extension',
		description:
			'Updates an extension configuration (enable/disable). Core extensions cannot be modified. Requires owner or admin role.',
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiSuccessResponse(ExtensionResponseModel, 'Returns the updated extension')
	@ApiNotFoundResponse('Extension not found')
	@ApiBadRequestResponse('Cannot modify core extension')
	async update(@Param('type') type: string, @Body() body: ReqUpdateExtensionDto): Promise<ExtensionResponseModel> {
		const extension = await this.extensionsService.updateEnabled(type, body.data.enabled);

		const response = new ExtensionResponseModel();
		response.data = extension;

		return response;
	}

	@ApiOperation({
		operationId: 'create-extensions-module-extensions-bulk-update',
		summary: 'Enable or disable several extensions',
		description:
			'Sets the enabled state of every extension in the supplied selection. Each extension is processed independently, so one that can not be updated - a core extension, or an unknown type - is reported in the response rather than aborting the rest of the selection. This exists so that acting on a large selection is one request instead of one per extension. Requires owner or admin role.',
	})
	@ApiBody({ type: ReqBulkUpdateExtensionsDto, description: 'The extensions to update and the state to set' })
	@ApiSuccessResponse(BulkResultResponseModel, 'Returns which extensions were updated and which were not')
	@ApiBadRequestResponse('Invalid request data')
	@Post('bulk-update')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(200)
	async bulkUpdate(@Body() body: ReqBulkUpdateExtensionsDto): Promise<BulkResultResponseModel> {
		const response = new BulkResultResponseModel();

		response.data = await this.extensionsBulkService.setEnabled(body.data.types, body.data.enabled);

		return response;
	}
}
