import { Body, Controller, Delete, Get, HttpCode, Logger, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqUpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayResponseModel, DisplaysResponseModel } from '../models/displays-response.model';
import { DisplaysService } from '../services/displays.service';

@ApiTags('Displays Module - Displays')
@Controller('displays')
export class DisplaysController {
	private readonly logger = new Logger(DisplaysController.name);

	constructor(private readonly displaysService: DisplaysService) {}

	@Get()
	@ApiOperation({
		summary: 'List all displays',
		description: 'Retrieves a list of all registered displays.',
	})
	@ApiSuccessResponse(DisplaysResponseModel, 'Returns a list of displays')
	async findAll(): Promise<DisplaysResponseModel> {
		this.logger.debug('[GET ALL] Fetching all displays');

		const displays = await this.displaysService.findAll();

		return { success: true, data: displays };
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get display by ID',
		description: 'Retrieves a specific display by its unique identifier.',
	})
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the display')
	@ApiNotFoundResponse('Display not found')
	async findOne(@Param('id') id: string): Promise<DisplayResponseModel> {
		this.logger.debug(`[GET] Fetching display with id=${id}`);

		const display = await this.displaysService.getOneOrThrow(id);

		return { success: true, data: display };
	}

	@Patch(':id')
	@ApiOperation({
		summary: 'Update display',
		description: 'Updates an existing display configuration.',
	})
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the updated display')
	@ApiNotFoundResponse('Display not found')
	@ApiUnprocessableEntityResponse('Invalid display data')
	async update(@Param('id') id: string, @Body() body: ReqUpdateDisplayDto): Promise<DisplayResponseModel> {
		this.logger.debug(`[UPDATE] Updating display with id=${id}`);

		const display = await this.displaysService.update(id, body.data);

		return { success: true, data: display };
	}

	@Delete(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Delete display',
		description: 'Removes a display from the system. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiNoContentResponse({ description: 'Display deleted successfully' })
	@ApiNotFoundResponse('Display not found')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing display with id=${id}`);

		await this.displaysService.remove(id);

		this.logger.debug(`[DELETE] Successfully removed display with id=${id}`);
	}
}
