import { ConfigService } from '../../../modules/config/services/config.service';
import {
	PluginConfigCommit,
	PluginConfigMutationRegistryService,
} from '../../../modules/config/services/plugin-config-mutation-registry.service';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';
import { HomeyConfigMutationService } from './homey-config-mutation.service';

describe('HomeyConfigMutationService', () => {
	let handler: ((update: HomeyUpdatePluginConfigDto, commit: PluginConfigCommit) => Promise<void>) | undefined;
	let config: jest.Mocked<Pick<ConfigService, 'getPluginConfig'>>;
	let cloudGrantMutations: {
		invalidateConfiguration: jest.MockedFunction<(commit: () => Promise<void> | void) => Promise<void>>;
	};

	beforeEach(() => {
		const configMutations = {
			register: jest.fn((_plugin: string, registeredHandler: typeof handler) => {
				handler = registeredHandler;
			}),
		};
		config = {
			getPluginConfig: jest.fn().mockReturnValue(
				Object.assign(new HomeyConfigModel(), {
					cloudClientId: 'client-a',
					cloudClientSecret: 'secret-a',
					cloudRedirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
				}),
			),
		};
		cloudGrantMutations = {
			invalidateConfiguration: jest.fn(async (commit): Promise<void> => {
				await commit();
			}),
		};

		const service = new HomeyConfigMutationService(
			configMutations as unknown as PluginConfigMutationRegistryService,
			config as unknown as ConfigService,
			cloudGrantMutations as unknown as HomeyCloudGrantMutationService,
		);

		service.onModuleInit();
		expect(configMutations.register).toHaveBeenCalledWith(DEVICES_HOMEY_PLUGIN_NAME, expect.any(Function));
	});

	it('invalidates grants before persisting a changed cloud client configuration while disabled', async () => {
		const commit = jest.fn();

		await handler?.(
			Object.assign(new HomeyUpdatePluginConfigDto(), {
				type: DEVICES_HOMEY_PLUGIN_NAME,
				enabled: false,
				cloudClientId: 'client-b',
				cloudClientSecret: 'secret-a',
			}),
			commit,
		);

		expect(cloudGrantMutations.invalidateConfiguration).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('persists unrelated changes without invalidating a cloud grant', async () => {
		const commit = jest.fn();

		await handler?.(
			Object.assign(new HomeyUpdatePluginConfigDto(), {
				type: DEVICES_HOMEY_PLUGIN_NAME,
				enabled: false,
				connectionTimeout: 10_000,
			}),
			commit,
		);

		expect(cloudGrantMutations.invalidateConfiguration).not.toHaveBeenCalled();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('invalidates grants when cloud credentials are explicitly cleared', async () => {
		const commit = jest.fn();

		await handler?.(
			Object.assign(new HomeyUpdatePluginConfigDto(), {
				type: DEVICES_HOMEY_PLUGIN_NAME,
				enabled: false,
				cloudClientId: null,
				cloudClientSecret: 'secret-a',
			}),
			commit,
		);

		expect(cloudGrantMutations.invalidateConfiguration).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledTimes(1);
	});
});
