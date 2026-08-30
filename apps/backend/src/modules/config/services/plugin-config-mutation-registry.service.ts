import { Injectable } from '@nestjs/common';

import { ConfigException } from '../config.exceptions';
import { UpdatePluginConfigDto } from '../dto/config.dto';

export type PluginConfigCommit = () => Promise<void> | void;

export type PluginConfigMutationHandler<TUpdateDto extends UpdatePluginConfigDto = UpdatePluginConfigDto> = (
	update: TUpdateDto,
	commit: PluginConfigCommit,
) => Promise<void>;

@Injectable()
export class PluginConfigMutationRegistryService {
	private readonly handlers = new Map<string, PluginConfigMutationHandler>();

	register<TUpdateDto extends UpdatePluginConfigDto>(
		plugin: string,
		handler: PluginConfigMutationHandler<TUpdateDto>,
	): void {
		if (this.handlers.has(plugin)) {
			throw new ConfigException(`Plugin configuration mutation handler is already registered: ${plugin}`);
		}

		this.handlers.set(plugin, handler as PluginConfigMutationHandler);
	}

	async execute<TUpdateDto extends UpdatePluginConfigDto>(
		plugin: string,
		update: TUpdateDto,
		commit: PluginConfigCommit,
	): Promise<void> {
		const handler = this.handlers.get(plugin);

		if (!handler) {
			await commit();
			return;
		}

		await handler(update, commit);
	}
}
