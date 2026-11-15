import { isDnsHostname, normalizeMacString, sanitizeText } from './protect-discovery-text';
import {
	ProtectPresence,
	ProtectProbeFailure,
	ProtectProbeStatus,
	ProtectTransportErrorKind,
} from './protect-discovery.constants';

export type ProtectProbeHttp =
	| { ok: true; statusCode: number; body: string }
	| { ok: false; kind: ProtectTransportErrorKind; code: string | null };

export interface ParsedProtectSystem {
	model: string;
	name: string | null;
	mac: string | null;
	deviceState: string | null;
	directConnectDomain: string | null;
}

export interface ProtectProbeClassification {
	status: ProtectProbeStatus;
	failure: ProtectProbeFailure | null;
	protect: ProtectPresence;
	system: ParsedProtectSystem | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string | null => (typeof value === 'string' ? sanitizeText(value) : null);

/** The fixed projection of `GET /api/system`; null unless `hardware.shortname` is a usable string. */
export const parseSystemInfo = (body: string): ParsedProtectSystem | null => {
	let json: unknown;

	try {
		json = JSON.parse(body);
	} catch {
		return null;
	}

	const root = asRecord(json);
	const model = text(asRecord(root?.['hardware'])?.['shortname']);

	if (root === null || model === null) {
		return null;
	}

	const mac = text(root['mac']);
	const domain = text(root['directConnectDomain']);

	return {
		model,
		name: text(root['name']),
		mac: mac === null ? null : normalizeMacString(mac),
		deviceState: text(root['deviceState']),
		directConnectDomain: domain !== null && isDnsHostname(domain) ? domain : null,
	};
};

const FAILURES: Partial<Record<ProtectTransportErrorKind, ProtectProbeFailure>> = {
	timeout: ProtectProbeFailure.TIMEOUT,
	refused: ProtectProbeFailure.CONNECTION_REFUSED,
	unreachable: ProtectProbeFailure.HOST_UNREACHABLE,
	dns: ProtectProbeFailure.DNS_FAILURE,
	tls: ProtectProbeFailure.TLS_FAILURE,
};

const classifyProtect = (protect: ProtectProbeHttp): ProtectPresence => {
	if ('kind' in protect) {
		return ProtectPresence.UNKNOWN;
	}

	if (protect.statusCode === 401 || protect.statusCode === 403) {
		return ProtectPresence.PRESENT;
	}

	return protect.statusCode === 404 ? ProtectPresence.ABSENT : ProtectPresence.UNKNOWN;
};

/** Pure: turns the two unauthenticated GET outcomes into a console verdict. Protect is only judged for a console. */
export const classifyProbe = (input: {
	system: ProtectProbeHttp;
	protect: ProtectProbeHttp;
}): ProtectProbeClassification => {
	const notConsole: ProtectProbeClassification = {
		status: ProtectProbeStatus.NOT_CONSOLE,
		failure: null,
		protect: ProtectPresence.UNKNOWN,
		system: null,
	};

	if ('kind' in input.system) {
		const failure = FAILURES[input.system.kind];

		return failure === undefined
			? notConsole
			: { status: ProtectProbeStatus.UNREACHABLE, failure, protect: ProtectPresence.UNKNOWN, system: null };
	}

	const system = input.system.statusCode === 200 ? parseSystemInfo(input.system.body) : null;

	if (system === null) {
		return notConsole;
	}

	return { status: ProtectProbeStatus.CONSOLE, failure: null, protect: classifyProtect(input.protect), system };
};
