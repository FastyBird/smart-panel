import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { CONFIG_MODULE_NAME } from '../config.constants';
import { ConfigException } from '../config.exceptions';
import { UpdatePluginConfigDto } from '../dto/config.dto';
import { PluginConfigModel } from '../models/config.model';

export interface PluginTypeMapping<TPlugin extends PluginConfigModel, TConfigDTO extends UpdatePluginConfigDto> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TPlugin; // Constructor for the configuration class
	configDto: new (...args: any[]) => TConfigDTO; // Constructor for the DTO
}

@Injectable()
export class PluginsTypeMapperService {
	private readonly logger = createExtensionLogger(CONFIG_MODULE_NAME, 'PluginsTypeMapperService');

	private onMappingsReadyCallback: (() => void) | null = null;

	private readonly mappings = new Map<string, PluginTypeMapping<PluginConfigModel, UpdatePluginConfigDto>>();

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

	registerMapping<TPlugin extends PluginConfigModel, TConfigDTO extends UpdatePluginConfigDto>(
		mapping: PluginTypeMapping<TPlugin, TConfigDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		if (this.onMappingsReadyCallback) {
			this.onMappingsReadyCallback();
		}

		this.logger.log(`[REGISTERED] Plugin type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TPlugin extends PluginConfigModel, TConfigDTO extends UpdatePluginConfigDto>(
		type: string,
	): PluginTypeMapping<TPlugin, TConfigDTO> {
		this.logger.debug(`Attempting to find mapping for config type: '${type}'`, { data: 'type' });

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

	getMappings(): PluginTypeMapping<PluginConfigModel, UpdatePluginConfigDto>[] {
		return Array.from(this.mappings.values());
	}
}
