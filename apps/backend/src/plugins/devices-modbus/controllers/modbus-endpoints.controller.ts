import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { setLocationHeader } from '../../../modules/api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_MODBUS_API_TAG_NAME, DEVICES_MODBUS_PLUGIN_PREFIX } from '../devices-modbus.constants';
import { ReqCreateModbusEndpointDto } from '../dto/create-endpoint.dto';
import { ReqUpdateModbusEndpointDto } from '../dto/update-endpoint.dto';
import { ModbusEndpointHealthModel, ModbusEndpointHealthResponseModel } from '../models/endpoint-health.model';
import { ModbusEndpointResponseModel, ModbusEndpointsResponseModel } from '../models/endpoint-response.model';
import { ModbusConnectionsService } from '../services/modbus-connections.service';
import { ModbusEndpointsService } from '../services/modbus-endpoints.service';

@ApiTags(DEVICES_MODBUS_API_TAG_NAME)
@Controller('endpoints')
export class ModbusEndpointsController {
	constructor(
		private readonly endpointsService: ModbusEndpointsService,
		private readonly connections: ModbusConnectionsService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve a list of Modbus endpoints',
		description: 'Fetches all configured Modbus endpoints (TCP gateways) that devices can be attached to.',
		operationId: 'get-devices-modbus-plugin-endpoints',
	})
	@ApiSuccessResponse(ModbusEndpointsResponseModel, 'A list of Modbus endpoints successfully retrieved.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get()
	async findAll(): Promise<ModbusEndpointsResponseModel> {
		const response = new ModbusEndpointsResponseModel();

		response.data = await this.endpointsService.findAll();

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve a Modbus endpoint',
		description: 'Fetches the details of a single Modbus endpoint identified by its unique ID.',
		operationId: 'get-devices-modbus-plugin-endpoint',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Endpoint ID' })
	@ApiSuccessResponse(ModbusEndpointResponseModel, 'The Modbus endpoint was successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ModbusEndpointResponseModel> {
		const response = new ModbusEndpointResponseModel();

		response.data = await this.endpointsService.getOneOrThrow(id);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Create a Modbus endpoint',
		description:
			'Creates a Modbus endpoint. Omitted fields take their defaults; rtu_over_tcp framing always uses a single in-flight request. The host and port pair must be unique.',
		operationId: 'create-devices-modbus-plugin-endpoint',
	})
	@ApiBody({ type: ReqCreateModbusEndpointDto, description: 'The data required to create a new endpoint' })
	@ApiCreatedSuccessResponse(
		ModbusEndpointResponseModel,
		'The Modbus endpoint was successfully created.',
		'/api/v1/plugins/devices-modbus/endpoints/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data or duplicate host and port')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post()
	async create(
		@Body() body: ReqCreateModbusEndpointDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<ModbusEndpointResponseModel> {
		const endpoint = await this.endpointsService.create(body.data);

		setLocationHeader(req, res, DEVICES_MODBUS_PLUGIN_PREFIX, 'endpoints', endpoint.id, { isPlugin: true });

		const response = new ModbusEndpointResponseModel();

		response.data = endpoint;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Update a Modbus endpoint',
		description:
			'Partially updates a Modbus endpoint. Changing the framing applies that framing default inter-request delay unless one is supplied.',
		operationId: 'update-devices-modbus-plugin-endpoint',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Endpoint ID' })
	@ApiBody({ type: ReqUpdateModbusEndpointDto, description: 'The data required to update an endpoint' })
	@ApiSuccessResponse(ModbusEndpointResponseModel, 'The Modbus endpoint was successfully updated.')
	@ApiBadRequestResponse('Invalid request data or duplicate host and port')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateModbusEndpointDto,
	): Promise<ModbusEndpointResponseModel> {
		const response = new ModbusEndpointResponseModel();

		response.data = await this.endpointsService.update(id, body.data);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Delete a Modbus endpoint',
		description: 'Deletes a Modbus endpoint. Fails while any Modbus device is still attached to it.',
		operationId: 'delete-devices-modbus-plugin-endpoint',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Endpoint ID' })
	@ApiNoContentResponse({ description: 'Endpoint deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format or endpoint is in use')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		await this.endpointsService.remove(id);
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve Modbus endpoint health',
		description:
			'Returns the live connection health of an endpoint. An endpoint that is disabled or not running reports the stopped state with zeroed counters.',
		operationId: 'get-devices-modbus-plugin-endpoint-health',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Endpoint ID' })
	@ApiSuccessResponse(ModbusEndpointHealthResponseModel, 'The endpoint health was successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	// The admin table polls every endpoint's health; the global 30/min per handler is too low for that.
	@Throttle({ default: { limit: 240, ttl: 60000 } })
	@Get(':id/health')
	async health(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ModbusEndpointHealthResponseModel> {
		const endpoint = await this.endpointsService.getOneOrThrow(id);

		const health = this.connections.getHealth(endpoint.id);

		const response = new ModbusEndpointHealthResponseModel();

		response.data = health ? ModbusEndpointHealthModel.from(health) : ModbusEndpointHealthModel.stopped();

		return response;
	}
}
