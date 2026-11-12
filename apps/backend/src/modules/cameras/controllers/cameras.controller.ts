import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CAMERAS_MODULE_API_TAG_NAME, CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasForbiddenException, CamerasNotFoundException } from '../cameras.exceptions';
import { resolveCameraOwner } from '../cameras.utils';
import { CameraResponseModel, CamerasResponseModel } from '../models/cameras-response.model';
import { CamerasService } from '../services/cameras.service';

@ApiTags(CAMERAS_MODULE_API_TAG_NAME)
@Controller('cameras')
export class CamerasController {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CamerasController');

	constructor(private readonly camerasService: CamerasService) {}

	@ApiOperation({
		tags: [CAMERAS_MODULE_API_TAG_NAME],
		summary: 'List cameras',
		description: 'Retrieves all camera and doorbell devices together with their stream profiles.',
		operationId: 'get-cameras-module-cameras',
	})
	@ApiSuccessResponse(CamerasResponseModel, 'Cameras retrieved successfully')
	@ApiForbiddenResponse('Cameras are not available to this caller')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(@Req() req: AuthenticatedRequest): Promise<CamerasResponseModel> {
		this.requireOwner(req);

		const response = new CamerasResponseModel();

		response.data = await this.camerasService.findAll();

		return response;
	}

	@ApiOperation({
		tags: [CAMERAS_MODULE_API_TAG_NAME],
		summary: 'Get a camera',
		description: 'Retrieves a single camera or doorbell device together with its stream profiles.',
		operationId: 'get-cameras-module-camera',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Camera device identifier' })
	@ApiSuccessResponse(CameraResponseModel, 'Camera retrieved successfully')
	@ApiForbiddenResponse('Cameras are not available to this caller')
	@ApiNotFoundResponse('Camera not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':deviceId')
	async findOne(
		@Req() req: AuthenticatedRequest,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
	): Promise<CameraResponseModel> {
		this.requireOwner(req);

		try {
			const { device, provider } = await this.camerasService.getOneOrThrow(deviceId);

			const response = new CameraResponseModel();

			response.data = await this.camerasService.toModel(device, provider);

			return response;
		} catch (error) {
			if (error instanceof CamerasNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	private requireOwner(req: AuthenticatedRequest): void {
		try {
			resolveCameraOwner(req);
		} catch (error) {
			if (error instanceof CamerasForbiddenException) {
				throw new ForbiddenException(error.message);
			}

			throw error;
		}
	}
}
