import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { DevicesResponseModel } from '../../devices/models/devices-response.model';
import { DisplaysResponseModel } from '../../displays/models/displays-response.model';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqBulkAssignDto } from '../dto/bulk-assign.dto';
import { ReqCreateSpaceDto } from '../dto/create-space.dto';
import { ReqUpdateSpaceDto } from '../dto/update-space.dto';
import {
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	CategoryTemplateDataModel,
	CategoryTemplatesResponseModel,
	SpaceResponseModel,
	SpacesResponseModel,
} from '../models/spaces-response.model';
import { SpacesService } from '../services/spaces.service';
import {
	SPACES_MODULE_API_TAG_NAME,
	SPACES_MODULE_NAME,
	SPACE_CATEGORY_TEMPLATES,
	SpaceRoomCategory,
	SpaceZoneCategory,
} from '../spaces.constants';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@Controller('spaces')
export class SpacesController {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesController');

	constructor(private readonly spacesService: SpacesService) {}

	@Get()
	@ApiOperation({
		operationId: 'get-spaces-module-spaces',
		summary: 'List all spaces',
		description: 'Retrieves a list of all spaces (rooms/zones).',
	})
	@ApiSuccessResponse(SpacesResponseModel, 'Returns a list of spaces')
	async findAll(): Promise<SpacesResponseModel> {
		this.logger.debug('Fetching all spaces');

		const spaces = await this.spacesService.findAll();

		const response = new SpacesResponseModel();

		response.data = spaces;

		return response;
	}

	@Get('categories/templates')
	@ApiOperation({
		operationId: 'get-spaces-module-category-templates',
		summary: 'List space category templates',
		description:
			'Retrieves all available space category templates with their default icons and descriptions. ' +
			'Templates provide suggested values when creating spaces of common room types.',
	})
	@ApiSuccessResponse(CategoryTemplatesResponseModel, 'Returns category templates')
	getCategoryTemplates(): CategoryTemplatesResponseModel {
		this.logger.debug('Fetching category templates');

		const templates = Object.entries(SPACE_CATEGORY_TEMPLATES).map(([category, template]) => {
			const model = new CategoryTemplateDataModel();
			model.category = category as SpaceRoomCategory | SpaceZoneCategory;
			model.icon = template.icon;
			model.description = template.description;
			return model;
		});

		const response = new CategoryTemplatesResponseModel();
		response.data = templates;

		return response;
	}

	@Get('zones')
	@ApiOperation({
		operationId: 'get-spaces-module-zones',
		summary: 'List all zones',
		description: 'Retrieves all spaces of type zone. Useful for parent selection dropdowns.',
	})
	@ApiSuccessResponse(SpacesResponseModel, 'Returns a list of zones')
	async findAllZones(): Promise<SpacesResponseModel> {
		this.logger.debug('Fetching all zones');

		const zones = await this.spacesService.findAllZones();

		const response = new SpacesResponseModel();
		response.data = zones;

		return response;
	}

	@Get(':id')
	@ApiOperation({
		operationId: 'get-spaces-module-space',
		summary: 'Get space by ID',
		description: 'Retrieves a specific space by its unique identifier.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the space')
	@ApiNotFoundResponse('Space not found')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceResponseModel> {
		this.logger.debug(`Fetching space with id=${id}`);

		const space = await this.spacesService.getOneOrThrow(id);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Post()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space',
		summary: 'Create a new space',
		description: 'Creates a new space (room/zone). Requires owner or admin role.',
	})
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the created space')
	@ApiBadRequestResponse('Invalid space data')
	@ApiUnprocessableEntityResponse('Space validation failed')
	async create(@Body() body: ReqCreateSpaceDto): Promise<SpaceResponseModel> {
		this.logger.debug('Creating new space');

		const space = await this.spacesService.create(body.data);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Patch(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'update-spaces-module-space',
		summary: 'Update space',
		description: 'Updates an existing space. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the updated space')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid space data')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateSpaceDto,
	): Promise<SpaceResponseModel> {
		this.logger.debug(`Updating space with id=${id}`);

		const space = await this.spacesService.update(id, body.data);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Delete(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space',
		summary: 'Delete space',
		description:
			'Removes a space from the system. Devices and displays in this space will be unassigned. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiNoContentResponse({ description: 'Space deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`Removing space with id=${id}`);

		await this.spacesService.remove(id);

		this.logger.debug(`Successfully removed space with id=${id}`);
	}

	@Get(':id/devices')
	@ApiOperation({
		operationId: 'get-spaces-module-space-devices',
		summary: 'List devices in space',
		description: 'Retrieves all devices assigned to a specific space.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(DevicesResponseModel, 'Returns the list of devices in the space')
	@ApiNotFoundResponse('Space not found')
	async findDevices(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DevicesResponseModel> {
		this.logger.debug(`Fetching devices for space with id=${id}`);

		const devices = await this.spacesService.findDevicesBySpace(id);

		const response = new DevicesResponseModel();

		response.data = devices;

		return response;
	}

	@Get(':id/displays')
	@ApiOperation({
		operationId: 'get-spaces-module-space-displays',
		summary: 'List displays in space',
		description: 'Retrieves all displays assigned to a specific space.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(DisplaysResponseModel, 'Returns the list of displays in the space')
	@ApiNotFoundResponse('Space not found')
	async findDisplays(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplaysResponseModel> {
		this.logger.debug(`Fetching displays for space with id=${id}`);

		const displays = await this.spacesService.findDisplaysBySpace(id);

		const response = new DisplaysResponseModel();

		response.data = displays;

		return response;
	}

	@Get(':id/children')
	@ApiOperation({
		operationId: 'get-spaces-module-space-children',
		summary: 'List child rooms of a zone',
		description: 'Retrieves all child rooms that belong to a zone. Only applicable for zones; returns empty for rooms.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Zone ID' })
	@ApiSuccessResponse(SpacesResponseModel, 'Returns the list of child rooms')
	@ApiNotFoundResponse('Space not found')
	async findChildren(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpacesResponseModel> {
		this.logger.debug(`Fetching child rooms for zone with id=${id}`);

		const children = await this.spacesService.getChildRooms(id);

		const response = new SpacesResponseModel();
		response.data = children;

		return response;
	}

	@Get(':id/parent')
	@ApiOperation({
		operationId: 'get-spaces-module-space-parent',
		summary: 'Get parent zone of a room',
		description:
			'Retrieves the parent zone for a room. Returns null if the room has no parent zone. ' +
			'Zones do not have parents.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Room ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the parent zone or null')
	@ApiNotFoundResponse('Space not found')
	async findParent(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceResponseModel> {
		this.logger.debug(`Fetching parent zone for room with id=${id}`);

		const parent = await this.spacesService.getParentZone(id);

		const response = new SpaceResponseModel();
		response.data = parent;

		return response;
	}

	@Post(':id/assign')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-assign',
		summary: 'Bulk assign devices/displays to space',
		description:
			'Assigns multiple devices and/or displays to a space in a single operation. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkAssignmentResponseModel, 'Returns the assignment result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid assignment data')
	async bulkAssign(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkAssignDto,
	): Promise<BulkAssignmentResponseModel> {
		this.logger.debug(`Bulk assigning to space with id=${id}`);

		const result = await this.spacesService.bulkAssign(id, body.data);

		const resultData = new BulkAssignmentResultDataModel();
		resultData.success = true;
		resultData.devicesAssigned = result.devicesAssigned;
		resultData.displaysAssigned = result.displaysAssigned;

		const response = new BulkAssignmentResponseModel();
		response.data = resultData;

		return response;
	}
}
