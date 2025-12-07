import { Body, Controller, Delete, Get, Logger, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { DISPLAYS_MODULE_PREFIX } from '../displays.constants';
import { ReqUpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayResponseModel, DisplaysResponseModel } from '../models/displays-response.model';
import { DisplaysService } from '../services/displays.service';

@ApiTags('Displays Module - Displays')
@Controller(DISPLAYS_MODULE_PREFIX)
export class DisplaysController {
	private readonly logger = new Logger(DisplaysController.name);

	constructor(private readonly displaysService: DisplaysService) {}

	@Get('/displays')
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

	@Get('/displays/:id')
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

	@Patch('/displays/:id')
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

	@Delete('/displays/:id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Delete display',
		description: 'Removes a display from the system. Requires owner or admin role.',
	})
	@ApiSuccessResponse(Boolean, 'Display successfully deleted')
	@ApiNotFoundResponse('Display not found')
	async remove(@Param('id') id: string): Promise<{ success: boolean }> {
		this.logger.debug(`[DELETE] Removing display with id=${id}`);

		await this.displaysService.remove(id);

		return { success: true };
	}
}
