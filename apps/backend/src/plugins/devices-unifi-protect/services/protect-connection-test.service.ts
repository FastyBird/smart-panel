import { Inject, Injectable, Optional } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PROTECT_API_CLIENT_FACTORY, ProtectApiClientFactory } from '../client/protect-api-client.factory';
import { ProtectApiClient } from '../client/protect-api.client';
import { ProtectConsoleSystem } from '../client/protect-api.types';
import { fetchProtectConsoleSystem } from '../client/protect-console-system';
import { ProtectCertificateInfo, inspectProtectCertificate } from '../client/protect-https-agent';
import { ProtectTlsSettings, fingerprintsEqual } from '../client/protect-tls-policy';
import { isSupportedProtectVersion } from '../client/protect-version';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_DEFAULT_PORT,
	PROTECT_MIN_VERSION,
	PROTECT_TLS_MODES,
	PROTECT_TRUSTED_CA,
} from '../devices-unifi-protect.constants';
import {
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionMode,
	ProtectTestSavedConnectionDto,
} from '../dto/test-connection.dto';
import {
	PROTECT_ERROR_MESSAGES,
	ProtectApiError,
	ProtectErrorCategory,
	toProtectApiError,
} from '../errors/protect-api.error';
import { ProtectConfigModel } from '../models/config.model';
import { ProtectCertificateModel, ProtectTestConnectionModel } from '../models/test-connection.model';
import {
	isValidProtectHost,
	isValidProtectServerName,
	normalizeProtectFingerprint,
} from '../validators/protect-config.validators';

const CERTIFICATE_PERIOD_WARNING = 'The console certificate is outside its validity period';

const CANDIDATE_KEYS: readonly string[] = ['mode', 'host', 'port', 'apiKey', 'tls'];

interface ResolvedConnection {
	host: string;
	port: number;
	apiKey: string;
	tls: ProtectTlsSettings;
}

const validation = (): ProtectApiError => new ProtectApiError(ProtectErrorCategory.VALIDATION, 'tls');

/** Names of the properties a request carries with a value; a property set to `undefined` counts as absent. */
const submittedKeys = (request: object): string[] =>
	Object.entries(request)
		.filter(([, value]) => value !== undefined)
		.map(([key]) => key);

/**
 * Tests a console connection without ever sending the API key to a peer that is not accepted first: the presented
 * certificate is inspected and judged (chain and name, or pin) before any client holding the key is created. A saved
 * test uses the stored settings only; a candidate test uses only what it submits, including a new key, so the stored
 * key never travels to a submitted host. Every outcome is a result; this service never throws.
 */
@Injectable()
export class ProtectConnectionTestService {
	constructor(
		private readonly configService: ConfigService,
		@Inject(PROTECT_API_CLIENT_FACTORY) private readonly clientFactory: ProtectApiClientFactory,
		@Optional() @Inject(PROTECT_TRUSTED_CA) private readonly trustedCa?: string,
	) {}

	async testConnection(
		request: ProtectTestSavedConnectionDto | ProtectTestCandidateConnectionDto,
	): Promise<ProtectTestConnectionModel> {
		const result = this.createResult(request?.mode);
		let client: ProtectApiClient | null = null;

		try {
			const connection = this.resolve(request);

			result.tlsMode = connection.tls.mode;

			const certificate = await inspectProtectCertificate({
				host: connection.host,
				port: connection.port,
				serverName: connection.tls.serverName,
				trustedCa: this.trustedCa,
			});

			this.applyCertificate(result, certificate);
			this.applySystem(result, await this.readSystem(connection));
			this.judgeCertificate(connection.tls, certificate);

			client = this.clientFactory.create({
				host: connection.host,
				port: connection.port,
				apiKey: connection.apiKey,
				tls: connection.tls,
			});

			const meta = await client.getMetaInfo();

			result.applicationVersion = meta.applicationVersion;
			result.versionSupported = isSupportedProtectVersion(meta.applicationVersion);

			if (!result.versionSupported) {
				throw new ProtectApiError(ProtectErrorCategory.VERSION_UNSUPPORTED, 'meta/info');
			}

			result.nvrName = (await client.getNvr()).name;
			result.success = true;
		} catch (error) {
			this.applyFailure(result, error);
		} finally {
			client?.close();
		}

		return result;
	}

	private resolve(request: ProtectTestSavedConnectionDto | ProtectTestCandidateConnectionDto): ResolvedConnection {
		if (request?.mode === ProtectTestConnectionMode.SAVED) {
			if (submittedKeys(request).some((key) => key !== 'mode')) {
				throw validation();
			}

			return this.validated(this.readSaved());
		}

		if (request?.mode !== ProtectTestConnectionMode.CANDIDATE) {
			throw validation();
		}

		if (submittedKeys(request).some((key) => !CANDIDATE_KEYS.includes(key))) {
			throw validation();
		}

		return this.validated({
			host: request.host,
			port: request.port ?? PROTECT_DEFAULT_PORT,
			apiKey: request.apiKey,
			tls: {
				mode: request.tls?.mode ?? 'verify',
				serverName: request.tls?.serverName ?? null,
				fingerprintSha256: request.tls?.fingerprintSha256 ?? null,
			},
		});
	}

	private readSaved(): Record<keyof ResolvedConnection, unknown> {
		let config: ProtectConfigModel;

		try {
			config = this.configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME);
		} catch {
			throw validation();
		}

		return {
			host: config.host,
			port: config.port,
			apiKey: config.apiKey,
			tls: {
				mode: config.tls.mode,
				serverName: config.tls.serverName,
				fingerprintSha256: config.tls.fingerprintSha256,
			},
		};
	}

	/** Re-checks whatever the request or the stored config supplied; nothing is trusted because a DTO accepted it. */
	private validated(input: Record<keyof ResolvedConnection, unknown>): ResolvedConnection {
		const { host, port, apiKey } = input;
		const tls = input.tls as Record<keyof ProtectTlsSettings, unknown>;

		if (
			!isValidProtectHost(host) ||
			typeof port !== 'number' ||
			!Number.isInteger(port) ||
			port < 1 ||
			port > 65535 ||
			typeof apiKey !== 'string' ||
			apiKey.trim().length === 0 ||
			typeof tls.mode !== 'string' ||
			!(PROTECT_TLS_MODES as readonly string[]).includes(tls.mode)
		) {
			throw validation();
		}

		let serverName: string | null = null;

		if (tls.serverName !== undefined && tls.serverName !== null) {
			if (!isValidProtectServerName(tls.serverName)) {
				throw validation();
			}

			serverName = tls.serverName;
		}

		const fingerprint = normalizeProtectFingerprint(tls.fingerprintSha256);

		if (tls.mode === 'pinned' && fingerprint === null) {
			throw validation();
		}

		return {
			host,
			port,
			apiKey,
			tls: {
				mode: tls.mode as ProtectTlsSettings['mode'],
				serverName,
				fingerprintSha256: fingerprint,
			},
		};
	}

	/** The unauthenticated console facts; a failure here only means there is nothing to suggest. */
	private async readSystem(connection: ResolvedConnection): Promise<ProtectConsoleSystem | null> {
		try {
			return await fetchProtectConsoleSystem({ host: connection.host, port: connection.port });
		} catch {
			return null;
		}
	}

	/** The certificate decision, made before any request carries the API key. */
	private judgeCertificate(tls: ProtectTlsSettings, certificate: ProtectCertificateInfo): void {
		if (tls.mode === 'verify') {
			if (!certificate.trusted) {
				throw new ProtectApiError(ProtectErrorCategory.TLS_UNTRUSTED, 'tls');
			}

			return;
		}

		if (tls.fingerprintSha256 === null || !fingerprintsEqual(certificate.fingerprintSha256, tls.fingerprintSha256)) {
			throw new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls');
		}
	}

	private createResult(mode: ProtectTestConnectionMode): ProtectTestConnectionModel {
		return Object.assign(new ProtectTestConnectionModel(), {
			mode,
			success: false,
			tlsMode: null,
			certificate: null,
			directConnectDomain: null,
			suggestedServerName: null,
			consoleName: null,
			consoleModel: null,
			applicationVersion: null,
			minimumVersion: PROTECT_MIN_VERSION,
			versionSupported: null,
			nvrName: null,
			warnings: [],
			errorCategory: null,
			error: null,
		});
	}

	private applyCertificate(result: ProtectTestConnectionModel, info: ProtectCertificateInfo): void {
		result.certificate = Object.assign(new ProtectCertificateModel(), {
			fingerprintSha256: info.fingerprintSha256,
			subjectCommonName: info.subjectCommonName,
			issuerCommonName: info.issuerCommonName,
			subjectAltNames: info.subjectAltNames,
			validFrom: info.validFrom,
			validTo: info.validTo,
			selfSigned: info.selfSigned,
			trusted: info.trusted,
		});

		const now = Date.now();

		if (now < Date.parse(info.validFrom) || now > Date.parse(info.validTo)) {
			result.warnings.push(CERTIFICATE_PERIOD_WARNING);
		}
	}

	private applySystem(result: ProtectTestConnectionModel, system: ProtectConsoleSystem | null): void {
		if (system === null) {
			return;
		}

		result.directConnectDomain = system.directConnectDomain;
		// Only a suggestion for the administrator to confirm; it is never used as the name the certificate is checked against.
		result.suggestedServerName = isValidProtectServerName(system.directConnectDomain)
			? system.directConnectDomain
			: null;
		result.consoleName = system.name;
		result.consoleModel = system.shortname;
	}

	private applyFailure(result: ProtectTestConnectionModel, error: unknown): void {
		const category = (error instanceof ProtectApiError ? error : toProtectApiError(error, 'system')).category;

		result.success = false;
		result.errorCategory = category;
		result.error = PROTECT_ERROR_MESSAGES[category];
	}
}
