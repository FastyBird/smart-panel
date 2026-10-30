import { randomUUID } from 'node:crypto';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { AuthenticatedShellyScriptHttp } from '../../devices-shelly-ng/services/authenticated-shelly-script-http';
import {
	REMOTE_DEW_POINT_PROFILE,
	RemoteDewPointDeadline,
} from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import { qualifiedRemoteDewPointBlockers } from '../../devices-shelly-ng/services/remote-dew-point-qualification';
import { RemoteDewPointSession } from '../../devices-shelly-ng/services/remote-dew-point-session';
import { ThermostatActuationAdapter } from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';

export interface RemoteCoolingFrame {
	readonly threshold: number;
	readonly expiresAt: number;
	readonly controllerRevision: number;
	readonly protectionFingerprint: string;
	readonly isCurrent: () => boolean;
}

/** Provider implementation is separate from legacy heating; only installed structured evidence admits ON/drain. */
export class ThermostatRemoteCoolingAdapter implements ThermostatActuationAdapter<ThermostatInstalledQualification> {
	readonly contractVersion = 1 as const;
	readonly providerProfile = Object.freeze({ id: REMOTE_DEW_POINT_PROFILE, version: 1 });
	private readonly sessions = new Map<
		string,
		{
			hash: string;
			epoch: number;
			witnessAt: number;
			password: string;
			session: RemoteDewPointSession;
			journals: Set<string>;
		}
	>();
	constructor(
		private readonly values: PropertyValueService,
		private readonly frame: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null,
		private readonly fallbackOff: (
			target: IDevicePropertyData,
			current: () => boolean,
		) => ReturnType<ThermostatActuationAdapter<ThermostatInstalledQualification>['send']>,
		private readonly createHttp = (url: URL, device: string, password: string) =>
			new AuthenticatedShellyScriptHttp(url, device, password),
	) {}

	private valid(target: IDevicePropertyData, qualification: ThermostatInstalledQualification | null): boolean {
		const remote = qualification?.profile.remoteDewPoint;
		return (
			target.device instanceof ShellyNgDeviceEntity &&
			!!target.device.password &&
			!!remote &&
			qualification.providerProfile?.id === REMOTE_DEW_POINT_PROFILE &&
			qualification.providerProfile.version === 1 &&
			qualification.physicalIdentity === thermostatActuatorIdentity(target.property, target.channel, target.device) &&
			qualification.physicalIdentity === remote.artifact.binding.physicalActuator &&
			target.device.canonicalMac?.toUpperCase() === remote.artifact.binding.deviceHardwareId &&
			qualification.machineLeaseIsCurrent?.() === true &&
			qualifiedRemoteDewPointBlockers(remote).length === 0
		);
	}
	private session(
		target: IDevicePropertyData,
		qualification: ThermostatInstalledQualification,
	): RemoteDewPointSession | null {
		if (!this.valid(target, qualification)) return null;
		const remote = qualification.profile.remoteDewPoint,
			binding = remote.artifact.binding;
		const device = target.device as ShellyNgDeviceEntity;
		const existing = this.sessions.get(qualification.physicalIdentity);
		if (
			existing?.hash === remote.artifact.sha256 &&
			existing.epoch === remote.authenticatedStatus.epoch &&
			existing.password === device.password
		)
			return existing.session;
		if (existing && remote.installation.restartDrainObservation.observedAt <= existing.witnessAt) return null;
		if (!existing && this.sessions.size >= 256) return null;
		const session = new RemoteDewPointSession(
			this.createHttp(
				new URL(`http://${binding.endpointHostname}/script/${binding.scriptId}/remote-dew-point`),
				binding.deviceId,
				device.password,
			),
			remote.artifact,
		);
		this.sessions.set(qualification.physicalIdentity, {
			hash: remote.artifact.sha256,
			epoch: remote.authenticatedStatus.epoch,
			witnessAt: remote.installation.restartDrainObservation.observedAt,
			password: device.password,
			session,
			journals: new Set(),
		});
		return session;
	}
	/** Pin the original session, reader and destinations before the caller starts native journal I/O. */
	capture(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification | null,
		frame = this.frame,
		fallbackOff = this.fallbackOff,
	): ThermostatActuationAdapter<ThermostatInstalledQualification> & { isCurrent: () => boolean } {
		const operation = this.captureOperation(target, claim, qualification, frame, fallbackOff);
		const methods = captureCreation(this, ['send', 'reconcile', 'canReconcile']);
		return {
			contractVersion: this.contractVersion,
			providerProfile: this.providerProfile,
			isCurrent: () => operation.current() && methods.current(),
			canReconcile: (leaf, installed) =>
				installed === qualification && methods.values.canReconcile.call(this, leaf, installed),
			send: (leaf, source, installed, admitted, dispatch) =>
				methods.values.send.call(this, leaf, source, installed, admitted, dispatch, operation),
			reconcile: (leaf, ids, off, current, scope) =>
				methods.values.reconcile.call(this, leaf, ids, off, current, scope, operation),
		};
	}

	private captureOperation(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity | null,
		qualification: ThermostatInstalledQualification | null,
		frame = this.frame,
		fallbackOff = this.fallbackOff,
	) {
		const session =
			(qualification && this.session(target, qualification)) ||
			(claim && target.value !== true ? this.sessions.get(claim.physicalIdentity)?.session : null);
		const identity = qualification?.physicalIdentity ?? claim?.physicalIdentity;
		const owner = this.sessions.get(identity);
		const methods = session && captureCreation(session, ['send', 'off', 'fence']);
		const values = captureCreation(this.values, ['writeSampleWithState', 'readQualifiedSample']);
		const sameSession = () => this.sessions.get(identity) === owner && (!session || owner?.session === session);
		return {
			qualification,
			frame: claim ? invokeCreation(frame, this, claim) : null,
			owner,
			methods,
			values,
			fallbackOff,
			sameSession,
			current: () => sameSession() && (methods?.current() ?? true) && values.current(),
		};
	}

	canReconcile(target: IDevicePropertyData, qualification: ThermostatInstalledQualification): boolean {
		return this.valid(target, qualification);
	}

	async send(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification | null,
		isAdmitted: () => boolean,
		dispatch?: { readonly commandId: string },
		operation = this.captureOperation(target, claim, qualification),
	) {
		if (target.value !== true) {
			const session = operation.methods;
			if (session) {
				const result = await session.values.off.call(
					session.receiver,
					new RemoteDewPointDeadline(Date.now() + 3000),
					isAdmitted,
				);
				if (result.outcome === 'accepted' && typeof result.wasOn === 'boolean')
					return {
						outcome: 'accepted' as const,
						wasOn: result.wasOn,
						outputConfirmed: false as const,
						pendingOnDrained: false as const,
					};
			}
			// A missing/revoked profile cannot prevent the existing absolute physical OFF attempt.
			return invokeCreation(operation.fallbackOff, this, target, isAdmitted);
		}
		const frame = operation.frame,
			session = operation.methods;
		if (
			!dispatch?.commandId ||
			!frame ||
			!session ||
			qualification !== operation.qualification ||
			!operation.current() ||
			!isAdmitted() ||
			!frame.isCurrent()
		)
			return { outcome: 'refused' as const, reasons: ['cooling_protective_evidence_or_installation_missing'] };
		const remote = qualification.profile.remoteDewPoint;
		if (
			remote.artifact.binding.controllerRevision !== frame.controllerRevision ||
			remote.artifact.binding.protectionFingerprint !== frame.protectionFingerprint
		)
			return { outcome: 'refused' as const, reasons: ['cooling_artifact_mismatch'] };
		const journals = operation.owner.journals;
		if (journals.size >= 256 && !journals.has(dispatch.commandId))
			return { outcome: 'refused' as const, reasons: ['cooling_pending_journal_capacity'] };
		journals.add(dispatch.commandId);
		const result = await session.values.send.call(
			session.receiver,
			'on',
			frame.threshold,
			new RemoteDewPointDeadline(Math.min(frame.expiresAt, Date.now() + claim.leaseSeconds * 1000)),
			() => operation.current() && isAdmitted() && frame.isCurrent() && this.valid(target, qualification),
			dispatch.commandId,
		);
		if (result.outcome === 'refused') return { outcome: 'refused' as const, reasons: result.reasons };
		if (result.outcome === 'unknown' || typeof result.wasOn !== 'boolean')
			return { outcome: 'unknown' as const, outputConfirmed: false as const, pendingOnDrained: false as const };
		return {
			outcome: 'accepted' as const,
			wasOn: result.wasOn,
			outputConfirmed: false as const,
			pendingOnDrained: false as const,
		};
	}

	async reconcile(
		target: IDevicePropertyData,
		commandIds: readonly string[],
		_off: Parameters<ThermostatActuationAdapter<ThermostatInstalledQualification>['reconcile']>[2],
		isCurrent: () => boolean,
		scope: Parameters<ThermostatActuationAdapter<ThermostatInstalledQualification>['reconcile']>[4],
		operation = this.captureOperation(target, null, scope.qualification),
	) {
		const qualification = scope.qualification,
			session = operation.methods;
		if (!session || qualification !== operation.qualification || !operation.current()) return null;
		const owner = operation.owner;
		if (!owner || owner.session !== session.receiver) return null;
		const coveredIds = Object.freeze([...commandIds]);
		const originallyOwned = new Set(owner.journals);
		const sameSession = operation.current;
		const fence = await session.values.fence.call(
			session.receiver,
			new RemoteDewPointDeadline(Date.now() + 3000),
			() => sameSession() && isCurrent() && this.valid(target, qualification),
		);
		if (!fence || !sameSession() || !isCurrent() || !this.valid(target, qualification)) return null;
		const owned = owner.journals;
		const installed = qualification.profile.remoteDewPoint.installation.restartDrainObservation;
		// A live status cannot cover a journal from another process or an untracked native dispatch.
		// Only the trusted installed native-completion + OFF-readback witness can cover those identities.
		if (coveredIds.length > 256 || coveredIds.some((id) => !owned.has(id) && !installed.coveredJournalIds.includes(id)))
			return null;
		const sourceIsCurrent = () =>
			sameSession() && qualification.machineLeaseIsCurrent?.() === true && this.valid(target, qualification);
		await operation.values.values.writeSampleWithState.call(operation.values.receiver, target.property, false, {
			sampledAt: fence.observedAt,
			receivedAt: fence.receivedAt,
			provenance: 'live',
			observedAt: fence.observedAt,
			isCurrent: () => isCurrent() && sourceIsCurrent(),
			sourceIsCurrent,
		});
		const sample = operation.values.values.readQualifiedSample.call(operation.values.receiver, target.property, 30000);
		if (
			!sample ||
			sample.value !== false ||
			sample.sampledAt.getTime() !== fence.observedAt.getTime() ||
			sample.receivedAt.getTime() !== fence.receivedAt.getTime() ||
			!isCurrent() ||
			!sourceIsCurrent()
		)
			return null;
		return {
			proofId: randomUUID(),
			physicalIdentity: qualification.physicalIdentity,
			connectionIdentity: `${qualification.physicalIdentity}:${fence.status.epoch}`,
			coveredCommandIds: [...coveredIds],
			retireConfirmedCommandIds: (ids: readonly string[]): void => {
				// Keep failed/unknown settlement recognizable. Never recapture a replacement owner.
				if (!sameSession()) return;
				for (const id of ids) if (coveredIds.includes(id) && originallyOwned.has(id)) owned.delete(id);
			},
			externalWriterBarrier: true as const,
			offSample: sample,
			observedAt: fence.observedAt,
			isCurrent: () => isCurrent() && sourceIsCurrent(),
			sourceIsCurrent,
			scope: {
				controllerId: scope.controllerId,
				controllerRevision: scope.controllerRevision,
				claimId: scope.claimId,
				claimRevision: scope.claimRevision,
				contractFingerprint: scope.contractFingerprint,
			},
		};
	}
}
