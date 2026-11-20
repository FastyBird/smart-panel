import {
	DevicesUnifiProtectPluginErrorCategory,
	DevicesUnifiProtectPluginTestCandidateConnectionMode,
	type DevicesUnifiProtectPluginTestConnectionRequestSchema,
	DevicesUnifiProtectPluginTestSavedConnectionMode,
	DevicesUnifiProtectPluginTlsMode,
} from '../../../openapi.constants';
import { isValidProtectHost, normalizeProtectFingerprint, protectServerNameFor } from '../schemas/config.schemas';
import type { IProtectConfigEditForm } from '../schemas/config.types';
import { protectProbeKey } from '../store/protect-discovery.store';
import type { IProtectDiscovery, IProtectProbe, IProtectTestConnection, IProtectTestTarget } from '../store/protect.types';

/** Why a connection test cannot run yet. */
export type ProtectTestHint = 'needs_key' | 'needs_host' | 'needs_port';

/** Whether the certificate of the current result may be trusted, and how: one click, or a confirmed pin replacement. */
export type ProtectTrustable = 'none' | 'untrusted' | 'changed';

export type IProtectConnectionFields = Pick<IProtectConfigEditForm, 'host' | 'port' | 'apiKey' | 'apiKeyConfigured' | 'tls'>;

export type ProtectTestPlan =
	| { request: DevicesUnifiProtectPluginTestConnectionRequestSchema; target: IProtectTestTarget }
	| { disabled: true; hint: ProtectTestHint };

/** The backend trims and lower-cases a host before it connects, so two spellings of one console compare equal. */
export const normalizeProtectHost = (host: string | null | undefined): string => (host ?? '').trim().toLowerCase();

const trimToNull = (value: string | null | undefined): string | null => {
	const trimmed = (value ?? '').trim();

	return trimmed === '' ? null : trimmed;
};

/** The pin compared and sent as the save would store it; an invalid value is kept so it still counts as a change. */
const normalizePin = (value: string | null | undefined): string | null => normalizeProtectFingerprint(value) ?? trimToNull(value);

/** Server names compare like DNS names: trimmed and case-insensitive. */
const normalizeServerName = (value: string | null | undefined): string | null => trimToNull(value)?.toLowerCase() ?? null;

/** The server name as a save would store it (see protectServerNameFor), compared like a DNS name. */
const effectiveServerName = (tls: IProtectConnectionFields['tls']): string | null => normalizeServerName(protectServerNameFor(tls));

const isValidPort = (port: unknown): port is number => typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;

/** The host, port, TLS mode and server name in the form, or null while no host is entered. */
export const protectTestTarget = (model: Pick<IProtectConnectionFields, 'host' | 'port' | 'tls'>): IProtectTestTarget | null => {
	const host = (model.host ?? '').trim();

	if (host === '') {
		return null;
	}

	return { host, port: model.port, tlsMode: DevicesUnifiProtectPluginTlsMode[model.tls.mode], serverName: protectServerNameFor(model.tls) };
};

/**
 * Whether a result belongs to the form's connection. In verify mode the server name is the SNI the chain was checked
 * against, so a result for another server name says nothing about this one.
 */
export const isSameProtectTarget = (a: IProtectTestTarget | null, b: IProtectTestTarget | null): boolean =>
	a !== null &&
	b !== null &&
	normalizeProtectHost(a.host) === normalizeProtectHost(b.host) &&
	a.port === b.port &&
	a.tlsMode === b.tlsMode &&
	(a.tlsMode !== DevicesUnifiProtectPluginTlsMode.verify || normalizeServerName(a.serverName) === normalizeServerName(b.serverName));

const connectionChanged = (model: IProtectConnectionFields, initial: IProtectConnectionFields): boolean => {
	if (normalizeProtectHost(model.host) !== normalizeProtectHost(initial.host) || model.port !== initial.port || model.tls.mode !== initial.tls.mode) {
		return true;
	}

	if (effectiveServerName(model.tls) !== effectiveServerName(initial.tls)) {
		return true;
	}

	// Saving drops the pin in verify mode, so only a pinned config is tested with one.
	return model.tls.mode === 'pinned' && normalizePin(model.tls.fingerprintSha256) !== normalizePin(initial.tls.fingerprintSha256);
};

/**
 * Chooses what a connection test runs with. A saved test uses the stored key, so it only answers for the stored host,
 * port and TLS settings. Anything relevant that differs needs a candidate test, and the backend never sends the stored
 * key to a submitted host, so a candidate needs a typed key. A key marked for removal is not tested at all.
 */
export const buildTestRequest = (model: IProtectConnectionFields, initial: IProtectConnectionFields): ProtectTestPlan => {
	const target = protectTestTarget(model);

	if (target === null || !isValidProtectHost(target.host)) {
		return { disabled: true, hint: 'needs_host' };
	}

	if (!isValidPort(model.port)) {
		return { disabled: true, hint: 'needs_port' };
	}

	if (typeof model.apiKey === 'string' && model.apiKey.trim() !== '') {
		const fingerprint = model.tls.mode === 'pinned' ? normalizePin(model.tls.fingerprintSha256) : null;

		return {
			request: {
				data: {
					mode: DevicesUnifiProtectPluginTestCandidateConnectionMode.candidate,
					host: target.host,
					port: model.port,
					api_key: model.apiKey.trim(),
					tls: { mode: target.tlsMode, server_name: target.serverName ?? null, fingerprint_sha256: fingerprint },
				},
			},
			target,
		};
	}

	if (model.apiKey === undefined && initial.apiKeyConfigured === true && !connectionChanged(model, initial)) {
		return { request: { data: { mode: DevicesUnifiProtectPluginTestSavedConnectionMode.saved } }, target };
	}

	return { disabled: true, hint: 'needs_key' };
};

/**
 * Trust is offered only for the two certificate failures (Q2): an untrusted chain in verify mode, and a pin the
 * presented certificate does not match in pinned mode. Replacing an existing pin needs confirmation (`changed`); with no
 * pin in the form there is nothing to replace, so it is a plain trust. `certificate.trusted` is chain trust, not a pin
 * match, so it decides nothing here. The caller passes only the current result of the current connection.
 */
export const protectTrustable = (
	result: IProtectTestConnection | null,
	tls: Pick<IProtectConfigEditForm['tls'], 'mode' | 'fingerprintSha256'>
): ProtectTrustable => {
	if (result === null || result.success || !result.certificate) {
		return 'none';
	}

	if (tls.mode === 'verify' && result.errorCategory === DevicesUnifiProtectPluginErrorCategory.tls_untrusted) {
		return 'untrusted';
	}

	if (tls.mode === 'pinned' && result.errorCategory === DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch) {
		return trimToNull(tls.fingerprintSha256) === null ? 'untrusted' : 'changed';
	}

	return 'none';
};

/** The latest probe of a host: a manual check, else the probe a discovery scan ran for a console at that address. */
export const findProtectProbe = (
	host: string | null | undefined,
	port: number,
	probes: Record<string, IProtectProbe>,
	discovery: IProtectDiscovery | null
): IProtectProbe | null => {
	if (normalizeProtectHost(host) === '') {
		return null;
	}

	const key = protectProbeKey(host ?? '', port);

	return probes[key] ?? discovery?.consoles.find((console) => protectProbeKey(console.probe.host, console.probe.port) === key)?.probe ?? null;
};

/** A date for display in the given (app) locale, or the raw value when it does not parse. */
export const formatProtectDate = (value: string, locale: string): string => {
	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
};
