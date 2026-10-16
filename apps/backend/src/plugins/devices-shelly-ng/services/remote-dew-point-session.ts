import { randomUUID } from 'node:crypto';

import { AuthenticatedShellyRequestError, AuthenticatedShellyScriptHttp } from './authenticated-shelly-script-http';
import { RemoteDewPointArtifact } from './remote-dew-point-artifact';
import {
	REMOTE_DEW_POINT_PROTOCOL,
	RemoteDewPointDeadline,
	RemoteDewPointPacket,
	RemoteDewPointStatus,
} from './remote-dew-point-lease.contract';

interface RemoteResult {
	protocol: string;
	artifact: string;
	epoch: number;
	sequence: number;
	requestId: string;
	untilDeviceUptimeMs: number;
	accepted: boolean;
	output: boolean;
	pendingOn: boolean;
	drained: boolean;
	wasOn?: boolean;
}
interface RemoteRequest {
	readonly packet: Readonly<RemoteDewPointPacket>;
	readonly deadline: RemoteDewPointDeadline;
	readonly sourceDeadline: RemoteDewPointDeadline;
	readonly sourceExpiresAt: number;
	/** The first dispatch's captured source/graph/request/ownership fence is never replaced by a retry. */
	readonly originalIsCurrent: () => boolean;
}
export type RemoteCoolingResult = {
	outcome: 'accepted' | 'refused' | 'unknown';
	pendingOnDrained: false;
	reasons: string[];
	wasOn?: boolean;
};

/** Authenticated finite remote threshold session. ACKs never become installation or drainage proofs. */
export class RemoteDewPointSession {
	private tail: Promise<unknown> = Promise.resolve();
	private epoch: number | null = null;
	private sequence = 0;
	private authorityGeneration = 0;
	private readonly requests = new Map<string, Readonly<RemoteRequest>>();
	private mutationUncertain = false;
	private restartDrainUncertain = false;
	private pendingOnPacket: Readonly<RemoteDewPointPacket> | null = null;
	private unresolved: Readonly<RemoteRequest> | null = null;
	constructor(
		private readonly http: AuthenticatedShellyScriptHttp,
		private readonly artifact: RemoteDewPointArtifact,
	) {}

	private async status(
		deadline: RemoteDewPointDeadline,
		isCurrent: () => boolean,
		fence = false,
	): Promise<RemoteDewPointStatus> {
		const status = await this.http.request<RemoteDewPointStatus>('GET', null, deadline, isCurrent);
		const b = this.artifact.binding;
		if (
			!status ||
			status.protocol !== REMOTE_DEW_POINT_PROTOCOL ||
			status.artifact !== this.artifact.artifactId ||
			status.sessionId !== `${this.artifact.artifactId}:${status.epoch}` ||
			status.auth_en !== true ||
			status.deviceId !== b.deviceId ||
			status.model !== b.model ||
			status.firmware !== b.firmware ||
			!Number.isSafeInteger(status.epoch) ||
			status.epoch < 1 ||
			!Number.isSafeInteger(status.sequence) ||
			status.sequence < 0 ||
			!Number.isFinite(status.uptimeMs) ||
			status.uptimeMs < 0 ||
			(!fence && status.ready !== true) ||
			typeof status.pendingOn !== 'boolean' ||
			typeof status.output !== 'boolean'
		)
			throw new AuthenticatedShellyRequestError('Remote profile/auth/identity/epoch mismatch');
		if (!fence && this.epoch !== null && this.epoch !== status.epoch && this.pendingOnPacket)
			throw new AuthenticatedShellyRequestError('Remote restart with unresolved ON; actual OFF/drain required');
		this.epoch = status.epoch;
		this.sequence = Math.max(this.sequence, status.sequence);
		return status;
	}

	/** The caller captures evidence expiry once and supplies a pure final branch/ownership/source fence. */
	send(
		action: 'on' | 'threshold',
		thresholdC: number,
		deadline: RemoteDewPointDeadline,
		isCurrent: () => boolean,
		requestId: string = randomUUID(),
	): Promise<RemoteCoolingResult> {
		const generation = this.authorityGeneration;
		const current = () => generation === this.authorityGeneration && isCurrent();
		return this.serialize(async () => {
			const existing = this.requests.get(requestId);
			if (existing) {
				if (
					existing.packet.action !== action ||
					existing.packet.thresholdC !== thresholdC ||
					existing.sourceExpiresAt !== deadline.expiresAt ||
					existing.packet.artifact !== this.artifact.artifactId ||
					existing.packet.controllerRevision !== this.artifact.binding.controllerRevision ||
					existing.packet.protectionFingerprint !== this.artifact.binding.protectionFingerprint ||
					existing.packet.epoch !== this.epoch
				)
					return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_request_conflict'] };
				return this.transmit(existing, current);
			}
			if (this.requests.size >= 256)
				return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_journal_capacity'] };
			if (this.mutationUncertain || this.restartDrainUncertain)
				return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_unresolved_on'] };
			if (!current() || !Number.isFinite(thresholdC) || thresholdC <= -45 || thresholdC > 60)
				return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_evidence_or_threshold'] };
			try {
				const status = await this.status(deadline, current);
				const until = deadline.deviceExpiry(status, this.artifact.binding.timing);
				if (until === null || (action === 'on' && status.pendingOn))
					return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_lifetime_or_pending_release'] };
				const packet: Readonly<RemoteDewPointPacket> = Object.freeze({
					protocol: REMOTE_DEW_POINT_PROTOCOL,
					artifact: this.artifact.artifactId,
					epoch: status.epoch,
					sequence: ++this.sequence,
					requestId,
					controllerRevision: this.artifact.binding.controllerRevision,
					protectionFingerprint: this.artifact.binding.protectionFingerprint,
					action,
					thresholdC,
					untilDeviceUptimeMs: until,
				});
				const packetDeadline = new RemoteDewPointDeadline(
					Math.min(deadline.expiresAt, Date.now() + until - status.uptimeMs),
				);
				const request: Readonly<RemoteRequest> = Object.freeze({
					packet,
					deadline: packetDeadline,
					sourceDeadline: deadline,
					sourceExpiresAt: deadline.expiresAt,
					originalIsCurrent: current,
				});
				this.requests.set(requestId, request);
				return this.transmit(request, current);
			} catch {
				return { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_status_or_authentication'] };
			}
		});
	}

	/** Exact tuple only; no renewed deadline, sequence, epoch, request ID or threshold after ambiguity. */
	retry(isCurrent: () => boolean): Promise<RemoteCoolingResult> {
		const generation = this.authorityGeneration;
		const request = this.unresolved;
		return this.serialize(async () =>
			request
				? this.transmit(request, () => generation === this.authorityGeneration && isCurrent())
				: { outcome: 'refused', pendingOnDrained: false, reasons: ['remote_no_exact_retry'] },
		);
	}

	private async transmit(
		request: Readonly<RemoteRequest>,
		attemptIsCurrent: () => boolean,
	): Promise<RemoteCoolingResult> {
		const { packet, deadline, sourceDeadline } = request;
		const isCurrent = () =>
			request.originalIsCurrent() &&
			attemptIsCurrent() &&
			!this.restartDrainUncertain &&
			this.epoch === packet.epoch &&
			this.sequence === packet.sequence &&
			packet.artifact === this.artifact.artifactId &&
			packet.controllerRevision === this.artifact.binding.controllerRevision &&
			packet.protectionFingerprint === this.artifact.binding.protectionFingerprint &&
			Math.min(deadline.remaining(), sourceDeadline.remaining()) >= this.artifact.binding.timing.minimumLifetimeMs;
		if (!isCurrent())
			return {
				outcome: 'refused',
				pendingOnDrained: false,
				reasons: ['remote_original_evidence_or_authority_revoked'],
			};
		let sent = false;
		try {
			const result = await this.http.request<RemoteResult>('POST', packet, deadline, isCurrent, () => {
				sent = true;
				this.mutationUncertain = true;
				this.unresolved = request;
				if (packet.action === 'on') this.pendingOnPacket ??= packet;
			});
			if (
				!isCurrent() ||
				!result ||
				result.protocol !== packet.protocol ||
				result.artifact !== packet.artifact ||
				result.epoch !== packet.epoch ||
				result.sequence !== packet.sequence ||
				result.requestId !== packet.requestId ||
				result.untilDeviceUptimeMs !== packet.untilDeviceUptimeMs ||
				result.accepted !== true
			)
				throw new AuthenticatedShellyRequestError('Remote command refused or mismatched', sent);
			this.mutationUncertain = false;
			// Even a matching ACK leaves an ON unresolved until separately qualified actual OFF/readback/drain.
			if (packet.action === 'threshold' && !this.pendingOnPacket && !result.output && !result.pendingOn)
				this.unresolved = null;
			return { outcome: 'accepted', pendingOnDrained: false, reasons: [], wasOn: result.wasOn };
		} catch (error) {
			const ambiguous = sent || (error instanceof AuthenticatedShellyRequestError && error.mutationMayHaveBeenSent);
			return {
				outcome: ambiguous ? 'unknown' : 'refused',
				pendingOnDrained: false,
				reasons: [ambiguous ? 'remote_mutation_unresolved' : 'remote_auth_or_authority_refused'],
			};
		}
	}

	/** Revoke queued ON authority synchronously, before awaiting any network or storage operation. */
	off(deadline: RemoteDewPointDeadline, ownershipIsCurrent: () => boolean): Promise<RemoteCoolingResult> {
		this.authorityGeneration++;
		return this.serialize(() => this.physicalOff(deadline, ownershipIsCurrent));
	}

	private async physicalOff(deadline: RemoteDewPointDeadline, current: () => boolean): Promise<RemoteCoolingResult> {
		const requestId = randomUUID();
		try {
			const result = await this.http.request<RemoteResult>(
				'POST',
				{
					protocol: REMOTE_DEW_POINT_PROTOCOL,
					artifact: this.artifact.artifactId,
					action: 'off',
					epoch: this.epoch,
					sequence: this.sequence,
					requestId,
				},
				deadline,
				current,
			);
			if (
				!result ||
				result.protocol !== REMOTE_DEW_POINT_PROTOCOL ||
				result.artifact !== this.artifact.artifactId ||
				result.requestId !== requestId ||
				result.accepted !== true ||
				typeof result.wasOn !== 'boolean' ||
				!Number.isSafeInteger(result.epoch) ||
				result.epoch < 1
			)
				throw new Error('Unconfirmed OFF');
			if (this.pendingOnPacket && this.epoch !== null && result.epoch !== this.epoch + 1)
				this.restartDrainUncertain = true;
			this.epoch = result.epoch;
			this.sequence = 0;
			return {
				outcome: 'accepted',
				wasOn: result.wasOn,
				pendingOnDrained: false,
				reasons: ['actual_off_readback_and_drain_required'],
			};
		} catch {
			return { outcome: 'unknown', pendingOnDrained: false, reasons: ['remote_off_unconfirmed'] };
		}
	}

	/** Neither epoch rotation nor repeated fences erase an uncertain native ON across restart. */
	fence(
		deadline: RemoteDewPointDeadline,
		isCurrent: () => boolean,
	): Promise<{ status: RemoteDewPointStatus; observedAt: Date; receivedAt: Date } | null> {
		this.authorityGeneration++;
		return this.serialize(async () => {
			const observedAt = new Date();
			let before: RemoteDewPointStatus | null = null;
			try {
				const previousEpoch = this.epoch;
				before = await this.status(deadline, isCurrent, true);
				if (this.pendingOnPacket && previousEpoch !== null && previousEpoch !== before.epoch)
					this.restartDrainUncertain = true;
			} catch {
				if (this.pendingOnPacket) this.restartDrainUncertain = true;
			}
			// An unavailable status or sticky uncertainty must still attempt the physical OFF.
			const off = await this.physicalOff(deadline, isCurrent);
			if (!before || off.outcome !== 'accepted' || this.restartDrainUncertain) return null;
			const fencedEpoch = this.epoch;
			try {
				for (let attempt = 0; attempt < 3 && deadline.remaining() > 0; attempt++) {
					const status = await this.status(deadline, isCurrent, true);
					if (!isCurrent() || status.epoch !== fencedEpoch || status.epoch <= before.epoch) return null;
					if (status.ready && !status.output && !status.pendingOn && status.drained === true && status.sequence === 0) {
						this.mutationUncertain = false;
						this.pendingOnPacket = null;
						this.unresolved = null;
						this.requests.clear();
						return { status, observedAt, receivedAt: new Date() };
					}
				}
			} catch {
				/* A timeout, ACK or new epoch is never drainage proof. */
			}
			return null;
		});
	}

	private serialize<T>(operation: () => Promise<T>): Promise<T> {
		const next = this.tail.then(operation, operation);
		this.tail = next.catch(() => undefined);
		return next;
	}
}
