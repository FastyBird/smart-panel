import { Injectable, Logger } from '@nestjs/common';

import { ConfigException } from '../config.exceptions';
import { UpdateModuleConfigDto } from '../dto/config.dto';
import { ModuleConfigModel } from '../models/config.model';

export interface ModuleTypeMapping<TModule extends ModuleConfigModel, TConfigDTO extends UpdateModuleConfigDto> {
	type: string; // e.g., 'devices-module', 'dashboard-module'
	class: new (...args: any[]) => TModule; // Constructor for the configuration class
	configDto: new (...args: any[]) => TConfigDTO; // Constructor for the DTO
}

@Injectable()
export class ModulesTypeMapperService {
	private readonly logger = new Logger(ModulesTypeMapperService.name);

	private onMappingsReadyCallback: (() => void) | null = null;

	private readonly mappings = new Map<string, ModuleTypeMapping<ModuleConfigModel, UpdateModuleConfigDto>>();

	/**
	 * @internal
	 *
	 * Should only be used by module initialization logic to register a callback
	 * triggered after all mappings are registered.
	 */
	onMappingsRegistered(callback: () => void) {
		if (this.onMappingsReadyCallback !== null) {
			throw new ConfigException('Mappings callback already registered');
		}

		this.onMappingsReadyCallback = callback;
	}

	registerMapping<TModule extends ModuleConfigModel, TConfigDTO extends UpdateModuleConfigDto>(
		mapping: ModuleTypeMapping<TModule, TConfigDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		if (this.onMappingsReadyCallback) {
			this.onMappingsReadyCallback();
		}

		this.logger.log(`[REGISTERED] Module type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TModule extends ModuleConfigModel, TConfigDTO extends UpdateModuleConfigDto>(
		type: string,
	): ModuleTypeMapping<TModule, TConfigDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for config type: '${type}'`, { data: 'type' });

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Module mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new ConfigException(`Unsupported module type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for module type: '${type}'`);

		return mapping as ModuleTypeMapping<TModule, TConfigDTO>;
	}

	getMappings(): ModuleTypeMapping<ModuleConfigModel, UpdateModuleConfigDto>[] {
		return Array.from(this.mappings.values());
	}
}
