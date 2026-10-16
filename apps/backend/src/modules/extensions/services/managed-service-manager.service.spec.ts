import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule, EventEmitterReadinessWatcher } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { UpdatePluginConfigDto } from '../../config/dto/config.dto';
import { AppConfigModel, PluginConfigModel } from '../../config/models/config.model';
import { ConfigSecretsService } from '../../config/services/config-secrets.service';
import { ConfigService } from '../../config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../../config/services/module-config-mutation-registry.service';
import { ModulesTypeMapperService } from '../../config/services/modules-type-mapper.service';
import { PluginConfigMutationRegistryService } from '../../config/services/plugin-config-mutation-registry.service';
import { PluginsTypeMapperService } from '../../config/services/plugins-type-mapper.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PlatformService } from '../../platform/services/platform.service';

import {
	IManagedExtensionService,
	ManagedServiceActivationPolicy,
	ManagedServiceOwnerKind,
	ServiceState,
} from './managed-extension-service.interface';
import { ManagedServiceManagerService, ManagedStartAdmission } from './managed-service-manager.service';

/**
 * Minimal mock service whose state can be controlled externally.
 */
function createMockService(
	ownerKind: ManagedServiceOwnerKind,
	ownerType: string,
	serviceId: string,
	initialState: ServiceState = 'stopped',
	activationPolicy: ManagedServiceActivationPolicy = 'owner-enabled',
): IManagedExtensionService & { _state: ServiceState } {
	const svc: IManagedExtensionService & { _state: ServiceState } = {
		owner: { kind: ownerKind, type: ownerType },
		serviceId,
		activationPolicy,
		_state: initialState,
		start: jest.fn(() => {
			svc._state = 'started';

			return Promise.resolve();
		}),
		stop: jest.fn(() => {
			svc._state = 'stopped';

			return Promise.resolve();
		}),
		getState: jest.fn(() => svc._state),
	};

	return svc;
}

function admissionDeferred<T = void>() {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve: (value: T) => resolve(value) };
}

class AdmissionFixturePluginConfig extends PluginConfigModel {}

describe('ManagedServiceManagerService', () => {
	let manager: ManagedServiceManagerService;
	let configService: { getModuleConfig: jest.Mock; getPluginConfig: jest.Mock };
	let nestConfigService: { get: jest.Mock };
	let pluginConfigValidator: { hasValidator: jest.Mock; validate: jest.Mock };
	let notifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };

	beforeEach(() => {
		jest.useFakeTimers();

		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ enabled: true }),
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};

		nestConfigService = {
			get: jest.fn().mockReturnValue(null), // not CLI mode
		};

		pluginConfigValidator = {
			hasValidator: jest.fn().mockReturnValue(false),
			validate: jest.fn().mockResolvedValue({ valid: true }),
		};

		notifications = { notify: jest.fn(), resolve: jest.fn(), resolveAll: jest.fn() };

		manager = new ManagedServiceManagerService(
			configService as unknown as ConfigService,
			nestConfigService as unknown as NestConfigService,
			pluginConfigValidator as unknown as PluginConfigValidatorService,
			notifications as unknown as NotificationsService,
		);

		// Mark startup as complete so handleConfigUpdated processes events
		(manager as unknown as { startupComplete: boolean }).startupComplete = true;
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('original managed start admission', () => {
		const startup = (target: ManagedServiceManagerService, complete: boolean) => {
			(target as unknown as { startupComplete: boolean }).startupComplete = complete;
		};
		const admittedService = (target: ManagedServiceManagerService, owner = 'admission-owner', id = 'runtime', policy: ManagedServiceActivationPolicy = 'owner-enabled') => {
			const service = createMockService('plugin', owner, id, 'stopped', policy);
			const tokens: ManagedStartAdmission[] = [];
			const revoke = jest.fn();
			service.revokeCurrentAuthority = revoke;
			const start = jest.fn(() => {
				const token = target.captureCurrentStartAdmission(service.owner, service.serviceId);
				if (!token) throw new Error('Expected original managed start admission');
				expect(token.isCurrent()).toBe(true);
				expect(target.captureCurrentStartAdmission({ kind: 'module', type: owner }, id)).toBeNull();
				tokens.push(token);
				service._state = 'started';
				return Promise.resolve();
			});
			service.start = start;
			return { service, tokens, revoke, start };
		};
		const registerBeforeStartup = (service: IManagedExtensionService) => {
			startup(manager, false); manager.register(service); startup(manager, true);
		};

		it('keeps original runtime evidence after operation close without allowing GET or duplicate events to mint tokens', async () => {
			const fixture = admittedService(manager);
			registerBeforeStartup(fixture.service);
			await expect(manager.startServiceManually('plugin', 'admission-owner', 'runtime')).resolves.toBe(true);
			const original = fixture.tokens[0];
			expect(original.isCurrent()).toBe(false);
			expect(original.runtime.isCurrent()).toBe(true);
			expect(manager.captureCurrentStartAdmission(fixture.service.owner, 'runtime')).toBeNull();
			await manager.getStatus();
			await manager.getServiceStatus('plugin', 'admission-owner', 'runtime');
			manager.getRegisteredServices();
			expect(() => manager.register(fixture.service)).toThrow('already registered');
			await manager.handleConfigUpdated({ source: 'admission-owner', type: 'plugin' });
			expect(fixture.start).toHaveBeenCalledTimes(1);
			expect(original.runtime.isCurrent()).toBe(true);
			await manager.stopServiceManually('plugin', 'admission-owner', 'runtime');
			expect(original.runtime.isCurrent()).toBe(false);
			await manager.startServiceManually('plugin', 'admission-owner', 'runtime');
			expect(fixture.tokens[1]).not.toBe(original);
			expect(fixture.tokens[1].runtime.isCurrent()).toBe(true);
			expect(original.runtime.isCurrent()).toBe(false);
		});

		it.each(['stopped', 'starting', 'started'] as ServiceState[])('records disable before startup scheduling for a %s registration', async (state) => {
			const fixture = admittedService(manager);
			registerBeforeStartup(fixture.service);
			await manager.startServiceManually('plugin', 'admission-owner', 'runtime');
			const old = fixture.tokens[0];
			fixture.service._state = state;
			fixture.revoke.mockClear();
			startup(manager, false);
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			const disabled = manager.handleConfigUpdated();
			expect(old.runtime.isCurrent()).toBe(false);
			expect(fixture.revoke).toHaveBeenCalledTimes(1);
			await disabled;
			configService.getPluginConfig.mockReturnValue({ enabled: true });
			await manager.handleConfigUpdated();
			expect(old.runtime.isCurrent()).toBe(false);
			expect(fixture.start).toHaveBeenCalledTimes(1);
		});

		it('does not revoke an always-active runtime when only its owner is disabled', async () => {
			const fixture = admittedService(manager, 'always-owner', 'discovery', 'always');
			registerBeforeStartup(fixture.service);
			await manager.startServiceManually('plugin', 'always-owner', 'discovery');
			fixture.revoke.mockClear();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(true);
			expect(fixture.revoke).not.toHaveBeenCalled();
			await manager.restartService('plugin', 'always-owner', 'discovery');
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(false);
			expect(fixture.tokens[1].runtime.isCurrent()).toBe(true);
		});

		it('does not rescue a validator token across disable-enable or deduplicate a new request onto its authority', async () => {
			const firstEntered = admissionDeferred(), secondEntered = admissionDeferred();
			const first = admissionDeferred<{ valid: boolean }>(), second = admissionDeferred<{ valid: boolean }>();
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate
				.mockImplementationOnce(() => { firstEntered.resolve(); return first.promise; })
				.mockImplementationOnce(() => { secondEntered.resolve(); return second.promise; });
			const fixture = admittedService(manager);
			registerBeforeStartup(fixture.service);
			const oldRequest = manager.handleConfigUpdated();
			await firstEntered.promise;
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			configService.getPluginConfig.mockReturnValue({ enabled: true });
			const newRequest = manager.handleConfigUpdated();
			first.resolve({ valid: true });
			await secondEntered.promise;
			expect(fixture.start).not.toHaveBeenCalled();
			second.resolve({ valid: true });
			await Promise.all([oldRequest, newRequest]);
			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(2);
			expect(fixture.start).toHaveBeenCalledTimes(1);
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(true);
		});

		it('closes a pending validator synchronously even when manual stop finds the service still stopped', async () => {
			const entered = admissionDeferred(), validation = admissionDeferred<{ valid: boolean }>();
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockImplementationOnce(() => { entered.resolve(); return validation.promise; });
			const fixture = admittedService(manager);
			registerBeforeStartup(fixture.service);
			const request = manager.handleConfigUpdated();
			await entered.promise;
			fixture.revoke.mockClear();
			await expect(manager.stopServiceManually('plugin', 'admission-owner', 'runtime')).resolves.toBe(false);
			expect(fixture.revoke).toHaveBeenCalledTimes(1);
			validation.resolve({ valid: true });
			await request;
			expect(fixture.start).not.toHaveBeenCalled();
			pluginConfigValidator.validate.mockResolvedValue({ valid: true });
			await manager.handleConfigUpdated();
			expect(fixture.start).toHaveBeenCalledTimes(1);
		});

		it('cannot reopen an old held start and starts the currently wanted generation after cleanup', async () => {
			const entered = admissionDeferred(), release = admissionDeferred();
			const fixture = admittedService(manager);
			fixture.service.start = jest.fn(async () => {
				const token = manager.captureCurrentStartAdmission(fixture.service.owner, 'runtime');
				if (!token) throw new Error('Missing original start');
				fixture.tokens.push(token);
				fixture.service._state = 'starting';
				if (fixture.tokens.length === 1) { entered.resolve(); await release.promise; }
				fixture.service._state = 'started';
			});
			registerBeforeStartup(fixture.service);
			const old = manager.startServiceManually('plugin', 'admission-owner', 'runtime');
			await entered.promise;
			startup(manager, false);
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			expect(fixture.tokens[0].isCurrent()).toBe(false);
			configService.getPluginConfig.mockReturnValue({ enabled: true });
			await manager.handleConfigUpdated();
			startup(manager, true);
			const fresh = manager.handleConfigUpdated();
			release.resolve();
			await jest.advanceTimersByTimeAsync(11_000);
			await Promise.all([old, fresh]);
			expect(fixture.tokens).toHaveLength(2);
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(false);
			expect(fixture.tokens[1].runtime.isCurrent()).toBe(true);
			await expect(manager.getServiceStatus('plugin', 'admission-owner', 'runtime')).resolves.toEqual(
				expect.objectContaining({ startCount: 1 }),
			);
		});

		it('keeps same-object registration ABA separate and cannot publish old completion into replacement status', async () => {
			const firstEntered = admissionDeferred(), release = admissionDeferred(), secondEntered = admissionDeferred();
			const fixture = admittedService(manager);
			fixture.service.start = jest.fn(async () => {
				const token = manager.captureCurrentStartAdmission(fixture.service.owner, 'runtime');
				if (!token) throw new Error('Missing original start');
				fixture.tokens.push(token);
				fixture.service._state = 'starting';
				if (fixture.tokens.length === 1) { firstEntered.resolve(); await release.promise; }
				else secondEntered.resolve();
				fixture.service._state = 'started';
			});
			registerBeforeStartup(fixture.service);
			const old = manager.startServiceManually('plugin', 'admission-owner', 'runtime');
			await firstEntered.promise;
			manager.unregister('plugin', 'admission-owner', 'runtime');
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(false);
			manager.register(fixture.service);
			release.resolve();
			await secondEntered.promise;
			await old;
			await manager.handleConfigUpdated();
			expect(fixture.tokens).toHaveLength(2);
			expect(fixture.tokens[1].runtime.isCurrent()).toBe(true);
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'admission-owner', 'runtime')).resolves.toEqual(
				expect.objectContaining({ startCount: 1 }),
			);
		});

		it.each(['stopAllServices', 'onModuleDestroy'] as const)('closes all admissions at %s entry without old-token revival', async (operation) => {
			const first = admittedService(manager, 'first-owner'), second = admittedService(manager, 'second-owner');
			startup(manager, false); manager.register(first.service); manager.register(second.service); startup(manager, true);
			await manager.handleConfigUpdated();
			const entered = admissionDeferred(), release = admissionDeferred();
			second.service.stop = jest.fn(async () => { entered.resolve(); await release.promise; second.service._state = 'stopped'; });
			const stopping = manager[operation]();
			await entered.promise;
			expect(first.tokens[0].runtime.isCurrent()).toBe(false);
			expect(second.tokens[0].runtime.isCurrent()).toBe(false);
			release.resolve(); await stopping;
			expect(first.tokens[0].runtime.isCurrent()).toBe(false);
			await manager.handleConfigUpdated();
			if (operation === 'stopAllServices') expect(first.tokens[1].runtime.isCurrent()).toBe(true);
			else {
				expect(first.tokens).toHaveLength(1);
				await expect(manager.startServiceManually('plugin', 'first-owner', 'runtime')).resolves.toBe(false);
			}
			expect(first.tokens[0].runtime.isCurrent()).toBe(false);
		});

		it('does not write stale validator errors into a replacement registration or its notifications', async () => {
			const entered = admissionDeferred();
			let reject: (error: Error) => void;
			const validation = new Promise<{ valid: boolean }>((_resolve, fail) => { reject = fail; });
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockImplementationOnce(() => { entered.resolve(); return validation; }).mockResolvedValue({ valid: true });
			const old = admittedService(manager), replacement = admittedService(manager);
			registerBeforeStartup(old.service);
			const oldRequest = manager.handleConfigUpdated();
			await entered.promise;
			manager.unregister('plugin', 'admission-owner', 'runtime');
			manager.register(replacement.service);
			const currentRequest = manager.handleConfigUpdated();
			reject(new Error('stale private validator error'));
			await Promise.all([oldRequest, currentRequest]);
			expect(old.start).not.toHaveBeenCalled();
			expect(replacement.start).toHaveBeenCalledTimes(1);
			expect(replacement.tokens[0].runtime.isCurrent()).toBe(true);
			expect(notifications.notify).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('plugin', 'admission-owner', 'runtime')).resolves.toEqual(
				expect.objectContaining({ startCount: 1, lastError: undefined }),
			);
		});

		it('does not let a readiness retry from an unregistered incarnation start the replacement twice', async () => {
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValueOnce({ valid: false, transient: true }).mockResolvedValue({ valid: true });
			const fixture = admittedService(manager);
			registerBeforeStartup(fixture.service);
			await manager.handleConfigUpdated();
			manager.unregister('plugin', 'admission-owner', 'runtime');
			manager.register(fixture.service);
			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);
			expect(fixture.start).toHaveBeenCalledTimes(1);
			expect(fixture.tokens[0].runtime.isCurrent()).toBe(true);
		});

		const actualEventFixture = async () => {
			let store = Object.assign(new AppConfigModel(), {
				plugins: ['route-owner', 'second-route-owner'].map((type) => Object.assign(new AdmissionFixturePluginConfig(), { type, enabled: true })),
				modules: [],
			});
			const module = await Test.createTestingModule({
				imports: [EventEmitterModule.forRoot()],
				providers: [
					ManagedServiceManagerService,
					{ provide: NestConfigService, useValue: nestConfigService },
					{ provide: PluginConfigValidatorService, useValue: pluginConfigValidator },
					{ provide: NotificationsService, useValue: notifications },
					{ provide: ConfigService, inject: [EventEmitter2], useFactory: (events: EventEmitter2) => {
						const plugins = new PluginsTypeMapperService(), modules = new ModulesTypeMapperService();
						for (const type of ['route-owner', 'second-route-owner']) plugins.registerMapping({ type, class: AdmissionFixturePluginConfig, configDto: UpdatePluginConfigDto });
						const config = new ConfigService(nestConfigService as unknown as NestConfigService, plugins, modules,
							new ConfigSecretsService(), new ModuleConfigMutationRegistryService(), new PluginConfigMutationRegistryService(),
							{} as PlatformService, events);
						// Only persistence is in memory; actual DTO/merge/validation/setPluginConfig + emitter/OnEvent loader run.
						const storage = config as unknown as { readonly appConfig: AppConfigModel; saveConfig(value: AppConfigModel): void };
						jest.spyOn(storage, 'appConfig', 'get').mockImplementation(() => store);
						jest.spyOn(storage, 'saveConfig').mockImplementation((saved) => { store = saved; });
						return config;
					} },
				],
			}).compile();
			await module.init();
			await module.get(EventEmitterReadinessWatcher).waitUntilReady();
			return { module, target: module.get(ManagedServiceManagerService), config: module.get(ConfigService), events: module.get(EventEmitter2), store };
		};

		it('actual ConfigService set route synchronously revokes every matching service before the first held stop', async () => {
			const fixture = await actualEventFixture();
			const release = admissionDeferred(), secondStopped = admissionDeferred();
			try {
				const first = admittedService(fixture.target, 'route-owner', 'first');
				const second = admittedService(fixture.target, 'route-owner', 'second');
				const unrelated = admittedService(fixture.target, 'second-route-owner');
				fixture.target.register(first.service); fixture.target.register(second.service); fixture.target.register(unrelated.service);
				await fixture.target.handleConfigUpdated();
				first.revoke.mockClear(); second.revoke.mockClear(); unrelated.revoke.mockClear();
				first.service.stop = jest.fn(async () => { await release.promise; first.service._state = 'stopped'; });
				second.service.stop = jest.fn(() => { second.service._state = 'stopped'; secondStopped.resolve(); return Promise.resolve(); });
				fixture.config.setPluginConfig('route-owner', Object.assign(new UpdatePluginConfigDto(), { type: 'route-owner', enabled: false }));
				// No await between actual config.emit and this assertion: later matching service is already revoked.
				expect(first.revoke).toHaveBeenCalledTimes(1);
				expect(second.revoke).toHaveBeenCalledTimes(1);
				expect(first.tokens[0].runtime.isCurrent()).toBe(false);
				expect(second.tokens[0].runtime.isCurrent()).toBe(false);
				expect(unrelated.revoke).not.toHaveBeenCalled();
				expect(unrelated.tokens[0].runtime.isCurrent()).toBe(true);
				release.resolve(); await secondStopped.promise;
			} finally { release.resolve(); await fixture.module.close(); }
		});

		it('actual broad config event prepasses different owners before serial waits and preserves always-active policy', async () => {
			const fixture = await actualEventFixture();
			const release = admissionDeferred(), stopped = admissionDeferred();
			try {
				const first = admittedService(fixture.target, 'route-owner');
				const later = admittedService(fixture.target, 'second-route-owner');
				const always = admittedService(fixture.target, 'route-owner', 'discovery', 'always');
				fixture.target.register(first.service); fixture.target.register(later.service); fixture.target.register(always.service);
				await fixture.target.handleConfigUpdated();
				first.revoke.mockClear(); later.revoke.mockClear(); always.revoke.mockClear();
				first.revoke.mockImplementationOnce(() => { throw new Error('injected first revocation hook failure'); });
				first.service.stop = jest.fn(async () => { await release.promise; first.service._state = 'stopped'; });
				later.service.stop = jest.fn(() => { later.service._state = 'stopped'; stopped.resolve(); return Promise.resolve(); });
				for (const config of fixture.store.plugins) config.enabled = false;
				fixture.events.emit(ConfigModuleEventType.CONFIG_UPDATED, { source: 'all', type: 'section' });
				expect(first.revoke).toHaveBeenCalledTimes(1);
				expect(later.revoke).toHaveBeenCalledTimes(1);
				expect(later.tokens[0].runtime.isCurrent()).toBe(false);
				expect(always.revoke).not.toHaveBeenCalled();
				expect(always.tokens[0].runtime.isCurrent()).toBe(true);
				release.resolve(); await stopped.promise;
			} finally { release.resolve(); await fixture.module.close(); }
		});
	});

	describe('extension ownership and activation', () => {
		it('registers module and plugin services under distinct authoritative keys', () => {
			manager.register(createMockService('module', 'shared-owner', 'runtime'));
			manager.register(createMockService('plugin', 'shared-owner', 'runtime'));

			expect(manager.getRegisteredServices()).toEqual(['module:shared-owner:runtime', 'plugin:shared-owner:runtime']);
		});

		it('keeps the complete managed runtime inventory explicit', () => {
			const expectedKeys = [
				'plugin:devices-home-assistant-plugin:connector',
				'plugin:devices-home-assistant-plugin:discovery',
				'plugin:devices-homey-plugin:connector',
				'plugin:devices-reterminal-plugin:connector',
				'plugin:devices-shelly-ng-plugin:connector',
				'plugin:devices-shelly-v1-plugin:connector',
				'plugin:devices-wled-plugin:connector',
				'plugin:devices-zigbee2mqtt-plugin:connector',
				'plugin:buddy-discord-plugin:bot',
				'plugin:buddy-telegram-plugin:bot',
				'plugin:buddy-whatsapp-plugin:bot',
				'plugin:influx-v1-plugin:storage',
				'plugin:influx-v2-plugin:storage',
				'plugin:memory-storage-plugin:storage',
				'plugin:logger-rotating-file-plugin:file-logger',
				'plugin:simulator-plugin:simulation',
				'module:mdns-module:advertisement',
				'module:buddy-module:heartbeat',
				'module:weather-module:refresh',
				'plugin:spaces-home-control-plugin:suggestion-heartbeat',
			];

			for (const key of expectedKeys) {
				const [kind, type, serviceId] = key.split(':') as ['module' | 'plugin', string, string];
				manager.register(createMockService(kind, type, serviceId));
			}

			expect(manager.getRegisteredServices()).toEqual(expectedKeys);
			expect(expectedKeys).toHaveLength(20);
		});

		it('rejects a duplicate registration with the same owner key', () => {
			const first = createMockService('plugin', 'duplicate-owner', 'runtime');
			const duplicate = createMockService('plugin', 'duplicate-owner', 'runtime');

			manager.register(first);

			expect(() => manager.register(duplicate)).toThrow('Service already registered: plugin:duplicate-owner:runtime');
		});

		it('starts always-active services while reporting the disabled owner separately', async () => {
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			const service = createMockService('plugin', 'discovery-owner', 'discovery', 'stopped', 'always');
			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);

			await manager.onApplicationBootstrap();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('plugin', 'discovery-owner', 'discovery')).resolves.toEqual(
				expect.objectContaining({
					activationPolicy: 'always',
					desiredState: 'started',
					enabled: false,
					state: 'started',
				}),
			);
		});

		it('routes plugin and module config events only to matching owners', async () => {
			const pluginService = createMockService('plugin', 'shared-owner', 'runtime');
			const moduleService = createMockService('module', 'shared-owner', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(pluginService);
			manager.register(moduleService);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'shared-owner', type: 'plugin' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(pluginService.start).toHaveBeenCalledTimes(1);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(moduleService.start).not.toHaveBeenCalled();

			await manager.handleConfigUpdated({ source: 'shared-owner', type: 'module' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(moduleService.start).toHaveBeenCalledTimes(1);
			expect(configService.getPluginConfig).toHaveBeenCalledWith('shared-owner');
			expect(configService.getModuleConfig).toHaveBeenCalledWith('shared-owner');
		});

		it('does not route non-matching config events', async () => {
			const service = createMockService('module', 'target-module', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'other-module', type: 'module' });
			await manager.handleConfigUpdated({ source: 'target-module', type: 'plugin' });

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('blocks manual start and restart when an owner-enabled service owner is disabled', async () => {
			configService.getModuleConfig.mockReturnValue({ enabled: false });
			const service = createMockService('module', 'disabled-module', 'runtime');

			manager.register(service);

			await expect(manager.startServiceManually('module', 'disabled-module', 'runtime')).resolves.toBe(false);
			await expect(manager.restartService('module', 'disabled-module', 'runtime')).resolves.toBe(false);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('module', 'disabled-module', 'runtime')).resolves.toEqual(
				expect.objectContaining({ enabled: false, desiredState: 'stopped' }),
			);
		});

		it('allows manual restart for an always-active service with a disabled owner', async () => {
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			const service = createMockService('plugin', 'discovery-owner', 'discovery', 'started', 'always');

			manager.register(service);

			await expect(manager.restartService('plugin', 'discovery-owner', 'discovery')).resolves.toBe(true);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalledTimes(1);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});

		it('does not validate module services with plugin validators', async () => {
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			const service = createMockService('module', 'validated-module', 'runtime');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
			await manager.handleConfigUpdated({ source: 'validated-module', type: 'module' });

			expect(pluginConfigValidator.hasValidator).not.toHaveBeenCalled();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('manual action results', () => {
		it('rejects duplicate starts and stopped restarts but stops a starting service', async () => {
			const starting = createMockService('plugin', 'action-plugin', 'starting', 'starting');
			const stopped = createMockService('plugin', 'action-plugin', 'stopped');

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(starting);
			manager.register(stopped);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'starting')).resolves.toBe(false);
			await expect(manager.stopServiceManually('plugin', 'action-plugin', 'starting')).resolves.toBe(true);
			expect(starting.getState()).toBe('stopped');
			await expect(manager.restartService('plugin', 'action-plugin', 'stopped')).resolves.toBe(false);
		});

		it('accepts starting as a successful asynchronous launch state', async () => {
			const startedManually = createMockService('plugin', 'action-plugin', 'async-start');
			startedManually.start = jest.fn(() => {
				startedManually._state = 'starting';

				return Promise.resolve();
			});
			const restarted = createMockService('plugin', 'action-plugin', 'async-restart', 'started');
			restarted.start = jest.fn(() => {
				restarted._state = 'starting';

				return Promise.resolve();
			});

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(startedManually);
			manager.register(restarted);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'async-start')).resolves.toBe(true);
			await expect(manager.restartService('plugin', 'action-plugin', 'async-restart')).resolves.toBe(true);
			expect(startedManually.getState()).toBe('starting');
			expect(restarted.getState()).toBe('starting');
		});

		it('returns false when start does not reach a valid launch state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'start-failure');
			service.start = jest.fn().mockRejectedValue(new Error('start failed'));

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;

			await expect(manager.startServiceManually('plugin', 'action-plugin', 'start-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('stopped');
		});

		it('returns false when stop does not reach the stopped state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'stop-failure', 'started');
			service.stop = jest.fn().mockRejectedValue(new Error('stop failed'));

			manager.register(service);

			await expect(manager.stopServiceManually('plugin', 'action-plugin', 'stop-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('started');
		});

		it('returns false and does not start when restart cannot stop the service', async () => {
			const service = createMockService('plugin', 'action-plugin', 'restart-stop-failure', 'started');
			service.stop = jest.fn().mockRejectedValue(new Error('stop failed'));

			manager.register(service);

			await expect(manager.restartService('plugin', 'action-plugin', 'restart-stop-failure')).resolves.toBe(false);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('returns false when restart cannot reach a valid launch state', async () => {
			const service = createMockService('plugin', 'action-plugin', 'restart-start-failure', 'started');
			service.start = jest.fn().mockRejectedValue(new Error('start failed'));

			manager.register(service);

			await expect(manager.restartService('plugin', 'action-plugin', 'restart-start-failure')).resolves.toBe(false);
			expect(service.getState()).toBe('stopped');
		});
	});

	describe('service error notifications', () => {
		it('raises the service issue on start failure and resolves it once the service starts', async () => {
			const service = createMockService('plugin', 'flaky-plugin', 'runtime');
			service.start = jest
				.fn()
				.mockRejectedValueOnce(new Error('connection refused'))
				.mockRejectedValueOnce(new Error('connection refused again'))
				.mockImplementationOnce(() => {
					service._state = 'started';

					return Promise.resolve();
				});

			manager.register(service);

			// First failure: a fresh transition into error - raises exactly once.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			// Second failure: still in error - a retry tick, not a new transition, so no re-raise.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			// Recovers: resolves the issue.
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(true);

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith({
				source: 'flaky-plugin',
				kind: NotificationKind.ISSUE,
				key: 'service:plugin:flaky-plugin:runtime',
				severity: NotificationSeverity.ERROR,
				title: 'Service runtime of flaky-plugin failed',
				message: 'connection refused',
				actions: [
					{
						type: NotificationActionType.SERVICE,
						label: 'Restart service',
						extension_kind: 'plugin',
						extension_type: 'flaky-plugin',
						service_id: 'runtime',
						operation: 'restart',
						primary: true,
					},
					{
						type: NotificationActionType.LINK,
						label: 'Open services',
						url: '/extensions?tab=services&kind=plugin',
					},
				],
			});

			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledWith('flaky-plugin', 'service:plugin:flaky-plugin:runtime');
		});

		it('raises the service issue once readiness retries are exhausted', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: 'devices-provider',
					kind: NotificationKind.ISSUE,
					key: 'service:plugin:devices-provider:connector',
					severity: NotificationSeverity.ERROR,
					message: 'Configuration readiness check is temporarily unavailable',
				}),
			);
		});

		it('raises exactly once when a transient readiness failure is followed by a start failure', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');
			service.start = jest.fn().mockRejectedValue(new Error('connection refused'));

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate
				.mockResolvedValueOnce({
					valid: false,
					errors: [{ message: 'Configuration validation failed unexpectedly' }],
					transient: true,
				})
				.mockResolvedValue({ valid: true });

			manager.register(service);

			// First attempt: a transient readiness failure - not a transition into error, so no raise.
			// A stale `lastError` from this must not suppress the genuine failure below.
			await manager.handleConfigUpdated();
			expect(notifications.notify).not.toHaveBeenCalled();

			// The scheduled retry re-validates (now valid this time) and reaches the real start(),
			// which fails - a fresh transition into error.
			await jest.advanceTimersByTimeAsync(20_000);

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: 'devices-provider',
					key: 'service:plugin:devices-provider:connector',
					message: 'connection refused',
				}),
			);
		});

		it('raises again after a resolved issue re-enters error, with one resolve in between', async () => {
			const service = createMockService('plugin', 'flaky-plugin', 'runtime');
			service.start = jest
				.fn()
				.mockRejectedValueOnce(new Error('connection refused'))
				.mockImplementationOnce(() => {
					service._state = 'started';

					return Promise.resolve();
				})
				.mockRejectedValueOnce(new Error('connection refused again'));

			manager.register(service);

			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(true);

			// Something external observes the service has failed again (a crash, a health probe) -
			// the manager only decides whether to raise, it does not itself detect the transition.
			service._state = 'error';

			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);

			expect(notifications.notify).toHaveBeenCalledTimes(2);
			expect(notifications.resolve).toHaveBeenCalledTimes(1);
		});

		it('logs a resolve failure without breaking the start path', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');
			const service = createMockService('plugin', 'flaky-plugin', 'runtime');
			service.start = jest
				.fn()
				.mockRejectedValueOnce(new Error('connection refused'))
				.mockImplementationOnce(() => {
					service._state = 'started';

					return Promise.resolve();
				});

			notifications.resolve.mockRejectedValueOnce(new Error('database is locked'));

			manager.register(service);

			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(false);
			await expect(manager.startServiceManually('plugin', 'flaky-plugin', 'runtime')).resolves.toBe(true);

			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(
				error.mock.calls.some(([message]) => typeof message === 'string' && message.includes('database is locked')),
			).toBe(true);
		});
	});

	describe('ordering and lifecycle boundaries', () => {
		it('starts dependencies first using generic service keys', async () => {
			const order: string[] = [];
			const dependency = createMockService('module', 'runtime-module', 'dependency');
			const dependent = createMockService('plugin', 'runtime-plugin', 'dependent');
			dependency.start = jest.fn(() => {
				order.push('dependency');
				dependency._state = 'started';

				return Promise.resolve();
			});
			dependent.start = jest.fn(() => {
				order.push('dependent');
				dependent._state = 'started';

				return Promise.resolve();
			});
			dependent.getDependencies = () => ['module:runtime-module:dependency'];

			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(dependent);
			manager.register(dependency);
			await manager.onApplicationBootstrap();

			expect(order).toEqual(['dependency', 'dependent']);
		});

		it('does not start managed runtimes in CLI mode', async () => {
			const cliConfig = { get: jest.fn().mockReturnValue('on') };
			const cliManager = new ManagedServiceManagerService(
				configService as unknown as ConfigService,
				cliConfig as unknown as NestConfigService,
				pluginConfigValidator as unknown as PluginConfigValidatorService,
				notifications as unknown as NotificationsService,
			);
			const service = createMockService('plugin', 'cli-plugin', 'runtime');

			cliManager.register(service);
			await cliManager.onApplicationBootstrap();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
		});

		it('stops services in reverse dependency order on shutdown', async () => {
			const order: string[] = [];
			const dependency = createMockService('module', 'runtime-module', 'dependency', 'started');
			const dependent = createMockService('plugin', 'runtime-plugin', 'dependent', 'started');
			dependency.stop = jest.fn(() => {
				order.push('dependency');
				dependency._state = 'stopped';

				return Promise.resolve();
			});
			dependent.stop = jest.fn(() => {
				order.push('dependent');
				dependent._state = 'stopped';

				return Promise.resolve();
			});
			dependent.getDependencies = () => ['module:runtime-module:dependency'];

			manager.register(dependent);
			manager.register(dependency);
			await manager.onModuleDestroy();

			expect(order).toEqual(['dependent', 'dependency']);
		});

		it('stops every running service for factory reset and remains reusable', async () => {
			const service = createMockService('module', 'reset-module', 'runtime', 'started');

			manager.register(service);
			await manager.stopAllServices();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalledTimes(1);
			configService.getModuleConfig.mockReturnValue({ enabled: true });
			await manager.handleConfigUpdated({ source: 'reset-module', type: 'module' });
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('syncServiceState with timed-out transitional states', () => {
		it('keeps an enabled service stopped when its runtime configuration needs attention', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'API key is required', field: 'api_key' }],
			});
			manager.register(service);

			await manager.handleConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Config validation failed: API key is required',
				}),
			);
		});

		it('keeps an enabled service stopped when its readiness check is temporarily unavailable', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockRejectedValue(new Error('private storage failure'));
			manager.register(service);

			await manager.handleConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({
					state: 'stopped',
					lastError: 'Configuration readiness check is temporarily unavailable',
				}),
			);
		});

		it('retries a transient readiness failure and starts after recovery', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate
				.mockResolvedValueOnce({
					valid: false,
					errors: [{ message: 'Configuration validation failed unexpectedly' }],
					transient: true,
				})
				.mockResolvedValue({ valid: true });
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(15_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(2);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('plugin', 'devices-provider', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', lastError: undefined }),
			);
		});

		it('bounds automatic retries for a persistent readiness failure', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(4);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(jest.getTimerCount()).toBe(0);
		});

		it('cancels a pending readiness retry when the plugin is disabled', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockResolvedValue({
				valid: false,
				errors: [{ message: 'Configuration validation failed unexpectedly' }],
				transient: true,
			});
			manager.register(service);

			await manager.handleConfigUpdated();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			await jest.advanceTimersByTimeAsync(120_000);

			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('does not start when the plugin is disabled during an asynchronous readiness check', async () => {
			const service = createMockService('plugin', 'devices-provider', 'connector');
			let finishValidation = (_result: { valid: boolean }): void => undefined;
			const validation = new Promise<{ valid: boolean }>((resolve) => {
				finishValidation = resolve;
			});

			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockReturnValue(validation);
			manager.register(service);

			const start = manager.handleConfigUpdated();
			await Promise.resolve();
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			await manager.handleConfigUpdated();
			finishValidation({ valid: true });
			await start;

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.start).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
		});

		it('should force-stop a service stuck in starting state when plugin is disabled', async () => {
			// Create a service that stays in 'starting' (simulates WhatsApp QR scan)
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'starting');

			manager.register(service);

			// Plugin is now disabled
			configService.getPluginConfig.mockReturnValue({ enabled: false });

			const promise = manager.handleConfigUpdated();

			// Advance past the waitForState timeout (10s default, polled every 50ms)
			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// The manager should have called stop() to force the service down
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalled();
		});

		it('should not force-stop a service in starting state when plugin is enabled', async () => {
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'starting');

			manager.register(service);

			// Plugin is enabled
			configService.getPluginConfig.mockReturnValue({ enabled: true });

			const promise = manager.handleConfigUpdated();

			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// stop() should NOT have been called
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).not.toHaveBeenCalled();
		});

		it('should force-stop a service stuck in stopping state when plugin is disabled', async () => {
			const service = createMockService('plugin', 'buddy-whatsapp', 'bot', 'stopping');

			manager.register(service);

			configService.getPluginConfig.mockReturnValue({ enabled: false });

			const promise = manager.handleConfigUpdated();

			await jest.advanceTimersByTimeAsync(11_000);

			await promise;

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(service.stop).toHaveBeenCalled();
		});
	});
});
