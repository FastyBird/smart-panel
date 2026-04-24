import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

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
	SpaceResponseModel,
	SpacesResponseModel,
} from '../models/spaces-response.model';
import { SpacesService } from '../services/spaces.service';
import { SPACES_MODULE_API_TAG_NAME, SPACES_MODULE_NAME } from '../spaces.constants';

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
	// The incoming body is typed as `unknown` to bypass the global
	// `ValidationPipe` (which runs with `forbidNonWhitelisted: true` and would
	// reject subtype-specific fields that only exist on per-type plugin DTOs —
	// e.g. `category` on home-control, `layout` on signage). `SpacesService.create`
	// dispatches to the right `mapping.createDto` and validates there with full
	// whitelist + forbidNonWhitelisted semantics. Swagger docs stay accurate
	// via `@ApiBody({ type: ReqCreateSpaceDto })`.
	@ApiBody({ type: ReqCreateSpaceDto, description: 'Payload containing the space attributes to create.' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the created space')
	@ApiBadRequestResponse('Invalid space data')
	@ApiUnprocessableEntityResponse('Space validation failed')
	async create(@Body() body: unknown): Promise<SpaceResponseModel> {
		this.logger.debug('Creating new space');

		// Typing the body as `unknown` skips the global ValidationPipe's
		// class-based whitelist (see the block comment above the @ApiBody
		// decorator). That also means we inherit no null/shape normalization,
		// so guard `body.data` explicitly — a raw `null` / non-object / missing
		// `data` field would otherwise dereference and produce a 500.
		const data = this.extractRequestData(body);

		const space = await this.spacesService.create(data as Parameters<SpacesService['create']>[0]);

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
	// See create() — typed as `unknown` to bypass the global pipe so
	// plugin-contributed subtype fields reach `SpacesService.update()`, which
	// dispatches to `mapping.updateDto` for the authoritative validation.
	@ApiBody({ type: ReqUpdateSpaceDto, description: 'Payload containing the space attributes to update.' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the updated space')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid space data')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: unknown,
	): Promise<SpaceResponseModel> {
		this.logger.debug(`Updating space with id=${id}`);

		// See create() — guard against null / non-object / missing `data`.
		const data = this.extractRequestData(body);

		const space = await this.spacesService.update(id, data as Parameters<SpacesService['update']>[1]);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	/**
	 * Unwrap the `{ data: ... }` envelope used by every spaces mutation
	 * endpoint. Typed as `unknown` because the global ValidationPipe is
	 * bypassed for these routes (see create() / update() body comments) —
	 * the pipe normally rejects null/non-object bodies before they reach
	 * the handler, and we have to do the same by hand here so a malformed
	 * client payload surfaces as a 400, not a 500.
	 */
	private extractRequestData(body: unknown): object {
		if (body === null || typeof body !== 'object') {
			throw new BadRequestException([JSON.stringify({ field: 'data', reason: 'Request body must be a JSON object.' })]);
		}
		const data = (body as { data?: unknown }).data;
		if (data === null || typeof data !== 'object') {
			throw new BadRequestException([
				JSON.stringify({ field: 'data', reason: 'Request body is missing the `data` object.' }),
			]);
		}
		return data;
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
