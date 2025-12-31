import { validate } from 'class-validator';
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
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CreateSceneActionDto, ReqCreateSceneActionDto } from '../dto/create-scene-action.dto';
import { ReqUpdateSceneActionDto, UpdateSceneActionDto } from '../dto/update-scene-action.dto';
import { SceneActionResponseModel, SceneActionsResponseModel } from '../models/scenes-response.model';
import { SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesException } from '../scenes.exceptions';
import { SceneActionsService } from '../services/scene-actions.service';
import { ScenesService } from '../services/scenes.service';

@ApiTags(SCENES_MODULE_API_TAG_NAME)
@Controller('scenes/:sceneId/actions')
export class SceneActionsController {
	private readonly logger = new Logger(SceneActionsController.name);

	constructor(
		private readonly sceneActionsService: SceneActionsService,
		private readonly scenesService: ScenesService,
	) {}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve all actions for a scene',
		description: 'Fetches a list of all actions associated with a specific scene.',
		operationId: 'get-scenes-module-scene-actions',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiSuccessResponse(SceneActionsResponseModel, 'A list of scene actions successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
	): Promise<SceneActionsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all actions for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const actions = await this.sceneActionsService.findAllForScene(sceneId);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${actions.length} actions for scene id=${sceneId}`);

		const response = new SceneActionsResponseModel();
		response.data = actions;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a specific action',
		description: 'Fetches the details of a specific action within a scene.',
		operationId: 'get-scenes-module-scene-action',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Action ID' })
	@ApiSuccessResponse(SceneActionResponseModel, 'The action details were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or action not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SceneActionResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching action id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getActionOrThrow(id, sceneId);

		const action = await this.sceneActionsService.findOne(id);

		this.logger.debug(`[LOOKUP] Found action id=${action?.id}`);

		const response = new SceneActionResponseModel();
		response.data = action;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Create a new action for a scene',
		description: 'Creates a new action within a specific scene.',
		operationId: 'create-scenes-module-scene-action',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiBody({ type: ReqCreateSceneActionDto, description: 'The data required to create a new action' })
	@ApiCreatedSuccessResponse(
		SceneActionResponseModel,
		'The action was successfully created.',
		'/api/v1/scenes-module/scenes/123e4567-e89b-12d3-a456-426614174000/actions/123e4567-e89b-12d3-a456-426614174001',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Scene not found')
	@ApiUnprocessableEntityResponse('Action could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Body() createDto: { data: CreateSceneActionDto },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SceneActionResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create action for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const dtoInstance = toInstance(CreateSceneActionDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for action creation error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const action = await this.sceneActionsService.create({
				...dtoInstance,
				scene: sceneId,
			});

			this.logger.debug(`[CREATE] Successfully created action id=${action.id}`);

			setLocationHeader(req, res, SCENES_MODULE_PREFIX, `scenes/${sceneId}/actions`, action.id);

			const response = new SceneActionResponseModel();
			response.data = action;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Action could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Update an existing action',
		description: 'Updates an existing action within a scene.',
		operationId: 'update-scenes-module-scene-action',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Action ID' })
	@ApiBody({ type: ReqUpdateSceneActionDto, description: 'The data required to update the action' })
	@ApiSuccessResponse(SceneActionResponseModel, 'The action was successfully updated.')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Scene or action not found')
	@ApiUnprocessableEntityResponse('Action could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: UpdateSceneActionDto },
	): Promise<SceneActionResponseModel> {
		this.logger.debug(`[UPDATE] Incoming request to update action id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getActionOrThrow(id, sceneId);

		const dtoInstance = toInstance(UpdateSceneActionDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for action update error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const action = await this.sceneActionsService.update(id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated action id=${action.id}`);

			const response = new SceneActionResponseModel();
			response.data = action;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Action could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Delete an action',
		description: 'Deletes a specific action from a scene.',
		operationId: 'delete-scenes-module-scene-action',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Action ID' })
	@ApiNoContentResponse({ description: 'The action was successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or action not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete action id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getActionOrThrow(id, sceneId);

		await this.sceneActionsService.remove(id);

		this.logger.debug(`[DELETE] Successfully deleted action id=${id}`);
	}

	private async getSceneOrThrow(sceneId: string): Promise<void> {
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			throw new NotFoundException(`Scene with id=${sceneId} was not found.`);
		}
	}

	private async getActionOrThrow(id: string, sceneId: string): Promise<void> {
		const action = await this.sceneActionsService.findOne(id);

		if (!action) {
			throw new NotFoundException(`Action with id=${id} was not found.`);
		}

		// Verify the action belongs to the specified scene (IDOR protection)
		const actionSceneId = typeof action.scene === 'string' ? action.scene : action.scene?.id;
		if (actionSceneId !== sceneId) {
			throw new NotFoundException(`Action with id=${id} was not found.`);
		}
	}
}
