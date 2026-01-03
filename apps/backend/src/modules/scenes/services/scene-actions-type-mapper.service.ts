import { Injectable, Logger } from '@nestjs/common';

import { CreateSceneActionDto } from '../dto/create-scene-action.dto';
import { UpdateSceneActionDto } from '../dto/update-scene-action.dto';
import { SceneActionEntity } from '../entities/scenes.entity';
import { ScenesException } from '../scenes.exceptions';

/**
 * Interface for scene action type mapping configuration
 */
export interface SceneActionTypeMapping<
	TAction extends SceneActionEntity = SceneActionEntity,
	TCreateDTO extends CreateSceneActionDto = CreateSceneActionDto,
	TUpdateDTO extends UpdateSceneActionDto = UpdateSceneActionDto,
> {
	type: string;
	class: new (...args: any[]) => TAction;
	createDto: new (...args: any[]) => TCreateDTO;
	updateDto: new (...args: any[]) => TUpdateDTO;
}

/**
 * Service for registering and retrieving scene action type mappings.
 * Plugins use this service to register their custom action types.
 */
@Injectable()
export class SceneActionsTypeMapperService {
	private readonly logger = new Logger(SceneActionsTypeMapperService.name);
	private readonly mappings = new Map<string, SceneActionTypeMapping<any, any, any>>();

	constructor() {
		// Register the base action type
		this.registerMapping({
			type: 'sceneactionentity',
			class: SceneActionEntity,
			createDto: CreateSceneActionDto,
			updateDto: UpdateSceneActionDto,
		});
	}

	/**
	 * Register a new action type mapping
	 */
	registerMapping<
		TAction extends SceneActionEntity,
		TCreateDTO extends CreateSceneActionDto,
		TUpdateDTO extends UpdateSceneActionDto,
	>(mapping: SceneActionTypeMapping<TAction, TCreateDTO, TUpdateDTO>): void {
		const normalizedType = mapping.type.toLowerCase();

		if (this.mappings.has(normalizedType)) {
			this.logger.warn(`[REGISTER] Overwriting existing mapping for action type: ${normalizedType}`);
		}

		this.mappings.set(normalizedType, mapping);

		this.logger.log(`[REGISTER] Registered scene action type mapping: ${normalizedType}`);
	}

	/**
	 * Get mapping for a specific action type
	 */
	getMapping<
		TAction extends SceneActionEntity,
		TCreateDTO extends CreateSceneActionDto,
		TUpdateDTO extends UpdateSceneActionDto,
	>(type: string): SceneActionTypeMapping<TAction, TCreateDTO, TUpdateDTO> {
		const normalizedType = type.toLowerCase();

		const mapping = this.mappings.get(normalizedType);

		if (!mapping) {
			this.logger.error(`[LOOKUP] No mapping found for action type: ${normalizedType}`);
			throw new ScenesException(`Unknown scene action type: ${type}`);
		}

		return mapping as SceneActionTypeMapping<TAction, TCreateDTO, TUpdateDTO>;
	}

	/**
	 * Check if a mapping exists for a type
	 */
	hasMapping(type: string): boolean {
		return this.mappings.has(type.toLowerCase());
	}

	/**
	 * Get all registered action types
	 */
	getAllTypes(): string[] {
		return Array.from(this.mappings.keys());
	}
}
