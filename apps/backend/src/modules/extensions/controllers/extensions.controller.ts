import { Body, Controller, Get, Logger, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqUpdateExtensionDto } from '../dto/update-extension.dto';
import { EXTENSIONS_MODULE_API_TAG_NAME } from '../extensions.constants';
import { ExtensionResponseModel, ExtensionsResponseModel } from '../models/extensions-response.model';
import { ExtensionsService } from '../services/extensions.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('extensions')
export class ExtensionsController {
	private readonly logger = new Logger(ExtensionsController.name);

	constructor(private readonly extensionsService: ExtensionsService) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'List all extensions',
		description: 'Retrieves a list of all registered extensions (modules and plugins). Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of extensions')
	findAll(): ExtensionsResponseModel {
		this.logger.debug('[GET ALL] Fetching all extensions');

		const extensions = this.extensionsService.findAll();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get('modules')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'List all modules',
		description: 'Retrieves a list of all registered modules. Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of modules')
	findAllModules(): ExtensionsResponseModel {
		this.logger.debug('[GET MODULES] Fetching all modules');

		const extensions = this.extensionsService.findAllModules();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get('plugins')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'List all plugins',
		description: 'Retrieves a list of all registered plugins. Requires owner or admin role.',
	})
	@ApiSuccessResponse(ExtensionsResponseModel, 'Returns a list of plugins')
	findAllPlugins(): ExtensionsResponseModel {
		this.logger.debug('[GET PLUGINS] Fetching all plugins');

		const extensions = this.extensionsService.findAllPlugins();

		const response = new ExtensionsResponseModel();
		response.data = extensions;

		return response;
	}

	@Get(':type')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Get extension by type',
		description: 'Retrieves a specific extension by its type identifier. Requires owner or admin role.',
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiSuccessResponse(ExtensionResponseModel, 'Returns the extension')
	@ApiNotFoundResponse('Extension not found')
	findOne(@Param('type') type: string): ExtensionResponseModel {
		this.logger.debug(`[GET] Fetching extension type=${type}`);

		const extension = this.extensionsService.findOne(type);

		const response = new ExtensionResponseModel();
		response.data = extension;

		return response;
	}

	@Patch(':type')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Update extension',
		description:
			'Updates an extension configuration (enable/disable). Core extensions cannot be modified. Requires owner or admin role.',
	})
	@ApiParam({ name: 'type', type: 'string', description: 'Extension type identifier' })
	@ApiSuccessResponse(ExtensionResponseModel, 'Returns the updated extension')
	@ApiNotFoundResponse('Extension not found')
	@ApiBadRequestResponse('Cannot modify core extension')
	update(@Param('type') type: string, @Body() body: ReqUpdateExtensionDto): ExtensionResponseModel {
		this.logger.debug(`[UPDATE] Updating extension type=${type}`);

		const extension = this.extensionsService.updateEnabled(type, body.data.enabled);

		const response = new ExtensionResponseModel();
		response.data = extension;

		return response;
	}
}
