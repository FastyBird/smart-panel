import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateSceneDto } from '../dto/create-scene.dto';
import { UpdateSceneDto } from '../dto/update-scene.dto';
import { SceneEntity } from '../entities/scenes.entity';
import { EventType } from '../scenes.constants';
import { ScenesException, ScenesNotEditableException, ScenesNotFoundException, ScenesValidationException } from '../scenes.exceptions';

import { SceneActionsService } from './scene-actions.service';
import { ScenesTypeMapperService } from './scenes-type-mapper.service';

@Injectable()
export class ScenesService {
	private readonly logger = new Logger(ScenesService.name);

	constructor(
		@InjectRepository(SceneEntity)
		private readonly repository: Repository<SceneEntity>,
		private readonly scenesMapperService: ScenesTypeMapperService,
		private readonly sceneActionsService: SceneActionsService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TScene extends SceneEntity>(type?: string): Promise<number> {
		const mapping = type ? this.scenesMapperService.getMapping<TScene, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all scenes count');

		const count = await repository.count();

		this.logger.debug(`[LOOKUP ALL] Found that in system is ${count} scenes`);

		return count;
	}

	async findAll<TScene extends SceneEntity>(type?: string): Promise<TScene[]> {
		const mapping = type ? this.scenesMapperService.getMapping<TScene, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all scenes');

		const scenes = (await repository.find({
			relations: [
				'actions',
				'actions.scene',
				'conditions',
				'conditions.scene',
				'triggers',
				'triggers.scene',
			],
			order: {
				name: 'ASC',
			} as any,
		})) as TScene[];

		this.logger.debug(`[LOOKUP ALL] Found ${scenes.length} scenes`);

		return scenes;
	}

	async findOne<TScene extends SceneEntity>(id: string, type?: string): Promise<TScene | null> {
		const mapping = type ? this.scenesMapperService.getMapping<TScene, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching scene with id=${id}`);

		const scene = (await repository
			.createQueryBuilder('scene')
			.leftJoinAndSelect('scene.actions', 'actions')
			.leftJoinAndSelect('actions.scene', 'actionScene')
			.leftJoinAndSelect('scene.conditions', 'conditions')
			.leftJoinAndSelect('conditions.scene', 'conditionScene')
			.leftJoinAndSelect('scene.triggers', 'triggers')
			.leftJoinAndSelect('triggers.scene', 'triggerScene')
			.where('scene.id = :id', { id })
			.orderBy('actions.order', 'ASC')
			.getOne()) as TScene | null;

		if (!scene) {
			this.logger.debug(`[LOOKUP] Scene with id=${id} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched scene with id=${id}`);

		return scene;
	}

	async findOneBy<TScene extends SceneEntity>(
		column: 'id' | 'category' | 'name',
		value: string | number | boolean,
		type?: string,
	): Promise<TScene | null> {
		const mapping = type ? this.scenesMapperService.getMapping<TScene, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching scene with ${column}=${value}`);

		const scene = (await repository
			.createQueryBuilder('scene')
			.leftJoinAndSelect('scene.actions', 'actions')
			.leftJoinAndSelect('actions.scene', 'actionScene')
			.leftJoinAndSelect('scene.conditions', 'conditions')
			.leftJoinAndSelect('conditions.scene', 'conditionScene')
			.leftJoinAndSelect('scene.triggers', 'triggers')
			.leftJoinAndSelect('triggers.scene', 'triggerScene')
			.where(`scene.${column} = :filterBy`, { filterBy: value })
			.orderBy('actions.order', 'ASC')
			.getOne()) as TScene | null;

		if (!scene) {
			this.logger.debug(`[LOOKUP] Scene with ${column}=${value} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched scene with ${column}=${value}`);

		return scene;
	}

	async create<TScene extends SceneEntity, TCreateDTO extends CreateSceneDto>(
		createDto: TCreateDTO,
	): Promise<TScene> {
		this.logger.debug('[CREATE] Creating new scene');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" attribute in data.');
			throw new ScenesException('Scene type attribute is required.');
		}

		const mapping = this.scenesMapperService.getMapping<TScene, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		// Generate IDs for actions if not provided
		(dtoInstance.actions || []).forEach((action, index) => {
			action.id = action.id ?? uuid().toString();
			action.order = action.order ?? index;
		});

		const actions = dtoInstance.actions || [];
		delete dtoInstance.actions;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for scene creation error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided scene data are invalid.');
		}

		const repository: Repository<TScene> = this.dataSource.getRepository(mapping.class);

		const scene = repository.create(toInstance(mapping.class, dtoInstance));

		// Save the scene
		const raw = await repository.save(scene);

		// Create actions
		for (const actionDto of actions) {
			this.logger.debug(`[CREATE] Creating new action for sceneId=${raw.id}`);

			await this.sceneActionsService.create({
				...actionDto,
				scene: raw.id,
			});
		}

		// Retrieve the saved scene with its full relations
		let savedScene = (await this.getOneOrThrow(scene.id)) as TScene;

		// Call afterCreate hook if defined
		if (mapping.afterCreate) {
			await mapping.afterCreate(savedScene);
			savedScene = (await this.getOneOrThrow(scene.id)) as TScene;
		}

		this.logger.debug(`[CREATE] Successfully created new scene with id=${savedScene.id}`);

		this.eventEmitter.emit(EventType.SCENE_CREATED, savedScene);

		return savedScene;
	}

	async update<TScene extends SceneEntity, TUpdateDTO extends UpdateSceneDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TScene> {
		this.logger.debug(`[UPDATE] Updating scene with id=${id}`);

		const existingScene = await this.getOneOrThrow<TScene>(id);

		if (!existingScene.isEditable) {
			this.logger.error(`[UPDATE] Scene with id=${id} is not editable`);
			throw new ScenesNotEditableException(`Scene with id=${id} cannot be edited.`);
		}

		const { type } = updateDto;

		if (!type) {
			this.logger.error('[UPDATE] Validation failed: Missing required "type" attribute in data.');
			throw new ScenesException('Scene type attribute is required.');
		}

		const mapping = this.scenesMapperService.getMapping<TScene, any, TUpdateDTO>(type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			skipMissingProperties: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for scene update error=${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided scene data are invalid.');
		}

		const repository: Repository<TScene> = this.dataSource.getRepository(mapping.class);

		const filteredUpdate = omitBy(dtoInstance, isUndefined);

		// Apply updates to existing scene
		const mergedScene = repository.merge(existingScene, filteredUpdate as any);
		mergedScene.updatedAt = new Date();

		const savedScene = await repository.save(mergedScene);

		// Retrieve the updated scene with its full relations
		let updatedScene = (await this.getOneOrThrow(savedScene.id)) as TScene;

		// Call afterUpdate hook if defined
		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedScene);
			updatedScene = (await this.getOneOrThrow(savedScene.id)) as TScene;
		}

		this.logger.debug(`[UPDATE] Successfully updated scene with id=${updatedScene.id}`);

		this.eventEmitter.emit(EventType.SCENE_UPDATED, updatedScene);

		return updatedScene;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing scene with id=${id}`);

		const scene = await this.getOneOrThrow(id);

		if (!scene.isEditable) {
			this.logger.error(`[DELETE] Scene with id=${id} is not editable/deletable`);
			throw new ScenesNotEditableException(`Scene with id=${id} cannot be deleted.`);
		}

		const mapping = this.scenesMapperService.getMapping(scene.type);

		// Call beforeDelete hook if defined
		if (mapping?.beforeDelete) {
			await mapping.beforeDelete(scene);
		}

		await this.repository.remove(scene);

		this.logger.debug(`[DELETE] Successfully removed scene with id=${id}`);

		this.eventEmitter.emit(EventType.SCENE_DELETED, { id });
	}

	async updateLastTriggered(id: string): Promise<void> {
		this.logger.debug(`[UPDATE] Updating last triggered timestamp for scene with id=${id}`);

		await this.repository.update(id, {
			lastTriggeredAt: new Date(),
		});
	}

	async getOneOrThrow<TScene extends SceneEntity>(id: string, type?: string): Promise<TScene> {
		const scene = await this.findOne<TScene>(id, type);

		if (!scene) {
			this.logger.error(`[ERROR] Scene with id=${id} was not found.`);
			throw new ScenesNotFoundException(`Scene with id=${id} was not found.`);
		}

		return scene;
	}

	private async validateDto<T extends object>(dtoClass: new () => T, data: Partial<T>): Promise<T> {
		const dtoInstance = toInstance(dtoClass, data);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] DTO validation failed: ${JSON.stringify(errors)}`);
			throw new ScenesValidationException('Provided data are invalid.');
		}

		return dtoInstance;
	}
}
