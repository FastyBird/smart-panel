import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, type FindOptionsOrder, type FindOptionsWhere, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateSceneActionDto } from '../dto/create-scene-action.dto';
import { UpdateSceneActionDto } from '../dto/update-scene-action.dto';
import { SceneActionEntity } from '../entities/scenes.entity';
import { EventType } from '../scenes.constants';
import { ScenesNotFoundException, ScenesValidationException } from '../scenes.exceptions';

import { SceneActionsTypeMapperService } from './scene-actions-type-mapper.service';

@Injectable()
export class SceneActionsService {
	private readonly logger = new Logger(SceneActionsService.name);

	constructor(
		@InjectRepository(SceneActionEntity)
		private readonly repository: Repository<SceneActionEntity>,
		private readonly actionsMapperService: SceneActionsTypeMapperService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAllForScene<TAction extends SceneActionEntity>(sceneId: string, type?: string): Promise<TAction[]> {
		const mapping = type ? this.actionsMapperService.getMapping<TAction, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		const actions = (await repository.find({
			where: { scene: { id: sceneId } } as unknown as FindOptionsWhere<TAction>,
			relations: ['scene'],
			order: { order: 'ASC' } as unknown as FindOptionsOrder<TAction>,
		})) as TAction[];

		return actions;
	}

	async findOne<TAction extends SceneActionEntity>(id: string, type?: string): Promise<TAction | null> {
		const mapping = type ? this.actionsMapperService.getMapping<TAction, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		const action = (await repository.findOne({
			where: { id } as unknown as FindOptionsWhere<TAction>,
			relations: ['scene'],
		})) as TAction | null;

		if (!action) {
			return null;
		}

		return action;
	}

	async create<TAction extends SceneActionEntity>(
		createDto: CreateSceneActionDto & { scene: string },
	): Promise<TAction> {
		const { type } = createDto;

		const mapping = type ? this.actionsMapperService.getMapping<TAction, any, any>(type) : null;

		const dtoClass = mapping?.createDto ?? CreateSceneActionDto;
		const dtoInstance = toInstance(dtoClass, createDto) as object;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for action creation error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided action data are invalid.');
		}

		const entityClass = mapping?.class || SceneActionEntity;
		const repository = this.dataSource.getRepository(entityClass) as Repository<TAction>;

		const action = repository.create(toInstance(entityClass, dtoInstance) as TAction);

		const savedAction = await repository.save(action);

		// Retrieve with relations
		const result = await this.getOneOrThrow<TAction>(savedAction.id);

		this.eventEmitter.emit(EventType.SCENE_ACTION_CREATED, result);

		return result;
	}

	/**
	 * Create action using a provided EntityManager (for transaction support)
	 */
	async createWithEntityManager<TAction extends SceneActionEntity>(
		createDto: CreateSceneActionDto & { scene: string },
		entityManager: EntityManager,
	): Promise<TAction> {
		const { type } = createDto;

		const mapping = type ? this.actionsMapperService.getMapping<TAction, any, any>(type) : null;

		const dtoClass = mapping?.createDto ?? CreateSceneActionDto;
		const dtoInstance = toInstance(dtoClass, createDto) as object;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for action creation error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided action data are invalid.');
		}

		const entityClass = mapping?.class || SceneActionEntity;
		const repository = entityManager.getRepository(entityClass) as Repository<TAction>;

		const action = repository.create(toInstance(entityClass, dtoInstance) as TAction);

		const savedAction = await repository.save(action);

		return savedAction;
	}

	async update<TAction extends SceneActionEntity>(id: string, updateDto: UpdateSceneActionDto): Promise<TAction> {
		const existingAction = await this.getOneOrThrow<TAction>(id);

		const { type } = updateDto;

		const mapping = type ? this.actionsMapperService.getMapping<TAction, any, any>(type) : null;

		const dtoClass = mapping?.updateDto ?? UpdateSceneActionDto;
		const dtoInstance = toInstance(dtoClass, updateDto) as object;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for action update error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided action data are invalid.');
		}

		const entityClass = mapping?.class || SceneActionEntity;
		const repository = this.dataSource.getRepository(entityClass) as Repository<TAction>;

		const filteredUpdate = omitBy(dtoInstance, isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(filteredUpdate).some((key) => {
			const newValue = (filteredUpdate as Record<string, unknown>)[key];
			const existingValue = (existingAction as unknown as Record<string, unknown>)[key];

			// Deep comparison for arrays
			if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Deep comparison for plain objects
			if (
				typeof newValue === 'object' &&
				typeof existingValue === 'object' &&
				newValue !== null &&
				existingValue !== null
			) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Handle null/undefined comparison
			if (newValue === null && existingValue === null) {
				return false;
			}
			if (newValue === null || existingValue === null) {
				return true;
			}

			// Simple value comparison
			return newValue !== existingValue;
		});

		const mergedAction = repository.merge(existingAction, filteredUpdate as any);
		mergedAction.updatedAt = new Date();

		const savedAction = await repository.save(mergedAction);

		const result = await this.getOneOrThrow<TAction>(savedAction.id);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.SCENE_ACTION_UPDATED, result);
		}

		return result;
	}

	async remove(id: string): Promise<void> {
		const action = await this.getOneOrThrow(id);

		await this.repository.remove(action);

		this.eventEmitter.emit(EventType.SCENE_ACTION_DELETED, { id });
	}

	async getOneOrThrow<TAction extends SceneActionEntity>(id: string, type?: string): Promise<TAction> {
		const action = await this.findOne<TAction>(id, type);

		if (!action) {
			this.logger.error(`[ERROR] Action with id=${id} was not found.`);
			throw new ScenesNotFoundException(`Scene action with id=${id} was not found.`);
		}

		return action;
	}
}
