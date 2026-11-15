import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME } from '../devices-unifi-protect.constants';
import { findProtectConfigError } from '../validators/protect-config.validators';

// Messages are fixed texts: the manager logs them and stores them as lastError, so they never carry a value.
@Injectable()
export class ProtectConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = DEVICES_UNIFI_PROTECT_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		if (config['enabled'] !== true) {
			return Promise.resolve({ valid: true });
		}

		const error = findProtectConfigError(config);

		return Promise.resolve(error ? { valid: false, errors: [error] } : { valid: true });
	}
}
