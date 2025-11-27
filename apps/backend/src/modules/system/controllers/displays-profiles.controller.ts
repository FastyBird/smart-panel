import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	ApiBody,
	ApiNoContentResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
} from '../../api/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqCreateDisplayProfileDto } from '../dto/create-display-profile.dto';
import { ReqUpdateDisplayProfileDto } from '../dto/update-display-profile.dto';
import { DisplayProfileEntity } from '../entities/system.entity';
import { DisplaysProfilesService } from '../services/displays-profiles.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

@ApiTags('system-module')
@Controller('displays-profiles')
export class DisplaysProfilesController {
	private readonly logger = new Logger(DisplaysProfilesController.name);

	constructor(private readonly displaysService: DisplaysProfilesService) {}

	@Get()
	@ApiOperation({
		summary: 'Get all display profiles',
		description: 'Retrieve a list of all display profiles',
	})
	@ApiSuccessArrayResponse(DisplayProfileEntity, 'Display profiles retrieved successfully')
	@ApiInternalServerErrorResponse()
	async findAll(): Promise<DisplayProfileEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays profiles');

		const displays = await this.displaysService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${displays.length} displays profiles`);

		return displays;
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get display profile by ID',
		description: 'Retrieve a specific display profile by its ID',
	})
	@ApiParam({ name: 'id', description: 'Display profile ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(DisplayProfileEntity, 'Display profile retrieved successfully')
	@ApiNotFoundResponse('Display profile not found')
	@ApiBadRequestResponse('Invalid display profile ID format')
	@ApiInternalServerErrorResponse()
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Fetching display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found display profile id=${display.id}`);

		return display;
	}

	@Get('by-uid/:uid')
	@ApiOperation({
		summary: 'Get display profile by UID',
		description: 'Retrieve a specific display profile by its unique identifier (UID)',
	})
	@ApiParam({ name: 'uid', description: 'Display profile UID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(DisplayProfileEntity, 'Display profile retrieved successfully')
	@ApiNotFoundResponse('Display profile not found')
	@ApiBadRequestResponse('Invalid UID format')
	@ApiInternalServerErrorResponse()
	async findOneByUid(@Param('uid', new ParseUUIDPipe({ version: '4' })) uid: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Fetching display profile uid=${uid}`);

		const display = await this.displaysService.findByUid(uid);

		if (!display) {
			this.logger.error(`[ERROR] display profile with uid=${uid} not found`);

			throw new NotFoundException('Requested display profile does not exist');
		}

		this.logger.debug(`[LOOKUP] Found display profile id=${display.id}`);

		return display;
	}

	@Post()
	@Header('Location', `:baseUrl/${SYSTEM_MODULE_PREFIX}/displays/:id`)
	@Roles(UserRole.DISPLAY)
	@ApiOperation({
		summary: 'Create a new display profile',
		description: 'Register a new display profile',
	})
	@ApiBody({ type: ReqCreateDisplayProfileDto, description: 'Display profile creation data' })
	@ApiCreatedSuccessResponse(DisplayProfileEntity, 'Display profile created successfully')
	@ApiBadRequestResponse('Invalid request data')
	@ApiUnprocessableEntityResponse({ description: 'UID already exists' })
	@ApiInternalServerErrorResponse()
	async create(@Body() createDto: ReqCreateDisplayProfileDto): Promise<DisplayProfileEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new display profile');

		const existingDisplay = await this.displaysService.findByUid(createDto.data.uid);

		if (existingDisplay) {
			this.logger.warn('[CREATE] Display profile is trying to use used uid');

			throw new UnprocessableEntityException('Trying to create display profile with used uid');
		}

		const display = await this.displaysService.create(createDto.data);

		this.logger.debug(`[CREATE] Successfully created display profile id=${display.id}`);

		return display;
	}

	@Patch(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	@ApiOperation({
		summary: 'Update a display profile',
		description: 'Update an existing display profile',
	})
	@ApiParam({ name: 'id', description: 'Display profile ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReqUpdateDisplayProfileDto, description: 'Display profile update data' })
	@ApiSuccessResponse(DisplayProfileEntity, 'Display profile updated successfully')
	@ApiNotFoundResponse('Display profile not found')
	@ApiBadRequestResponse('Invalid request data')
	@ApiInternalServerErrorResponse()
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDisplayProfileDto,
	): Promise<DisplayProfileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		const updatedDisplay = await this.displaysService.update(display.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated display profile id=${updatedDisplay.id}`);

		return updatedDisplay;
	}

	@Delete(':id')
	@HttpCode(204)
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	@ApiOperation({
		summary: 'Delete a display profile',
		description: 'Delete an existing display profile',
	})
	@ApiParam({ name: 'id', description: 'Display profile ID', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'Display profile deleted successfully' })
	@ApiNotFoundResponse('Display profile not found')
	@ApiBadRequestResponse('Invalid display profile ID format')
	@ApiInternalServerErrorResponse()
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.displaysService.remove(display.id);

		this.logger.debug(`[DELETE] Successfully deleted display profile id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of display profile id=${id}`);

		const display = await this.displaysService.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] display profile with id=${id} not found`);

			throw new NotFoundException('Requested display profile does not exist');
		}

		return display;
	}
}
