import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_CLOUD_CLIENT_ID_ENV,
	HOMEY_CLOUD_CLIENT_SECRET_ENV,
	HOMEY_CLOUD_REDIRECT_URL_ENV,
	MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH,
} from '../devices-homey.constants';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeyConfigModel } from '../models/config.model';
import { isSafeHomeyCloudRedirectUrl } from '../validators/homey-cloud-redirect-url.validator';

interface LegacyCloudConfiguration {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly redirectUrl: string;
}

@Injectable()
export class HomeyLegacyCloudConfigMigrationService {
	private readonly logger = new Logger(HomeyLegacyCloudConfigMigrationService.name);

	constructor(
		private readonly config: ConfigService,
		private readonly environment: NestConfigService,
	) {}

	migrate(): void {
		const current = this.config.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);

		if (current.cloudLegacyEnvironmentMigrated) return;

		const legacy = this.readLegacyConfiguration();
		const hasAdminConfiguration =
			current.cloudClientId !== null || current.cloudClientSecret !== null || current.cloudRedirectUrl !== null;

		if (legacy === undefined && !hasAdminConfiguration) return;

		if (hasAdminConfiguration || legacy === null) {
			this.persist(null);
			return;
		}

		this.persist(legacy);
		this.logger.warn(
			'Imported deprecated Homey Cloud environment settings into plugin configuration; remove FB_HOMEY_CLOUD_* from the installation environment',
		);
	}

	private readLegacyConfiguration(): LegacyCloudConfiguration | null | undefined {
		const clientId = this.readOptional(HOMEY_CLOUD_CLIENT_ID_ENV);
		const clientSecret = this.readOptional(HOMEY_CLOUD_CLIENT_SECRET_ENV);
		const redirectUrl = this.readOptional(HOMEY_CLOUD_REDIRECT_URL_ENV);
		const hasAnyValue = clientId.length > 0 || clientSecret.length > 0 || redirectUrl.length > 0;

		if (!hasAnyValue) return null;

		const complete =
			clientId.length > 0 &&
			clientId.length <= MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH &&
			clientSecret.length > 0 &&
			clientSecret.length <= MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH &&
			redirectUrl.length > 0 &&
			isSafeHomeyCloudRedirectUrl(redirectUrl);

		if (!complete) {
			this.logger.warn(
				'Deprecated Homey Cloud environment settings are incomplete or invalid; configure Homey Cloud in Admin',
			);
			return undefined;
		}

		return { clientId, clientSecret, redirectUrl };
	}

	private readOptional(key: string): string {
		const value = this.environment.get<unknown>(key);

		return typeof value === 'string' ? value.trim() : '';
	}

	private persist(legacy: LegacyCloudConfiguration | null): void {
		const submitted = {
			type: DEVICES_HOMEY_PLUGIN_NAME,
			cloud_legacy_environment_migrated: true,
			...(legacy
				? {
						cloud_client_id: legacy.clientId,
						cloud_client_secret: legacy.clientSecret,
						cloud_redirect_url: legacy.redirectUrl,
					}
				: {}),
		};
		const update = toInstance(HomeyUpdatePluginConfigDto, submitted, { excludeExtraneousValues: false });

		this.config.setPluginConfig(DEVICES_HOMEY_PLUGIN_NAME, update, submitted);
	}
}
