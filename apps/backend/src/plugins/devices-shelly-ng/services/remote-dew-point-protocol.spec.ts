import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ThermostatRemoteCoolingAdapter } from '../../devices-virtual/services/thermostat-remote-cooling-adapter';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { VirtualDependencyGraphService } from '../../devices-virtual/services/virtual-dependency-graph.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from '../../devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatActuatorClaimEntity } from '../../devices-virtual/entities/virtual-thermostat.entity';
import { RemoteDewPointSession } from './remote-dew-point-session';
import { RemoteDewPointInstallationEvidence, remoteDewPointInstallationBlockers } from './remote-dew-point-qualification';
import { REMOTE_DEW_POINT_PROFILE, RemoteDewPointStatus } from './remote-dew-point-lease.contract';

import { Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { runInNewContext } from 'node:vm';

import { AuthenticatedShellyScriptHttp, shellyScriptDigest } from './authenticated-shelly-script-http';
import { RemoteDewPointArtifactBinding, compileRemoteDewPointArtifact } from './remote-dew-point-artifact';
import { REMOTE_DEW_POINT_PROTOCOL, RemoteDewPointDeadline } from './remote-dew-point-lease.contract';

const binding: RemoteDewPointArtifactBinding = {
	deviceId: 'shellyplus1pm-test',
	deviceHardwareId: 'AABBCCDDEEFF', endpointHostname: 'fixture.invalid', scriptId: 1,
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
			getComponentConfig: (component: string) =>
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
				callbacks.push({ method, on: params.on, run: () => {
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
					if (method === 'SensorAddon.GetPeripherals') callback(JSON.parse(binding.localSurface.peripheralsJson));
					if (method === 'Switch.GetStatus') callback({ output });
					if (method === 'Switch.Set') {
						const wasOn = output; output = params.on;
						switches.push({ on: params.on, toggle_after: params.toggle_after });
						callback({ was_on: wasOn });
					}
				} });
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
		const f = firmware(); f.drain(); f.sample(); const old = f.packet(); f.request('POST', old);
		f.runRpc('KVS.Set'); f.runRpc('KVS.Get'); // ON has entered native RPC but its callback has not completed.
		const off = f.request('POST', { action: 'off', requestId: 'protective-off' });
		f.runRpc('Switch.Set', false); f.runRpc('Switch.GetStatus');
		expect(f.request('GET').data().pendingOn).toBe(true);
		expect(f.request('GET').data().drained).toBe(false);
		f.runRpc('KVS.Set'); f.runRpc('KVS.Get');
		expect(off.response.code).toBe(200);
		f.runRpc('Switch.Set', true); // The old native call really executes AFTER the newer OFF.
		expect(f.request('GET').data().drained).toBe(false);
		f.drain(); expect(f.output).toBe(false);
		expect(f.request('GET').data().drained).toBe(true);
		expect(f.request('POST', old).response.code).toBe(409); f.drain(); expect(f.output).toBe(false);
	});
	it('attempts physical OFF on KVS failure and leaves readiness inhibited; native callback cannot clear failure', () => {
		const f = firmware(); f.drain(); f.sample(); f.request('POST', f.packet()); f.drain(); expect(f.output).toBe(true);
		f.storageFailure(); f.request('POST', { action: 'off', requestId: 'off-storage-failed' });
		f.drain(); expect(f.output).toBe(false); expect(f.request('GET').data().ready).toBe(false);
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
 const status: RemoteDewPointStatus = { protocol: REMOTE_DEW_POINT_PROTOCOL, artifact: artifact.artifactId,
 deviceId: binding.deviceId, model: binding.model, firmware: binding.firmware, auth_en: true, epoch: 11,
 sessionId: `${artifact.artifactId}:11`, uptimeMs: 1000, ready: true, output: false, pendingOn: false, sequence: 0, drained: true };
 let current = true;
 const installation: RemoteDewPointInstallationEvidence = { profile: REMOTE_DEW_POINT_PROFILE, version: 1,
 protocol: REMOTE_DEW_POINT_PROTOCOL, publishedAlpha: 'software-fixture-after-alpha', physicalIdentity: binding.physicalActuator,
 deviceHardwareId: binding.deviceHardwareId, deviceId: binding.deviceId, model: binding.model, firmware: binding.firmware,
 artifactId: artifact.artifactId, compiledSha256: artifact.sha256, surface: { placementAuditId: 'fixture-placement',
 component: binding.localSurface.component, peripheralFingerprint: binding.localSurface.peripheralFingerprint,
 calibrationFingerprint: binding.localSurface.calibrationFingerprint, domainMinimum: -40, domainMaximum: 60 },
 timingAuditId: 'fixture-timing', authenticationAuditId: 'fixture-auth', writerIsolationAuditId: 'fixture-writers',
 nativeTimerAuditId: 'fixture-native-timer', restartDrainAuditId: 'fixture-restart', independentEquipmentCutoffAuditId: 'fixture-cutoff',
 measuredTiming: binding.timing, observedAt: Date.now(), expiresAt: Date.now()+60000, isCurrent: () => current,
 restartDrainObservation: { epoch: status.epoch, sessionId: status.sessionId, physicalIdentity: binding.physicalActuator,
 artifactId: artifact.artifactId, compiledSha256: artifact.sha256, coveredJournalIds: ['prior-native-command'],
 observedAt: Date.now(), nativeCompletionEvidenceId: 'fixture-native-completed', offReadbackEvidenceId: 'fixture-actual-off-readback', isCurrent: () => current } };
 const qualification: ThermostatInstalledQualification = { contractVersion: 1, providerProfile: { id: REMOTE_DEW_POINT_PROFILE, version: 1 },
 physicalIdentity: binding.physicalActuator, qualificationGeneration: 'fixture-generation', upstreamWritersExcluded: true,
 opposedOutputsInterlocked: false, machineLeaseIsCurrent: () => current, profile: { deviceId: binding.deviceId,
 model: binding.model, firmware: binding.firmware, componentId: 0, evidenceId: 'explicit-software-fixture', revision: 1,
 testedLeaseSeconds: { min: .1, max: 10 }, releaseOrderingQualified: true, independentProtectionQualified: true,
 remoteDewPoint: { artifact, installation, authenticatedStatus: status } } };
 return { artifact, status, installation, qualification, invalidate: () => { current = false; } };
}

describe('separate remote profile actual claims registry', () => {
 it('refuses absent installation, admits only exact internal fixture and withdraws on lifecycle invalidation', () => {
  const f=installedFixture();
  const registry=new VirtualThermostatClaimsService({} as DataSource, new DeviceStructureLockService(), {} as VirtualDependencyGraphService,
    new PropertyCommandAdmissionRegistryService(), new EventEmitter2());
  const claim=Object.assign(new VirtualThermostatActuatorClaimEntity(), { physicalIdentity: binding.physicalActuator, role: 'cooling',
    controllerId: 'fixture-controller', providerProfile: REMOTE_DEW_POINT_PROFILE, providerProfileVersion: 1, qualificationGeneration: 'fixture-generation', leaseSeconds: 5 });
  expect(registry.qualification(claim,false)).toBeNull();
  expect(remoteDewPointInstallationBlockers(f.artifact,f.status,null)).toContain('cooling_remote_profile_installation_unqualified');
  registry.recordQualification(f.qualification);
  expect(registry.qualification(claim,false)?.providerProfile.id).toBe(REMOTE_DEW_POINT_PROFILE);
  expect(registry.qualification({...claim, role:'heating'},false)).toBeNull();
  expect(registry.qualification(claim,true)).toBeNull();
  f.invalidate(); expect(registry.qualification(claim,false)).toBeNull(); registry.onModuleDestroy();
 });
 it.each(['sessionId','physicalIdentity','artifactId','compiledSha256','nativeCompletionEvidenceId','offReadbackEvidenceId'] as const)(
 'rejects a mismatched or absent exact drainage witness field %s', field => {
  const f=installedFixture();
  const installation={...f.installation,restartDrainObservation:{...f.installation.restartDrainObservation,[field]:''}};
  expect(remoteDewPointInstallationBlockers(f.artifact,f.status,installation)).toContain('cooling_current_restart_drain_observation_required');
 });
});

describe('backend remote session journal and restart uncertainty', () => {
 function sessionFixture() {
  const f=installedFixture(); let epoch=11; const mutations: Record<string, unknown>[]=[];
  const request=jest.fn(async (method: string, packet: Record<string, unknown>|null, _deadline: RemoteDewPointDeadline, current:()=>boolean, sent?:()=>void) => {
   if(!current()) throw new Error('revoked');
   if(method==='GET') return {...f.status,epoch,sessionId:`${f.artifact.artifactId}:${epoch}`};
   sent?.(); mutations.push({...packet});
   if(packet.action==='off') epoch++;
   return {...packet,epoch,accepted:true,wasOn:false,output:packet.action==='on',pendingOn:false,drained:packet.action==='off'};
  });
  const session=new RemoteDewPointSession({request} as unknown as AuthenticatedShellyScriptHttp,f.artifact);
  return {...f,session,request,mutations,restart:()=>{epoch++;}, deadline:()=>new RemoteDewPointDeadline(Date.now()+5000)};
 }
 it('reuses the exact journal tuple and absolute expiry without granting new sequence/lifetime',async()=>{
  const f=sessionFixture();
  expect((await f.session.send('on',12,f.deadline(),()=>true,'durable-command')).outcome).toBe('accepted');
  expect((await f.session.send('on',15,f.deadline(),()=>true,'durable-command')).outcome).toBe('accepted');
  expect(f.mutations).toHaveLength(2); expect(f.mutations[1]).toEqual(f.mutations[0]);
 });
 it('keeps native uncertainty sticky across restart and repeated fences while still attempting physical OFF',async()=>{
  const f=sessionFixture(); await f.session.send('on',12,f.deadline(),()=>true,'pending-native-command'); f.restart();
  expect(await f.session.fence(f.deadline(),()=>true)).toBeNull();
  expect(await f.session.fence(f.deadline(),()=>true)).toBeNull();
  expect(f.mutations.filter(p=>p.action==='off')).toHaveLength(2);
  expect((await f.session.send('on',12,f.deadline(),()=>true,'new-command')).outcome).toBe('refused');
 });
 it('revokes queued ON synchronously when protective OFF is requested',async()=>{
  const f=sessionFixture();
  const on=f.session.send('on',12,f.deadline(),()=>true,'queued-command');
  const off=f.session.off(f.deadline(),()=>true);
  expect((await on).outcome).toBe('refused'); expect((await off).outcome).toBe('accepted');
  expect(f.mutations.map(p=>p.action)).toEqual(['off']);
 });
});


describe('actual remote adapter retained-journal qualification boundary', () => {
 it('uses the actual registry and refuses unknown journal drainage before writing source freshness',async()=>{
  const f=installedFixture();
  const registry=new VirtualThermostatClaimsService({} as DataSource, new DeviceStructureLockService(), {} as VirtualDependencyGraphService,
    new PropertyCommandAdmissionRegistryService(), new EventEmitter2());
  const claim=Object.assign(new VirtualThermostatActuatorClaimEntity(), { id: 'fixture-claim', physicalIdentity: binding.physicalActuator, role: 'cooling',
    controllerId: 'fixture-controller', providerProfile: REMOTE_DEW_POINT_PROFILE, providerProfileVersion: 1, qualificationGeneration: 'fixture-generation', leaseSeconds: 5 });
  const target={device:Object.assign(new ShellyNgDeviceEntity(),{canonicalMac:binding.deviceHardwareId,password:'fixture-private'}),
   channel:Object.assign(new ChannelEntity(),{identifier:'switch:0'}),property:Object.assign(new ChannelPropertyEntity(),{identifier:'output',category:PropertyCategory.ON,dataType:DataTypeType.BOOL,permissions:[PermissionType.READ_WRITE]}),value:true};
  let epoch=11;
  const request=jest.fn(async(method:string,p:Record<string,unknown>|null,_deadline:RemoteDewPointDeadline,current:()=>boolean,sent?:()=>void)=>{
   if(!current()) throw new Error('revoked');
   if(method==='GET') return {...f.status,epoch,sessionId:`${f.artifact.artifactId}:${epoch}`};
   sent?.(); if(p.action==='off')epoch++;
   return {...p,epoch,accepted:true,wasOn:false};
  });
  const values={writeSampleWithState:jest.fn(),readQualifiedSample:jest.fn()};
  const adapter=new ThermostatRemoteCoolingAdapter(values as unknown as PropertyValueService,
    ()=>({threshold:12,expiresAt:Date.now()+5000,controllerRevision:3,protectionFingerprint:binding.protectionFingerprint,isCurrent:()=>true}),
    async()=>({outcome:'unknown',outputConfirmed:false,pendingOnDrained:false}),
    ()=>({request} as unknown as AuthenticatedShellyScriptHttp));
  expect((await adapter.send(target,claim,registry.qualification(claim,false),()=>true,{commandId:'owned-command'})).outcome).toBe('refused');
  expect(request).not.toHaveBeenCalled();
  registry.recordQualification(f.qualification); const qualification=registry.qualification(claim,false);
  expect((await adapter.send(target,claim,qualification,()=>true,{commandId:'owned-command'})).outcome).toBe('accepted');
  const proof=await adapter.reconcile({...target,value:false},['untracked-pre-restart-command'],null,()=>true,
    {controllerId:'fixture-controller',controllerRevision:3,claimId:'fixture-claim',claimRevision:1,contractFingerprint:'fixture',qualification});
  expect(proof).toBeNull(); expect(values.writeSampleWithState).not.toHaveBeenCalled();
  expect(request.mock.calls.some(c=>c[1]?.action==='off')).toBe(true);
  registry.onModuleDestroy();
 });
});
