import { Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { runInNewContext } from 'node:vm';
import { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { ThermostatCoolingDependencyEntity } from '../../devices-virtual/entities/thermostat-cooling-dependency.entity';
import { VirtualThermostatCommandEntity } from '../../devices-virtual/entities/virtual-thermostat-runtime.entity';
import { VirtualThermostatActuatorClaimEntity } from '../../devices-virtual/entities/virtual-thermostat.entity';
import {
	CoolingBinding,
	ThermostatCoolingDependencyService,
} from '../../devices-virtual/services/thermostat-cooling-dependency.service';
import { ThermostatRemoteCoolingAdapter } from '../../devices-virtual/services/thermostat-remote-cooling-adapter';
import { VirtualDependencyGraphService } from '../../devices-virtual/services/virtual-dependency-graph.service';
import {
	ThermostatInstalledQualification,
	VirtualThermostatClaimsService,
} from '../../devices-virtual/services/virtual-thermostat-claims.service';
import { thermostatPropertyContract } from '../../devices-virtual/services/virtual-thermostat-contract.utils';
import { VirtualThermostatRuntimeService } from '../../devices-virtual/services/virtual-thermostat-runtime.service';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

import { AuthenticatedShellyScriptHttp, shellyScriptDigest } from './authenticated-shelly-script-http';
import { RemoteDewPointArtifactBinding, compileRemoteDewPointArtifact } from './remote-dew-point-artifact';
import { REMOTE_DEW_POINT_PROFILE, RemoteDewPointStatus } from './remote-dew-point-lease.contract';
import { REMOTE_DEW_POINT_PROTOCOL, RemoteDewPointDeadline } from './remote-dew-point-lease.contract';
import {
	RemoteDewPointInstallationEvidence,
	remoteDewPointInstallationBlockers,
} from './remote-dew-point-qualification';
import { RemoteDewPointSession } from './remote-dew-point-session';

const binding: RemoteDewPointArtifactBinding = {
	deviceId: 'shellyplus1pm-test',
	deviceHardwareId: 'AABBCCDDEEFF',
	endpointHostname: 'fixture.invalid',
	scriptId: 1,
	model: 'SNSW-001P16EU',
	firmware: '1.7.5',
	physicalActuator: 'shelly-ng:AABBCCDDEEFF:switch:0:output',
	switchId: 0,
	switchConfigurationJson: '{"id":0,"in_mode":"detached"}',
	controllerRevision: 3,
	protectionFingerprint: 'protection-policy-and-graph',
	remoteLineageFingerprint: 'two-input-current-lineage',
	formulaVersion: 'magnus-water-17.62-243.12-v1',
	marginC: 2,
	recoveryHysteresisC: 1,
	absoluteMinimumC: null,
	localSurface: {
		component: 'temperature:100',
		property: 'tC',
		peripheralFingerprint: 'actual-peripheral',
		calibrationFingerprint: 'actual-calibration',
		configurationJson: '{"id":100}',
		peripheralsJson: '{"temperature":{"temperature:100":{}}}',
		domain: { minimum: -40, maximum: 60 },
		maximumAgeMs: 1000,
	},
	timing: {
		transportMs: 100,
		statusMs: 100,
		clockMs: 100,
		driftMs: 100,
		dispatchMs: 100,
		minimumLifetimeMs: 100,
		maximumLeaseMs: 10000,
	},
	writerIsolationEvidenceId: 'installation-audit-required',
};

/** Real compiled component protocol under deterministic firmware RPC callbacks; never installed certification. */
function firmware(kvs = { value: { epoch: 10, reservedThrough: 0 }, revision: 1 }) {
	const artifact = compileRemoteDewPointArtifact(binding);
	let time = 1000,
		output = false,
		temperature = 20,
		auth = true,
		failStorage = false;
	const callbacks: { method: string; on?: boolean; run: () => void }[] = [],
		timers: (() => void)[] = [];
	let endpoint: (request: object, response: object) => void;
	let statusHandler: (event: object) => void;
	const switches: { on: boolean; toggle_after?: number }[] = [];
	runInNewContext(artifact.source, {
		Shelly: {
			getUptimeMs: () => time,
			getDeviceInfo: () => ({
				id: binding.deviceId,
				mac: binding.deviceHardwareId,
				model: binding.model,
				ver: binding.firmware,
				auth_en: auth,
			}),
			getComponentConfig: (component: string): unknown =>
				JSON.parse(
					component.startsWith('switch:') ? binding.switchConfigurationJson : binding.localSurface.configurationJson,
				),
			getComponentStatus: (component: string) => (component.startsWith('switch:') ? { output } : { tC: temperature }),
			addStatusHandler: (handler: typeof statusHandler) => {
				statusHandler = handler;
			},
			call: (
				method: string,
				params: { on?: boolean; value?: typeof kvs.value; toggle_after?: number; etag?: string },
				callback: (result: object, error?: number) => void,
			) => {
				callbacks.push({
					method,
					on: params.on,
					run: () => {
						if (method.startsWith('KVS.') && failStorage) {
							callback(null, 1);
							return;
						}
						if (method === 'KVS.Get') callback({ value: { ...kvs.value }, etag: String(kvs.revision) });
						if (method === 'KVS.Set') {
							if (params.etag !== String(kvs.revision)) {
								callback(null, 1);
								return;
							}
							kvs.value = { ...params.value };
							kvs.revision++;
							callback({ etag: String(kvs.revision) });
						}
						if (method === 'SensorAddon.GetPeripherals') {
							const peripherals: unknown = JSON.parse(binding.localSurface.peripheralsJson);
							if (!peripherals || typeof peripherals !== 'object') throw new Error('Invalid fixture peripherals');
							callback(peripherals);
						}
						if (method === 'Switch.GetStatus') callback({ output });
						if (method === 'Switch.Set') {
							const wasOn = output;
							output = params.on;
							switches.push({ on: params.on, toggle_after: params.toggle_after });
							callback({ was_on: wasOn });
						}
					},
				});
			},
		},
		HTTPServer: {
			registerEndpoint: (_name: string, handler: typeof endpoint) => {
				endpoint = handler;
			},
		},
		Timer: {
			set: (_ms: number, _repeat: boolean, callback: () => void) => {
				timers.push(callback);
			},
		},
	});
	const drain = () => {
		let n = 0;
		while (callbacks.length) {
			if (++n > 100) throw new Error('RPC loop');
			callbacks.shift().run();
		}
	};
	const request = (method: string, payload?: object) => {
		const result = { code: 0, headers: [], body: '', send: () => undefined };
		endpoint({ method, body: payload ? JSON.stringify(payload) : '' }, result);
		return { response: result, data: () => JSON.parse(result.body) as Record<string, unknown> };
	};
	const packet = (sequence = 1, extra = {}) => ({
		protocol: REMOTE_DEW_POINT_PROTOCOL,
		artifact: artifact.artifactId,
		epoch: kvs.value.epoch,
		sequence,
		requestId: `request-${sequence}`,
		controllerRevision: 3,
		protectionFingerprint: binding.protectionFingerprint,
		action: 'on',
		thresholdC: 12,
		untilDeviceUptimeMs: time + 5000,
		...extra,
	});
	const sample = (value = 20) => {
		temperature = value;
		statusHandler({ component: 'temperature:100', delta: { tC: value } });
	};
	return {
		runRpc: (method: string, on?: boolean) => {
			const index = callbacks.findIndex((c) => c.method === method && (on === undefined || c.on === on));
			if (index < 0) throw new Error(`No queued ${method}/${on}`);
			callbacks.splice(index, 1)[0].run();
		},
		kvs,
		artifact,
		drain,
		request,
		packet,
		sample,
		switches,
		tick: (ms: number) => {
			time += ms;
			timers.forEach((t) => t());
		},
		auth: (enabled: boolean) => {
			auth = enabled;
		},
		storageFailure: () => {
			failStorage = true;
		},
		get output() {
			return output;
		},
	};
}

describe('remote dew point replay, finite expiry and firmware protocol', () => {
	it('durably rotates epoch and reserves a compact block before accepting ON; exact duplicate does not reapply', () => {
		const f = firmware();
		expect(f.request('GET').data().ready).toBe(false);
		f.drain();
		f.sample();
		expect(f.kvs.value).toEqual({ epoch: 11, reservedThrough: 0 });
		const packet = f.packet(),
			result = f.request('POST', packet);
		expect(f.output).toBe(false);
		f.drain();
		expect(f.kvs.value).toEqual({ epoch: 11, reservedThrough: 256 });
		expect(result.data().accepted).toBe(true);
		expect(f.output).toBe(true);
		expect(f.switches.at(-1).toggle_after).toBe(5);
		const writes = f.switches.length;
		expect(f.request('POST', packet).data().accepted).toBe(true);
		f.drain();
		expect(f.switches).toHaveLength(writes);
		f.request('POST', { ...packet, thresholdC: 11 });
		f.drain();
		expect(f.output).toBe(false);
	});
	it('restart refuses old epoch and never reconstructs a lease from KVS/history', () => {
		const first = firmware();
		first.drain();
		first.sample();
		const old = first.packet();
		first.request('POST', old);
		first.drain();
		const restarted = firmware(first.kvs);
		restarted.drain();
		restarted.sample();
		expect(restarted.kvs.value.epoch).toBe(12);
		expect(restarted.request('POST', old).response.code).toBe(409);
		restarted.drain();
		expect(restarted.output).toBe(false);
	});
	it('storage failure inhibits and emergency OFF supersedes an awaited reservation', () => {
		const failed = firmware();
		failed.storageFailure();
		failed.drain();
		expect(failed.request('GET').data().ready).toBe(false);
		const f = firmware();
		f.drain();
		f.sample();
		const pending = f.request('POST', f.packet());
		f.request('POST', { action: 'off' });
		f.drain();
		expect(f.output).toBe(false);
		expect(pending.response.code).toBe(409);
	});
	it('higher threshold trips active ON immediately; stale surface/auth/lease loss fails OFF', () => {
		const f = firmware();
		f.drain();
		f.sample();
		f.request('POST', f.packet());
		f.drain();
		expect(f.output).toBe(true);
		f.request('POST', f.packet(2, { action: 'threshold', thresholdC: 20 }));
		f.drain();
		expect(f.output).toBe(false);
		const stale = firmware();
		stale.drain();
		stale.sample();
		stale.request('POST', stale.packet());
		stale.drain();
		stale.tick(1000);
		stale.drain();
		expect(stale.output).toBe(false);
		const auth = firmware();
		auth.drain();
		auth.sample();
		auth.request('POST', auth.packet());
		auth.drain();
		auth.auth(false);
		auth.tick(100);
		auth.drain();
		expect(auth.output).toBe(false);
	});
	it('does not prove drain by epoch: already-issued native ON reordered after OFF must settle then be physically released', () => {
		const f = firmware();
		f.drain();
		f.sample();
		const old = f.packet();
		f.request('POST', old);
		f.runRpc('KVS.Set');
		f.runRpc('KVS.Get'); // ON has entered native RPC but its callback has not completed.
		const off = f.request('POST', { action: 'off', requestId: 'protective-off' });
		f.runRpc('Switch.Set', false);
		f.runRpc('Switch.GetStatus');
		expect(f.request('GET').data().pendingOn).toBe(true);
		expect(f.request('GET').data().drained).toBe(false);
		f.runRpc('KVS.Set');
		f.runRpc('KVS.Get');
		expect(off.response.code).toBe(200);
		f.runRpc('Switch.Set', true); // The old native call really executes AFTER the newer OFF.
		expect(f.request('GET').data().drained).toBe(false);
		f.drain();
		expect(f.output).toBe(false);
		expect(f.request('GET').data().drained).toBe(true);
		expect(f.request('POST', old).response.code).toBe(409);
		f.drain();
		expect(f.output).toBe(false);
	});
	it('attempts physical OFF on KVS failure and leaves readiness inhibited; native callback cannot clear failure', () => {
		const f = firmware();
		f.drain();
		f.sample();
		f.request('POST', f.packet());
		f.drain();
		expect(f.output).toBe(true);
		f.storageFailure();
		f.request('POST', { action: 'off', requestId: 'off-storage-failed' });
		f.drain();
		expect(f.output).toBe(false);
		expect(f.request('GET').data().ready).toBe(false);
		expect(f.switches.at(-1).on).toBe(false);
	});

	it('absolute deadline cannot be rebased by retries or wall rollback and subtracts qualified budgets', () => {
		let wall = 1000,
			mono = 10;
		const deadline = new RemoteDewPointDeadline(
			11000,
			() => wall,
			() => mono,
		);
		const status = { uptimeMs: 5000 } as never;
		expect(deadline.deviceExpiry(status, binding.timing)).toBe(14500);
		wall = 0;
		mono = 5010;
		expect(deadline.remaining()).toBe(5000);
		expect(deadline.deviceExpiry(status, binding.timing)).toBe(9500);
		mono = 10010;
		expect(deadline.deviceExpiry(status, binding.timing)).toBeNull();
	});
});

describe('real localhost HTTP Digest fixture (no devices)', () => {
	let server: Server;
	afterEach(async () => {
		if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
	});
	it('gets a fresh read-only 401 then sends authenticated exact-method/URI JSON; never challenges by mutation', async () => {
		const calls: { method: string; auth: boolean; body: string }[] = [];
		server = createServer((req, res) => {
			let body = '';
			req.on('data', (chunk) => (body += String(chunk)));
			req.on('end', () => {
				calls.push({ method: req.method, auth: !!req.headers.authorization, body });
				if (!req.headers.authorization) {
					res.writeHead(401, {
						'WWW-Authenticate': 'Digest qop="auth", realm="shellyplus1pm-test", nonce="60dc59c6", algorithm=SHA-256',
					});
					res.end();
					return;
				}
				const cnonce = /cnonce="([a-f0-9]+)"/.exec(req.headers.authorization)[1];
				expect(req.headers.authorization).toBe(
					shellyScriptDigest(
						'Digest qop="auth", realm="shellyplus1pm-test", nonce="60dc59c6", algorithm=SHA-256',
						binding.deviceId,
						'private-test',
						req.method as 'GET' | 'POST',
						req.url,
						cnonce,
					),
				);
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ accepted: true }));
			});
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const http = new AuthenticatedShellyScriptHttp(
			new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/script/1/remote-dew-point`),
			binding.deviceId,
			'private-test',
		);
		await http.request(
			'POST',
			{ action: 'threshold', thresholdC: 12 },
			new RemoteDewPointDeadline(Date.now() + 3000),
			() => true,
		);
		expect(calls.map((c) => [c.method, c.auth])).toEqual([
			['GET', false],
			['POST', true],
		]);
		expect(JSON.parse(calls[1].body)).toEqual({ action: 'threshold', thresholdC: 12 });
	});
	it('rejects wrong realm, disabled auth and over-limit request bytes', async () => {
		expect(() =>
			shellyScriptDigest(
				'Digest qop="auth", realm="wrong", nonce="123", algorithm=SHA-256',
				binding.deviceId,
				'private-test',
				'POST',
				'/script/1/remote-dew-point',
				'0'.repeat(32),
			),
		).toThrow();
		server = createServer((_req, res) => {
			res.writeHead(200);
			res.end('{}');
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const http = new AuthenticatedShellyScriptHttp(
			new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/script/1/remote-dew-point`),
			binding.deviceId,
			'private-test',
		);
		await expect(http.request('POST', {}, new RemoteDewPointDeadline(Date.now() + 3000), () => true)).rejects.toThrow(
			'disabled',
		);
	});
});

/** Explicit software fixture, never an installed evidence record. Exercises the real provider registry. */
function installedFixture() {
	const artifact = compileRemoteDewPointArtifact(binding);
	const status: RemoteDewPointStatus = {
		protocol: REMOTE_DEW_POINT_PROTOCOL,
		artifact: artifact.artifactId,
		deviceId: binding.deviceId,
		model: binding.model,
		firmware: binding.firmware,
		auth_en: true,
		epoch: 11,
		sessionId: `${artifact.artifactId}:11`,
		uptimeMs: 1000,
		ready: true,
		output: false,
		pendingOn: false,
		sequence: 0,
		drained: true,
	};
	let current = true;
	const installation: RemoteDewPointInstallationEvidence = {
		profile: REMOTE_DEW_POINT_PROFILE,
		version: 1,
		protocol: REMOTE_DEW_POINT_PROTOCOL,
		publishedAlpha: 'software-fixture-after-alpha',
		physicalIdentity: binding.physicalActuator,
		deviceHardwareId: binding.deviceHardwareId,
		deviceId: binding.deviceId,
		model: binding.model,
		firmware: binding.firmware,
		artifactId: artifact.artifactId,
		compiledSha256: artifact.sha256,
		surface: {
			placementAuditId: 'fixture-placement',
			component: binding.localSurface.component,
			peripheralFingerprint: binding.localSurface.peripheralFingerprint,
			calibrationFingerprint: binding.localSurface.calibrationFingerprint,
			domainMinimum: -40,
			domainMaximum: 60,
		},
		timingAuditId: 'fixture-timing',
		authenticationAuditId: 'fixture-auth',
		writerIsolationAuditId: 'fixture-writers',
		nativeTimerAuditId: 'fixture-native-timer',
		restartDrainAuditId: 'fixture-restart',
		independentEquipmentCutoffAuditId: 'fixture-cutoff',
		measuredTiming: binding.timing,
		observedAt: Date.now(),
		expiresAt: Date.now() + 60000,
		isCurrent: () => current,
		restartDrainObservation: {
			epoch: status.epoch,
			sessionId: status.sessionId,
			physicalIdentity: binding.physicalActuator,
			artifactId: artifact.artifactId,
			compiledSha256: artifact.sha256,
			coveredJournalIds: ['prior-native-command'],
			observedAt: Date.now(),
			nativeCompletionEvidenceId: 'fixture-native-completed',
			offReadbackEvidenceId: 'fixture-actual-off-readback',
			isCurrent: () => current,
		},
	};
	const qualification: ThermostatInstalledQualification = {
		contractVersion: 1,
		providerProfile: { id: REMOTE_DEW_POINT_PROFILE, version: 1 },
		physicalIdentity: binding.physicalActuator,
		qualificationGeneration: 'fixture-generation',
		upstreamWritersExcluded: true,
		opposedOutputsInterlocked: false,
		machineLeaseIsCurrent: () => current,
		profile: {
			deviceId: binding.deviceId,
			model: binding.model,
			firmware: binding.firmware,
			componentId: 0,
			evidenceId: 'explicit-software-fixture',
			revision: 1,
			testedLeaseSeconds: { min: 0.1, max: 10 },
			releaseOrderingQualified: true,
			independentProtectionQualified: true,
			remoteDewPoint: { artifact, installation, authenticatedStatus: status },
		},
	};
	return {
		artifact,
		status,
		installation,
		qualification,
		invalidate: () => {
			current = false;
		},
		setCurrent: (value: boolean) => {
			current = value;
		},
	};
}

describe('separate remote profile actual claims registry', () => {
	it('refuses absent installation, admits only exact internal fixture and withdraws on lifecycle invalidation', () => {
		const f = installedFixture();
		const registry = new VirtualThermostatClaimsService(
			{} as DataSource,
			new DeviceStructureLockService(),
			{} as VirtualDependencyGraphService,
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			physicalIdentity: binding.physicalActuator,
			role: 'cooling',
			controllerId: 'fixture-controller',
			providerProfile: REMOTE_DEW_POINT_PROFILE,
			providerProfileVersion: 1,
			qualificationGeneration: 'fixture-generation',
			leaseSeconds: 5,
		});
		expect(registry.qualification(claim, false)).toBeNull();
		expect(remoteDewPointInstallationBlockers(f.artifact, f.status, null)).toContain(
			'cooling_remote_profile_installation_unqualified',
		);
		registry.recordQualification(f.qualification);
		expect(registry.qualification(claim, false)?.providerProfile.id).toBe(REMOTE_DEW_POINT_PROFILE);
		expect(registry.qualification({ ...claim, role: 'heating' }, false)).toBeNull();
		expect(registry.qualification(claim, true)).toBeNull();
		f.invalidate();
		expect(registry.qualification(claim, false)).toBeNull();
		registry.onModuleDestroy();
	});
	it.each([
		'sessionId',
		'physicalIdentity',
		'artifactId',
		'compiledSha256',
		'nativeCompletionEvidenceId',
		'offReadbackEvidenceId',
	] as const)('rejects a mismatched or absent exact drainage witness field %s', (field) => {
		const f = installedFixture();
		const installation = {
			...f.installation,
			restartDrainObservation: { ...f.installation.restartDrainObservation, [field]: '' },
		};
		expect(remoteDewPointInstallationBlockers(f.artifact, f.status, installation)).toContain(
			'cooling_current_restart_drain_observation_required',
		);
	});
});

describe('backend remote session journal and restart uncertainty', () => {
	function sessionFixture() {
		const f = installedFixture();
		let epoch = 11;
		const mutations: Record<string, unknown>[] = [];
		const request = jest.fn(
			async (
				method: string,
				packet: Record<string, unknown> | null,
				_deadline: RemoteDewPointDeadline,
				current: () => boolean,
				sent?: () => void,
			) => {
				if (!current()) throw new Error('revoked');
				if (method === 'GET')
					return Promise.resolve({ ...f.status, epoch, sessionId: `${f.artifact.artifactId}:${epoch}` });
				sent?.();
				mutations.push({ ...packet });
				if (packet.action === 'off') epoch++;
				return Promise.resolve({
					...packet,
					epoch,
					accepted: true,
					wasOn: false,
					output: packet.action === 'on',
					pendingOn: false,
					drained: packet.action === 'off',
				});
			},
		);
		const session = new RemoteDewPointSession({ request } as unknown as AuthenticatedShellyScriptHttp, f.artifact);
		return {
			...f,
			session,
			request,
			mutations,
			restart: () => {
				epoch++;
			},
			deadline: () => new RemoteDewPointDeadline(Date.now() + 5000),
		};
	}
	it('retries an exact journal tuple only with its original evidence and original absolute expiry', async () => {
		const f = sessionFixture(),
			deadline = f.deadline();
		expect((await f.session.send('on', 12, deadline, () => true, 'durable-command')).outcome).toBe('accepted');
		expect(
			(await f.session.send('on', 12, new RemoteDewPointDeadline(deadline.expiresAt), () => true, 'durable-command'))
				.outcome,
		).toBe('accepted');
		expect(f.mutations).toHaveLength(2);
		expect(f.mutations[1]).toEqual(f.mutations[0]);
	});
	it.each(['threshold', 'action', 'deadline'] as const)(
		'refuses same journal ID with conflicting %s before any I/O',
		async (conflict) => {
			const f = sessionFixture(),
				deadline = f.deadline();
			await f.session.send('on', 12, deadline, () => true, 'durable-command');
			const calls = f.request.mock.calls.length;
			const result = await f.session.send(
				conflict === 'action' ? 'threshold' : 'on',
				conflict === 'threshold' ? 15 : 12,
				new RemoteDewPointDeadline(deadline.expiresAt + (conflict === 'deadline' ? 1000 : 0)),
				() => true,
				'durable-command',
			);
			expect(result.outcome).toBe('refused');
			expect(result.reasons).toContain('remote_request_conflict');
			expect(f.request).toHaveBeenCalledTimes(calls);
			expect(f.mutations).toHaveLength(1);
		},
	);
	it.each(['send', 'retry'] as const)(
		'never replaces invalidated original T/RH lineage with a fresh %s guard',
		async (method) => {
			const f = sessionFixture(),
				deadline = f.deadline();
			let originalCurrent = true;
			await f.session.send('on', 12, deadline, () => originalCurrent, 'old-temperature-and-humidity');
			originalCurrent = false;
			const calls = f.request.mock.calls.length;
			const result =
				method === 'send'
					? await f.session.send('on', 12, deadline, () => true, 'old-temperature-and-humidity')
					: await f.session.retry(() => true);
			expect(result.outcome).toBe('refused');
			expect(f.request).toHaveBeenCalledTimes(calls);
			expect(f.mutations).toHaveLength(1);
		},
	);
	it('cannot renew the original monotonic validity using a newly captured same-wall-expiry deadline', async () => {
		const f = sessionFixture(),
			deadline = f.deadline();
		await f.session.send('on', 12, deadline, () => true, 'original-monotonic-budget');
		jest.spyOn(deadline, 'remaining').mockReturnValue(0);
		const calls = f.request.mock.calls.length;
		expect(
			(
				await f.session.send(
					'on',
					12,
					new RemoteDewPointDeadline(deadline.expiresAt),
					() => true,
					'original-monotonic-budget',
				)
			).outcome,
		).toBe('refused');
		expect((await f.session.retry(() => true)).outcome).toBe('refused');
		expect(f.request).toHaveBeenCalledTimes(calls);
	});
	it('refuses old request after an OFF epoch fence even if the new attempt guard is true', async () => {
		const f = sessionFixture(),
			deadline = f.deadline();
		await f.session.send('on', 12, deadline, () => true, 'old-epoch');
		await f.session.off(f.deadline(), () => true);
		const calls = f.request.mock.calls.length;
		expect((await f.session.send('on', 12, deadline, () => true, 'old-epoch')).outcome).toBe('refused');
		expect((await f.session.retry(() => true)).outcome).toBe('refused');
		expect(f.request).toHaveBeenCalledTimes(calls);
	});
	it('binds retries to the original compiled artifact/protection even if an internal caller supplies a changed artifact', async () => {
		const f = sessionFixture();
		// Intentional internal tampering fixture: production compiler artifacts are deeply frozen.
		const mutable = { ...f.artifact, binding: { ...f.artifact.binding } };
		const session = new RemoteDewPointSession(
			{ request: f.request } as unknown as AuthenticatedShellyScriptHttp,
			mutable,
		);
		const deadline = f.deadline();
		await session.send('on', 12, deadline, () => true, 'artifact-bound');
		mutable.artifactId = 'other-artifact';
		const calls = f.request.mock.calls.length;
		expect((await session.send('on', 12, deadline, () => true, 'artifact-bound')).outcome).toBe('refused');
		expect((await session.retry(() => true)).outcome).toBe('refused');
		expect(f.request).toHaveBeenCalledTimes(calls);
	});
	it('keeps native uncertainty sticky across restart and repeated fences while still attempting physical OFF', async () => {
		const f = sessionFixture();
		await f.session.send('on', 12, f.deadline(), () => true, 'pending-native-command');
		f.restart();
		expect(await f.session.fence(f.deadline(), () => true)).toBeNull();
		expect(await f.session.fence(f.deadline(), () => true)).toBeNull();
		expect(f.mutations.filter((p) => p.action === 'off')).toHaveLength(2);
		expect((await f.session.send('on', 12, f.deadline(), () => true, 'new-command')).outcome).toBe('refused');
	});
	it('revokes queued ON synchronously when protective OFF is requested', async () => {
		const f = sessionFixture();
		const on = f.session.send('on', 12, f.deadline(), () => true, 'queued-command');
		const off = f.session.off(f.deadline(), () => true);
		expect((await on).outcome).toBe('refused');
		expect((await off).outcome).toBe('accepted');
		expect(f.mutations.map((p) => p.action)).toEqual(['off']);
	});
});

describe('actual remote adapter retained-journal qualification boundary', () => {
	it('uses the actual registry and refuses unknown journal drainage before writing source freshness', async () => {
		const f = installedFixture();
		const registry = new VirtualThermostatClaimsService(
			{} as DataSource,
			new DeviceStructureLockService(),
			{} as VirtualDependencyGraphService,
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: 'fixture-claim',
			physicalIdentity: binding.physicalActuator,
			role: 'cooling',
			controllerId: 'fixture-controller',
			providerProfile: REMOTE_DEW_POINT_PROFILE,
			providerProfileVersion: 1,
			qualificationGeneration: 'fixture-generation',
			leaseSeconds: 5,
		});
		const target = {
			device: Object.assign(new ShellyNgDeviceEntity(), {
				canonicalMac: binding.deviceHardwareId,
				password: 'fixture-private',
			}),
			channel: Object.assign(new ChannelEntity(), { identifier: 'switch:0' }),
			property: Object.assign(new ChannelPropertyEntity(), {
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			}),
			value: true,
		};
		let epoch = 11;
		const request = jest.fn(
			async (
				method: string,
				p: Record<string, unknown> | null,
				_deadline: RemoteDewPointDeadline,
				current: () => boolean,
				sent?: () => void,
			) => {
				if (!current()) throw new Error('revoked');
				if (method === 'GET')
					return Promise.resolve({ ...f.status, epoch, sessionId: `${f.artifact.artifactId}:${epoch}` });
				sent?.();
				if (p.action === 'off') epoch++;
				return Promise.resolve({ ...p, epoch, accepted: true, wasOn: false });
			},
		);
		const values = { writeSampleWithState: jest.fn(), readQualifiedSample: jest.fn() };
		const adapter = new ThermostatRemoteCoolingAdapter(
			values as unknown as PropertyValueService,
			() => ({
				threshold: 12,
				expiresAt: Date.now() + 5000,
				controllerRevision: 3,
				protectionFingerprint: binding.protectionFingerprint,
				isCurrent: () => true,
			}),
			() => Promise.resolve({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false }),
			() => ({ request }) as unknown as AuthenticatedShellyScriptHttp,
		);
		expect(
			(
				await adapter.send(target, claim, registry.qualification(claim, false), () => true, {
					commandId: 'owned-command',
				})
			).outcome,
		).toBe('refused');
		expect(request).not.toHaveBeenCalled();
		registry.recordQualification(f.qualification);
		const qualification = registry.qualification(claim, false);
		expect((await adapter.send(target, claim, qualification, () => true, { commandId: 'owned-command' })).outcome).toBe(
			'accepted',
		);
		const proof = await adapter.reconcile(
			{ ...target, value: false },
			['untracked-pre-restart-command'],
			null,
			() => true,
			{
				controllerId: 'fixture-controller',
				controllerRevision: 3,
				claimId: 'fixture-claim',
				claimRevision: 1,
				contractFingerprint: 'fixture',
				qualification,
			},
		);
		expect(proof).toBeNull();
		expect(values.writeSampleWithState).not.toHaveBeenCalled();
		expect(request.mock.calls.some((c) => c[1]?.action === 'off')).toBe(true);
		registry.onModuleDestroy();
	});
});

/** Firmware component execution, including native Switch callbacks/readback; no device or installed record. */
function firmwareHttp(f: ReturnType<typeof firmware>) {
	return {
		request: jest.fn(
			async (
				method: string,
				packet: object | null,
				_deadline: RemoteDewPointDeadline,
				current: () => boolean,
				sent?: () => void,
			) => {
				if (!current()) throw new Error('revoked');
				if (method === 'POST') sent?.();
				const result = f.request(method, packet);
				f.drain();
				if (!current() || result.response.code !== 200) throw new Error('component refused');
				return Promise.resolve(result.data());
			},
		),
	} as unknown as AuthenticatedShellyScriptHttp;
}

describe('cooling recovery with real recursive accepted lineage and compiled OFF drainage', () => {
	it('does not re-arm after proved release; needs BOTH post-release inputs and re-fences qualification loss/regain', async () => {
		const f = installedFixture(),
			component = firmware();
		component.drain();
		component.sample();
		const events = new EventEmitter2(),
			producers = new PropertyProducerRegistryService(events);
		const values = new PropertyValueService(
			{
				isConnected: () => true,
				enqueueWritePoint: () => Promise.resolve(undefined),
				flushQueuedWrites: () => Promise.resolve(undefined),
				writePoints: () => Promise.resolve(undefined),
				query: () => Promise.resolve([]),
			} as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		const registry = new VirtualThermostatClaimsService(
			{} as DataSource,
			new DeviceStructureLockService(),
			{} as VirtualDependencyGraphService,
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		registry.recordQualification(f.qualification);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: 'cooling',
			controllerId: 'fixture-controller',
			physicalIdentity: binding.physicalActuator,
			role: 'cooling',
			providerProfile: REMOTE_DEW_POINT_PROFILE,
			providerProfileVersion: 1,
			qualificationGeneration: 'fixture-generation',
			leaseSeconds: 5,
		});
		const property = (id: string) =>
			Object.assign(new ChannelPropertyEntity(), {
				id,
				channel: 'fixture-channel',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
				format: [-45, 60],
			});
		const t = property('dry-bulb'),
			rh = property('relative-humidity'),
			dew = property('dew-point'),
			surface = property('surface');
		rh.category = PropertyCategory.HUMIDITY;
		rh.unit = '%';
		rh.format = [0, 100];
		const lease = producers.register(dew, 1);
		const report = async (p: ChannelPropertyEntity, value: number) =>
			values.writeSampleWithState(p, value, { sampledAt: new Date(), receivedAt: new Date(), provenance: 'live' });
		const publish = async () =>
			values.publishDerived(dew, lease, 10, {
				quality: 'good',
				reasons: [],
				sampledAt: new Date(),
				evaluatedAt: new Date(),
				expiresAt: new Date(Date.now() + 5000),
				sourceSamples: [values.captureIncorporatedSample(t), values.captureIncorporatedSample(rh)],
			});
		const dependency = Object.assign(new ThermostatCoolingDependencyEntity(), {
			maximumAgeSeconds: 60,
			purpose: 'cooled_surface',
			dewPointIdentity: dew.id,
			surfaceIdentity: surface.id,
			dewPointFingerprint: binding.remoteLineageFingerprint,
		});
		const entry: CoolingBinding = {
			claimId: claim.id,
			controllerRevision: 3,
			claim,
			opposed: false,
			dependency,
			dewPoint: dew,
			surface: {
				property: surface,
				leaf: surface,
				enabled: true,
				fingerprint: binding.localSurface.calibrationFingerprint,
				domain: { minimum: -40, maximum: 60 },
				transform: null,
			} as CoolingBinding['surface'],
			policy: { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1 },
			basis: binding.protectionFingerprint,
		};
		const cooling = new ThermostatCoolingDependencyService({} as DataSource, values, registry);
		const read = () => cooling.read([entry], Date.now())[0];
		const session = new RemoteDewPointSession(firmwareHttp(component), f.artifact);
		try {
			await report(t, 20);
			await report(rh, 50);
			await report(surface, 20);
			await publish();
			expect(read().reasons).toContain('cooling_pending_release');
			for (let i = 0; i < 3; i++) expect(read().ready).toBe(false);
			await report(t, 20);
			await report(rh, 50);
			await report(surface, 20);
			await publish();
			expect(read()).toMatchObject({ ready: false, latched: true }); // Even recovered temperatures cannot clear a pending release latch.
			// Exercise the compiled device's actual OFF completion + native pending count + Switch.GetStatus readback.
			const off = await session.fence(new RemoteDewPointDeadline(Date.now() + 3000), () => true);
			expect(off?.status).toMatchObject({ output: false, pendingOn: false, drained: true });
			expect(component.switches.at(-1).on).toBe(false);
			cooling.acknowledgeRelease([entry]);
			for (let i = 0; i < 3; i++) {
				expect(read().reasons).toContain('cooling_fresh_report_required');
				expect(read().reasons).not.toContain('cooling_pending_release');
			}
			await report(surface, 20);
			await report(t, 20);
			await publish();
			expect(read().ready).toBe(false); // RH is still the pre-release acceptance generation.
			await report(rh, 50);
			await publish();
			expect(read().ready).toBe(true);
			f.setCurrent(false);
			expect(read().reasons).toEqual(
				expect.arrayContaining(['cooling_remote_profile_installation_unqualified', 'cooling_pending_release']),
			);
			f.setCurrent(true);
			expect(read().ready).toBe(false); // Regain does not revive the old reports.
			const again = await session.fence(new RemoteDewPointDeadline(Date.now() + 3000), () => true);
			expect(again).not.toBeNull();
			cooling.acknowledgeRelease([entry]);
			for (let i = 0; i < 3; i++) expect(read().reasons).not.toContain('cooling_pending_release');
			await report(surface, 20);
			await report(rh, 50);
			await publish();
			expect(read().ready).toBe(false); // T still old.
			await report(t, 20);
			await publish();
			expect(read().ready).toBe(true);
		} finally {
			registry.onModuleDestroy();
			producers.onModuleDestroy();
		}
	});
});

describe('actual runtime journal dispatch to remote provider continuity', () => {
	it('renews threshold+finite ON with a NEW persisted command identity while the native output is already ON', async () => {
		const f = installedFixture(),
			component = firmware();
		component.drain();
		component.sample();
		const http = firmwareHttp(component),
			events = new EventEmitter2(),
			structure = new DeviceStructureLockService();
		const target = {
			device: Object.assign(new ShellyNgDeviceEntity(), {
				id: 'relay',
				enabled: true,
				canonicalMac: binding.deviceHardwareId,
				password: 'fixture-private',
			}),
			channel: Object.assign(new ChannelEntity(), { id: 'switch', identifier: 'switch:0' }),
			property: Object.assign(new ChannelPropertyEntity(), {
				id: 'relay-output',
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			}),
			value: true,
		};
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: 'continuity-claim',
			controllerId: 'continuity-controller',
			revision: 1,
			state: 'reserved',
			sourcePropertyId: target.property.id,
			sourcePropertyIdentity: target.property.id,
			sourceDeviceId: target.device.id,
			physicalIdentity: binding.physicalActuator,
			contractFingerprint: thermostatPropertyContract(target.property, target.channel, target.device),
			role: 'cooling',
			providerProfile: REMOTE_DEW_POINT_PROFILE,
			providerProfileVersion: 1,
			qualificationGeneration: 'fixture-generation',
			leaseSeconds: 5,
		});
		const journals: VirtualThermostatCommandEntity[] = [];
		const manager = {
			find: () => Promise.resolve([claim]),
			create: (entity: new () => object, row: object) => Object.assign(new entity(), row),
			insert: (_entity: unknown, row: VirtualThermostatCommandEntity) => {
				journals.push(row);
				return Promise.resolve();
			},
			save: () => Promise.resolve(undefined),
		};
		const db = {
			manager,
			transaction: async (task: (m: typeof manager) => Promise<unknown>) => task(manager),
		} as unknown as DataSource;
		const graph = {} as VirtualDependencyGraphService;
		const registry = new VirtualThermostatClaimsService(
			db,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
			new ConfigService({ FB_CLI: 'off' }),
		);
		await registry.onApplicationBootstrap();
		registry.recordQualification(f.qualification);
		registry.registerRuntimeAdmission(() => true);
		let generation = 1,
			threshold = 12;
		const adapter = new ThermostatRemoteCoolingAdapter(
			{} as PropertyValueService,
			() => {
				const captured = generation;
				return {
					threshold,
					expiresAt: Date.now() + 5000,
					controllerRevision: 3,
					protectionFingerprint: binding.protectionFingerprint,
					isCurrent: () => captured === generation,
				};
			},
			() => Promise.resolve({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false }),
			() => http,
		);
		const producers = new PropertyProducerRegistryService(events);
		const runtime = new VirtualThermostatRuntimeService(
			db,
			structure,
			registry,
			{ read: () => ({}) } as never,
			{ get: () => adapter } as never,
			{} as PropertyValueService,
			producers,
			events,
			graph,
			{} as never,
		);
		// Isolate renewed-command continuity: the full decision evaluator has separate runtime suites.
		// Actual prepare/dispatch, final ownership authority, installed registry, source guard, adapter, session and compiled protocol execute here.
		const internal = runtime as unknown as {
			active: boolean;
			contexts: Map<string, unknown>;
			epochs: Map<string, number>;
			decide: (...args: unknown[]) => { desiredCooling: boolean };
			prepare: (context: unknown, claim: VirtualThermostatActuatorClaimEntity, action: 'on') => Promise<void>;
			inFlight: Map<string, Promise<void>>;
		};
		const context = {
			config: { controllerId: claim.controllerId, revision: 3 },
			claims: [claim],
			admission: { isCurrent: () => true },
			publishGuard: () => true,
			epoch: 1,
			branches: new Map([[claim.id, { activity: 'on' }]]),
			bindings: [],
			targets: new Map([[claim.id, target]]),
			commands: [],
			state: { decisionRevision: 1 },
		};
		internal.active = true;
		internal.contexts.set(claim.controllerId, context);
		internal.epochs.set(claim.controllerId, 1);
		jest.spyOn(internal, 'decide').mockReturnValue({ desiredCooling: true });
		jest.spyOn(runtime, 'request').mockImplementation(() => undefined);
		try {
			await internal.prepare(context, claim, 'on');
			await Promise.all([...internal.inFlight.values()]);
			expect(component.output).toBe(true);
			threshold = 15;
			generation++; // New T/RH acceptance invalidates the original captured guard.
			await internal.prepare(context, claim, 'on');
			await Promise.all([...internal.inFlight.values()]);
			expect(component.output).toBe(true);
			expect(journals).toHaveLength(2);
			expect(journals[0].id).not.toBe(journals[1].id);
			expect(journals.map((j) => j.status)).toEqual(['accepted', 'accepted']);
			const packets = jest
				.spyOn(http, 'request')
				.mock.calls.filter(
					([method, packet]) => method === 'POST' && packet && 'action' in packet && packet.action === 'on',
				)
				.map(([, packet]) => {
					if (!packet || !('requestId' in packet) || !('thresholdC' in packet) || !('sequence' in packet))
						throw new Error('Missing fixture packet identity or threshold');
					return { requestId: packet.requestId, thresholdC: packet.thresholdC, sequence: packet.sequence };
				});
			expect(packets.map((p) => p.requestId)).toEqual(journals.map((j) => j.id));
			expect(packets.map((p) => p.thresholdC)).toEqual([12, 15]);
			expect(packets.map((p) => p.sequence)).toEqual([1, 2]);
			const nativeOns = component.switches.filter((s) => s.on);
			expect(nativeOns).toHaveLength(2);
			expect(nativeOns.every((s) => s.toggle_after > 0 && s.toggle_after <= 5)).toBe(true);
		} finally {
			internal.active = false;
			registry.onModuleDestroy();
			producers.onModuleDestroy();
		}
	});
});
