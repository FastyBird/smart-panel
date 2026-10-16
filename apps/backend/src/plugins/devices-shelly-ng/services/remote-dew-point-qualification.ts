import { RemoteDewPointArtifact } from './remote-dew-point-artifact';
import {
	REMOTE_DEW_POINT_PROFILE,
	REMOTE_DEW_POINT_PROTOCOL,
	RemoteDewPointStatus,
} from './remote-dew-point-lease.contract';

/** Internal installation audit contract; there is no HTTP DTO or public boolean to supply it. */
export interface RemoteDewPointInstallationEvidence {
	readonly profile: typeof REMOTE_DEW_POINT_PROFILE;
	readonly version: 1;
	readonly protocol: typeof REMOTE_DEW_POINT_PROTOCOL;
	readonly publishedAlpha: string;
	readonly physicalIdentity: string;
	readonly deviceHardwareId: string;
	readonly deviceId: string;
	readonly model: string;
	readonly firmware: string;
	readonly artifactId: string;
	readonly compiledSha256: string;
	readonly surface: {
		readonly placementAuditId: string;
		readonly component: string;
		readonly peripheralFingerprint: string;
		readonly calibrationFingerprint: string;
		readonly domainMinimum: number;
		readonly domainMaximum: number;
	};
	readonly timingAuditId: string;
	readonly authenticationAuditId: string;
	readonly writerIsolationAuditId: string;
	readonly opposedOutputInterlockAuditId?: string | null;
	readonly nativeTimerAuditId: string;
	readonly restartDrainAuditId: string;
	readonly restartDrainObservation: {
		readonly epoch: number;
		readonly sessionId: string;
		readonly physicalIdentity: string;
		readonly artifactId: string;
		readonly compiledSha256: string;
		readonly coveredJournalIds: readonly string[];
		readonly observedAt: number;
		readonly nativeCompletionEvidenceId: string;
		readonly offReadbackEvidenceId: string;
		readonly isCurrent: () => boolean;
	};
	readonly independentEquipmentCutoffAuditId: string;
	readonly measuredTiming: RemoteDewPointArtifact['binding']['timing'];
	readonly observedAt: number;
	readonly expiresAt: number;
	/** Trusted installed verifier lifecycle, not a value accepted from public JSON. */
	readonly isCurrent: () => boolean;
}

/** Pure diagnostics for a future real installed record. No record is created, activated or inferred here. */
export function remoteDewPointInstallationBlockers(
	artifact: RemoteDewPointArtifact,
	status: RemoteDewPointStatus | null,
	evidence: RemoteDewPointInstallationEvidence | null,
	now = Date.now(),
): string[] {
	if (!evidence) return ['cooling_remote_profile_installation_unqualified'];
	const b = artifact.binding,
		reasons: string[] = [];
	if (
		evidence.profile !== REMOTE_DEW_POINT_PROFILE ||
		evidence.version !== 1 ||
		evidence.protocol !== REMOTE_DEW_POINT_PROTOCOL
	)
		reasons.push('cooling_unsupported_profile');
	if (!evidence.publishedAlpha || !evidence.publishedAlpha.includes('alpha'))
		reasons.push('cooling_post_alpha_evidence_required');
	if (
		evidence.physicalIdentity !== b.physicalActuator ||
		evidence.deviceHardwareId !== b.deviceHardwareId ||
		evidence.deviceId !== b.deviceId ||
		evidence.model !== b.model ||
		evidence.firmware !== b.firmware
	)
		reasons.push('cooling_installed_hardware_mismatch');
	if (evidence.artifactId !== artifact.artifactId || evidence.compiledSha256 !== artifact.sha256)
		reasons.push('cooling_artifact_mismatch');
	const surface = evidence.surface;
	if (
		!surface?.placementAuditId ||
		surface.component !== b.localSurface.component ||
		surface.peripheralFingerprint !== b.localSurface.peripheralFingerprint ||
		surface.calibrationFingerprint !== b.localSurface.calibrationFingerprint ||
		surface.domainMinimum !== b.localSurface.domain.minimum ||
		surface.domainMaximum !== b.localSurface.domain.maximum
	)
		reasons.push('cooling_local_surface_unqualified');
	for (const [name, audit] of Object.entries({
		timing: evidence.timingAuditId,
		auth: evidence.authenticationAuditId,
		writer_isolation: evidence.writerIsolationAuditId,
		native_timer: evidence.nativeTimerAuditId,
		restart_drain: evidence.restartDrainAuditId,
		equipment_cutoff: evidence.independentEquipmentCutoffAuditId,
	}))
		if (typeof audit !== 'string' || !audit.trim()) reasons.push(`cooling_${name}_unqualified`);
	if (
		!evidence.measuredTiming ||
		Object.entries(b.timing).some(([key, bound]) => evidence.measuredTiming[key] !== bound)
	)
		reasons.push('cooling_timing_mismatch');
	if (
		!Number.isFinite(now) ||
		!Number.isFinite(evidence.observedAt) ||
		evidence.observedAt > now ||
		!Number.isFinite(evidence.expiresAt) ||
		evidence.expiresAt <= now ||
		typeof evidence.isCurrent !== 'function' ||
		!evidence.isCurrent()
	)
		reasons.push('cooling_installation_evidence_stale');
	const drainage = evidence.restartDrainObservation;
	if (
		!drainage ||
		drainage.physicalIdentity !== b.physicalActuator ||
		drainage.artifactId !== artifact.artifactId ||
		drainage.compiledSha256 !== artifact.sha256 ||
		drainage.sessionId !== `${artifact.artifactId}:${drainage.epoch}` ||
		drainage.sessionId !== status?.sessionId ||
		!Array.isArray(drainage.coveredJournalIds) ||
		drainage.coveredJournalIds.length > 256 ||
		new Set(drainage.coveredJournalIds).size !== drainage.coveredJournalIds.length ||
		drainage.coveredJournalIds.some((id) => typeof id !== 'string' || !id.trim()) ||
		!drainage.nativeCompletionEvidenceId ||
		!drainage.offReadbackEvidenceId ||
		!Number.isFinite(drainage.observedAt) ||
		drainage.observedAt > now ||
		drainage.epoch !== status?.epoch ||
		typeof drainage.isCurrent !== 'function' ||
		!drainage.isCurrent() ||
		status?.output !== false ||
		status?.pendingOn !== false ||
		status?.drained !== true
	)
		reasons.push('cooling_current_restart_drain_observation_required');
	if (
		!status ||
		status.auth_en !== true ||
		!status.ready ||
		status.protocol !== REMOTE_DEW_POINT_PROTOCOL ||
		status.artifact !== artifact.artifactId ||
		status.deviceId !== b.deviceId ||
		status.model !== b.model ||
		status.firmware !== b.firmware
	)
		reasons.push('cooling_authenticated_session_unavailable');
	return reasons;
}

/** Held only by the trusted installed verifier; never serialized through an API or accepted from a client. */
export interface QualifiedRemoteDewPointProfile {
	readonly artifact: RemoteDewPointArtifact;
	readonly installation: RemoteDewPointInstallationEvidence;
	readonly authenticatedStatus: RemoteDewPointStatus;
}
export function qualifiedRemoteDewPointBlockers(profile: QualifiedRemoteDewPointProfile | null): string[] {
	return profile
		? remoteDewPointInstallationBlockers(profile.artifact, profile.authenticatedStatus, profile.installation)
		: ['cooling_remote_profile_installation_unqualified'];
}
