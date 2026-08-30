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
	private readonly mutationTails = new Map<string, Promise<void>>();

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
		const previous = this.mutationTails.get(plugin) ?? Promise.resolve();
		let release = (): void => undefined;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.mutationTails.set(plugin, current);
		await previous;

		try {
			const handler = this.handlers.get(plugin);

			if (!handler) {
				await commit();
				return;
			}

			await handler(update, commit);
		} finally {
			release();

			if (this.mutationTails.get(plugin) === current) this.mutationTails.delete(plugin);
		}
	}
}
