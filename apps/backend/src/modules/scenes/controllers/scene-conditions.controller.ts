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
import { CreateSceneConditionDto, ReqCreateSceneConditionDto } from '../dto/create-scene-condition.dto';
import { ReqUpdateSceneConditionDto, UpdateSceneConditionDto } from '../dto/update-scene-condition.dto';
import { SceneConditionResponseModel, SceneConditionsResponseModel } from '../models/scenes-response.model';
import { SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesException } from '../scenes.exceptions';
import { SceneConditionsService } from '../services/scene-conditions.service';
import { ScenesService } from '../services/scenes.service';

@ApiTags(SCENES_MODULE_API_TAG_NAME)
@Controller('scenes/:sceneId/conditions')
export class SceneConditionsController {
	private readonly logger = new Logger(SceneConditionsController.name);

	constructor(
		private readonly sceneConditionsService: SceneConditionsService,
		private readonly scenesService: ScenesService,
	) {}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve all conditions for a scene',
		description: 'Fetches a list of all conditions associated with a specific scene.',
		operationId: 'get-scenes-module-scene-conditions',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiSuccessResponse(SceneConditionsResponseModel, 'A list of scene conditions successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
	): Promise<SceneConditionsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all conditions for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const conditions = await this.sceneConditionsService.findAllForScene(sceneId);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${conditions.length} conditions for scene id=${sceneId}`);

		const response = new SceneConditionsResponseModel();
		response.data = conditions;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a specific condition',
		description: 'Fetches the details of a specific condition within a scene.',
		operationId: 'get-scenes-module-scene-condition',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Condition ID' })
	@ApiSuccessResponse(SceneConditionResponseModel, 'The condition details were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or condition not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SceneConditionResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching condition id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getConditionOrThrow(id, sceneId);

		const condition = await this.sceneConditionsService.findOne(id);

		this.logger.debug(`[LOOKUP] Found condition id=${condition?.id}`);

		const response = new SceneConditionResponseModel();
		response.data = condition;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Create a new condition for a scene',
		description: 'Creates a new condition within a specific scene.',
		operationId: 'create-scenes-module-scene-condition',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiBody({ type: ReqCreateSceneConditionDto, description: 'The data required to create a new condition' })
	@ApiCreatedSuccessResponse(
		SceneConditionResponseModel,
		'The condition was successfully created.',
		'/api/v1/scenes-module/scenes/123e4567-e89b-12d3-a456-426614174000/conditions/123e4567-e89b-12d3-a456-426614174001',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Scene not found')
	@ApiUnprocessableEntityResponse('Condition could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Body() createDto: { data: CreateSceneConditionDto },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SceneConditionResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create condition for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const dtoInstance = toInstance(CreateSceneConditionDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for condition creation error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const condition = await this.sceneConditionsService.create({
				...dtoInstance,
				scene: sceneId,
			});

			this.logger.debug(`[CREATE] Successfully created condition id=${condition.id}`);

			setLocationHeader(req, res, SCENES_MODULE_PREFIX, `scenes/${sceneId}/conditions`, condition.id);

			const response = new SceneConditionResponseModel();
			response.data = condition;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Condition could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Update an existing condition',
		description: 'Updates an existing condition within a scene.',
		operationId: 'update-scenes-module-scene-condition',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Condition ID' })
	@ApiBody({ type: ReqUpdateSceneConditionDto, description: 'The data required to update the condition' })
	@ApiSuccessResponse(SceneConditionResponseModel, 'The condition was successfully updated.')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Scene or condition not found')
	@ApiUnprocessableEntityResponse('Condition could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: UpdateSceneConditionDto },
	): Promise<SceneConditionResponseModel> {
		this.logger.debug(`[UPDATE] Incoming request to update condition id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getConditionOrThrow(id, sceneId);

		const dtoInstance = toInstance(UpdateSceneConditionDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for condition update error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const condition = await this.sceneConditionsService.update(id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated condition id=${condition.id}`);

			const response = new SceneConditionResponseModel();
			response.data = condition;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Condition could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Delete a condition',
		description: 'Deletes a specific condition from a scene.',
		operationId: 'delete-scenes-module-scene-condition',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Condition ID' })
	@ApiNoContentResponse({ description: 'The condition was successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or condition not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete condition id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getConditionOrThrow(id, sceneId);

		await this.sceneConditionsService.remove(id);

		this.logger.debug(`[DELETE] Successfully deleted condition id=${id}`);
	}

	private async getSceneOrThrow(sceneId: string): Promise<void> {
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			throw new NotFoundException(`Scene with id=${sceneId} was not found.`);
		}
	}

	private async getConditionOrThrow(id: string, sceneId: string): Promise<void> {
		const condition = await this.sceneConditionsService.findOne(id);

		if (!condition) {
			throw new NotFoundException(`Condition with id=${id} was not found.`);
		}

		// Verify the condition belongs to the specified scene (IDOR protection)
		const conditionSceneId = typeof condition.scene === 'string' ? condition.scene : condition.scene?.id;
		if (conditionSceneId !== sceneId) {
			throw new NotFoundException(`Condition with id=${id} was not found.`);
		}
	}
}
