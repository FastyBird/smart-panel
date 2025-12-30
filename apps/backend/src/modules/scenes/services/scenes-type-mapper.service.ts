import { Injectable, Logger } from '@nestjs/common';

import { CreateSceneDto } from '../dto/create-scene.dto';
import { UpdateSceneDto } from '../dto/update-scene.dto';
import { SceneEntity } from '../entities/scenes.entity';
import { ScenesException } from '../scenes.exceptions';

/**
 * Interface for scene type mapping configuration
 */
export interface SceneTypeMapping<
	TScene extends SceneEntity = SceneEntity,
	TCreateDTO extends CreateSceneDto = CreateSceneDto,
	TUpdateDTO extends UpdateSceneDto = UpdateSceneDto,
> {
	type: string;
	class: new (...args: any[]) => TScene;
	createDto: new (...args: any[]) => TCreateDTO;
	updateDto: new (...args: any[]) => TUpdateDTO;
	afterCreate?: (scene: TScene) => Promise<void>;
	afterUpdate?: (scene: TScene) => Promise<void>;
	beforeDelete?: (scene: TScene) => Promise<void>;
}

/**
 * Service for registering and retrieving scene type mappings.
 * Plugins use this service to register their custom scene types.
 */
@Injectable()
export class ScenesTypeMapperService {
	private readonly logger = new Logger(ScenesTypeMapperService.name);
	private readonly mappings = new Map<string, SceneTypeMapping<any, any, any>>();

	constructor() {
		// Register the base scene type
		this.registerMapping({
			type: 'sceneentity',
			class: SceneEntity,
			createDto: CreateSceneDto,
			updateDto: UpdateSceneDto,
		});

		// Register 'local' as an alias for the base scene type (used by frontend)
		this.registerMapping({
			type: 'local',
			class: SceneEntity,
			createDto: CreateSceneDto,
			updateDto: UpdateSceneDto,
		});
	}

	/**
	 * Register a new scene type mapping
	 */
	registerMapping<TScene extends SceneEntity, TCreateDTO extends CreateSceneDto, TUpdateDTO extends UpdateSceneDto>(
		mapping: SceneTypeMapping<TScene, TCreateDTO, TUpdateDTO>,
	): void {
		const normalizedType = mapping.type.toLowerCase();

		if (this.mappings.has(normalizedType)) {
			this.logger.warn(`[REGISTER] Overwriting existing mapping for type: ${normalizedType}`);
		}

		this.mappings.set(normalizedType, mapping);

		this.logger.log(`[REGISTER] Registered scene type mapping: ${normalizedType}`);
	}

	/**
	 * Get mapping for a specific scene type
	 */
	getMapping<TScene extends SceneEntity, TCreateDTO extends CreateSceneDto, TUpdateDTO extends UpdateSceneDto>(
		type: string,
	): SceneTypeMapping<TScene, TCreateDTO, TUpdateDTO> {
		const normalizedType = type.toLowerCase();

		const mapping = this.mappings.get(normalizedType);

		if (!mapping) {
			this.logger.error(`[LOOKUP] No mapping found for scene type: ${normalizedType}`);
			throw new ScenesException(`Unknown scene type: ${type}`);
		}

		return mapping as SceneTypeMapping<TScene, TCreateDTO, TUpdateDTO>;
	}

	/**
	 * Check if a mapping exists for a type
	 */
	hasMapping(type: string): boolean {
		return this.mappings.has(type.toLowerCase());
	}

	/**
	 * Get all registered scene types
	 */
	getAllTypes(): string[] {
		return Array.from(this.mappings.keys());
	}

	/**
	 * Get all registered mappings
	 */
	getAllMappings(): SceneTypeMapping<any, any, any>[] {
		return Array.from(this.mappings.values());
	}
}
