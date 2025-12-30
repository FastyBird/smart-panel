import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { type FindOptionsWhere, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateSceneConditionDto } from '../dto/create-scene-condition.dto';
import { UpdateSceneConditionDto } from '../dto/update-scene-condition.dto';
import { SceneConditionEntity } from '../entities/scenes.entity';
import { EventType } from '../scenes.constants';
import { ScenesNotFoundException, ScenesValidationException } from '../scenes.exceptions';

@Injectable()
export class SceneConditionsService {
	private readonly logger = new Logger(SceneConditionsService.name);

	constructor(
		@InjectRepository(SceneConditionEntity)
		private readonly repository: Repository<SceneConditionEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAllForScene(sceneId: string): Promise<SceneConditionEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all conditions for scene id=${sceneId}`);

		const conditions = await this.repository.find({
			where: { scene: { id: sceneId } } as FindOptionsWhere<SceneConditionEntity>,
			relations: ['scene'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${conditions.length} conditions for scene id=${sceneId}`);

		return conditions;
	}

	async findOne(id: string): Promise<SceneConditionEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching condition with id=${id}`);

		const condition = await this.repository.findOne({
			where: { id },
			relations: ['scene'],
		});

		if (!condition) {
			this.logger.debug(`[LOOKUP] Condition with id=${id} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched condition with id=${id}`);

		return condition;
	}

	async create(createDto: CreateSceneConditionDto & { scene: string }): Promise<SceneConditionEntity> {
		this.logger.debug('[CREATE] Creating new scene condition');

		const dtoInstance = toInstance(CreateSceneConditionDto, createDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for condition creation error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided condition data are invalid.');
		}

		const condition = this.repository.create(toInstance(SceneConditionEntity, createDto));

		const savedCondition = await this.repository.save(condition);

		const result = await this.getOneOrThrow(savedCondition.id);

		this.logger.debug(`[CREATE] Successfully created new condition with id=${result.id}`);

		this.eventEmitter.emit(EventType.SCENE_CONDITION_CREATED, result);

		return result;
	}

	async update(id: string, updateDto: UpdateSceneConditionDto): Promise<SceneConditionEntity> {
		this.logger.debug(`[UPDATE] Updating condition with id=${id}`);

		const existingCondition = await this.getOneOrThrow(id);

		const dtoInstance = toInstance(UpdateSceneConditionDto, updateDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for condition update error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided condition data are invalid.');
		}

		const filteredUpdate = omitBy(dtoInstance, isUndefined);

		const mergedCondition = this.repository.merge(existingCondition, filteredUpdate as Partial<SceneConditionEntity>);
		mergedCondition.updatedAt = new Date();

		const savedCondition = await this.repository.save(mergedCondition);

		const result = await this.getOneOrThrow(savedCondition.id);

		this.logger.debug(`[UPDATE] Successfully updated condition with id=${result.id}`);

		this.eventEmitter.emit(EventType.SCENE_CONDITION_UPDATED, result);

		return result;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing condition with id=${id}`);

		const condition = await this.getOneOrThrow(id);

		await this.repository.remove(condition);

		this.logger.debug(`[DELETE] Successfully removed condition with id=${id}`);

		this.eventEmitter.emit(EventType.SCENE_CONDITION_DELETED, { id });
	}

	async getOneOrThrow(id: string): Promise<SceneConditionEntity> {
		const condition = await this.findOne(id);

		if (!condition) {
			this.logger.error(`[ERROR] Condition with id=${id} was not found.`);
			throw new ScenesNotFoundException(`Scene condition with id=${id} was not found.`);
		}

		return condition;
	}
}
