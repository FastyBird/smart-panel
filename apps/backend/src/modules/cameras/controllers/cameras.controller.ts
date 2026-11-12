import { FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiBinarySuccessResponse,
	ApiCreatedSuccessResponse,
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
import { CameraSessionOwner, resolveCameraOwner } from '../cameras.utils';
import { ReqCreateCameraSessionDto } from '../dto/create-session.dto';
import { SnapshotQueryDto } from '../dto/snapshot-query.dto';
import { CamerasModuleEnabledGuard } from '../guards/cameras-module-enabled.guard';
import {
	CameraResponseModel,
	CameraSessionResponseModel,
	CamerasResponseModel,
} from '../models/cameras-response.model';
import { CameraSessionModel } from '../models/session.model';
import { CameraSessionService } from '../services/camera-session.service';
import { CameraSnapshotResult, CameraSnapshotService } from '../services/camera-snapshot.service';
import { CameraProviderTimeoutError, CamerasService } from '../services/cameras.service';

const PROFILE_UNAVAILABLE_MESSAGE = 'Stream profile is not available';

@ApiTags(CAMERAS_MODULE_API_TAG_NAME)
@UseGuards(CamerasModuleEnabledGuard)
@Controller('cameras')
export class CamerasController {
	constructor(
		private readonly camerasService: CamerasService,
		private readonly snapshotService: CameraSnapshotService,
		private readonly sessionService: CameraSessionService,
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
	@ApiBadRequestResponse('Invalid UUID format')
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
	@ApiBadRequestResponse('Invalid UUID format or query parameters')
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
			// Provider errors are sanitised at the provider boundary; only the module's own not-found keeps its text.
			if (error instanceof CamerasNotFoundException) {
				throw new NotFoundException(error.message);
			}

			if (error instanceof CameraProfileUnavailableException) {
				throw new NotFoundException(PROFILE_UNAVAILABLE_MESSAGE);
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

	@ApiOperation({
		tags: [CAMERAS_MODULE_API_TAG_NAME],
		summary: 'Open a live view session',
		description:
			'Creates a short-lived, single-use live view session for a camera stream profile. The returned relative URL must be opened within a minute.',
		operationId: 'create-cameras-module-camera-session',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Camera device identifier' })
	@ApiCreatedSuccessResponse(CameraSessionResponseModel, 'Session created successfully')
	@ApiForbiddenResponse('Cameras are not available to this caller')
	@ApiNotFoundResponse('Camera or stream profile not found')
	@ApiBadRequestResponse('Invalid session request or invalid UUID format')
	@ApiServiceUnavailableResponse('Camera did not respond')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':deviceId/sessions')
	async createSession(
		@Req() req: AuthenticatedRequest,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Body() body: ReqCreateCameraSessionDto,
	): Promise<CameraSessionResponseModel> {
		const owner = this.requireOwner(req);

		let created: ReturnType<CameraSessionService['create']>;

		try {
			const { device, provider } = await this.camerasService.getProviderOrThrow(deviceId);
			const profile = await this.camerasService.resolveProfile(device, provider, body.data.profile);

			created = this.sessionService.create({
				deviceId: device.id,
				profileId: profile.id,
				transport: body.data.transport,
				owner,
			});
		} catch (error) {
			if (error instanceof CamerasNotFoundException) {
				throw new NotFoundException(error.message);
			}

			if (error instanceof CameraProfileUnavailableException) {
				throw new NotFoundException(PROFILE_UNAVAILABLE_MESSAGE);
			}

			if (
				error instanceof CameraProviderTimeoutError ||
				error instanceof CameraOfflineException ||
				error instanceof CameraRateLimitedException ||
				error instanceof CameraUpstreamException
			) {
				throw new ServiceUnavailableException('Camera did not respond');
			}

			throw error;
		}

		const model = new CameraSessionModel();

		model.sessionId = created.session.id;
		model.url = `/api/v1/modules/cameras/live?session=${created.token}`;
		model.expiresAt = new Date(created.session.expiresAt).toISOString();

		const response = new CameraSessionResponseModel();

		response.data = model;

		return response;
	}

	private requireOwner(req: AuthenticatedRequest): CameraSessionOwner {
		try {
			return resolveCameraOwner(req);
		} catch (error) {
			if (error instanceof CamerasForbiddenException) {
				throw new ForbiddenException(error.message);
			}

			throw error;
		}
	}
}
