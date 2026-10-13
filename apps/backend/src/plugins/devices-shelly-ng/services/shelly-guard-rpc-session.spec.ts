import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';

import { ShellyProtectiveQualification } from '../contracts/protective-switch.contract';

import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';
import { ShellyGuardRpcSession } from './shelly-guard-rpc-session';

const code = 'offline fixture script';
class FixtureRpc extends GuardedShellyRpcHandler {
	firmware = 'fixture-only';
	scriptCode = code;
	protected override createSocket(): WebSocket {
		return Object.assign(new EventEmitter(), {
			readyState: WebSocket.OPEN,
			send: (data: string, callback: () => void) => {
				const frame = JSON.parse(data) as { id: number; method: string };
				callback();
				const result =
					frame.method === 'Shelly.GetDeviceInfo'
						? { id: 'physical', model: 'SNSW-001P16EU', fw_id: this.firmware, mac: '000000000001' }
						: { data: this.scriptCode, left: 0 };
				queueMicrotask(() => this.client.receive({ jsonrpc: '2.0', id: frame.id, result }));
			},
		}) as unknown as WebSocket;
	}
	protected override connect(): Promise<void> {
		return Promise.resolve();
	}
	protected override disconnect(): Promise<void> {
		return Promise.resolve();
	}
}
describe('guarded SDK identity plus qualified Shelly 1.7 HTTP guard bridge', () => {
	let server: Server;
	let rpc: FixtureRpc;
	let session: ShellyGuardRpcSession;
	let current: boolean;
	let epoch: number;
	let resultOverride: Record<string, unknown>;
	let requests: URL[];
	let qualification: ShellyProtectiveQualification;
	beforeEach(async () => {
		current = true;
		epoch = 10;
		resultOverride = {};
		requests = [];
		server = createServer((request, response) => {
			const url = new URL(request.url, 'http://fixture.invalid');
			requests.push(url);
			const action = url.searchParams.get('action');
			const result =
				action === 'status'
					? {
							protocol: 'sp-guard-candidate-1',
							deviceId: 'physical',
							firmware: 'fixture-only',
							componentId: 0,
							evidenceId: 'offline-only',
							epoch,
							nowMs: 1000,
							ready: true,
							busy: false,
							fault: null,
							floorSafe: true,
							output: false,
						}
					: action === 'on'
						? { accepted: true, epoch, untilMs: Number(url.searchParams.get('untilMs')) }
						: {
								epoch: ++epoch,
								deviceId: 'physical',
								componentId: 0,
								evidenceId: 'offline-only',
								output: false,
								localOnDrained: true,
							};
			response.setHeader('Content-Type', 'application/json');
			response.end(JSON.stringify({ nonce: url.searchParams.get('nonce'), result: { ...result, ...resultOverride } }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const hostname = `127.0.0.1:${(server.address() as AddressInfo).port}`;
		rpc = new FixtureRpc(hostname, { clientId: 'fixture', requestTimeout: 2, pingInterval: 0, reconnectInterval: 0 });
		qualification = {
			deviceId: 'physical',
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
				canonicalMac: '000000000001',
				protocol: 'sp-guard-candidate-1',
				evidenceId: 'offline-only',
				writerIsolationEvidenceId: 'fixture-only',
				commissioningBarrierEvidenceId: 'fixture-only',
				endpointAuthenticationEvidenceId: 'fixture-only',
				restartDrainEvidenceId: 'fixture-only',
				localExecutionBoundsEvidenceId: 'fixture-only',
			},
		};
		session = new ShellyGuardRpcSession(rpc, 0, qualification, () => current);
	});
	afterEach(async () => {
		await rpc.destroy();
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	});
	it('uses one immutable absolute expiry for ON and never treats acceptance as output proof', async () => {
		expect(await session.on(5, 1000, () => true)).toEqual({
			outcome: 'accepted',
			wasOn: false,
			outputConfirmed: false,
			pendingOnDrained: false,
		});
		expect(requests.map((url) => url.pathname)).toEqual(['/script/1/spguard', '/script/1/spguard']);
		expect(requests[1].searchParams.get('epoch')).toBe('10');
		expect(requests[1].searchParams.get('untilMs')).toBe('6000');
	});
	it('returns a fresh OFF readback only after matched script epoch, identity, and drainage acknowledgement', async () => {
		const before = Date.now();
		const readback = await session.fence(1000, () => true);
		expect(readback).toMatchObject({ output: false, epoch: 11, evidence: { provenance: 'live' } });
		expect(readback.evidence.observedAt.getTime()).toBeGreaterThanOrEqual(before);
		current = false;
		expect(readback.isCurrent()).toBe(false);
		expect(readback.evidence.sourceIsCurrent()).toBe(false);
	});
	it.each([{ firmware: 'other' }, { epoch: 50 }, { output: true }, { localOnDrained: false }])(
		'refuses unmatched acknowledgement %j',
		async (override) => {
			resultOverride = override;
			expect(await session.fence(1000, () => true)).toBeNull();
		},
	);
	it('refuses source code and firmware changes before sending any script endpoint command', async () => {
		rpc.scriptCode = 'modified';
		expect(await session.fence(1000, () => true)).toBeNull();
		expect(requests).toEqual([]);
		rpc.scriptCode = code;
		rpc.firmware = 'new';
		expect(await session.on(5, 1000, () => true)).toMatchObject({ outcome: 'refused' });
		expect(requests).toEqual([]);
	});
	it('rejects a DNS endpoint alias or boolean evidence rather than qualifying a transport', () => {
		const profile = qualification.guardScript as unknown as Record<string, unknown>;
		profile.endpointHostname = 'fixture.invalid';
		expect(session.isCurrent()).toBe(false);
		profile.endpointHostname = rpc.hostname;
		profile.endpointAuthenticationEvidenceId = true;
		expect(session.isCurrent()).toBe(false);
	});

	it('requires installed writer isolation and restart-drain evidence, not an API boolean', () => {
		delete (qualification.guardScript as unknown as Record<string, unknown>).writerIsolationEvidenceId;
		expect(session.isCurrent()).toBe(false);
	});
});
