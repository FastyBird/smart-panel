import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelPropertyEntity } from '../../src/modules/devices/entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../../src/modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../src/modules/devices/services/channels.properties.service';
import { DeviceStructureLockService } from '../../src/modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../src/modules/devices/services/platform.registry.service';
import { PropertyCommandWindowService } from '../../src/modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../src/modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../src/modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../src/modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../src/modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../src/modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../src/modules/devices/services/property-value.service';
import { StorageService } from '../../src/modules/storage/services/storage.service';
import { DelegatesManagerService } from '../../src/plugins/devices-shelly-ng/delegates/delegates-manager.service';
import { UpdateShellyNgChannelPropertyDto } from '../../src/plugins/devices-shelly-ng/dto/update-channel-property.dto';
import {
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../src/plugins/devices-shelly-ng/platforms/shelly-ng.device.platform';
import * as http from '../../src/plugins/devices-shelly-ng/services/guarded-shelly-http';
import { GuardedShellyRpcHandler } from '../../src/plugins/devices-shelly-ng/services/guarded-shelly-rpc';
import { ShellyGuardRpcSession } from '../../src/plugins/devices-shelly-ng/services/shelly-guard-rpc-session';
import { VirtualThermostatActuatorClaimEntity } from '../../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { ThermostatInstalledQualification } from '../../src/plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatTransportService } from '../../src/plugins/devices-virtual/services/virtual-thermostat-transport.service';

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
) {
	const tick = useThermostatPacketClock();
	const sources = new PropertyValueSourceRegistryService();
	const values = new PropertyValueService(
		{
			isConnected: () => true,
			enqueueWritePoint: () => Promise.resolve(undefined),
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
	const delegates = new Map();
	const identifiers = new Map();
	const deviceIds = new Map();
	const code = 'offline test script: no hardware qualification';
	const controls = {
		beforeFence: null as ((property: string) => Promise<void>) | null,
		beforeOn: null as ((property: string) => Promise<void>) | null,
		afterOn: null as ((property: string) => Promise<void>) | null,
		sends: [] as { property: string; on: boolean }[],
		fences: [] as string[],
		errors: [] as unknown[],
	};
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
		const rpc = {
			connected: true,
			hostname,
			withSendGuard: (guard: () => boolean, send: () => unknown) =>
				guard() ? send() : Promise.reject(new Error('revoked')),
			request: (method: string) =>
				Promise.resolve(
					method === 'Shelly.GetDeviceInfo'
						? { id: profile.deviceId, model: profile.model, fw_id: profile.firmware, mac: device.canonicalMac }
						: { data: code, left: 0 },
				),
		} as unknown as GuardedShellyRpcHandler;
		delegates.set(device.id, {
			guardedTransportActive: true,
			prepareGuardRpcSession: (_component: number, installed: typeof profile, current: () => boolean) =>
				new ShellyGuardRpcSession(rpc, 0, installed, current),
		});
		identifiers.set(device.identifier, new Set([device.id]));
		deviceIds.set(device.id, device.id);
	}
	const manager = Object.assign(Object.create(DelegatesManagerService.prototype) as object, {
		channelsPropertiesService: reports,
		delegates,
		identifierToDelegates: identifiers,
		delegateDeviceIds: deviceIds,
		sampleGenerations: new Map(),
	}) as unknown as DelegatesManagerService;
	const admit = DelegatesManagerService.prototype.admitGuardFenceSample.bind(
		manager,
	) as DelegatesManagerService['admitGuardFenceSample'];
	jest.spyOn(manager, 'admitGuardFenceSample').mockImplementation(async (...args) => {
		try {
			await admit(...args);
		} catch (error) {
			controls.errors.push(error);
			throw error;
		}
	});
	const telemetry = new Set<Promise<void>>();
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
		flushTelemetry: () => Promise.all([...telemetry]),
		report,
		controls,
		reports,
		transport: new VirtualThermostatTransportService(
			{ get: () => new ShellyNgDevicePlatform(manager) } as unknown as PlatformRegistryService,
			values,
		),
	};
}
