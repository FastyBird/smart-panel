import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ReqCreateDisplayInstanceDto } from '../dto/create-display-instance.dto';
import { ReqUpdateDisplayInstanceDto } from '../dto/update-display-instance.dto';
import { DisplayInstanceEntity } from '../entities/users.entity';
import { Roles } from '../guards/roles.guard';
import {
	DisplayInstanceByUidResponseModel,
	DisplayInstanceResponseModel,
	DisplayInstancesResponseModel,
} from '../models/users-response.model';
import { DisplaysInstancesService } from '../services/displays-instances.service';
import { UsersService } from '../services/users.service';
import { USERS_MODULE_API_TAG_NAME, USERS_MODULE_PREFIX, UserRole } from '../users.constants';

@ApiTags(USERS_MODULE_API_TAG_NAME)
@Controller('displays-instances')
export class DisplaysInstancesController {
	private readonly logger = new Logger(DisplaysInstancesController.name);

	constructor(
		private readonly displaysService: DisplaysInstancesService,
		private readonly usersService: UsersService,
	) {}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of all display instances',
		description:
			'Fetches a list of all display instances currently registered in the system. Each display instance includes its metadata such as ID, UID, MAC address, version, build, and associated user.',
		operationId: 'get-users-module-displays-instances',
	})
	@ApiSuccessResponse(
		DisplayInstancesResponseModel,
		'A list of display instances successfully retrieved. Each display instance includes its metadata (ID, UID, MAC address, version, build, and associated user).',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<DisplayInstancesResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays instances');

		const displays = await this.displaysService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${displays.length} displays instances`);

		const response = new DisplayInstancesResponseModel();

		response.data = displays;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific display instance',
		description:
			"Fetches the details of a specific display instance using its unique ID. The response includes the display instance's metadata such as ID, UID, MAC address, version, build, and associated user.",
		operationId: 'get-users-module-display-instance',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display instance ID' })
	@ApiSuccessResponse(
		DisplayInstanceResponseModel,
		"The display instance details were successfully retrieved. The response includes the display instance's metadata (ID, UID, MAC address, version, build, and associated user).",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Display instance not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayInstanceResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found display instance id=${display.id}`);

		const response = new DisplayInstanceResponseModel();

		response.data = display;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a display instance by UID',
		description:
			"Fetches the details of a specific display instance using its unique identifier (UID). The response includes the display instance's metadata such as ID, UID, MAC address, version, build, and associated user.",
		operationId: 'get-users-module-display-instance-by-uid',
	})
	@ApiParam({ name: 'uid', type: 'string', format: 'uuid', description: 'Display instance UID' })
	@ApiSuccessResponse(
		DisplayInstanceByUidResponseModel,
		"The display instance details were successfully retrieved. The response includes the display instance's metadata (ID, UID, MAC address, version, build, and associated user).",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Display instance not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('by-uid/:uid')
	async findOneByUid(
		@Param('uid', new ParseUUIDPipe({ version: '4' })) uid: string,
	): Promise<DisplayInstanceByUidResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching display instance uid=${uid}`);

		const display = await this.displaysService.findByUid(uid);

		if (!display) {
			this.logger.error(`[ERROR] display instance with uid=${uid} not found`);

			throw new NotFoundException('Requested display instance does not exist');
		}

		this.logger.debug(`[LOOKUP] Found display instance id=${display.id}`);

		const response = new DisplayInstanceByUidResponseModel();

		response.data = display;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Create a new display instance',
		description:
			'Registers a new display instance in the system. The request requires display-specific attributes such as UID, MAC address, version, build, and associated user. The response includes the full representation of the created display instance, including its unique identifier, UID, MAC address, version, build, and timestamps. Additionally, a Location header is provided with the URI of the newly created resource.',
		operationId: 'create-users-module-display-instance',
	})
	@ApiCreatedSuccessResponse(
		DisplayInstanceResponseModel,
		'The display instance was successfully created. The response includes the complete details of the newly created display instance, such as its unique identifier, UID, MAC address, version, build, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiUnprocessableEntityResponse('UID already exists or user not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Header('Location', `:baseUrl/${USERS_MODULE_PREFIX}/displays/:id`)
	@Roles(UserRole.DISPLAY)
	async create(@Body() createDto: ReqCreateDisplayInstanceDto): Promise<DisplayInstanceResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new display instance');

		const existingDisplay = await this.displaysService.findByUid(createDto.data.uid);

		if (existingDisplay) {
			this.logger.warn('[CREATE] Display instance is trying to use used uid');

			throw new UnprocessableEntityException('Trying to create display instance with used uid');
		}

		const displayUser = await this.usersService.findOne(createDto.data.user);

		if (!displayUser) {
			this.logger.warn('[CREATE] Display instance is trying to register without provided user');

			throw new UnprocessableEntityException('Trying to create display instance with used uid');
		}

		const display = await this.displaysService.create(displayUser.id, createDto.data);

		this.logger.debug(`[CREATE] Successfully created display instance id=${display.id}`);

		const response = new DisplayInstanceResponseModel();

		response.data = display;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Update an existing display instance',
		description:
			'Updates the details of an existing display instance using its unique ID. The request can include updates to version, build, or display profile. The response includes the complete updated representation of the display instance.',
		operationId: 'update-users-module-display-instance',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display instance ID' })
	@ApiSuccessResponse(
		DisplayInstanceResponseModel,
		'The display instance was successfully updated. The response includes the complete details of the updated display instance, such as its unique identifier, UID, MAC address, version, build, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Display instance not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDisplayInstanceDto,
	): Promise<DisplayInstanceResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		const updatedDisplay = await this.displaysService.update(display.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated display instance id=${updatedDisplay.id}`);

		const response = new DisplayInstanceResponseModel();

		response.data = updatedDisplay;

		return response;
	}

	@ApiOperation({
		tags: [USERS_MODULE_API_TAG_NAME],
		summary: 'Delete an existing display instance',
		description:
			'Deletes an existing display instance from the system using its unique ID. This operation is irreversible and will remove all associated display instance data.',
		operationId: 'delete-users-module-display-instance',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display instance ID' })
	@ApiNoContentResponse({ description: 'Display instance deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Display instance not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.displaysService.remove(display.id);

		this.logger.debug(`[DELETE] Successfully deleted display instance id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of display instance id=${id}`);

		const display = await this.displaysService.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] display instance with id=${id} not found`);

			throw new NotFoundException('Requested display instance does not exist');
		}

		return display;
	}
}
