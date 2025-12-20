import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqUpdateExtensionDto } from '../dto/update-extension.dto';
import { EXTENSIONS_MODULE_API_TAG_NAME, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import { ExtensionResponseModel, ExtensionsResponseModel } from '../models/extensions-response.model';
import { ExtensionsService } from '../services/extensions.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('extensions')
export class ExtensionsController {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ExtensionsController');

	constructor(private readonly extensionsService: ExtensionsService) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-extensions-module-extensions',
		summary: 'List all extensions',
		description: 'Retrieves a list of all registered extensions (modules and plugins). Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of extensions')
	findAll(): ExtensionsResponseModel {
		this.logger.debug('Fetching all extensions');

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
		this.logger.debug('Fetching all modules');

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
		this.logger.debug('Fetching all plugins');

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
		this.logger.debug(`Fetching extension type=${type}`);

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
	update(@Param('type') type: string, @Body() body: ReqUpdateExtensionDto): ExtensionResponseModel {
		this.logger.debug(`Updating extension type=${type}`);

		const extension = this.extensionsService.updateEnabled(type, body.data.enabled);

		const response = new ExtensionResponseModel();
		response.data = extension;

		return response;
	}
}
