import { FastifyReply as Response } from 'fastify';

import {
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBinarySuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CAMERAS_MODULE_API_TAG_NAME } from '../cameras.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasForbiddenException,
	CamerasNotFoundException,
} from '../cameras.exceptions';
import { resolveCameraOwner } from '../cameras.utils';
import { SnapshotQueryDto } from '../dto/snapshot-query.dto';
import { CameraResponseModel, CamerasResponseModel } from '../models/cameras-response.model';
import { CameraSnapshotResult, CameraSnapshotService } from '../services/camera-snapshot.service';
import { CamerasService } from '../services/cameras.service';

@ApiTags(CAMERAS_MODULE_API_TAG_NAME)
@Controller('cameras')
export class CamerasController {
	constructor(
		private readonly camerasService: CamerasService,
		private readonly snapshotService: CameraSnapshotService,
	) {}

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

	@ApiOperation({
		tags: [CAMERAS_MODULE_API_TAG_NAME],
		summary: 'Get a camera snapshot',
		description:
			'Returns a current still image of the camera. Images are cached for a short time and concurrent requests share one camera call. When the camera is rate limited the last image is returned with an X-Snapshot-Age header (whole seconds).',
		operationId: 'get-cameras-module-camera-snapshot',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Camera device identifier' })
	@ApiBinarySuccessResponse(
		{
			'image/jpeg': { type: 'string', format: 'binary' },
			'image/png': { type: 'string', format: 'binary' },
			'image/webp': { type: 'string', format: 'binary' },
		},
		'Camera snapshot image',
	)
	@ApiForbiddenResponse('Cameras are not available to this caller')
	@ApiNotFoundResponse('Camera or stream profile not found')
	@ApiServiceUnavailableResponse('Camera is offline, busy or did not respond')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':deviceId/snapshot')
	async getSnapshot(
		@Req() req: AuthenticatedRequest,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Query() query: SnapshotQueryDto,
		@Res() res: Response,
	): Promise<void> {
		this.requireOwner(req);

		let snapshot: CameraSnapshotResult;

		try {
			snapshot = await this.snapshotService.getSnapshot(deviceId, {
				profileId: query.profile,
				highQuality: query.hq === 'true',
			});
		} catch (error) {
			if (error instanceof CamerasNotFoundException || error instanceof CameraProfileUnavailableException) {
				throw new NotFoundException(error.message);
			}

			if (error instanceof CameraOfflineException) {
				throw new ServiceUnavailableException('Camera is offline');
			}

			if (error instanceof CameraRateLimitedException) {
				void res.header('Retry-After', '2');

				throw new ServiceUnavailableException('Camera is busy');
			}

			if (error instanceof CameraUpstreamException) {
				throw new ServiceUnavailableException('Camera did not respond');
			}

			throw error;
		}

		void res.header('Content-Type', snapshot.contentType);
		void res.header('Content-Length', String(snapshot.data.length));
		void res.header('Cache-Control', 'no-store');

		if (snapshot.stale) {
			void res.header('X-Snapshot-Age', String(Math.floor(snapshot.ageMs / 1000)));
		}

		void res.send(snapshot.data);
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
