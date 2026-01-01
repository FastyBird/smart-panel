import { validate } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CreateSceneDto, ReqCreateSceneDto } from '../dto/create-scene.dto';
import { ReqTriggerSceneDto, TriggerSceneDto } from '../dto/trigger-scene.dto';
import { ReqUpdateSceneDto, UpdateSceneDto } from '../dto/update-scene.dto';
import { SceneEntity } from '../entities/scenes.entity';
import { SceneExecutionResponseModel, SceneResponseModel, ScenesResponseModel } from '../models/scenes-response.model';
import { SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesException, ScenesNotEditableException, ScenesNotTriggerableException } from '../scenes.exceptions';
import { SceneExecutorService } from '../services/scene-executor.service';
import { ScenesService } from '../services/scenes.service';

@ApiTags(SCENES_MODULE_API_TAG_NAME)
@Controller('scenes')
export class ScenesController {
	private readonly logger = new Logger(ScenesController.name);

	constructor(
		private readonly scenesService: ScenesService,
		private readonly sceneExecutorService: SceneExecutorService,
	) {}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of available scenes',
		description:
			'Fetches a list of all scenes currently registered in the system. Each scene includes its metadata (e.g., ID, name, and category), along with associated actions, conditions, and triggers.',
		operationId: 'get-scenes-module-scenes',
	})
	@ApiSuccessResponse(
		ScenesResponseModel,
		'A list of scenes successfully retrieved. Each scene includes its metadata (ID, name, category), associated actions, conditions, and triggers.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<ScenesResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all scenes');

		const scenes = await this.scenesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${scenes.length} scenes`);

		const response = new ScenesResponseModel();
		response.data = scenes;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific scene',
		description:
			"Fetches the details of a specific scene using its unique ID. The response includes the scene's metadata (e.g., ID, name, and category), associated actions, conditions, and triggers.",
		operationId: 'get-scenes-module-scene',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiSuccessResponse(
		SceneResponseModel,
		"The scene details were successfully retrieved. The response includes the scene's metadata (ID, name, category), associated actions, conditions, and triggers.",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SceneResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching scene id=${id}`);

		const scene = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found scene id=${scene.id}`);

		const response = new SceneResponseModel();
		response.data = scene;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Create a new scene',
		description:
			'Creates a new scene resource in the system. The request requires scene-specific attributes such as category and name. The response includes the full representation of the created scene, including its associated actions, conditions, and triggers. Additionally, a Location header is provided with the URI of the newly created resource.',
		operationId: 'create-scenes-module-scene',
	})
	@ApiBody({ type: ReqCreateSceneDto, description: 'The data required to create a new scene' })
	@ApiCreatedSuccessResponse(
		SceneResponseModel,
		'The scene was successfully created. The response includes the complete details of the newly created scene, such as its unique identifier, name, category, and timestamps.',
		'/api/v1/scenes/scenes/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiUnprocessableEntityResponse('Scene could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: { data: object },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SceneResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new scene');

		// Extract actions before validation - they will be validated by the service
		// using plugin-specific DTOs via the type mapper
		const rawData = createDto.data as Record<string, unknown>;
		const actions = rawData.actions;
		const sceneDataWithoutActions = { ...rawData };
		delete sceneDataWithoutActions.actions;

		const dtoInstance = toInstance(CreateSceneDto, sceneDataWithoutActions, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for scene creation error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		// Re-attach actions for the service to process with type mapper
		dtoInstance.actions = actions as CreateSceneDto['actions'];

		try {
			const scene = await this.scenesService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created scene id=${scene.id}`);

			setLocationHeader(req, res, SCENES_MODULE_PREFIX, 'scenes', scene.id);

			const response = new SceneResponseModel();
			response.data = scene;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Scene could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Update an existing scene',
		description:
			'Updates an existing scene resource in the system. Only provided fields will be updated. The response includes the full representation of the updated scene.',
		operationId: 'update-scenes-module-scene',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiBody({ type: ReqUpdateSceneDto, description: 'The data required to update the scene' })
	@ApiSuccessResponse(
		SceneResponseModel,
		'The scene was successfully updated. The response includes the complete details of the updated scene.',
	)
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiForbiddenResponse('Scene cannot be edited')
	@ApiNotFoundResponse('Scene not found')
	@ApiUnprocessableEntityResponse('Scene could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<SceneResponseModel> {
		this.logger.debug(`[UPDATE] Incoming request to update scene id=${id}`);

		await this.getOneOrThrow(id);

		const dtoInstance = toInstance(UpdateSceneDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for scene update error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const scene = await this.scenesService.update(id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated scene id=${scene.id}`);

			const response = new SceneResponseModel();
			response.data = scene;

			return response;
		} catch (error) {
			if (error instanceof ScenesNotEditableException) {
				throw new ForbiddenException('Scene cannot be edited');
			}

			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Scene could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Delete a scene',
		description: 'Deletes a specific scene from the system using its unique ID.',
		operationId: 'delete-scenes-module-scene',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiNoContentResponse({ description: 'The scene was successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Scene cannot be deleted')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete scene id=${id}`);

		await this.getOneOrThrow(id);

		try {
			await this.scenesService.remove(id);

			this.logger.debug(`[DELETE] Successfully deleted scene id=${id}`);
		} catch (error) {
			if (error instanceof ScenesNotEditableException) {
				throw new ForbiddenException('Scene cannot be deleted');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Trigger a scene',
		description:
			'Manually triggers a scene execution. The scene actions will be executed in order if all conditions are met.',
		operationId: 'trigger-scenes-module-scene',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiBody({ type: ReqTriggerSceneDto, description: 'Optional trigger context' })
	@ApiSuccessResponse(
		SceneExecutionResponseModel,
		'The scene was successfully triggered. The response includes the execution result.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Scene cannot be triggered')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/trigger')
	async trigger(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() triggerDto: { data?: TriggerSceneDto },
	): Promise<SceneExecutionResponseModel> {
		this.logger.debug(`[TRIGGER] Incoming request to trigger scene id=${id}`);

		await this.getOneOrThrow(id);

		try {
			const result = await this.sceneExecutorService.triggerScene(id, triggerDto.data?.source || 'manual');

			this.logger.debug(`[TRIGGER] Successfully triggered scene id=${id}`);

			const response = new SceneExecutionResponseModel();
			response.data = result;

			return response;
		} catch (error) {
			if (error instanceof ScenesNotTriggerableException) {
				throw new ForbiddenException('Scene cannot be triggered');
			}

			throw error;
		}
	}

	private async getOneOrThrow(id: string): Promise<SceneEntity> {
		const scene = await this.scenesService.findOne(id);

		if (!scene) {
			this.logger.error(`[ERROR] Scene with id=${id} was not found.`);
			throw new NotFoundException(`Scene with id=${id} was not found.`);
		}

		return scene;
	}
}
