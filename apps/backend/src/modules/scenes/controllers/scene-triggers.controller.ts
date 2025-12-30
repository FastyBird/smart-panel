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
import { CreateSceneTriggerDto, ReqCreateSceneTriggerDto } from '../dto/create-scene-trigger.dto';
import { ReqUpdateSceneTriggerDto, UpdateSceneTriggerDto } from '../dto/update-scene-trigger.dto';
import { SceneTriggerResponseModel, SceneTriggersResponseModel } from '../models/scenes-response.model';
import { SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesException } from '../scenes.exceptions';
import { SceneTriggersService } from '../services/scene-triggers.service';
import { ScenesService } from '../services/scenes.service';

@ApiTags(SCENES_MODULE_API_TAG_NAME)
@Controller('scenes/:sceneId/triggers')
export class SceneTriggersController {
	private readonly logger = new Logger(SceneTriggersController.name);

	constructor(
		private readonly sceneTriggersService: SceneTriggersService,
		private readonly scenesService: ScenesService,
	) {}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve all triggers for a scene',
		description: 'Fetches a list of all triggers associated with a specific scene.',
		operationId: 'get-scenes-module-scene-triggers',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiSuccessResponse(SceneTriggersResponseModel, 'A list of scene triggers successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
	): Promise<SceneTriggersResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all triggers for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const triggers = await this.sceneTriggersService.findAllForScene(sceneId);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${triggers.length} triggers for scene id=${sceneId}`);

		const response = new SceneTriggersResponseModel();
		response.data = triggers;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a specific trigger',
		description: 'Fetches the details of a specific trigger within a scene.',
		operationId: 'get-scenes-module-scene-trigger',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Trigger ID' })
	@ApiSuccessResponse(SceneTriggerResponseModel, 'The trigger details were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or trigger not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SceneTriggerResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching trigger id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const trigger = await this.sceneTriggersService.findOne(id);

		if (!trigger) {
			throw new NotFoundException(`Trigger with id=${id} was not found.`);
		}

		this.logger.debug(`[LOOKUP] Found trigger id=${trigger.id}`);

		const response = new SceneTriggerResponseModel();
		response.data = trigger;

		return response;
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Create a new trigger for a scene',
		description: 'Creates a new trigger within a specific scene.',
		operationId: 'create-scenes-module-scene-trigger',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiBody({ type: ReqCreateSceneTriggerDto, description: 'The data required to create a new trigger' })
	@ApiCreatedSuccessResponse(
		SceneTriggerResponseModel,
		'The trigger was successfully created.',
		'/api/v1/scenes-module/scenes/123e4567-e89b-12d3-a456-426614174000/triggers/123e4567-e89b-12d3-a456-426614174001',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Scene not found')
	@ApiUnprocessableEntityResponse('Trigger could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Body() createDto: { data: CreateSceneTriggerDto },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SceneTriggerResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create trigger for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);

		const dtoInstance = toInstance(CreateSceneTriggerDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for trigger creation error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const trigger = await this.sceneTriggersService.create({
				...dtoInstance,
				scene: sceneId,
			});

			this.logger.debug(`[CREATE] Successfully created trigger id=${trigger.id}`);

			setLocationHeader(req, res, SCENES_MODULE_PREFIX, `scenes/${sceneId}/triggers`, trigger.id);

			const response = new SceneTriggerResponseModel();
			response.data = trigger;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Trigger could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Update an existing trigger',
		description: 'Updates an existing trigger within a scene.',
		operationId: 'update-scenes-module-scene-trigger',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Trigger ID' })
	@ApiBody({ type: ReqUpdateSceneTriggerDto, description: 'The data required to update the trigger' })
	@ApiSuccessResponse(SceneTriggerResponseModel, 'The trigger was successfully updated.')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Scene or trigger not found')
	@ApiUnprocessableEntityResponse('Trigger could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: UpdateSceneTriggerDto },
	): Promise<SceneTriggerResponseModel> {
		this.logger.debug(`[UPDATE] Incoming request to update trigger id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getTriggerOrThrow(id);

		const dtoInstance = toInstance(UpdateSceneTriggerDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for trigger update error=${JSON.stringify(errors)}`);
			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const trigger = await this.sceneTriggersService.update(id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated trigger id=${trigger.id}`);

			const response = new SceneTriggerResponseModel();
			response.data = trigger;

			return response;
		} catch (error) {
			if (error instanceof ScenesException) {
				throw new UnprocessableEntityException('Trigger could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [SCENES_MODULE_API_TAG_NAME],
		summary: 'Delete a trigger',
		description: 'Deletes a specific trigger from a scene.',
		operationId: 'delete-scenes-module-scene-trigger',
	})
	@ApiParam({ name: 'sceneId', type: 'string', format: 'uuid', description: 'Scene ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Trigger ID' })
	@ApiNoContentResponse({ description: 'The trigger was successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Scene or trigger not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(
		@Param('sceneId', new ParseUUIDPipe({ version: '4' })) sceneId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete trigger id=${id} for scene id=${sceneId}`);

		await this.getSceneOrThrow(sceneId);
		await this.getTriggerOrThrow(id);

		await this.sceneTriggersService.remove(id);

		this.logger.debug(`[DELETE] Successfully deleted trigger id=${id}`);
	}

	private async getSceneOrThrow(sceneId: string): Promise<void> {
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			throw new NotFoundException(`Scene with id=${sceneId} was not found.`);
		}
	}

	private async getTriggerOrThrow(id: string): Promise<void> {
		const trigger = await this.sceneTriggersService.findOne(id);

		if (!trigger) {
			throw new NotFoundException(`Trigger with id=${id} was not found.`);
		}
	}
}
