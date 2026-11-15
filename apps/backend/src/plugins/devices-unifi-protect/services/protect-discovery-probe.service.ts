import { Inject, Injectable } from '@nestjs/common';

import { ProtectProbeHttp, classifyProbe } from './protect-discovery-probe';
import {
	ProtectCertificateCheck,
	ProtectProbeTarget,
	ProtectProbeTransport,
} from './protect-discovery-probe.transport';
import {
	PROTECT_PROBE_PROTECT_PATH,
	PROTECT_PROBE_SYSTEM_PATH,
	PROTECT_PROBE_TIMEOUT_MS,
	PROTECT_PROBE_TRANSPORT,
	ProtectPresence,
	ProtectProbeFailure,
	ProtectProbeStatus,
} from './protect-discovery.constants';

export interface ProtectProbeCertificate {
	checked: true;
	domain: string;
	valid: boolean | null;
	errorCode: string | null;
	validTo: string | null;
	domainResolvesToHost: boolean;
}

export interface ProtectProbeResult {
	host: string;
	port: number;
	status: ProtectProbeStatus;
	failure: ProtectProbeFailure | null;
	protect: ProtectPresence;
	model: string | null;
	name: string | null;
	mac: string | null;
	deviceState: string | null;
	directConnectDomain: string | null;
	certificate: ProtectProbeCertificate | null;
	preferredHost: string | null;
}

@Injectable()
export class ProtectDiscoveryProbeService {
	constructor(@Inject(PROTECT_PROBE_TRANSPORT) private readonly transport: ProtectProbeTransport) {}

	/** Never rejects. Sends no credentials. */
	async probe(target: ProtectProbeTarget): Promise<ProtectProbeResult> {
		const base = { host: target.host, port: target.port };

		try {
			const [system, protect] = await Promise.all([
				this.transport.get(target, PROTECT_PROBE_SYSTEM_PATH, PROTECT_PROBE_TIMEOUT_MS),
				this.transport.get(target, PROTECT_PROBE_PROTECT_PATH, PROTECT_PROBE_TIMEOUT_MS),
			] as Promise<ProtectProbeHttp>[]);
			const verdict = classifyProbe({ system, protect });
			const info = verdict.system;

			const result: ProtectProbeResult = {
				...base,
				status: verdict.status,
				failure: verdict.failure,
				protect: verdict.protect,
				model: info?.model ?? null,
				name: info?.name ?? null,
				mac: info?.mac ?? null,
				deviceState: info?.deviceState ?? null,
				directConnectDomain: info?.directConnectDomain ?? null,
				certificate: null,
				preferredHost: null,
			};

			if (verdict.status !== ProtectProbeStatus.CONSOLE) {
				return result;
			}

			result.preferredHost = target.host;

			const domain = result.directConnectDomain;

			if (domain === null) {
				return result;
			}

			const [check, domainAddrs, hostAddrs] = await Promise.all([
				this.transport.checkCertificate(target, domain, PROTECT_PROBE_TIMEOUT_MS),
				this.transport.resolveAll(domain),
				this.transport.resolveAll(target.host),
			]);
			const domainResolvesToHost = domainAddrs.some((address) => hostAddrs.includes(address));

			result.certificate = this.toCertificate(domain, check, domainResolvesToHost);

			if (result.certificate.valid === true && domainResolvesToHost) {
				result.preferredHost = domain;
			}

			return result;
		} catch {
			return {
				...base,
				status: ProtectProbeStatus.UNREACHABLE,
				failure: ProtectProbeFailure.HOST_UNREACHABLE,
				protect: ProtectPresence.UNKNOWN,
				model: null,
				name: null,
				mac: null,
				deviceState: null,
				directConnectDomain: null,
				certificate: null,
				preferredHost: null,
			};
		}
	}

	private toCertificate(
		domain: string,
		check: ProtectCertificateCheck,
		domainResolvesToHost: boolean,
	): ProtectProbeCertificate {
		if ('kind' in check) {
			return { checked: true, domain, valid: null, errorCode: check.kind, validTo: null, domainResolvesToHost };
		}

		return {
			checked: true,
			domain,
			valid: check.valid,
			errorCode: check.errorCode,
			validTo: check.valid ? check.validTo : null,
			domainResolvesToHost,
		};
	}
}
