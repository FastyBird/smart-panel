import { Injectable } from '@nestjs/common';

import { ConfigException } from '../config.exceptions';
import { UpdateModuleConfigDto } from '../dto/config.dto';

export type ModuleConfigCommit = () => Promise<void> | void;

export type ModuleConfigMutationHandler<TUpdateDto extends UpdateModuleConfigDto = UpdateModuleConfigDto> = (
	update: TUpdateDto,
	commit: ModuleConfigCommit,
) => Promise<void>;

@Injectable()
export class ModuleConfigMutationRegistryService {
	private readonly handlers = new Map<string, ModuleConfigMutationHandler>();

	register<TUpdateDto extends UpdateModuleConfigDto>(
		module: string,
		handler: ModuleConfigMutationHandler<TUpdateDto>,
	): void {
		if (this.handlers.has(module)) {
			throw new ConfigException(`Module configuration mutation handler is already registered: ${module}`);
		}

		this.handlers.set(module, handler as ModuleConfigMutationHandler);
	}

	async execute<TUpdateDto extends UpdateModuleConfigDto>(
		module: string,
		update: TUpdateDto,
		commit: ModuleConfigCommit,
	): Promise<void> {
		const handler = this.handlers.get(module);

		if (!handler) {
			await commit();
			return;
		}

		await handler(update, commit);
	}
}
