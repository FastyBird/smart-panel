import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { setLocationHeader } from '../../../modules/api/utils/location-header.utils';
import { DEVICES_MODULE_PREFIX } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_MODBUS_API_TAG_NAME, DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';
import { ReqCreateModbusDeviceStructureDto } from '../dto/create-device-structure.dto';
import { ReqUpdateModbusDeviceStructureDto } from '../dto/update-device-structure.dto';
import { ModbusBindingsResponseModel } from '../models/bindings-response.model';
import { ModbusDeviceResponseModel } from '../models/device-response.model';
import { ModbusBindingsService } from '../services/modbus-bindings.service';
import { ModbusDeviceStructureService } from '../services/modbus-device-structure.service';

@ApiTags(DEVICES_MODBUS_API_TAG_NAME)
@Controller('devices')
export class ModbusDevicesController {
	constructor(
		private readonly structureService: ModbusDeviceStructureService,
		private readonly bindingsService: ModbusBindingsService,
		private readonly devicesService: DevicesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Create a Modbus device',
		description:
			'Creates a Modbus device with its channels, properties and register bindings in one transaction. The whole structure is validated first (endpoint and unit, permissions against bindings, register rules and the device specification); nothing is stored when any check fails.',
		operationId: 'create-devices-modbus-plugin-device',
	})
	@ApiBody({
		type: ReqCreateModbusDeviceStructureDto,
		description: 'The device, its channels, properties and bindings',
	})
	@ApiCreatedSuccessResponse(
		ModbusDeviceResponseModel,
		'The Modbus device was successfully created.',
		'/api/v1/modules/devices/devices/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid device structure, unknown endpoint or unit already in use')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post()
	async create(
		@Body() body: ReqCreateModbusDeviceStructureDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<ModbusDeviceResponseModel> {
		const device = await this.structureService.create(body.data);

		setLocationHeader(req, res, DEVICES_MODULE_PREFIX, 'devices', device.id);

		const response = new ModbusDeviceResponseModel();

		response.data = device;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Update the points of a Modbus device',
		description:
			'Replaces the channels, properties and register bindings of a Modbus device and updates its category and polling defaults in one transaction. Channels and properties sent with an id are updated in place and keep it; channels of the device that are not listed are removed and every binding is replaced. The device_information channel, name, room, endpoint, unit and template provenance are not changed. The whole request is validated first; nothing is changed when any check fails.',
		operationId: 'update-devices-modbus-plugin-device-structure',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiBody({
		type: ReqUpdateModbusDeviceStructureDto,
		description: 'The category, polling defaults, channels, properties and bindings of the device',
	})
	@ApiSuccessResponse(ModbusDeviceResponseModel, 'The Modbus device points were successfully updated.')
	@ApiBadRequestResponse('Invalid UUID format or invalid device structure')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put(':id/structure')
	async updateStructure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateModbusDeviceStructureDto,
	): Promise<ModbusDeviceResponseModel> {
		const response = new ModbusDeviceResponseModel();

		response.data = await this.structureService.update(id, body.data);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve the register bindings of a Modbus device',
		description: 'Fetches the read and write register bindings of every property of a Modbus device.',
		operationId: 'get-devices-modbus-plugin-device-bindings',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(ModbusBindingsResponseModel, 'The device bindings were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get(':id/bindings')
	async bindings(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ModbusBindingsResponseModel> {
		const device = await this.devicesService.findOne(id);

		if (!device || device.type !== DEVICES_MODBUS_TYPE) {
			throw new NotFoundException('Requested Modbus device does not exist');
		}

		const response = new ModbusBindingsResponseModel();

		response.data = await this.bindingsService.findByDevice(id);

		return response;
	}
}
