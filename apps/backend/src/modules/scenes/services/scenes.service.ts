import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { buildSqliteFtsNameRankExpression } from '../../../common/utils/sqlite-fts.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { SpacesService } from '../../spaces/services/spaces.service';
import { CreateSceneActionDto } from '../dto/create-scene-action.dto';
import { CreateSceneDto } from '../dto/create-scene.dto';
import { UpdateSceneDto } from '../dto/update-scene.dto';
import { SceneEntity } from '../entities/scenes.entity';
import { EventType, SCENES_MODULE_NAME, SceneCategory } from '../scenes.constants';
import {
	ScenesNotEditableException,
	ScenesNotFoundException,
	ScenesSpaceValidationException,
	ScenesValidationException,
} from '../scenes.exceptions';

import { SceneActionsService } from './scene-actions.service';

export interface SceneSummaryPage {
	scenes: SceneEntity[];
	total: number;
}

export interface SceneSearchSummary {
	id: string;
	name: string;
	category: SceneCategory;
	enabled: boolean;
	triggerable: boolean;
	primarySpaceId: string | null;
	rankTier: number;
	lexicalScore: number;
}

export interface SceneSearchSummaryInput {
	match: string;
	offset?: number;
	limit: number;
	rawQuery?: string;
	normalizedQuery?: string;
	normalizedTokens?: string[];
	primarySpaceIds?: string[];
	primarySpaceId?: string;
	primarySpaceParentId?: string;
	categories?: SceneCategory[];
}

export interface SceneSearchSummaryPage {
	scenes: SceneSearchSummary[];
	total: number;
}

@Injectable()
export class ScenesService {
	private readonly logger = createExtensionLogger(SCENES_MODULE_NAME, 'ScenesService');

	constructor(
		@InjectRepository(SceneEntity)
		private readonly repository: Repository<SceneEntity>,
		private readonly sceneActionsService: SceneActionsService,
		private readonly spacesService: SpacesService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Validate that space exists
	 */
	private async validateSpace(primarySpaceId: string): Promise<void> {
		const space = await this.spacesService.findOne(primarySpaceId);

		if (!space) {
			throw new ScenesSpaceValidationException(`Space with id=${primarySpaceId} not found.`);
		}
	}

	/**
	 * Find all scenes for a specific space
	 */
	async findBySpace(primarySpaceId: string): Promise<SceneEntity[]> {
		this.logger.debug(`[LOOKUP] Fetching scenes for primarySpaceId=${primarySpaceId}`);

		const scenes = await this.repository
			.createQueryBuilder('scene')
			.leftJoinAndSelect('scene.actions', 'actions')
			.leftJoinAndSelect('actions.scene', 'actionScene')
			.where('scene.primarySpaceId = :primarySpaceId', { primarySpaceId })
			.orderBy('scene.order', 'ASC')
			.addOrderBy('scene.name', 'ASC')
			.getMany();

		this.logger.debug(`[LOOKUP] Found ${scenes.length} scenes for primarySpaceId=${primarySpaceId}`);

		return scenes;
	}

	async getCount(): Promise<number> {
		this.logger.debug('[LOOKUP ALL] Fetching all scenes count');

		const count = await this.repository.count();

		this.logger.debug(`[LOOKUP ALL] Found that in system is ${count} scenes`);

		return count;
	}

	async findAll(): Promise<SceneEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all scenes');

		const scenes = await this.repository.find({
			relations: ['actions', 'actions.scene'],
			order: {
				name: 'ASC',
			},
		});

		this.logger.debug(`[LOOKUP ALL] Found ${scenes.length} scenes`);

		return scenes;
	}

	async findSummaryPage(limit: number, primarySpaceId?: string | string[]): Promise<SceneSummaryPage> {
		if (Array.isArray(primarySpaceId) && primarySpaceId.length === 0) {
			return { scenes: [], total: 0 };
		}

		const query = this.repository
			.createQueryBuilder('scene')
			.select([
				'scene.id',
				'scene.name',
				'scene.category',
				'scene.enabled',
				'scene.triggerable',
				'scene.primarySpaceId',
			])
			.orderBy('scene.name', 'ASC')
			.take(limit);

		if (Array.isArray(primarySpaceId)) {
			query.where('scene.primarySpaceId IN (:...primarySpaceIds)', { primarySpaceIds: primarySpaceId });
		} else if (primarySpaceId) {
			query.where('scene.primarySpaceId = :primarySpaceId', { primarySpaceId });
		}

		const [scenes, total] = await query.getManyAndCount();

		return { scenes, total };
	}

	async searchSummaryPage(input: SceneSearchSummaryInput): Promise<SceneSearchSummaryPage> {
		if (input.limit <= 0 || input.primarySpaceIds?.length === 0 || input.categories?.length === 0) {
			return { scenes: [], total: 0 };
		}

		const predicates = ['home_context_entity_search_fts.entity_kind = ?', 'home_context_entity_search_fts MATCH ?'];
		const parameters: Array<string | number> = ['scene', input.match];

		const spacePredicates: string[] = [];

		if (input.primarySpaceIds) {
			spacePredicates.push(`scene."primarySpaceId" IN (${input.primarySpaceIds.map(() => '?').join(', ')})`);
			parameters.push(...input.primarySpaceIds);
		}

		if (input.primarySpaceId) {
			spacePredicates.push('scene."primarySpaceId" = ?');
			parameters.push(input.primarySpaceId);
		}

		if (input.primarySpaceParentId) {
			spacePredicates.push(
				'scene."primarySpaceId" IN (SELECT scoped_space.id FROM spaces_module_spaces scoped_space ' +
					'WHERE scoped_space."parentId" = ?)',
			);
			parameters.push(input.primarySpaceParentId);
		}

		if (spacePredicates.length > 0) {
			predicates.push(`(${spacePredicates.join(' OR ')})`);
		}

		if (input.categories) {
			predicates.push(`scene.category IN (${input.categories.map(() => '?').join(', ')})`);
			parameters.push(...input.categories);
		}

		interface SceneSearchRow extends Omit<SceneSearchSummary, 'enabled' | 'triggerable' | 'rankTier' | 'lexicalScore'> {
			enabled: boolean | number;
			triggerable: boolean | number;
			rankTier: string | number;
			lexicalScore: string | number;
		}

		interface CountRow {
			total: string | number;
		}

		const where = predicates.join('\n AND ');
		const rank = buildSqliteFtsNameRankExpression({
			ftsTable: 'home_context_entity_search_fts',
			vocabularyTable: 'home_context_entity_search_vocab',
			entityIdExpression: 'scene.id',
			rawQuery: input.rawQuery,
			normalizedQuery: input.normalizedQuery,
			normalizedTokens: input.normalizedTokens,
		});
		const [rows, countRows] = await Promise.all([
			this.dataSource.query<SceneSearchRow[]>(
				`SELECT scene.id AS id,
				        scene.name AS name,
				        scene.category AS category,
				        scene.enabled AS enabled,
				        scene.triggerable AS triggerable,
				        scene."primarySpaceId" AS "primarySpaceId",
				        ${rank.sql} AS "rankTier",
				        bm25(home_context_entity_search_fts) AS "lexicalScore"
				 FROM home_context_entity_search_fts
				 INNER JOIN scenes_module_scenes scene
				   ON scene.id = home_context_entity_search_fts.entity_id
				 WHERE ${where}
				 ORDER BY "rankTier" ASC, "lexicalScore" ASC, LOWER(scene.name) ASC, scene.id ASC
				 LIMIT ? OFFSET ?`,
				[...rank.parameters, ...parameters, input.limit, input.offset ?? 0],
			),
			this.dataSource.query<CountRow[]>(
				`SELECT COUNT(*) AS total
				 FROM home_context_entity_search_fts
				 INNER JOIN scenes_module_scenes scene
				   ON scene.id = home_context_entity_search_fts.entity_id
				 WHERE ${where}`,
				parameters,
			),
		]);

		return {
			scenes: rows.map((row) => ({
				...row,
				enabled: Boolean(row.enabled),
				triggerable: Boolean(row.triggerable),
				rankTier: Number(row.rankTier),
				lexicalScore: Number(row.lexicalScore),
			})),
			total: Number(countRows[0]?.total ?? 0),
		};
	}

	async findTriggerableSummaryPage(limit: number): Promise<SceneSummaryPage> {
		const [scenes, total] = await this.repository
			.createQueryBuilder('scene')
			.select([
				'scene.id',
				'scene.name',
				'scene.category',
				'scene.enabled',
				'scene.triggerable',
				'scene.primarySpaceId',
			])
			.where('scene.enabled = :enabled', { enabled: true })
			.andWhere('scene.triggerable = :triggerable', { triggerable: true })
			.orderBy('scene.name', 'ASC')
			.addOrderBy('scene.id', 'ASC')
			.take(limit)
			.getManyAndCount();

		return { scenes, total };
	}

	async findOne(id: string): Promise<SceneEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching scene with id=${id}`);

		const scene = await this.repository
			.createQueryBuilder('scene')
			.leftJoinAndSelect('scene.actions', 'actions')
			.leftJoinAndSelect('actions.scene', 'actionScene')
			.where('scene.id = :id', { id })
			.orderBy('actions.order', 'ASC')
			.getOne();

		if (!scene) {
			this.logger.debug(`[LOOKUP] Scene with id=${id} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched scene with id=${id}`);

		return scene;
	}

	async findOneBy(column: 'id' | 'category' | 'name', value: string | number | boolean): Promise<SceneEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching scene with ${column}=${value}`);

		const scene = await this.repository
			.createQueryBuilder('scene')
			.leftJoinAndSelect('scene.actions', 'actions')
			.leftJoinAndSelect('actions.scene', 'actionScene')
			.where(`scene.${column} = :filterBy`, { filterBy: value })
			.orderBy('actions.order', 'ASC')
			.getOne();

		if (!scene) {
			this.logger.debug(`[LOOKUP] Scene with ${column}=${value} not found`);
			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched scene with ${column}=${value}`);

		return scene;
	}

	async create(createDto: CreateSceneDto): Promise<SceneEntity> {
		const { primary_space_id } = createDto;

		// Validate that space exists if provided
		if (primary_space_id) {
			await this.validateSpace(primary_space_id);
		}

		// Extract actions before validation - they will be validated by SceneActionsService
		// using plugin-specific DTOs via the type mapper
		const actions = (createDto.actions || []) as (CreateSceneActionDto & { scene?: string })[];
		const sceneDataWithoutActions = { ...createDto };
		delete sceneDataWithoutActions.actions;

		const dtoInstance = await this.validateDto(CreateSceneDto, sceneDataWithoutActions);

		// Generate IDs for actions if not provided
		actions.forEach((action, index) => {
			action.id = action.id ?? uuid().toString();
			action.order = action.order ?? index;
		});

		// Use transaction to ensure scene and actions are created atomically
		const savedScene = await this.dataSource.transaction(async (transactionalEntityManager) => {
			const repository: Repository<SceneEntity> = transactionalEntityManager.getRepository(SceneEntity);

			const scene = repository.create(toInstance(SceneEntity, dtoInstance));

			// Save the scene
			const raw = await repository.save(scene);

			// Create actions within the same transaction
			for (const actionDto of actions) {
				await this.sceneActionsService.createWithEntityManager(
					{
						...actionDto,
						scene: raw.id,
					},
					transactionalEntityManager,
				);
			}

			return raw;
		});

		// Retrieve the saved scene with its full relations
		const fullScene = await this.getOneOrThrow(savedScene.id);

		this.eventEmitter.emit(EventType.SCENE_CREATED, fullScene);

		return fullScene;
	}

	async update(id: string, updateDto: UpdateSceneDto): Promise<SceneEntity> {
		const existingScene = await this.getOneOrThrow(id);

		if (!existingScene.editable) {
			this.logger.error(`[UPDATE] Scene with id=${id} is not editable`);
			throw new ScenesNotEditableException(`Scene with id=${id} cannot be edited.`);
		}

		const { primary_space_id } = updateDto;

		// Validate space if being updated
		if (primary_space_id) {
			await this.validateSpace(primary_space_id);
		}

		const dtoInstance = await this.validateDto(UpdateSceneDto, updateDto);

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

		// Convert DTO to entity format (snake_case to camelCase) and filter undefined values
		const entityUpdate = toInstance(SceneEntity, dtoInstance);
		const filteredUpdate = omitBy(entityUpdate, isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(filteredUpdate).some((key) => {
			const newValue = (filteredUpdate as Record<string, unknown>)[key];
			const existingValue = (existingScene as unknown as Record<string, unknown>)[key];

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

		// Apply updates to existing scene
		const mergedScene = this.repository.merge(existingScene, filteredUpdate as Partial<SceneEntity>);
		mergedScene.updatedAt = new Date();

		const savedScene = await this.repository.save(mergedScene);

		// Retrieve the updated scene with its full relations
		const updatedScene = await this.getOneOrThrow(savedScene.id);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.SCENE_UPDATED, updatedScene);
		}

		return updatedScene;
	}

	async remove(id: string): Promise<void> {
		const scene = await this.getOneOrThrow(id);

		if (!scene.editable) {
			this.logger.error(`[DELETE] Scene with id=${id} is not editable/deletable`);
			throw new ScenesNotEditableException(`Scene with id=${id} cannot be deleted.`);
		}

		await this.repository.remove(scene);

		this.eventEmitter.emit(EventType.SCENE_DELETED, { id });
	}

	async updateLastTriggered(id: string): Promise<void> {
		await this.repository.update(id, {
			lastTriggeredAt: new Date(),
		});
	}

	async getOneOrThrow(id: string): Promise<SceneEntity> {
		const scene = await this.findOne(id);

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
