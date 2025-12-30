import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { type FindOptionsWhere, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateSceneTriggerDto } from '../dto/create-scene-trigger.dto';
import { UpdateSceneTriggerDto } from '../dto/update-scene-trigger.dto';
import { SceneTriggerEntity } from '../entities/scenes.entity';
import { EventType } from '../scenes.constants';
import { ScenesNotFoundException, ScenesValidationException } from '../scenes.exceptions';

@Injectable()
export class SceneTriggersService {
	private readonly logger = new Logger(SceneTriggersService.name);

	constructor(
		@InjectRepository(SceneTriggerEntity)
		private readonly repository: Repository<SceneTriggerEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAllForScene(sceneId: string): Promise<SceneTriggerEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all triggers for scene id=${sceneId}`);

		const triggers = await this.repository.find({
			where: { scene: { id: sceneId } } as FindOptionsWhere<SceneTriggerEntity>,
			relations: ['scene'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${triggers.length} triggers for scene id=${sceneId}`);

		return triggers;
	}

	async findOne(id: string): Promise<SceneTriggerEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching trigger with id=${id}`);

		const trigger = await this.repository.findOne({
			where: { id },
			relations: ['scene'],
		});

		if (!trigger) {
			this.logger.debug(`[LOOKUP] Trigger with id=${id} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched trigger with id=${id}`);

		return trigger;
	}

	async create(createDto: CreateSceneTriggerDto & { scene: string }): Promise<SceneTriggerEntity> {
		this.logger.debug('[CREATE] Creating new scene trigger');

		const dtoInstance = toInstance(CreateSceneTriggerDto, createDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for trigger creation error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided trigger data are invalid.');
		}

		const trigger = this.repository.create(toInstance(SceneTriggerEntity, createDto));

		const savedTrigger = await this.repository.save(trigger);

		const result = await this.getOneOrThrow(savedTrigger.id);

		this.logger.debug(`[CREATE] Successfully created new trigger with id=${result.id}`);

		this.eventEmitter.emit(EventType.SCENE_TRIGGER_CREATED, result);

		return result;
	}

	async update(id: string, updateDto: UpdateSceneTriggerDto): Promise<SceneTriggerEntity> {
		this.logger.debug(`[UPDATE] Updating trigger with id=${id}`);

		const existingTrigger = await this.getOneOrThrow(id);

		const dtoInstance = toInstance(UpdateSceneTriggerDto, updateDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for trigger update error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided trigger data are invalid.');
		}

		const filteredUpdate = omitBy(dtoInstance, isUndefined);

		const mergedTrigger = this.repository.merge(existingTrigger, filteredUpdate as Partial<SceneTriggerEntity>);
		mergedTrigger.updatedAt = new Date();

		const savedTrigger = await this.repository.save(mergedTrigger);

		const result = await this.getOneOrThrow(savedTrigger.id);

		this.logger.debug(`[UPDATE] Successfully updated trigger with id=${result.id}`);

		this.eventEmitter.emit(EventType.SCENE_TRIGGER_UPDATED, result);

		return result;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing trigger with id=${id}`);

		const trigger = await this.getOneOrThrow(id);

		await this.repository.remove(trigger);

		this.logger.debug(`[DELETE] Successfully removed trigger with id=${id}`);

		this.eventEmitter.emit(EventType.SCENE_TRIGGER_DELETED, { id });
	}

	async getOneOrThrow(id: string): Promise<SceneTriggerEntity> {
		const trigger = await this.findOne(id);

		if (!trigger) {
			this.logger.error(`[ERROR] Trigger with id=${id} was not found.`);
			throw new ScenesNotFoundException(`Scene trigger with id=${id} was not found.`);
		}

		return trigger;
	}
}
