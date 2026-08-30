import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_HOMEY_PLUGIN_NAME, HOMEY_CLOUD_SCOPES } from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';
import { HomeyConfigModel } from '../models/config.model';
import { isSafeHomeyCloudRedirectUrl } from '../validators/homey-cloud-redirect-url.validator';

export interface HomeyCloudClientConfiguration {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly redirectUrl: string;
}

export interface HomeyCloudClientConfigurationInput {
	readonly clientId: unknown;
	readonly clientSecret: unknown;
	readonly redirectUrl: unknown;
}

@Injectable()
export class HomeyCloudClientConfigService {
	constructor(private readonly config: ConfigService) {}

	isConfigured(): boolean {
		try {
			this.getConfiguration();

			return true;
		} catch (error) {
			if (error instanceof HomeyCloudConfigurationError) return false;

			throw error;
		}
	}

	getConfiguration(): HomeyCloudClientConfiguration {
		const config = this.config.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		const clientId = this.readRequired(config.cloudClientId);
		const clientSecret = this.readRequired(config.cloudClientSecret);
		const redirectUrl = this.readRequired(config.cloudRedirectUrl);

		this.assertRedirectUrl(redirectUrl);

		return { clientId, clientSecret, redirectUrl };
	}

	getConfigurationFingerprint(): string | null {
		try {
			return this.createFingerprint(this.getConfiguration());
		} catch (error) {
			if (error instanceof HomeyCloudConfigurationError) return null;

			throw error;
		}
	}

	getConfigurationFingerprintFor(configuration: HomeyCloudClientConfigurationInput): string | null {
		try {
			const normalized = {
				clientId: this.readRequired(configuration.clientId),
				clientSecret: this.readRequired(configuration.clientSecret),
				redirectUrl: this.readRequired(configuration.redirectUrl),
			};
			this.assertRedirectUrl(normalized.redirectUrl);

			return this.createFingerprint(normalized);
		} catch (error) {
			if (error instanceof HomeyCloudConfigurationError) return null;

			throw error;
		}
	}

	private createFingerprint(configuration: HomeyCloudClientConfiguration): string {
		const identity = JSON.stringify({ ...configuration, scopes: HOMEY_CLOUD_SCOPES });

		return createHash('sha256').update(identity).digest('hex');
	}

	private readRequired(value: unknown): string {
		if (typeof value !== 'string' || value.trim().length === 0) {
			throw new HomeyCloudConfigurationError('Homey Cloud client configuration is incomplete');
		}

		return value.trim();
	}

	private assertRedirectUrl(value: string): void {
		if (!isSafeHomeyCloudRedirectUrl(value)) {
			throw new HomeyCloudConfigurationError(
				'cloud_redirect_url must be the exact credential-free Homey Cloud callback URL',
			);
		}
	}
}
