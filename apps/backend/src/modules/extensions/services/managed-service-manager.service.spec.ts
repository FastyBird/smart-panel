import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';

import {
	IManagedExtensionService,
	ManagedServiceActivationPolicy,
	ManagedServiceOwnerKind,
	ServiceState,
} from './managed-extension-service.interface';
import { ManagedRuntimeAdmission, ManagedServiceManagerService } from './managed-service-manager.service';

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

	describe('start admission ownership', () => {
		function register(service: IManagedExtensionService): void {
			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
		}

		it('captures only the original service during start and retires its runtime on restart', async () => {
			const service = createMockService('plugin', 'owner', 'connector');
			const impostor = createMockService('plugin', 'owner', 'connector');
			const admissions: ManagedRuntimeAdmission[] = [];
			jest.spyOn(service, 'start').mockImplementation(() => {
				expect(manager.captureCurrentStartAdmission(impostor)).toBeNull();
				const admission = manager.captureCurrentStartAdmission(service);
				expect(admission?.isCurrent()).toBe(true);
				admissions.push(admission);
				service._state = 'started';
				return Promise.resolve();
			});
			register(service);
			expect(manager.captureCurrentStartAdmission(service)).toBeNull();
			await manager.startServiceManually('plugin', 'owner', 'connector');
			expect(manager.captureCurrentStartAdmission(service)).toBeNull();
			expect(admissions[0].isCurrent()).toBe(true);
			await expect(manager.restartService('plugin', 'owner', 'connector')).resolves.toBe(true);
			expect(admissions).toHaveLength(2);
			expect(admissions[0].isCurrent()).toBe(false);
			expect(admissions[1].isCurrent()).toBe(true);
		});

		it('retires a delayed original start before admitting its restart', async () => {
			let complete!: () => void;
			let entered!: () => void;
			const starting = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const service = createMockService('plugin', 'owner', 'connector');
			const admissions: ManagedRuntimeAdmission[] = [];
			const start = jest.spyOn(service, 'start').mockImplementation(() => {
				admissions.push(manager.captureCurrentStartAdmission(service));
				service._state = 'started';
				if (admissions.length === 1) {
					entered();
					return new Promise<void>((resolve) => {
						complete = resolve;
					});
				}
				return Promise.resolve();
			});
			register(service);
			const original = manager.startServiceManually('plugin', 'owner', 'connector');
			await starting;
			const restart = manager.restartService('plugin', 'owner', 'connector');
			expect(admissions[0].isCurrent()).toBe(false);
			complete();
			await original;
			await expect(restart).resolves.toBe(true);
			expect(start).toHaveBeenCalledTimes(2);
			expect(admissions[0].isCurrent()).toBe(false);
			expect(admissions[1].isCurrent()).toBe(true);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ startCount: 1 }),
			);
		});

		it('invalidates a delayed readiness start even when manual stop observes stopped', async () => {
			let complete!: (value: { valid: boolean }) => void;
			let entered!: () => void;
			const checking = new Promise<void>((resolve) => {
				entered = resolve;
			});
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockImplementationOnce(() => {
				entered();
				return new Promise((resolve) => {
					complete = resolve;
				});
			});
			const service = createMockService('plugin', 'owner', 'connector');
			const start = jest.spyOn(service, 'start');
			register(service);
			const first = manager.startServiceManually('plugin', 'owner', 'connector');
			await checking;
			await manager.stopServiceManually('plugin', 'owner', 'connector');
			const second = manager.startServiceManually('plugin', 'owner', 'connector');
			complete({ valid: true });
			await first;
			await expect(second).resolves.toBe(true);
			expect(start).toHaveBeenCalledTimes(1);
			expect(pluginConfigValidator.validate).toHaveBeenCalledTimes(2);
		});

		it('does not start or report a replaced registration after queued validation', async () => {
			let complete!: (value: { valid: boolean }) => void;
			let entered!: () => void;
			const checking = new Promise<void>((resolve) => {
				entered = resolve;
			});
			pluginConfigValidator.hasValidator.mockReturnValue(true);
			pluginConfigValidator.validate.mockImplementationOnce(() => {
				entered();
				return new Promise((resolve) => {
					complete = resolve;
				});
			});
			const original = createMockService('plugin', 'owner', 'connector');
			const start = jest.spyOn(original, 'start');
			register(original);
			const first = manager.startServiceManually('plugin', 'owner', 'connector');
			await checking;
			manager.unregister('plugin', 'owner', 'connector');
			const replacement = createMockService('plugin', 'owner', 'connector');
			register(replacement);
			await expect(manager.startServiceManually('plugin', 'owner', 'connector')).resolves.toBe(true);
			complete({ valid: true });
			await expect(first).resolves.toBe(false);
			expect(start).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ startCount: 1, lastError: undefined }),
			);
		});

		it('drains the original invocation before restarting a re-registered service object', async () => {
			let complete!: () => void;
			let entered!: () => void;
			const starting = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const service = createMockService('plugin', 'owner', 'connector');
			const admissions: ManagedRuntimeAdmission[] = [];
			const start = jest.spyOn(service, 'start').mockImplementation(() => {
				admissions.push(manager.captureCurrentStartAdmission(service));
				if (admissions.length === 1) {
					entered();
					return new Promise<void>((resolve) => {
						complete = () => {
							service._state = 'started';
							resolve();
						};
					});
				}
				service._state = 'started';
				return Promise.resolve();
			});
			const stop = jest.spyOn(service, 'stop');
			register(service);
			const first = manager.startServiceManually('plugin', 'owner', 'connector');
			await starting;
			manager.unregister('plugin', 'owner', 'connector');
			register(service);
			const second = manager.startServiceManually('plugin', 'owner', 'connector');
			expect(start).toHaveBeenCalledTimes(1);
			expect(admissions[0].isCurrent()).toBe(false);
			complete();
			await first;
			await expect(second).resolves.toBe(true);
			expect(stop).toHaveBeenCalledTimes(1);
			expect(start).toHaveBeenCalledTimes(2);
			expect(admissions[0].isCurrent()).toBe(false);
			expect(admissions[1].isCurrent()).toBe(true);
		});

		it('does not let a late original failure change a replacement runtime', async () => {
			let fail!: (error: Error) => void;
			let entered!: () => void;
			const starting = new Promise<void>((resolve) => {
				entered = resolve;
			});
			let originalAdmission: ManagedRuntimeAdmission | null = null;
			const original = createMockService('plugin', 'owner', 'connector');
			jest.spyOn(original, 'start').mockImplementation(() => {
				originalAdmission = manager.captureCurrentStartAdmission(original);
				entered();
				return new Promise((_, reject) => {
					fail = reject;
				});
			});
			register(original);
			const first = manager.startServiceManually('plugin', 'owner', 'connector');
			await starting;
			manager.unregister('plugin', 'owner', 'connector');
			register(createMockService('plugin', 'owner', 'connector'));
			await manager.startServiceManually('plugin', 'owner', 'connector');
			fail(new Error('original failed'));
			await first;
			expect(originalAdmission?.isCurrent()).toBe(false);
			expect(notifications.notify).not.toHaveBeenCalled();
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ startCount: 1, lastError: undefined }),
			);
		});

		it('keeps a failed stop revoked while preserving its error and blocking restart', async () => {
			const service = createMockService('plugin', 'owner', 'connector');
			let admission: ManagedRuntimeAdmission | null = null;
			jest.spyOn(service, 'start').mockImplementation(() => {
				admission = manager.captureCurrentStartAdmission(service);
				service._state = 'started';
				return Promise.resolve();
			});
			jest.spyOn(service, 'stop').mockRejectedValue(new Error('cleanup failed'));
			register(service);
			await manager.startServiceManually('plugin', 'owner', 'connector');
			await expect(manager.restartService('plugin', 'owner', 'connector')).resolves.toBe(false);
			expect(admission?.isCurrent()).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', lastError: 'cleanup failed', startCount: 1 }),
			);
		});
	});

	describe('completed lifecycle ownership', () => {
		function admittedService() {
			const service = createMockService('plugin', 'owner', 'connector');
			const admissions: ManagedRuntimeAdmission[] = [];
			const start = jest.spyOn(service, 'start').mockImplementation(() => {
				admissions.push(manager.captureCurrentStartAdmission(service));
				service._state = 'started';
				return Promise.resolve();
			});
			return { service, admissions, start, stop: jest.spyOn(service, 'stop') };
		}

		it('restarts a fully completed lifecycle after public unregister and same-object registration', async () => {
			const { service, admissions, start, stop } = admittedService();
			manager.register(service);
			await manager.onApplicationBootstrap();
			// Repeated bootstrap/config synchronization of the current owner is idempotent.
			await manager.onApplicationBootstrap();
			await manager.handleConfigUpdated();
			expect(start).toHaveBeenCalledTimes(1);
			expect(stop).not.toHaveBeenCalled();
			expect(admissions[0].isCurrent()).toBe(true);
			manager.unregister('plugin', 'owner', 'connector');
			manager.register(service);
			await manager.onApplicationBootstrap();
			expect(start).toHaveBeenCalledTimes(2);
			expect(stop).toHaveBeenCalledTimes(1);
			expect(admissions[0].isCurrent()).toBe(false);
			expect(admissions[1].isCurrent()).toBe(true);
			await manager.onApplicationBootstrap();
			await manager.handleConfigUpdated();
			expect(start).toHaveBeenCalledTimes(2);
			expect(stop).toHaveBeenCalledTimes(1);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 1, lastError: undefined }),
			);
		});

		it.each(['started', 'starting'] as const)(
			'preserves a fresh unmanaged %s service without claiming its lifecycle',
			async (state) => {
				const service = createMockService('plugin', 'owner', 'connector', state);
				const start = jest.spyOn(service, 'start');
				const stop = jest.spyOn(service, 'stop');
				manager.register(service);
				await manager.onApplicationBootstrap();
				manager.unregister('plugin', 'owner', 'connector');
				manager.register(service);
				await manager.onApplicationBootstrap();
				expect(start).not.toHaveBeenCalled();
				expect(stop).not.toHaveBeenCalled();
				expect(manager.captureCurrentStartAdmission(service)).toBeNull();
				await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
					expect.objectContaining({ state, startCount: 0 }),
				);
			},
		);

		it('does not claim an unmanaged lifecycle started after a completed managed stop', async () => {
			const { service, admissions, start, stop } = admittedService();
			manager.register(service);
			await manager.onApplicationBootstrap();
			await expect(manager.stopServiceManually('plugin', 'owner', 'connector')).resolves.toBe(true);
			await service.start(); // Ordinary unmanaged caller: no manager start context or new admission.
			expect(admissions[1]).toBeNull();
			manager.unregister('plugin', 'owner', 'connector');
			manager.register(service);
			await manager.onApplicationBootstrap();
			expect(start).toHaveBeenCalledTimes(2);
			expect(stop).toHaveBeenCalledTimes(1);
			expect(admissions[0].isCurrent()).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 0 }),
			);
		});

		it('starts a different replacement object without stopping or inheriting the retired object', async () => {
			const original = admittedService();
			manager.register(original.service);
			await manager.onApplicationBootstrap();
			manager.unregister('plugin', 'owner', 'connector');
			const replacement = admittedService();
			manager.register(replacement.service);
			await manager.onApplicationBootstrap();
			expect(original.start).toHaveBeenCalledTimes(1);
			expect(original.stop).not.toHaveBeenCalled();
			expect(original.admissions[0].isCurrent()).toBe(false);
			expect(replacement.start).toHaveBeenCalledTimes(1);
			expect(replacement.admissions[0].isCurrent()).toBe(true);
		});

		it('keeps a disabled replacement closed and starts its own lifecycle when enabled', async () => {
			const { service, admissions, start } = admittedService();
			manager.register(service);
			await manager.onApplicationBootstrap();
			manager.unregister('plugin', 'owner', 'connector');
			configService.getPluginConfig.mockReturnValue({ enabled: false });
			manager.register(service);
			await manager.onApplicationBootstrap();
			expect(start).toHaveBeenCalledTimes(1);
			expect(admissions[0].isCurrent()).toBe(false);
			// Enabling an already-running retired object must not take the config-handler shortcut.
			configService.getPluginConfig.mockReturnValue({ enabled: true });
			await manager.handleConfigUpdated();
			expect(start).toHaveBeenCalledTimes(2);
			expect(admissions[1].isCurrent()).toBe(true);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 1 }),
			);
		});

		it.each(['disabled', 'unregistered'])(
			'rechecks a replacement %s during retirement of a completed lifecycle',
			async (change) => {
				const { service, admissions, start, stop } = admittedService();
				manager.register(service);
				await manager.onApplicationBootstrap();
				let finishStop!: () => void;
				let enteredStop!: () => void;
				const stopping = new Promise<void>((resolve) => {
					enteredStop = resolve;
				});
				const stopped = new Promise<void>((resolve) => {
					finishStop = resolve;
				});
				stop.mockImplementation(async () => {
					enteredStop();
					await stopped;
					service._state = 'stopped';
				});
				manager.unregister('plugin', 'owner', 'connector');
				manager.register(service);
				const replacement = manager.onApplicationBootstrap();
				await stopping;
				if (change === 'disabled') configService.getPluginConfig.mockReturnValue({ enabled: false });
				else manager.unregister('plugin', 'owner', 'connector');
				finishStop();
				await replacement;
				expect(start).toHaveBeenCalledTimes(1);
				expect(admissions[0].isCurrent()).toBe(false);
				expect(service.getState()).toBe('stopped');
			},
		);

		it('does not report a new start or admission when retired lifecycle cleanup fails', async () => {
			const { service, admissions, start, stop } = admittedService();
			manager.register(service);
			await manager.onApplicationBootstrap();
			manager.unregister('plugin', 'owner', 'connector');
			stop.mockRejectedValue(new Error('retired cleanup failed'));
			manager.register(service);
			await manager.onApplicationBootstrap();
			await expect(manager.startServiceManually('plugin', 'owner', 'connector')).resolves.toBe(false);
			expect(start).toHaveBeenCalledTimes(1);
			expect(admissions[0].isCurrent()).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 0, lastError: 'retired cleanup failed' }),
			);
		});
	});

	describe('replacement during stop and issue persistence', () => {
		function registerWithoutStarting(service: IManagedExtensionService): void {
			(manager as unknown as { startupComplete: boolean }).startupComplete = false;
			manager.register(service);
			(manager as unknown as { startupComplete: boolean }).startupComplete = true;
		}

		it('drains a pending stop before starting the re-registered exact service object', async () => {
			const service = createMockService('plugin', 'owner', 'connector');
			const admissions: ManagedRuntimeAdmission[] = [];
			jest.spyOn(service, 'start').mockImplementation(() => {
				admissions.push(manager.captureCurrentStartAdmission(service));
				service._state = 'started';
				return Promise.resolve();
			});
			let finishStop!: () => void;
			const stopped = new Promise<void>((resolve) => {
				finishStop = resolve;
			});
			const stop = jest.spyOn(service, 'stop').mockImplementation(async () => {
				// Faithful to Shelly: state remains started while its lifecycle lock is occupied.
				await stopped;
				service._state = 'stopped';
			});
			registerWithoutStarting(service);
			await manager.startServiceManually('plugin', 'owner', 'connector');
			const originalStop = manager.stopServiceManually('plugin', 'owner', 'connector');
			manager.unregister('plugin', 'owner', 'connector');
			manager.register(service); // Public late-registration path must drain the original stop.
			const replacementStart = manager.onApplicationBootstrap();
			expect(service.getState()).toBe('started');
			expect(admissions[0].isCurrent()).toBe(false);
			finishStop();
			const originalStopped = await originalStop;
			await replacementStart;
			expect(stop).toHaveBeenCalledTimes(1);
			expect(admissions).toHaveLength(2);
			expect(admissions[1].isCurrent()).toBe(true);
			expect(originalStopped).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 1, lastStoppedAt: undefined, lastError: undefined }),
			);
		});

		it.each(['disabled', 'unregistered'])(
			'does not restart a replacement %s while its old stop drains',
			async (change) => {
				const service = createMockService('plugin', 'owner', 'connector');
				const start = jest.spyOn(service, 'start');
				let finishStop!: () => void;
				const stopped = new Promise<void>((resolve) => {
					finishStop = resolve;
				});
				jest.spyOn(service, 'stop').mockImplementation(async () => {
					await stopped;
					service._state = 'stopped';
				});
				registerWithoutStarting(service);
				await manager.startServiceManually('plugin', 'owner', 'connector');
				const originalStop = manager.stopServiceManually('plugin', 'owner', 'connector');
				manager.unregister('plugin', 'owner', 'connector');
				manager.register(service);
				const replacementStart = manager.onApplicationBootstrap();
				if (change === 'disabled') configService.getPluginConfig.mockReturnValue({ enabled: false });
				else manager.unregister('plugin', 'owner', 'connector');
				finishStop();
				await originalStop;
				await replacementStart;
				expect(start).toHaveBeenCalledTimes(1);
				expect(service.getState()).toBe('stopped');
			},
		);

		it.each(['pending', 'persisted'])('retires the old %s notification after successful replacement', async (phase) => {
			const active = new Map<string, string>();
			let finishWrite!: () => void;
			let enteredWrite!: () => void;
			const writing = new Promise<void>((resolve) => {
				enteredWrite = resolve;
			});
			const write = new Promise<void>((resolve) => {
				finishWrite = resolve;
			});
			notifications.notify.mockImplementation(async (input: { key: string; message: string }) => {
				enteredWrite();
				if (phase === 'pending') await write;
				active.set(input.key, input.message);
			});
			notifications.resolve.mockImplementation((_: string, key: string) => Promise.resolve(active.delete(key)));
			const original = createMockService('plugin', 'owner', 'connector');
			jest.spyOn(original, 'start').mockRejectedValue(new Error('old failure'));
			registerWithoutStarting(original);
			const originalStart = manager.startServiceManually('plugin', 'owner', 'connector');
			await writing;
			if (phase === 'persisted') await originalStart;
			manager.unregister('plugin', 'owner', 'connector');
			const replacement = createMockService('plugin', 'owner', 'connector');
			let admission: ManagedRuntimeAdmission | null = null;
			let enteredStart!: () => void;
			const starting = new Promise<void>((resolve) => {
				enteredStart = resolve;
			});
			jest.spyOn(replacement, 'start').mockImplementation(() => {
				admission = manager.captureCurrentStartAdmission(replacement);
				replacement._state = 'started';
				enteredStart();
				return Promise.resolve();
			});
			registerWithoutStarting(replacement);
			const replacementStart = manager.startServiceManually('plugin', 'owner', 'connector');
			await starting;
			expect(admission?.isCurrent()).toBe(true);
			finishWrite();
			await originalStart;
			await expect(replacementStart).resolves.toBe(true);
			expect(active.size).toBe(0);
			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(admission?.isCurrent()).toBe(true);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'started', startCount: 1, lastError: undefined }),
			);
		});

		it('retires the old write before publishing a newer legitimate replacement failure', async () => {
			const active = new Map<string, string>();
			const order: string[] = [];
			let finishWrite!: () => void;
			let enteredWrite!: () => void;
			let finishCleanup!: () => void;
			let enteredCleanup!: () => void;
			const writing = new Promise<void>((resolve) => {
				enteredWrite = resolve;
			});
			const write = new Promise<void>((resolve) => {
				finishWrite = resolve;
			});
			const cleaning = new Promise<void>((resolve) => {
				enteredCleanup = resolve;
			});
			const cleanup = new Promise<void>((resolve) => {
				finishCleanup = resolve;
			});
			notifications.notify.mockImplementation(async (input: { key: string; message: string }) => {
				if (input.message === 'old failure') {
					enteredWrite();
					await write;
				}
				active.set(input.key, input.message);
				order.push(input.message);
			});
			notifications.resolve.mockImplementation(async (_: string, key: string) => {
				enteredCleanup();
				await cleanup;
				order.push('resolve old');
				return active.delete(key);
			});
			const original = createMockService('plugin', 'owner', 'connector');
			jest.spyOn(original, 'start').mockRejectedValue(new Error('old failure'));
			registerWithoutStarting(original);
			const originalStart = manager.startServiceManually('plugin', 'owner', 'connector');
			await writing;
			manager.unregister('plugin', 'owner', 'connector');
			const replacement = createMockService('plugin', 'owner', 'connector');
			let admission: ManagedRuntimeAdmission | null = null;
			let enteredStart!: () => void;
			const starting = new Promise<void>((resolve) => {
				enteredStart = resolve;
			});
			jest.spyOn(replacement, 'start').mockImplementation(() => {
				admission = manager.captureCurrentStartAdmission(replacement);
				replacement._state = 'error';
				enteredStart();
				return Promise.reject(new Error('replacement failure'));
			});
			registerWithoutStarting(replacement);
			const replacementStart = manager.startServiceManually('plugin', 'owner', 'connector');
			await starting;
			finishWrite();
			await cleaning;
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			finishCleanup();
			await originalStart;
			await expect(replacementStart).resolves.toBe(false);
			expect(order).toEqual(['old failure', 'resolve old', 'replacement failure']);
			expect(active.get('service:plugin:owner:connector')).toBe('replacement failure');
			expect(admission?.isCurrent()).toBe(false);
			await expect(manager.getServiceStatus('plugin', 'owner', 'connector')).resolves.toEqual(
				expect.objectContaining({ state: 'error', startCount: 0, lastError: 'replacement failure' }),
			);
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

		it.each(['fulfill', 'reject'] as const)(
			'continues config synchronization after a held stop times out, then handles its late %s',
			async (settlement) => {
				const service = createMockService('plugin', 'held-owner', 'connector');
				const later = createMockService('plugin', 'later-owner', 'connector');
				const admissions: ManagedRuntimeAdmission[] = [];
				const start = jest.spyOn(service, 'start').mockImplementation(async () => {
					admissions.push(manager.captureCurrentStartAdmission(service));
					service._state = 'started';
				});
				const changed = jest.fn().mockResolvedValue(undefined);
				later.onConfigChanged = changed;
				(manager as unknown as { startupComplete: boolean }).startupComplete = false;
				manager.register(service);
				manager.register(later);
				await manager.onApplicationBootstrap();
				let finishStop!: () => void;
				let enterStop!: () => void;
				const entered = new Promise<void>((resolve) => {
					enterStop = resolve;
				});
				const held = new Promise<void>((resolve, reject) => {
					finishStop = () => {
						service._state = settlement === 'fulfill' ? 'stopped' : 'error';
						if (settlement === 'fulfill') resolve();
						else reject(new Error('late stop failure'));
					};
				});
				const stop = jest.spyOn(service, 'stop').mockImplementationOnce(() => {
					service._state = 'stopping';
					enterStop();
					return held;
				});
				configService.getPluginConfig.mockImplementation((owner: string) => ({ enabled: owner !== 'held-owner' }));
				const first = manager.handleConfigUpdated({ source: 'held-owner', type: 'plugin' });
				await entered;
				let completed = false;
				const second = manager.handleConfigUpdated().then(() => {
					completed = true;
				});
				let replacement: Promise<boolean> | undefined;
				let replacementCompleted = false;
				try {
					await jest.advanceTimersByTimeAsync(10_050);
					expect(completed).toBe(false);
					expect(changed).not.toHaveBeenCalled();
					await jest.advanceTimersByTimeAsync(10_000);
					expect(completed).toBe(true);
					expect(changed).toHaveBeenCalledTimes(1);
					expect(stop).toHaveBeenCalledTimes(1);
					expect(service.getState()).toBe('stopping');
					expect(admissions[0].isCurrent()).toBe(false);
					await expect(manager.getServiceStatus('plugin', 'held-owner', 'connector')).resolves.toEqual(
						expect.objectContaining({ state: 'stopping', startCount: 1, lastStoppedAt: undefined }),
					);
					expect(jest.getTimerCount()).toBe(0);

					if (settlement === 'fulfill') {
						manager.unregister('plugin', 'held-owner', 'connector');
						manager.register(service);
						configService.getPluginConfig.mockReturnValue({ enabled: true });
						replacement = manager.startServiceManually('plugin', 'held-owner', 'connector').then((result) => {
							replacementCompleted = true;
							return result;
						});
						await jest.advanceTimersByTimeAsync(30_000);
						expect(replacementCompleted).toBe(false);
						expect(start).toHaveBeenCalledTimes(1);
						expect(stop).toHaveBeenCalledTimes(1);
						expect(admissions[0].isCurrent()).toBe(false);
					}
				} finally {
					// Also settle the old implementation after an assertion failure: no hanging test hooks.
					finishStop();
					await first;
					await second;
					if (replacement !== undefined) await replacement;
				}
				if (replacement !== undefined) await expect(replacement).resolves.toBe(true);
				if (settlement === 'reject') {
					await expect(manager.getServiceStatus('plugin', 'held-owner', 'connector')).resolves.toEqual(
						expect.objectContaining({ state: 'error', lastError: 'late stop failure', startCount: 1 }),
					);
					configService.getPluginConfig.mockReturnValue({ enabled: true });
					await manager.startServiceManually('plugin', 'held-owner', 'connector');
				}
				expect(start).toHaveBeenCalledTimes(2);
				expect(stop).toHaveBeenCalledTimes(1);
				expect(admissions[0].isCurrent()).toBe(false);
				expect(admissions[1].isCurrent()).toBe(true);
				expect(service.getState()).toBe('started');
				expect(jest.getTimerCount()).toBe(0);
			},
		);

		it('bounds a newly invoked forced config stop without discarding its pending lifecycle', async () => {
			const service = createMockService('plugin', 'held-owner', 'connector', 'starting');
			const later = createMockService('plugin', 'later-owner', 'connector', 'started');
			const changed = jest.fn().mockResolvedValue(undefined);
			later.onConfigChanged = changed;
			configService.getPluginConfig.mockImplementation((owner: string) => ({ enabled: owner !== 'held-owner' }));
			manager.register(service);
			manager.register(later);
			let finishStop!: () => void;
			const held = new Promise<void>((resolve) => {
				finishStop = resolve;
			});
			const stop = jest.spyOn(service, 'stop').mockImplementationOnce(async () => {
				service._state = 'stopping';
				await held;
				service._state = 'stopped';
			});
			let completed = false;
			const sync = manager.handleConfigUpdated().then(() => {
				completed = true;
			});
			try {
				await jest.advanceTimersByTimeAsync(10_050);
				expect(stop).toHaveBeenCalledTimes(1);
				expect(completed).toBe(false);
				await jest.advanceTimersByTimeAsync(10_000);
				expect(completed).toBe(true);
				expect(changed).toHaveBeenCalledTimes(1);
				expect(service.getState()).toBe('stopping');
				expect(jest.getTimerCount()).toBe(0);
			} finally {
				finishStop();
				await sync;
				await manager.stopServiceManually('plugin', 'held-owner', 'connector');
			}
			expect(stop).toHaveBeenCalledTimes(1);
			expect(service.getState()).toBe('stopped');
			expect(jest.getTimerCount()).toBe(0);
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
