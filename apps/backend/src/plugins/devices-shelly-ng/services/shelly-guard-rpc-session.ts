import { createHash, randomUUID } from 'node:crypto';
import { RpcParams } from 'shellies-ds9';

import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';
import { guardScriptReadiness } from '../contracts/guard-script.contract';
import {
	ShellyProtectiveCommandResult,
	ShellyProtectiveQualification,
	protectiveReadiness,
} from '../contracts/protective-switch.contract';

import { guardedShellyHttp } from './guarded-shelly-http';
import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';

interface GuardStatus {
	protocol: string;
	deviceId: string;
	firmware: string;
	componentId: number;
	evidenceId: string;
	epoch: number;
	nowMs: number;
	ready: boolean;
	busy: boolean;
	fault: unknown;
	floorSafe: boolean;
	output: boolean;
}
export interface ShellyGuardFenceReadback {
	readonly proofId: string;
	readonly connectionIdentity: string;
	readonly output: false;
	readonly epoch: number;
	readonly wasOn: boolean;
	readonly evidence: PropertySampleEvidence & { readonly observedAt: Date; readonly provenance: 'live' };
	readonly isCurrent: () => boolean;
}
/** Captured real provider lease. Unknown responses and changed source/configuration never mint proof. */
export class ShellyGuardRpcSession {
	readonly connectionIdentity = randomUUID();
	constructor(
		private readonly rpc: GuardedShellyRpcHandler,
		private readonly componentId: number,
		private readonly qualification: ShellyProtectiveQualification,
		private readonly sourceIsCurrent: () => boolean,
	) {}
	isCurrent(): boolean {
		return (
			this.sourceIsCurrent() &&
			protectiveReadiness(
				{
					deviceId: this.qualification.deviceId,
					model: this.qualification.model,
					firmware: this.qualification.firmware,
				},
				this.componentId,
				this.qualification,
			).length === 0 &&
			this.rpc.connected &&
			guardScriptReadiness(this.qualification.guardScript).length === 0 &&
			this.rpc.hostname === this.qualification.guardScript.endpointHostname
		);
	}
	private async execute<T>(method: string, params: RpcParams, isCurrent: () => boolean, deadline: number): Promise<T> {
		if (!this.isCurrent() || !isCurrent()) throw new Error('Guard RPC lease expired');
		const request = this.rpc.withSendGuard(
			() => this.isCurrent() && isCurrent() && Date.now() < deadline,
			() => this.rpc.request<T>(method, params),
		);
		let timer: ReturnType<typeof setTimeout>;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Guard RPC deadline expired')), Math.max(0, deadline - Date.now()));
		});
		return Promise.race([Promise.resolve(request), timeout]).finally(() => clearTimeout(timer));
	}
	private async guardRequest<T>(
		action: 'status' | 'on' | 'fence',
		params: Record<string, number>,
		guard: () => boolean,
		deadline: number,
		onSend?: () => void,
	): Promise<T> {
		const script = this.qualification.guardScript;
		if (!script || !this.isCurrent() || !guard()) throw new Error('Guard HTTP lease expired');
		const url = new URL(`http://${script.endpointHostname}/script/${script.scriptId}/spguard`);
		url.search = new URLSearchParams({
			action,
			nonce: randomUUID(),
			...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
		}).toString();
		return guardedShellyHttp<T>(url, deadline, () => this.isCurrent() && guard(), undefined, onSend);
	}

	private async inspect(isCurrent: () => boolean, deadline: number): Promise<GuardStatus | null> {
		const script = this.qualification.guardScript;
		if (!script || !this.isCurrent()) return null;
		const info = await this.execute<{ id: string; model: string; fw_id: string; mac: string }>(
			'Shelly.GetDeviceInfo',
			{},
			isCurrent,
			deadline,
		);
		if (
			info.id !== this.qualification.deviceId ||
			info.model !== this.qualification.model ||
			info.fw_id !== this.qualification.firmware ||
			info.mac?.replace(/[:-]/g, '').toUpperCase() !== script.canonicalMac.toUpperCase()
		)
			return null;
		const hash = createHash('sha256');
		let offset = 0;
		for (let chunk = 0; chunk < 64; chunk++) {
			const code = await this.execute<{ data: string; left: number }>(
				'Script.GetCode',
				{ id: script.scriptId, offset, len: 1024 },
				isCurrent,
				deadline,
			);
			if (typeof code.data !== 'string' || !Number.isSafeInteger(code.left) || code.left < 0) return null;
			const bytes = Buffer.byteLength(code.data, 'utf8');
			if (bytes > 1024 || (bytes === 0 && code.left > 0)) return null;
			hash.update(code.data, 'utf8');
			offset += bytes;
			if (code.left === 0) break;
			if (chunk === 63) return null;
		}
		if (hash.digest('hex') !== script.sourceHash) return null;
		const status = await this.guardRequest<GuardStatus>('status', {}, isCurrent, deadline);
		if (
			!status ||
			status.protocol !== script.protocol ||
			status.deviceId !== info.id ||
			status.firmware !== info.fw_id ||
			status.componentId !== this.componentId ||
			status.evidenceId !== script.evidenceId ||
			!Number.isSafeInteger(status.epoch) ||
			status.epoch < 1 ||
			!Number.isSafeInteger(status.nowMs) ||
			status.nowMs < 0 ||
			status.ready !== true ||
			status.fault !== null ||
			typeof status.output !== 'boolean' ||
			!this.isCurrent() ||
			!isCurrent()
		)
			return null;
		return status;
	}
	async on(leaseSeconds: number, timeoutMs: number, isAdmitted: () => boolean): Promise<ShellyProtectiveCommandResult> {
		const deadline = Date.now() + timeoutMs;
		const guard = () => this.isCurrent() && isAdmitted() && Date.now() < deadline;
		let onSendStarted = false;
		try {
			const status = await this.inspect(guard, deadline);
			const bounds = this.qualification.testedLeaseSeconds;
			if (
				!status ||
				status.busy ||
				!status.floorSafe ||
				!Number.isFinite(leaseSeconds) ||
				leaseSeconds < bounds.min ||
				leaseSeconds > bounds.max
			)
				return { outcome: 'refused', reasons: ['ordered_script_not_ready'] };
			// Compute from the status observation, never from the later acknowledgement or retry time.
			const untilMs = status.nowMs + Math.floor(leaseSeconds * 1000);
			const result = await this.guardRequest<{ accepted: boolean; epoch: number; untilMs: number }>(
				'on',
				{ epoch: status.epoch, untilMs },
				guard,
				deadline,
				() => {
					onSendStarted = true;
				},
			);
			if (!guard() || result?.accepted !== true || result.epoch !== status.epoch || result.untilMs !== untilMs)
				return { outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false };
			return { outcome: 'accepted', wasOn: status.output, outputConfirmed: false, pendingOnDrained: false };
		} catch {
			if (!onSendStarted) return { outcome: 'refused', reasons: ['ordered_script_not_ready'] };
			return { outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false };
		}
	}
	async fence(timeoutMs: number, isAdmitted: () => boolean): Promise<ShellyGuardFenceReadback | null> {
		const deadline = Date.now() + timeoutMs;
		const guard = () => this.isCurrent() && isAdmitted() && Date.now() < deadline;
		try {
			const status = await this.inspect(guard, deadline);
			if (!status) return null;
			const observedAt = new Date();
			const result = await this.guardRequest<{
				epoch: number;
				deviceId: string;
				componentId: number;
				evidenceId: string;
				output: boolean;
				localOnDrained: boolean;
			}>('fence', {}, guard, deadline);
			const receivedAt = new Date();
			if (
				!guard() ||
				result?.epoch !== status.epoch + 1 ||
				result.deviceId !== status.deviceId ||
				result.componentId !== this.componentId ||
				result.evidenceId !== this.qualification.guardScript.evidenceId ||
				result.output !== false ||
				result.localOnDrained !== true
			)
				return null;
			return Object.freeze({
				proofId: randomUUID(),
				connectionIdentity: this.connectionIdentity,
				output: false,
				epoch: result.epoch,
				wasOn: status.output,
				isCurrent: () => this.isCurrent() && isAdmitted(),
				evidence: {
					sampledAt: receivedAt,
					receivedAt,
					observedAt,
					provenance: 'live' as const,
					isCurrent: () => this.isCurrent() && isAdmitted(),
					sourceIsCurrent: () => this.isCurrent(),
				},
			});
		} catch {
			return null;
		}
	}
}
