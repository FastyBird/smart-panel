import { readFileSync } from 'fs';
import { join } from 'path';

import {
	ParsedProtectSystem,
	ProtectProbeClassification,
	ProtectProbeHttp,
	classifyProbe,
	parseSystemInfo,
} from './protect-discovery-probe';
import { ProtectPresence, ProtectProbeFailure, ProtectProbeStatus } from './protect-discovery.constants';

const systemFixture = readFileSync(join(__dirname, '..', '__fixtures__', 'system.json'), 'utf8');

const sys200: ProtectProbeHttp = { ok: true, statusCode: 200, body: systemFixture };
const http = (statusCode: number): ProtectProbeHttp => ({ ok: true, statusCode, body: '' });
const fail = (kind: 'timeout' | 'refused' | 'unreachable' | 'dns' | 'tls' | 'protocol'): ProtectProbeHttp => ({
	ok: false,
	kind,
	code: null,
});

const parsed = (body: string): ParsedProtectSystem => {
	const result = parseSystemInfo(body);

	if (result === null) {
		throw new Error('expected a parsed system');
	}

	return result;
};

describe('parseSystemInfo', () => {
	it('reads the live fixture', () => {
		const system = parsed(systemFixture);

		expect(system.model).toBe('UNVR');
		expect(system.name).toBe('Dream Machine Pro');
		expect(system.mac).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
		expect(typeof system.deviceState).toBe('string');
		expect(system.directConnectDomain).toMatch(/^[0-9a-f]+\.id\.ui\.direct$/);
	});

	it.each([
		'',
		'not json',
		'[]',
		'{}',
		'{"hardware":{}}',
		'{"hardware":{"shortname":""}}',
		'{"hardware":{"shortname":5}}',
	])('returns null for %j', (body) => {
		expect(parseSystemInfo(body)).toBeNull();
	});

	it.each(['a b', 'EVIL.com/x'])('drops an invalid directConnectDomain %j and keeps the rest', (domain) => {
		const system = parsed(JSON.stringify({ hardware: { shortname: 'UNVR' }, directConnectDomain: domain }));

		expect(system.directConnectDomain).toBeNull();
		expect(system.model).toBe('UNVR');
	});

	it('turns a malformed mac into null and keeps the rest', () => {
		const system = parsed(JSON.stringify({ hardware: { shortname: 'UNVR' }, name: 'Console', mac: 'not-a-mac' }));

		expect(system.mac).toBeNull();
		expect(system.model).toBe('UNVR');
		expect(system.name).toBe('Console');
	});

	it('ignores unknown keys and nulls absent optional fields', () => {
		expect(parsed('{"hardware":{"shortname":"UDM","x":1},"other":{"a":1}}')).toEqual({
			model: 'UDM',
			name: null,
			mac: null,
			deviceState: null,
			directConnectDomain: null,
		});
	});
});

describe('classifyProbe', () => {
	const expectClassification = (
		input: { system: ProtectProbeHttp; protect: ProtectProbeHttp },
		status: ProtectProbeStatus,
		failure: ProtectProbeFailure | null,
		protect: ProtectPresence,
	): ProtectProbeClassification => {
		const result = classifyProbe(input);

		expect(result.status).toBe(status);
		expect(result.failure).toBe(failure);
		expect(result.protect).toBe(protect);

		return result;
	};

	it('console with Protect (401)', () => {
		const result = expectClassification(
			{ system: sys200, protect: http(401) },
			ProtectProbeStatus.CONSOLE,
			null,
			ProtectPresence.PRESENT,
		);

		expect(result.system?.model).toBe('UNVR');
	});

	it('Protect behind 403', () =>
		void expectClassification(
			{ system: sys200, protect: http(403) },
			ProtectProbeStatus.CONSOLE,
			null,
			ProtectPresence.PRESENT,
		));

	it('console without Protect (404)', () =>
		void expectClassification(
			{ system: sys200, protect: http(404) },
			ProtectProbeStatus.CONSOLE,
			null,
			ProtectPresence.ABSENT,
		));

	it('Protect answers 502', () =>
		void expectClassification(
			{ system: sys200, protect: http(502) },
			ProtectProbeStatus.CONSOLE,
			null,
			ProtectPresence.UNKNOWN,
		));

	it('Protect request times out', () =>
		void expectClassification(
			{ system: sys200, protect: fail('timeout') },
			ProtectProbeStatus.CONSOLE,
			null,
			ProtectPresence.UNKNOWN,
		));

	it('system 404 (a non-console is never reported as having Protect)', () => {
		const result = expectClassification(
			{ system: http(404), protect: http(401) },
			ProtectProbeStatus.NOT_CONSOLE,
			null,
			ProtectPresence.UNKNOWN,
		);

		expect(result.system).toBeNull();
	});

	it('system body is HTML', () =>
		void expectClassification(
			{ system: { ok: true, statusCode: 200, body: '<html>' }, protect: http(401) },
			ProtectProbeStatus.NOT_CONSOLE,
			null,
			ProtectPresence.UNKNOWN,
		));

	it('system protocol error (oversized body)', () =>
		void expectClassification(
			{ system: fail('protocol'), protect: http(401) },
			ProtectProbeStatus.NOT_CONSOLE,
			null,
			ProtectPresence.UNKNOWN,
		));

	it.each([
		['timeout', ProtectProbeFailure.TIMEOUT],
		['refused', ProtectProbeFailure.CONNECTION_REFUSED],
		['unreachable', ProtectProbeFailure.HOST_UNREACHABLE],
		['dns', ProtectProbeFailure.DNS_FAILURE],
		['tls', ProtectProbeFailure.TLS_FAILURE],
	] as const)('system %s is unreachable', (kind, failure) => {
		const result = expectClassification(
			{ system: fail(kind), protect: fail(kind) },
			ProtectProbeStatus.UNREACHABLE,
			failure,
			ProtectPresence.UNKNOWN,
		);

		expect(result.system).toBeNull();
	});
});
