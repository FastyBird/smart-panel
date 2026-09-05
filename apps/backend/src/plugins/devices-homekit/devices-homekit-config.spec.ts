import * as fs from 'fs';
import * as yaml from 'yaml';

import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigSecretsService } from '../../modules/config/services/config-secrets.service';
import { ConfigService } from '../../modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../../modules/config/services/module-config-mutation-registry.service';
import { ModulesTypeMapperService } from '../../modules/config/services/modules-type-mapper.service';
import { PluginConfigMutationRegistryService } from '../../modules/config/services/plugin-config-mutation-registry.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { PlatformService } from '../../modules/platform/services/platform.service';

import { DEVICES_HOMEKIT_PLUGIN_NAME } from './devices-homekit.constants';
import { HomeKitUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeKitConfigModel } from './models/config.model';

jest.mock('fs');
jest.mock('yaml', () => ({
	parse: jest.fn(),
	stringify: jest.fn(),
}));

describe('DevicesHomeKit Config Redaction and Persistence', () => {
	let configService: ConfigService;
	let pluginsMapperService: PluginsTypeMapperService;
	const initialPin = '031-45-154';
	let storedConfig: Record<string, unknown>;

	beforeEach(async () => {
		storedConfig = {
			plugins: {
				[DEVICES_HOMEKIT_PLUGIN_NAME]: {
					bridge_name: 'Smart Panel Bridge',
					port: 51826,
					pincode: initialPin,
					username: 'CC:22:3D:E3:CE:30',
					setup_id: 'SP01',
					mapped_device_ids: [],
				},
			},
			modules: {},
		};

		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.readFileSync as jest.Mock).mockImplementation(() => JSON.stringify(storedConfig));
		(yaml.parse as jest.Mock).mockImplementation(() => storedConfig);
		(yaml.stringify as jest.Mock).mockImplementation((data: unknown) => {
			storedConfig = data as Record<string, unknown>;
			return JSON.stringify(data);
		});

		const module: TestingModule = await Test.createTestingModule({
			imports: [NestConfigModule],
			providers: [
				ConfigService,
				PluginsTypeMapperService,
				ModulesTypeMapperService,
				ConfigSecretsService,
				PluginConfigMutationRegistryService,
				ModuleConfigMutationRegistryService,
				{
					provide: EventEmitter2,
					useValue: { emit: jest.fn() },
				},
				{
					provide: PlatformService,
					useValue: {},
				},
			],
		}).compile();

		configService = module.get<ConfigService>(ConfigService);
		pluginsMapperService = module.get<PluginsTypeMapperService>(PluginsTypeMapperService);

		pluginsMapperService.registerMapping<HomeKitConfigModel, HomeKitUpdatePluginConfigDto>({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			class: HomeKitConfigModel,
			configDto: HomeKitUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'pincode',
					configuredPath: 'pincode_configured',
				},
			],
		});
	});

	it('redacts pincode and exposes pincode_configured: true in getPublicPluginConfig', () => {
		const publicConfig = configService.getPublicPluginConfig<HomeKitConfigModel>(
			DEVICES_HOMEKIT_PLUGIN_NAME,
		) as unknown as Record<string, unknown>;

		expect(publicConfig).toBeDefined();
		expect(publicConfig.pincode).toBeUndefined();
		expect('pincode' in publicConfig).toBe(false);
		expect(publicConfig.pincode_configured).toBe(true);
		expect(publicConfig.bridge_name).toBe('Smart Panel Bridge');
	});

	it('preserves stored pincode when pincode is omitted in updatePluginConfig', async () => {
		await configService.updatePluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			bridge_name: 'Renamed Bridge',
		});

		const internalConfig = configService.getPluginConfig<HomeKitConfigModel>(DEVICES_HOMEKIT_PLUGIN_NAME);
		expect(internalConfig.bridgeName).toBe('Renamed Bridge');
		expect(internalConfig.pincode).toBe(initialPin);

		const publicConfig = configService.getPublicPluginConfig<HomeKitConfigModel>(
			DEVICES_HOMEKIT_PLUGIN_NAME,
		) as unknown as Record<string, unknown>;
		expect(publicConfig.bridge_name).toBe('Renamed Bridge');
		expect(publicConfig.pincode).toBeUndefined();
		expect(publicConfig.pincode_configured).toBe(true);
	});

	it('replaces stored pincode when a new valid PIN is provided in updatePluginConfig', async () => {
		const newPin = '849-21-482';
		await configService.updatePluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			pincode: newPin,
		});

		const internalConfig = configService.getPluginConfig<HomeKitConfigModel>(DEVICES_HOMEKIT_PLUGIN_NAME);
		expect(internalConfig.pincode).toBe(newPin);

		const publicConfig = configService.getPublicPluginConfig<HomeKitConfigModel>(
			DEVICES_HOMEKIT_PLUGIN_NAME,
		) as unknown as Record<string, unknown>;
		expect(publicConfig.pincode).toBeUndefined();
		expect(publicConfig.pincode_configured).toBe(true);
	});
});
