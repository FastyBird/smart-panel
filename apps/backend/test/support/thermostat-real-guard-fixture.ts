import { createHash } from 'node:crypto';
import { Device, DeviceDiscoverer, WiFi } from 'shellies-ds9';
import { DataSource } from 'typeorm';
import WebSocket from 'ws';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { ConfigService } from '../../src/modules/config/services/config.service';
import { PluginConfigValidatorService } from '../../src/modules/config/services/plugin-config-validator.service';
import { ChannelPropertyEntity } from '../../src/modules/devices/entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../../src/modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../src/modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../src/modules/devices/services/device-connectivity.service';
import { DeviceStructureLockService } from '../../src/modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../src/modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../src/modules/devices/services/platform.registry.service';
import { PropertyCommandWindowService } from '../../src/modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../src/modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../src/modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../src/modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../src/modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../src/modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../src/modules/devices/services/property-value.service';
import { ManagedServiceManagerService } from '../../src/modules/extensions/services/managed-service-manager.service';
import { NotificationsService } from '../../src/modules/notifications/services/notifications.service';
import { StorageService } from '../../src/modules/storage/services/storage.service';
import { DelegatesManagerService } from '../../src/plugins/devices-shelly-ng/delegates/delegates-manager.service';
import { ShellyDeviceDelegate } from '../../src/plugins/devices-shelly-ng/delegates/shelly-device.delegate';
import { UpdateShellyNgChannelPropertyDto } from '../../src/plugins/devices-shelly-ng/dto/update-channel-property.dto';
import {
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { PropertyMappingStorageService, TransformerRegistry } from '../../src/plugins/devices-shelly-ng/mappings';
import { ShellyNgDevicePlatform } from '../../src/plugins/devices-shelly-ng/platforms/shelly-ng.device.platform';
import { DatabaseDiscovererService } from '../../src/plugins/devices-shelly-ng/services/database-discoverer.service';
import { DeviceAddressService } from '../../src/plugins/devices-shelly-ng/services/device-address.service';
import { DeviceManagerService } from '../../src/plugins/devices-shelly-ng/services/device-manager.service';
import * as http from '../../src/plugins/devices-shelly-ng/services/guarded-shelly-http';
import { GuardedShellyRpcHandler } from '../../src/plugins/devices-shelly-ng/services/guarded-shelly-rpc';
import { PollPlacementDiagnosticsService } from '../../src/plugins/devices-shelly-ng/services/poll-placement-diagnostics.service';
import { ShellyNgService } from '../../src/plugins/devices-shelly-ng/services/shelly-ng.service';
import { ShellyWsServerService } from '../../src/plugins/devices-shelly-ng/services/shelly-ws-server.service';
import { VirtualThermostatActuatorClaimEntity } from '../../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { ThermostatInstalledQualification } from '../../src/plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatTransportService } from '../../src/plugins/devices-virtual/services/virtual-thermostat-transport.service';

const activeFixtureCleanups = new Set<() => Promise<void>>();

/** Join test-owned managed lifecycles before the runtime suite tears down SQLite. */
export async function disposeRealThermostatGuardFixtures(): Promise<void> {
	for (const dispose of [...activeFixtureCleanups]) await dispose();
}

/** Keep packet age independent of SQLite/host latency, while retaining real asynchronous scheduling. */
export function useThermostatPacketClock(): () => void {
	// Logical receiver time advances only with simulated packets; SQLite/SDK scheduling remains real.
	jest.useFakeTimers({
		doNotFake: [
			'setTimeout',
			'clearTimeout',
			'setInterval',
			'clearInterval',
			'setImmediate',
			'clearImmediate',
			'nextTick',
			'queueMicrotask',
			'performance',
			'hrtime',
		],
	});
	return () => jest.setSystemTime(Date.now() + 1);
}

/** Real guard session/adapter/platform/delegate/sample/event chain; only SDK/HTTP and storage I/O are simulated. */
export async function realThermostatGuardFixture(
	db: DataSource,
	events: EventEmitter2,
	producers: PropertyProducerRegistryService,
	qualifications: Map<string, ThermostatInstalledQualification>,
	mode: 'managed' | 'closed' | 'unmanaged' = 'managed',
) {
	const tick = useThermostatPacketClock();
	const sources = new PropertyValueSourceRegistryService();
	const values = new PropertyValueService(
		{
			isConnected: () => true,
			enqueueWritePoint: () => Promise.resolve(undefined),
			flushQueuedWrites: () => Promise.resolve(),
			queryStrict: () => Promise.resolve([]),
		} as unknown as StorageService,
		sources,
		new PropertyValueLockService({} as never),
		producers,
		events,
	);
	const properties = new Map(
		(await db.manager.find(ChannelPropertyEntity, { relations: ['channel', 'channel.device'] })).map((property) => [
			property.id,
			property,
		]),
	);
	const reports = new ChannelsPropertiesService(
		{} as never,
		{
			getMapping: () => ({
				type: 'devices-shelly-ng',
				class: ShellyNgChannelPropertyEntity,
				updateDto: UpdateShellyNgChannelPropertyDto,
			}),
		} as unknown as ChannelsPropertiesTypeMapperService,
		values,
		sources,
		new DeviceStructureLockService(),
		new PropertyStateCoordinatorService(),
		new PropertyCommandWindowService(),
		db,
		events,
		undefined,
		{ findOne: (id: string) => Promise.resolve(properties.get(id)) } as unknown as PropertyMetadataService,
	);
	const report = async (id: string, value: number | boolean) => {
		tick();
		const now = new Date();
		await values.writeSampleWithState(properties.get(id), value, {
			sampledAt: now,
			receivedAt: now,
			provenance: 'live',
			sourceIsCurrent: () => true,
		});
	};
	const claims = await db.manager.find(VirtualThermostatActuatorClaimEntity);
	const members = new Map<
		string,
		{ property: string; epoch: number; output: boolean; profile: ThermostatInstalledQualification['profile'] }
	>();
	const sdkDevices: Device[] = [];
	const rpcs: GuardedShellyRpcHandler[] = [];
	const delegates: ShellyDeviceDelegate[] = [];
	const targets = new Map<
		string,
		{ device: ShellyNgDeviceEntity; profile: ThermostatInstalledQualification['profile'] }
	>();
	const code = 'offline test script: no hardware qualification';
	const controls = {
		beforeFence: null as ((property: string) => Promise<void>) | null,
		beforeOn: null as ((property: string) => Promise<void>) | null,
		afterOn: null as ((property: string) => Promise<void>) | null,
		sends: [] as { property: string; on: boolean }[],
		fences: [] as string[],
		errors: [] as unknown[],
	};
	class EmptyDiscoverer extends DeviceDiscoverer {
		run(): Promise<void> {
			return Promise.resolve();
		}
	}
	const module = await Test.createTestingModule({
		providers: [
			ManagedServiceManagerService,
			ShellyNgService,
			DelegatesManagerService,
			PlatformRegistryService,
			PollPlacementDiagnosticsService,
			{ provide: ChannelsPropertiesService, useValue: reports },
			{
				provide: ChannelsService,
				useValue: { findAll: () => Promise.resolve([]), findOneBy: () => Promise.resolve(null) },
			},
			{
				provide: DevicesService,
				useValue: {
					findAll: () => Promise.resolve([]),
					findOne: (id: string) => db.manager.findOneBy(ShellyNgDeviceEntity, { id }),
					findOneBy: (field: string, value: string) => {
						if (field !== 'identifier') throw new Error('Unexpected offline device lookup');
						return db.manager.findOneBy(ShellyNgDeviceEntity, { identifier: value });
					},
				},
			},
			{ provide: DeviceManagerService, useValue: { createOrUpdate: () => Promise.resolve() } },
			{ provide: DeviceConnectivityService, useValue: { setConnectionState: () => Promise.resolve() } },
			{ provide: DeviceAddressService, useValue: { syncAddresses: () => Promise.resolve() } },
			{ provide: PropertyMappingStorageService, useValue: { get: () => null } },
			{ provide: TransformerRegistry, useValue: { get: () => null } },
			{ provide: DatabaseDiscovererService, useValue: new EmptyDiscoverer() },
			{ provide: ShellyWsServerService, useValue: { start: () => {}, stop: () => {}, isRunning: () => false } },
			{
				provide: ConfigService,
				useValue: {
					getPluginConfig: () => ({
						enabled: true,
						statusPollInterval: 0,
						mdns: { enabled: false, interface: null },
						websockets: { requestTimeout: 1, pingInterval: 0, reconnectInterval: 0 },
					}),
				},
			},
			{ provide: NestConfigService, useValue: new NestConfigService({ FB_CLI: 'off' }) },
			{ provide: PluginConfigValidatorService, useValue: { hasValidator: () => false } },
			{
				provide: NotificationsService,
				useValue: { notify: () => Promise.resolve(null), resolve: () => Promise.resolve(false) },
			},
		],
	}).compile();
	expect(module.get(PollPlacementDiagnosticsService).isEnabled()).toBe(false);
	const manager = module.get(DelegatesManagerService);
	const lifecycleManager = module.get(ManagedServiceManagerService);
	const connector = module.get(ShellyNgService);
	const platforms = module.get(PlatformRegistryService);
	const platform = new ShellyNgDevicePlatform(manager);
	const registration = platforms.register(platform);
	if (!registration) throw new Error('Original offline platform registration required');
	const transport = new VirtualThermostatTransportService(platforms, values);
	lifecycleManager.register(connector);
	const startManaged = () =>
		lifecycleManager.startServiceManually(connector.owner.kind, connector.owner.type, connector.serviceId);
	const stopManaged = () =>
		lifecycleManager.stopServiceManually(connector.owner.kind, connector.owner.type, connector.serviceId);
	const telemetry = new Set<Promise<void>>();
	let disposing: Promise<void> | undefined;
	const dispose = (): Promise<void> => {
		if (disposing !== undefined) return disposing;
		connector.revokeCurrentAuthority();
		disposing = (async () => {
			let failure: { cause: unknown } | undefined;
			const attempt = async (operation: () => void | PromiseLike<void>) => {
				try {
					await operation();
				} catch (cause) {
					failure ??= { cause };
				}
			};
			await attempt(() => connector.stop());
			for (const pending of [...telemetry]) await attempt(() => pending);
			await attempt(() => manager.detach());
			for (const delegate of delegates) await attempt(() => delegate.destroy());
			for (const rpc of rpcs) await attempt(() => rpc.destroy());
			await attempt(() => reports.onModuleDestroy());
			await attempt(() => {
				lifecycleManager.unregister(connector.owner.kind, connector.owner.type, connector.serviceId);
			});
			await attempt(() => module.close());
			activeFixtureCleanups.delete(dispose);
			if (failure) throw failure.cause;
		})();
		return disposing;
	};
	activeFixtureCleanups.add(dispose);
	const insert = async () => {
		for (const sdk of sdkDevices) {
			const delegate = await manager.insert(sdk);
			expect(delegate).toBeInstanceOf(ShellyDeviceDelegate);
			delegates.push(delegate);
		}
	};
	try {
		if (mode === 'managed') expect(await startManaged()).toBe(true);
		else if (mode === 'unmanaged') await connector.start();
		for (const [index, claim] of claims.entries()) {
			const device = await db.manager.findOneByOrFail(ShellyNgDeviceEntity, { id: claim.sourceDeviceId });
			const hostname = `127.0.0.${index + 2}`;
			const profile: ThermostatInstalledQualification['profile'] = {
				deviceId: device.identifier,
				model: 'SNSW-001P16EU',
				firmware: 'fixture-only',
				componentId: 0,
				evidenceId: 'offline-only',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 30 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
				guardScript: {
					scriptId: 1,
					sourceHash: createHash('sha256').update(code).digest('hex'),
					endpointHostname: hostname,
					canonicalMac: device.canonicalMac,
					evidenceId: 'offline-only',
					protocol: 'sp-guard-candidate-1',
					writerIsolationEvidenceId: 'offline-only',
					commissioningBarrierEvidenceId: 'offline-only',
					endpointAuthenticationEvidenceId: 'offline-only',
					restartDrainEvidenceId: 'offline-only',
					localExecutionBoundsEvidenceId: 'offline-only',
				},
			};
			qualifications.set(claim.physicalIdentity, {
				physicalIdentity: claim.physicalIdentity,
				profile,
				upstreamWritersExcluded: true,
				opposedOutputsInterlocked: false,
			});
			members.set(hostname, { property: claim.sourcePropertyId, epoch: 1, output: false, profile });
			const OfflineSocket = jest.createMockFromModule<typeof WebSocket>('ws');
			class OfflineRpc extends GuardedShellyRpcHandler {
				private online = true;
				protected override createSocket(): WebSocket {
					const socket = new OfflineSocket('ws://synthetic.invalid');
					Object.defineProperty(socket, 'readyState', { value: WebSocket.OPEN });
					jest.spyOn(socket, 'send').mockImplementation((data, options, callback) => {
						if (typeof data !== 'string') throw new Error('Expected offline SDK frame');
						const frame: unknown = JSON.parse(data);
						if (
							!frame ||
							typeof frame !== 'object' ||
							!('id' in frame) ||
							typeof frame.id !== 'number' ||
							!('method' in frame) ||
							(frame.method !== 'Shelly.GetDeviceInfo' && frame.method !== 'Script.GetCode')
						)
							throw new Error('Unexpected offline SDK request');
						const id = frame.id;
						const result =
							frame.method === 'Shelly.GetDeviceInfo'
								? { id: profile.deviceId, model: profile.model, fw_id: profile.firmware, mac: device.canonicalMac }
								: { data: code, left: 0 };
						if (typeof options === 'function') (options as (error?: Error) => void)();
						else callback?.();
						queueMicrotask(() => this.client.receive({ jsonrpc: '2.0', id, result }));
					});
					return socket;
				}
				override get connected(): boolean {
					return this.online;
				}
				protected override connect(): Promise<void> {
					return Promise.resolve();
				}
				protected override disconnect(): Promise<void> {
					this.online = false;
					return Promise.resolve();
				}
			}
			const rpc = new OfflineRpc(hostname, {
				clientId: 'runtime-offline-test-only',
				requestTimeout: 1,
				pingInterval: 0,
				reconnectInterval: 0,
			});
			rpcs.push(rpc);
			const DeviceClass = Device.getClass('SNSW-001P16EU');
			if (!DeviceClass) throw new Error('Pinned SDK device class required');
			const sdk = new DeviceClass(
				{ id: device.identifier, mac: device.canonicalMac, model: profile.model, fw_id: profile.firmware },
				rpc,
			);
			const wifi = sdk.getComponent('wifi');
			if (!(wifi instanceof WiFi)) throw new Error('Original SDK WiFi component required');
			wifi.update({ sta_ip: hostname });
			sdkDevices.push(sdk);
			targets.set(claim.sourcePropertyId, { device, profile });
		}
		await insert();
		const admit = manager.admitGuardFenceSample.bind(manager) as DelegatesManagerService['admitGuardFenceSample'];
		jest.spyOn(manager, 'admitGuardFenceSample').mockImplementation(async (...args) => {
			try {
				await admit(...args);
			} catch (error) {
				controls.errors.push(error);
				throw error;
			}
		});
		const responses = new Set<() => void>();
		const matchedOnResponses = () =>
			new Promise<void>((resolve) => {
				const finish = () => {
					responses.delete(finish);
					clearTimeout(timeout);
					resolve();
				};
				const timeout = setTimeout(finish, 100);
				responses.add(finish);
				if (responses.size === members.size) for (const ready of [...responses]) ready();
			});
		jest.spyOn(http, 'guardedShellyHttp').mockImplementation(async (url, _deadline, guard, _request, onSend) => {
			tick();
			const member = members.get(url.hostname);
			const action = url.searchParams.get('action');
			if (action === 'fence') await controls.beforeFence?.(member.property);
			if (action === 'on') await controls.beforeOn?.(member.property);
			if (!guard()) throw new Error('revoked before simulated network send');
			onSend?.();
			if (action === 'status')
				return {
					protocol: 'sp-guard-candidate-1',
					deviceId: member.profile.deviceId,
					firmware: member.profile.firmware,
					componentId: 0,
					evidenceId: 'offline-only',
					epoch: member.epoch,
					nowMs: 1000,
					ready: true,
					busy: false,
					fault: null,
					floorSafe: true,
					output: member.output,
				} as never;
			if (action === 'on') {
				member.output = true;
				controls.sends.push({ property: member.property, on: true });
				await controls.afterOn?.(member.property);
				// Model independent matched replies before the SDK telemetry batch. Early/late replies remain fenced.
				await matchedOnResponses();
				// SDK telemetry is independent of the HTTP acceptance. Publish on the next event-loop turn,
				// after the matched guard response, while retaining the real core sample/event path.
				const feedback = new Promise<void>((resolve) =>
					setImmediate(() => {
						void report(member.property, true)
							.catch((error) => controls.errors.push(error))
							.finally(resolve);
					}),
				);
				telemetry.add(feedback);
				void feedback.finally(() => telemetry.delete(feedback));
				return { accepted: true, epoch: member.epoch, untilMs: Number(url.searchParams.get('untilMs')) } as never;
			}
			member.output = false;
			controls.fences.push(member.property);
			return {
				epoch: ++member.epoch,
				deviceId: member.profile.deviceId,
				componentId: 0,
				evidenceId: 'offline-only',
				output: false,
				localOnDrained: true,
			} as never;
		});
		return {
			values,
			dispose,
			flushTelemetry: () => Promise.all([...telemetry]),
			report,
			controls,
			reports,
			transport,
			platform,
			platforms,
			startManaged,
			stopManaged,
			insert,
			captureSession: (propertyId: string) => {
				const target = targets.get(propertyId);
				if (!target) throw new Error('Original offline target required');
				return manager.prepareGuardRpcSession(target.device, 0, target.profile);
			},
		};
	} catch (error) {
		try {
			await dispose();
		} catch (cleanupError) {
			controls.errors.push(cleanupError);
		}
		throw error;
	}
}
