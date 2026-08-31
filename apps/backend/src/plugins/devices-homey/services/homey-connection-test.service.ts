import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { HomeyConnectorFactory, HomeyConnectorFactoryConfig } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_CONNECTOR_FACTORY,
} from '../devices-homey.constants';
import {
	HomeyTestCandidateConnectionDto,
	HomeyTestConnectionDto,
	HomeyTestConnectionMode,
} from '../dto/test-connection.dto';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyTestConnectionModel } from '../models/test-connection.model';
import { isSafeHomeyUrl } from '../validators/homey-url.validator';

const FIXED_ERROR_MESSAGES: Record<HomeyConnectorErrorCategory, string> = {
	[HomeyConnectorErrorCategory.AUTHENTICATION]: 'Homey authentication failed',
	[HomeyConnectorErrorCategory.AUTHORIZATION]: 'The Homey API key does not have the required permissions',
	[HomeyConnectorErrorCategory.TIMEOUT]: 'The Homey connection test timed out',
	[HomeyConnectorErrorCategory.UNAVAILABLE]: 'The Homey endpoint is unavailable',
	[HomeyConnectorErrorCategory.PROTOCOL]: 'The Homey endpoint returned an unsupported response',
	[HomeyConnectorErrorCategory.VALIDATION]: 'The Homey connection configuration is incomplete or invalid',
	[HomeyConnectorErrorCategory.UNSUPPORTED]: 'The configured Homey connection is not supported',
};

@Injectable()
export class HomeyConnectionTestService {
	constructor(
		private readonly configService: ConfigService,
		@Inject(HOMEY_CONNECTOR_FACTORY)
		private readonly connectorFactory: HomeyConnectorFactory,
	) {}

	async testConnection(request: HomeyTestConnectionDto): Promise<HomeyTestConnectionModel> {
		let connector: HomeyConnector | null = null;
		const result = this.createResult(request.mode);

		try {
			const connectorConfig = this.resolveConnectorConfig(request);
			connector = this.connectorFactory.create(connectorConfig);

			await connector.connect();
			const systemInfo = await connector.getSystemInfo();

			result.success = true;
			result.homeyId = systemInfo.id;
			result.homeyName = systemInfo.name;
			result.homeyVersion = systemInfo.version;
		} catch (error) {
			this.applyFailure(result, error);
		} finally {
			if (connector !== null) {
				try {
					await connector.disconnect();
				} catch (error) {
					if (result.success) {
						this.applyFailure(result, error);
					}
				}
			}
		}

		return result;
	}

	private resolveConnectorConfig(request: HomeyTestConnectionDto): HomeyConnectorFactoryConfig {
		if (request.mode === HomeyTestConnectionMode.SAVED) {
			if (Object.keys(request).some((key) => key !== 'mode')) {
				throw this.validationError();
			}

			let savedConfig: HomeyConfigModel;

			try {
				savedConfig = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
			} catch {
				throw this.validationError();
			}

			const connectionTimeout = Math.min(savedConfig.connectionTimeout, DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS);

			if (savedConfig.url === null || savedConfig.apiKey === null) throw this.validationError();

			return {
				url: savedConfig.url,
				apiKey: savedConfig.apiKey,
				connectionTimeout,
			};
		}

		if (request.mode !== HomeyTestConnectionMode.CANDIDATE) {
			throw this.validationError();
		}

		if (Object.keys(request).some((key) => !['mode', 'url', 'apiKey'].includes(key))) {
			throw this.validationError();
		}

		const candidate = request as HomeyTestCandidateConnectionDto;

		if (!isSafeHomeyUrl(candidate.url) || typeof candidate.apiKey !== 'string' || candidate.apiKey.trim() === '') {
			throw this.validationError();
		}

		return {
			url: candidate.url,
			apiKey: candidate.apiKey,
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		};
	}

	private validationError(): HomeyConnectorError {
		return new HomeyConnectorError(HomeyConnectorErrorCategory.VALIDATION, HomeyConnectorOperation.CONNECT);
	}

	private createResult(mode: HomeyTestConnectionMode): HomeyTestConnectionModel {
		return Object.assign(new HomeyTestConnectionModel(), {
			mode,
			success: false,
			homeyId: null,
			homeyName: null,
			homeyVersion: null,
			errorCategory: null,
			error: null,
		});
	}

	private applyFailure(result: HomeyTestConnectionModel, error: unknown): void {
		const category = error instanceof HomeyConnectorError ? error.category : HomeyConnectorErrorCategory.PROTOCOL;

		result.success = false;
		result.homeyId = null;
		result.homeyName = null;
		result.homeyVersion = null;
		result.errorCategory = category;
		result.error = FIXED_ERROR_MESSAGES[category];
	}
}
