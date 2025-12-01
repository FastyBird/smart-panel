import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { DEVICES_MODULE_API_TAG_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';
import { DeviceControlResponseModel, DeviceControlsResponseModel } from '../models/devices-response.model';
import { DevicesControlsService } from '../services/devices.controls.service';
import { DevicesService } from '../services/devices.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('devices/:deviceId/controls')
export class DevicesControlsController {
	private readonly logger = new Logger(DevicesControlsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesControlsService: DevicesControlsService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of all available device controls',
		description:
			'Fetches a list of controls associated with a specific device. Controls represent actions that can be performed on the device, such as reboot or calibration.',
		operationId: 'get-devices-module-device-controls',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(
		DeviceControlsResponseModel,
		'A list of controls successfully retrieved. Each control includes its metadata (ID, name, and timestamps).',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
	): Promise<DeviceControlsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const controls = await this.devicesControlsService.findAll(device.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${controls.length} controls for deviceId=${device.id}`);

		const response = new DeviceControlsResponseModel();

		response.data = controls;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific control for a device',
		description:
			"Fetches detailed information about a specific control associated with a device using its unique ID. The response includes metadata such as the control's name, ID, associated device, and timestamps.",
		operationId: 'get-devices-module-device-control',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiSuccessResponse(
		DeviceControlResponseModel,
		"The control details were successfully retrieved. The response includes the control's metadata (ID, name, and timestamps).",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOneControl(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DeviceControlResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const control = await this.getOneOrThrow(id, device.id);

		this.logger.debug(`[LOOKUP] Found control id=${control.id} for deviceId=${device.id}`);

		const response = new DeviceControlResponseModel();

		response.data = control;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Create a new control for a device',
		description:
			'Creates a new control associated with a specific device. Controls represent actions or commands that can be executed on the device, such as reboot or factory reset.',
		operationId: 'create-devices-module-device-control',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiBody({ type: ReqCreateDeviceControlDto, description: 'The data required to create a new device control' })
	@ApiCreatedSuccessResponse(
		DeviceControlResponseModel,
		'The control was successfully created. The response includes the complete details of the newly created control, such as its unique identifier, name, associated device, and timestamps.',
		'/api/v1/devices-module/devices/{deviceId}/controls/{controlId}',
	)
	@ApiBadRequestResponse('Invalid UUID format or duplicate control name')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Device control could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Body() createDto: ReqCreateDeviceControlDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<DeviceControlResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create a new control for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const existingControl = await this.devicesControlsService.findOneByName(createDto.data.name, device.id);

		if (existingControl === null) {
			throw ValidationExceptionFactory.createException([
				{
					property: 'controls',
					children: [
						{
							property: 'name',
							constraints: {
								unique: 'name must be unique',
							},
						},
					],
				},
			]);
		}

		try {
			const control = await this.devicesControlsService.create(device.id, createDto.data);

			this.logger.debug(`[CREATE] Successfully created control id=${control.id} for deviceId=${device.id}`);

			setLocationHeader(req, res, DEVICES_MODULE_PREFIX, 'devices', device.id, 'controls', control.id);

			const response = new DeviceControlResponseModel();

			response.data = control;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device control could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Delete a control for a device',
		description:
			'Deletes a specific control associated with a device using its unique ID. This action is irreversible and removes the control from the system.',
		operationId: 'delete-devices-module-device-control',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiNoContentResponse({ description: 'Control deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete control id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const control = await this.getOneOrThrow(id, device.id);

		await this.devicesControlsService.remove(control.id, device.id);

		this.logger.debug(`[DELETE] Successfully deleted control id=${id} for deviceId=${device.id}`);
	}

	private async getOneOrThrow(id: string, deviceId: string): Promise<DeviceControlEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of control id=${id} for deviceId=${deviceId}`);

		const control = await this.devicesControlsService.findOne(id, deviceId);

		if (!control) {
			this.logger.error(`[ERROR] Control with id=${id} for deviceId=${deviceId} not found`);

			throw new NotFoundException('Requested device control does not exist');
		}

		return control;
	}

	private async getDeviceOrThrow(deviceId: string): Promise<DeviceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of device id=${deviceId}`);

		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${deviceId} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		return device;
	}
}
