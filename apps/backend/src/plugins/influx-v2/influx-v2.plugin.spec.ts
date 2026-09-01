import { plainToInstance } from 'class-transformer';

import { ConfigSecretField } from '../../modules/config/interfaces/config-secret.interface';
import { ConfigSecretsService } from '../../modules/config/services/config-secrets.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { INFLUX_V2_PLUGIN_NAME } from './influx-v2.constants';
import { InfluxV2Plugin } from './influx-v2.plugin';
import { InfluxV2ConfigModel } from './models/config.model';
import { InfluxV2ManagedService } from './services/influx-v2-managed.service';

describe('InfluxV2Plugin', () => {
	const registeredMapping = (): { secretFields?: readonly ConfigSecretField[] } => {
		let captured: { secretFields?: readonly ConfigSecretField[] } | undefined;

		const pluginsMapperService = {
			registerMapping: jest.fn((mapping: { secretFields?: readonly ConfigSecretField[] }): void => {
				captured = mapping;
			}),
		};
		const managedService = { owner: { kind: 'plugin', type: INFLUX_V2_PLUGIN_NAME }, serviceId: 'storage' };

		new InfluxV2Plugin(
			pluginsMapperService as unknown as PluginsTypeMapperService,
			{ register: jest.fn() } as unknown as SwaggerModelsRegistryService,
			{ registerPluginMetadata: jest.fn() } as unknown as ExtensionsService,
			managedService as unknown as InfluxV2ManagedService,
			{ register: jest.fn() } as unknown as ManagedServiceManagerService,
		).onModuleInit();

		if (!captured) {
			throw new Error('InfluxV2Plugin registered no config mapping');
		}

		return captured;
	};

	// The v2 token is an authentication credential, and every other storage and
	// buddy plugin declares its credential. This one was missed because the
	// original survey grepped for `api_key` / `password` / `*_token` and the bare
	// name `token` matched none of them, so `GET /config/plugins` returned it.
	//
	// Asserted through ConfigSecretsService rather than against the literal
	// registration, because a declared-but-wrong `path` fails silently: the
	// service calls instanceToPlain() before every lookup, so a path that does
	// not match the serialized wire name redacts nothing and looks identical to
	// declaring no secret at all.
	it('keeps the API token out of the public config', () => {
		const config = plainToInstance(InfluxV2ConfigModel, {
			type: INFLUX_V2_PLUGIN_NAME,
			url: 'http://localhost:8086',
			token: 'super-secret-token',
			org: 'fastybird',
			bucket: 'smart-panel',
		});

		const publicConfig = new ConfigSecretsService().toPublic(
			config,
			registeredMapping().secretFields,
		) as unknown as Record<string, unknown>;

		expect(publicConfig).not.toHaveProperty('token');
		expect(publicConfig.token_configured).toBe(true);
		expect(JSON.stringify(publicConfig)).not.toContain('super-secret-token');
	});

	it('reports an absent token as not configured', () => {
		const config = plainToInstance(InfluxV2ConfigModel, {
			type: INFLUX_V2_PLUGIN_NAME,
			url: 'http://localhost:8086',
			org: 'fastybird',
			bucket: 'smart-panel',
		});

		const publicConfig = new ConfigSecretsService().toPublic(
			config,
			registeredMapping().secretFields,
		) as unknown as Record<string, unknown>;

		expect(publicConfig.token_configured).toBe(false);
	});
});
