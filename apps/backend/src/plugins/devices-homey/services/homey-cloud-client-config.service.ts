import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import {
	HOMEY_CLOUD_CALLBACK_PATH,
	HOMEY_CLOUD_CLIENT_ID_ENV,
	HOMEY_CLOUD_CLIENT_SECRET_ENV,
	HOMEY_CLOUD_REDIRECT_URL_ENV,
} from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';

export interface HomeyCloudClientConfiguration {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly redirectUrl: string;
}

@Injectable()
export class HomeyCloudClientConfigService {
	constructor(private readonly config: NestConfigService) {}

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
		const clientId = this.readRequired(HOMEY_CLOUD_CLIENT_ID_ENV);
		const clientSecret = this.readRequired(HOMEY_CLOUD_CLIENT_SECRET_ENV);
		const redirectUrl = this.readRequired(HOMEY_CLOUD_REDIRECT_URL_ENV);

		this.assertRedirectUrl(redirectUrl);

		return { clientId, clientSecret, redirectUrl };
	}

	private readRequired(key: string): string {
		const value = this.config.get<unknown>(key);

		if (typeof value !== 'string' || value.trim().length === 0) {
			throw new HomeyCloudConfigurationError(`Homey Cloud configuration is missing ${key}`);
		}

		return value.trim();
	}

	private assertRedirectUrl(value: string): void {
		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new HomeyCloudConfigurationError(`${HOMEY_CLOUD_REDIRECT_URL_ENV} must be an absolute URL`);
		}

		const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
		const isLoopbackHttp = url.protocol === 'http:' && loopbackHosts.has(url.hostname.toLowerCase());
		const isHttps = url.protocol === 'https:';

		if (!isHttps && !isLoopbackHttp) {
			throw new HomeyCloudConfigurationError(
				`${HOMEY_CLOUD_REDIRECT_URL_ENV} must use HTTPS outside loopback development`,
			);
		}

		if (url.username || url.password || url.search || url.hash || url.pathname !== HOMEY_CLOUD_CALLBACK_PATH) {
			throw new HomeyCloudConfigurationError(
				`${HOMEY_CLOUD_REDIRECT_URL_ENV} must be the exact credential-free Homey Cloud callback URL`,
			);
		}
	}
}
