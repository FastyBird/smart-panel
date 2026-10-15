import { copyFileSync, cpSync, existsSync, readdirSync, rmSync } from 'fs';
import { DataSource } from 'typeorm';

import { DiscoveredBackendExtension } from '@fastybird/smart-panel-extension-sdk';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { VirtualNumericOperatorHostService } from '../../../plugins/devices-virtual/services/virtual-numeric-operator-host.service';
import { VirtualNumericOperatorRegistry } from '../../../plugins/devices-virtual/services/virtual-numeric-operator.registry';
import { EventType as ConfigEvent } from '../../config/config.constants';
import { PluginsTypeMapperService } from '../../config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../extensions/services/managed-service-manager.service';

import { BackupContributionRegistry } from './backup-contribution-registry.service';
import { BackupArchiveError, BackupService, PreparedRestore } from './backup.service';

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
	readdirSync: jest.fn(),
	copyFileSync: jest.fn(),
	cpSync: jest.fn(),
	mkdirSync: jest.fn(),
	rmSync: jest.fn(),
}));
jest.mock('child_process', () => ({
	...jest.requireActual<typeof import('child_process')>('child_process'),
	execFile: jest.fn((...args: unknown[]) => {
		const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
		callback(null, '', '');
	}),
}));

class FixtureConfig {}
class FixtureConfigDto {}
const descriptor: DiscoveredBackendExtension = {
	pkgName: '@fixture/restore',
	backendExports: [FixtureConfig, FixtureConfigDto],
	configOwnerType: 'restore-owner',
	kind: 'plugin',
	packageDir: '/fixture',
	routePrefix: 'restore',
	extensionClass: class Fixture {},
	numericOperators: [
		{
			contractVersion: 1,
			name: 'identity',
			operatorVersion: 1,
			input: { quantity: 'temperature', unit: '°C' },
			output: { quantity: 'temperature', unit: '°C' },
			inputRange: { minimum: 0, maximum: 100 },
			outputRange: { minimum: 0, maximum: 100 },
			parameters: {},
			evaluate: (n) => n,
		},
	],
};

const prepared = (lazy: boolean): PreparedRestore => ({
	workingArchive: '/restore/archive.tar.gz',
	tempDir: '/restore',
	metadata: {
		id: 'de710c62-6acc-4600-a4ca-a5ae18df9846',
		name: 'Restore fixture',
		version: '1',
		createdAt: '2026-10-15T10:00:00Z',
		sizeBytes: 100,
		contributions: [
			{ source: 'config', label: 'config', type: 'file' },
			...(lazy ? [{ source: 'buddy', label: 'personality', type: 'directory' as const }] : []),
		],
	},
});

describe('BackupService restore config reload boundary', () => {
	let events: EventEmitter2;
	let contributions: BackupContributionRegistry;
	let registry: VirtualNumericOperatorRegistry;
	let host: VirtualNumericOperatorHostService;
	let manager: ManagedServiceManagerService;
	let service: BackupService;
	let diskEnabled: boolean;
	let cachedEnabled: boolean;
	let destroy: jest.Mock;
	let order: string[];
	let lazyPath: jest.Mock;
	beforeEach(async () => {
		jest.clearAllMocks();
		jest.mocked(existsSync).mockReturnValue(true);
		jest.mocked(readdirSync).mockReturnValue(['entry'] as never);
		diskEnabled = cachedEnabled = true;
		order = [];
		jest.mocked(copyFileSync).mockImplementation((_source, target) => {
			if (target === '/live/config.json') {
				diskEnabled = false;
				order.push('static');
			}
		});
		jest.mocked(cpSync).mockImplementation(() => {
			order.push('lazy');
		});
		events = new EventEmitter2();
		contributions = new BackupContributionRegistry();
		contributions.register({
			source: 'config',
			label: 'config',
			type: 'file',
			path: '/live/config.json',
			optional: false,
		});
		lazyPath = jest.fn(() => {
			expect(cachedEnabled).toBe(false);
			return '/live/restored/personality';
		});
		// A valid backup may omit this optional contribution entirely.
		contributions.register({
			source: 'buddy',
			label: 'personality',
			type: 'directory',
			path: lazyPath,
			optional: true,
		});
		registry = new VirtualNumericOperatorRegistry();
		manager = new ManagedServiceManagerService(
			{ getPluginConfig: () => ({ enabled: cachedEnabled }) } as never,
			new NestConfigService(),
			{ hasValidator: () => false } as never,
			{ resolve: () => Promise.resolve(undefined) } as never,
		);
		await manager.onApplicationBootstrap();
		const mapper = new PluginsTypeMapperService();
		mapper.registerMapping({ type: 'restore-owner', class: FixtureConfig, configDto: FixtureConfigDto } as never);
		const modules = { getMappings: () => [] };
		const metadata = new ExtensionsService({} as never, modules as never, mapper, {} as never);
		metadata.registerPluginMetadata({ type: 'restore-owner', name: 'Restore', packageName: '@fixture/restore' });
		host = new VirtualNumericOperatorHostService(registry, manager, modules as never, mapper, metadata, events, [
			descriptor,
		]);
		host.onModuleInit();
		host.onApplicationBootstrap();
		await Promise.resolve();
		destroy = jest.fn().mockResolvedValue(undefined);
		service = new BackupService(new NestConfigService(), contributions, events, {
			isInitialized: true,
			destroy,
		} as unknown as DataSource);
	});
	afterEach(async () => {
		host.onModuleDestroy();
		await manager.onModuleDestroy();
		jest.restoreAllMocks();
	});

	it.each([false, true])(
		'reloads exactly once after static restore with lazy contribution present=%s',
		async (lazy) => {
			const scope = registry.capture('@fixture/restore:identity', 1);
			expect(scope?.isCurrent()).toBe(true);
			const reload = jest.fn(() => {
				cachedEnabled = diskEnabled;
				order.push('reload');
				expect(scope.isCurrent()).toBe(false);
				expect(registry.capture('@fixture/restore:identity', 1)).toBeNull();
			});
			events.on(ConfigEvent.CONFIG_RELOAD, reload);
			let release: () => void, entered: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const started = new Promise<void>((resolve) => {
				entered = resolve;
			});
			destroy.mockImplementation(async () => {
				order.push('database');
				entered();
				await gate;
			});
			const restoring = service.restore(prepared(lazy));
			await started;
			expect(reload).toHaveBeenCalledTimes(1);
			expect(order).toEqual(['static', 'reload', ...(lazy ? ['lazy'] : []), 'database']);
			expect(lazyPath).toHaveBeenCalledTimes(lazy ? 1 : 0);
			expect(cachedEnabled).toBe(false);
			expect(scope.isCurrent()).toBe(false);
			release();
			await restoring;
			expect(reload).toHaveBeenCalledTimes(1);
			expect(rmSync).toHaveBeenCalledWith('/restore', { recursive: true, force: true });
			expect(registry.capture('@fixture/restore:identity', 1)).toBeNull();
			// The controller's later restart cannot make a restored disabled owner active.
			await manager.restartService('plugin', 'restore-owner', 'numeric-operators');
			expect(registry.capture('@fixture/restore:identity', 1)).toBeNull();
		},
	);

	it.each(['missing-static', 'static-copy'])(
		'retains %s failure cleanup and point-of-no-return behavior',
		async (failure) => {
			const reload = jest.fn();
			events.on(ConfigEvent.CONFIG_RELOAD, reload);
			const exitError = new Error('process exit intercepted');
			const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
				throw exitError;
			});
			if (failure === 'missing-static') {
				jest.mocked(existsSync).mockImplementation((path) => path !== '/restore/contributions/config/config');
				await expect(service.restore(prepared(false))).rejects.toBeInstanceOf(BackupArchiveError);
				expect(exit).not.toHaveBeenCalled();
			} else {
				jest.mocked(copyFileSync).mockImplementationOnce(() => {
					throw new Error('copy failed');
				});
				await expect(service.restore(prepared(false))).rejects.toBe(exitError);
				expect(exit).toHaveBeenCalledWith(1);
			}
			expect(reload).not.toHaveBeenCalled();
			expect(destroy).not.toHaveBeenCalled();
			expect(rmSync).toHaveBeenCalledWith('/restore', { recursive: true, force: true });
		},
	);
});
