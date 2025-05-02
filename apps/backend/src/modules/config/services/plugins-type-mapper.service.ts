import { Injectable, Logger } from '@nestjs/common';

import { ConfigException } from '../config.exceptions';
import { UpdatePluginConfigDto } from '../dto/config.dto';
import { PluginConfigEntity } from '../entities/config.entity';

export interface PluginTypeMapping<TPlugin extends PluginConfigEntity, TConfigDTO extends UpdatePluginConfigDto> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TPlugin; // Constructor for the configuration class
	configDto: new (...args: any[]) => TConfigDTO; // Constructor for the DTO
}

@Injectable()
export class PluginsTypeMapperService {
	private readonly logger = new Logger(PluginsTypeMapperService.name);

	private onMappingsReadyCallback: (() => void) | null = null;

	private readonly mappings = new Map<string, PluginTypeMapping<PluginConfigEntity, UpdatePluginConfigDto>>();

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

	registerMapping<TPlugin extends PluginConfigEntity, TConfigDTO extends UpdatePluginConfigDto>(
		mapping: PluginTypeMapping<TPlugin, TConfigDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		if (this.onMappingsReadyCallback) {
			this.onMappingsReadyCallback();
		}

		this.logger.log(`[REGISTERED] Plugin type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TPlugin extends PluginConfigEntity, TConfigDTO extends UpdatePluginConfigDto>(
		type: string,
	): PluginTypeMapping<TPlugin, TConfigDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for config type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Plugin mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new ConfigException(`Unsupported plugin type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for plugin type: '${type}'`);

		return mapping as PluginTypeMapping<TPlugin, TConfigDTO>;
	}

	getMappings(): PluginTypeMapping<PluginConfigEntity, UpdatePluginConfigDto>[] {
		return Array.from(this.mappings.values());
	}
}
