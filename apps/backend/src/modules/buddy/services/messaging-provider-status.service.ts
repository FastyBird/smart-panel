import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { ExtensionsService } from '../../extensions/services/extensions.service';
import { ExtensionKind } from '../../extensions/extensions.constants';
import { BuddyCapability, BUDDY_MODULE_NAME } from '../buddy.constants';
import { MessagingProviderStatusDataModel } from '../models/messaging-provider-status.model';

@Injectable()
export class MessagingProviderStatusService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'MessagingProviderStatusService');

	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly configService: ConfigService,
	) {}

	getProviderStatuses(): MessagingProviderStatusDataModel[] {
		const allExtensions = this.extensionsService.findAllPlugins();

		const messagingPlugins = allExtensions.filter(
			(ext) => ext.kind === ExtensionKind.PLUGIN && ext.capabilities?.includes(BuddyCapability.MESSAGING),
		);

		const statuses: MessagingProviderStatusDataModel[] = [];

		for (const plugin of messagingPlugins) {
			const status = new MessagingProviderStatusDataModel();

			status.type = plugin.type;
			status.name = plugin.name;
			status.description = plugin.description ?? '';
			status.enabled = plugin.enabled;

			let pluginConfig: Record<string, unknown> | null = null;

			try {
				pluginConfig = this.configService.getPluginConfig(plugin.type) as unknown as Record<string, unknown>;
			} catch {
				this.logger.debug(`Plugin config for '${plugin.type}' not found`);
			}

			if (pluginConfig) {
				status.enabled = (pluginConfig.enabled as boolean) ?? false;
				status.configured = this.isPluginConfigured(plugin.type, pluginConfig);
			} else {
				status.enabled = false;
				status.configured = false;
			}

			statuses.push(status);
		}

		return statuses;
	}

	private isPluginConfigured(type: string, config: Record<string, unknown>): boolean {
		// A messaging plugin is considered configured if it has its main credential set.
		// We check common patterns: botToken, token, apiKey.
		const credentialKeys = ['botToken', 'bot_token', 'token', 'apiKey', 'api_key'];

		let hasCredentialField = false;

		for (const key of credentialKeys) {
			if (key in config) {
				hasCredentialField = true;

				if (typeof config[key] === 'string' && (config[key] as string).trim().length > 0) {
					return true;
				}
			}
		}

		// If the plugin has no credential fields at all (e.g. WhatsApp with QR pairing),
		// consider it configured when enabled — there are no credentials to fill in.
		if (!hasCredentialField) {
			return (config.enabled as boolean) ?? false;
		}

		return false;
	}
}
