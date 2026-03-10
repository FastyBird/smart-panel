import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { CONFIG_MODULE_NAME } from '../config.constants';

export interface IConfigValidationError {
	message: string;
	field?: string;
}

export interface IConfigValidationResult {
	valid: boolean;
	errors?: IConfigValidationError[];
}

export interface IPluginConfigValidator {
	readonly pluginType: string;
	validate(config: Record<string, unknown>): Promise<IConfigValidationResult>;
}

@Injectable()
export class PluginConfigValidatorService {
	private readonly logger = createExtensionLogger(CONFIG_MODULE_NAME, 'PluginConfigValidatorService');

	private readonly validators = new Map<string, IPluginConfigValidator>();

	register(validator: IPluginConfigValidator): void {
		this.validators.set(validator.pluginType, validator);

		this.logger.log(`[REGISTERED] Config validator for plugin '${validator.pluginType}'`);
	}

	hasValidator(pluginType: string): boolean {
		return this.validators.has(pluginType);
	}

	async validate(pluginType: string, config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const validator = this.validators.get(pluginType);

		if (!validator) {
			return { valid: true };
		}

		try {
			return await validator.validate(config);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Config validator for '${pluginType}' threw: ${err.message}`);

			return {
				valid: false,
				errors: [{ message: err.message }],
			};
		}
	}
}
