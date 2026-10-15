import { DiscoveredBackendExtension, NumericOperatorDefinition } from '@fastybird/smart-panel-extension-sdk';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/config/config.constants';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';

import { VirtualNumericOperatorHostService } from './virtual-numeric-operator-host.service';
import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';

const definition: NumericOperatorDefinition = {
	contractVersion: 1,
	name: 'offset',
	operatorVersion: 1,
	input: { quantity: 'temperature', unit: '°C' },
	output: { quantity: 'temperature', unit: '°C' },
	inputRange: { minimum: 0, maximum: 100 },
	outputRange: { minimum: 0, maximum: 100 },
	parameters: {},
	evaluate: (n) => n,
};
class FixtureConfig {}
class FixtureConfigDto {}
const descriptor: DiscoveredBackendExtension = {
	pkgName: '@fixture/operator',
	backendExports: [FixtureConfig, FixtureConfigDto],
	configOwnerType: 'real-owner',
	numericOperators: [definition],
	kind: 'plugin',
	packageDir: '/fixture',
	routePrefix: 'unrelated-route',
	extensionClass: class Fixture {},
};

describe('discovered numeric operator managed lifecycle', () => {
	let enabled: boolean;
	let manager: ManagedServiceManagerService;
	let registry: VirtualNumericOperatorRegistry;
	let events: EventEmitter2;
	let host: VirtualNumericOperatorHostService;
	const createHost = (descriptors = [descriptor], validMetadata = true, validMapping = true) =>
		new VirtualNumericOperatorHostService(
			registry,
			manager,
			{ getMappings: () => [] } as never,
			{
				getMappings: () =>
					validMapping ? [{ type: 'real-owner', class: FixtureConfig, configDto: FixtureConfigDto }] : [],
			} as never,
			{
				hasOwnerMetadata: (kind: string, type: string, pkgName: string) =>
					validMetadata && kind === 'plugin' && type === 'real-owner' && pkgName === '@fixture/operator',
			} as never,
			events,
			descriptors,
		);
	beforeEach(async () => {
		enabled = true;
		registry = new VirtualNumericOperatorRegistry();
		events = new EventEmitter2();
		manager = new ManagedServiceManagerService(
			{ getPluginConfig: () => ({ enabled }) } as never,
			new NestConfigService(),
			{ hasValidator: () => false } as never,
			{ resolve: () => Promise.resolve(undefined) } as never,
		);
		await manager.onApplicationBootstrap();
	});
	afterEach(async () => {
		host?.onModuleDestroy();
		await manager.onModuleDestroy();
	});
	const current = () => registry.capture('@fixture/operator:offset', 1);
	it('revokes synchronously before async config synchronization, reactivates distinctly, and obeys manual stop/restart', async () => {
		host = createHost();
		host.onModuleInit();
		host.onApplicationBootstrap();
		await Promise.resolve();
		const old = current();
		expect(old?.isCurrent()).toBe(true);
		events.emit(EventType.CONFIG_UPDATED, { type: 'plugin', source: 'real-owner' });
		expect(old.isCurrent()).toBe(false);
		expect(current()).toBeNull();
		await manager.handleConfigUpdated({ type: 'plugin', source: 'real-owner' });
		expect(current()?.isCurrent()).toBe(true);
		enabled = false;
		events.emit(EventType.CONFIG_UPDATED, { type: 'plugin', source: 'real-owner' });
		expect(current()).toBeNull();
		await manager.handleConfigUpdated({ type: 'plugin', source: 'real-owner' });
		expect(current()).toBeNull();
		enabled = true;
		await manager.handleConfigUpdated({ type: 'plugin', source: 'real-owner' });
		expect(current()?.isCurrent()).toBe(true);
		await manager.stopServiceManually('plugin', 'real-owner', 'numeric-operators');
		expect(current()).toBeNull();
		await manager.startServiceManually('plugin', 'real-owner', 'numeric-operators');
		const previous = current();
		const restarting = manager.restartService('plugin', 'real-owner', 'numeric-operators');
		expect(previous.isCurrent()).toBe(false);
		await restarting;
		expect(current()?.isCurrent()).toBe(true);
		events.emit(EventType.CONFIG_RESET);
		expect(current()).toBeNull();
	});

	it('revokes all numeric authority before coordinated shutdown awaits another service', async () => {
		host = createHost();
		host.onModuleInit();
		host.onApplicationBootstrap();
		await Promise.resolve();
		const scope = current();
		expect(scope?.isCurrent()).toBe(true);
		let release: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let state: 'stopped' | 'started' = 'stopped';
		manager.register({
			owner: { kind: 'plugin', type: 'other' },
			serviceId: 'delayed-stop',
			getPriority: () => 999,
			getState: () => state,
			start: () => {
				state = 'started';
				return Promise.resolve();
			},
			stop: async () => {
				await gate;
				state = 'stopped';
			},
		});
		await Promise.resolve();
		const stopping = manager.onModuleDestroy();
		expect(scope.isCurrent()).toBe(false);
		release();
		await stopping;
	});
	it('does not accept an overwrite of a pre-existing owner even with self-declared matching package metadata', () => {
		const metadata = new ExtensionsService({} as never, {} as never, {} as never, {} as never);
		metadata.registerPluginMetadata({ type: 'existing-owner', name: 'Built-in' });
		metadata.registerPluginMetadata({ type: 'existing-owner', name: 'Spoofed', packageName: '@fixture/operator' });
		expect(metadata.hasOwnerMetadata('plugin', 'existing-owner', '@fixture/operator')).toBe(false);
	});
	it.each(['metadata', 'mapping', 'owner-collision', 'package-collision', 'spoofed-owner'])(
		'rejects %s without affecting unrelated extensions',
		async (mode) => {
			const descriptors =
				mode === 'owner-collision'
					? [descriptor, { ...descriptor, pkgName: '@fixture/other' }]
					: mode === 'package-collision'
						? [descriptor, { ...descriptor, configOwnerType: 'other-owner' }]
						: [descriptor];
			if (mode === 'spoofed-owner')
				descriptors[0] = { ...descriptor, backendExports: [class ArbitraryExistingConfig {}, FixtureConfigDto] };
			host = createHost(descriptors, mode !== 'metadata', mode !== 'mapping');
			host.onModuleInit();
			host.onApplicationBootstrap();
			await Promise.resolve();
			expect(current()).toBeNull();
		},
	);
});
