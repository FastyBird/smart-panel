import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { CoverRecoveryTarget } from '../contracts/cover-recovery.contract';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { COVER_RECOVERY_ACKNOWLEDGEMENT, RecoverCoverOrderingDto } from '../dto/cover-recovery.dto';
import { ShellyCoverOrderingEntity } from '../entities/shelly-cover-ordering.entity';
import { ShellyCoverRecoveryEntity } from '../entities/shelly-cover-recovery.entity';
import { CoverRecoveryContextModel, CoverRecoveryModel } from '../models/cover-recovery.model';

import { ShellyCoverRecoveryLaneService } from './shelly-cover-recovery-lane.service';

interface IssuedContext {
	actorId: string;
	deviceId: string;
	channelId: string;
	propertyId: string;
	target: CoverRecoveryTarget;
	revision: string;
	metadataGeneration: number;
	token: string;
	startedAt: Date;
	expiresAt: number;
}
/** Deliberate operator uncertainty exception. Current idle feedback is a prerequisite, never upstream drain proof. */
@Injectable()
export class ShellyCoverRecoveryService {
	private readonly contexts = new Map<string, IssuedContext>();
	constructor(
		private readonly database: DataSource,
		private readonly metadata: PropertyMetadataService,
		private readonly sources: PropertyValueSourceRegistryService,
		private readonly delegates: DelegatesManagerService,
		private readonly lane: ShellyCoverRecoveryLaneService,
		private readonly structure: DeviceStructureLockService,
	) {}
	private async load(deviceId: string, channelId: string, propertyId: string) {
		const generation = this.metadata.getGeneration();
		const property = await this.metadata.findOne(propertyId);
		const channel = property?.channel as ChannelEntity;
		const device = channel?.device as DeviceEntity;
		if (
			!property ||
			device?.id !== deviceId ||
			channel.id !== channelId ||
			device.type !== DEVICES_SHELLY_NG_TYPE ||
			!device.enabled ||
			this.sources.resolve(property) !== property.id
		)
			throw new NotFoundException('Current canonical ordinary Shelly cover target unavailable');
		const update: IDevicePropertyData = { device, channel, property, value: 'stop' };
		const target = await this.delegates.captureCoverRecoveryTarget(update);
		if (!target || !target.isCurrent() || generation !== this.metadata.getGeneration())
			throw new ConflictException('Cover metadata/connection changed or no guarded calibrated cover adapter exists');
		const revision = createHash('sha256')
			.update(
				JSON.stringify([
					generation,
					device.id,
					device.identifier,
					device.enabled,
					device.category,
					channel.id,
					channel.identifier,
					channel.category,
					this.sources.resolve(property),
					target.revision,
				]),
			)
			.digest('hex');
		return { target, revision, metadataGeneration: generation };
	}
	async context(
		actorId: string,
		deviceId: string,
		channelId: string,
		propertyId: string,
	): Promise<CoverRecoveryContextModel> {
		for (const [id, value] of this.contexts) if (value.expiresAt <= Date.now()) this.contexts.delete(id);
		if (this.contexts.size >= 1024) throw new ConflictException('Recovery context capacity exceeded');
		const current = await this.load(deviceId, channelId, propertyId);
		if (this.lane.isRecovering(current.target.physicalIdentity))
			throw new ConflictException('Cover recovery already in progress');
		const row = await this.database.manager.findOneBy(ShellyCoverOrderingEntity, {
			physicalIdentity: current.target.physicalIdentity,
		});
		if (!row) throw new NotFoundException('No unresolved cover ordering reservation');
		if (
			this.lane.isRecovering(current.target.physicalIdentity) ||
			!current.target.isCurrent() ||
			current.metadataGeneration !== this.metadata.getGeneration()
		)
			throw new ConflictException('Cover context changed');
		const id = randomUUID(),
			expiresAt = Date.now() + 30_000;
		this.contexts.set(id, {
			actorId,
			deviceId,
			channelId,
			propertyId,
			...current,
			token: row.token,
			startedAt: row.startedAt,
			expiresAt,
		});
		return Object.assign(new CoverRecoveryContextModel(), {
			context_id: id,
			physical_identity: row.physicalIdentity,
			expected_token: row.token,
			expected_revision: current.revision,
			started_at: row.startedAt.toISOString(),
			expires_at: new Date(expiresAt).toISOString(),
		});
	}
	async recover(
		actorId: string,
		deviceId: string,
		channelId: string,
		propertyId: string,
		dto: RecoverCoverOrderingDto,
	): Promise<CoverRecoveryModel> {
		const context = this.contexts.get(dto.context_id);
		if (
			!context ||
			context.actorId !== actorId ||
			context.deviceId !== deviceId ||
			context.channelId !== channelId ||
			context.propertyId !== propertyId ||
			context.token !== dto.expected_token ||
			context.revision !== dto.expected_revision ||
			context.expiresAt <= Date.now()
		)
			throw new ConflictException('Cover recovery context expired or changed; reload');
		if (dto.acknowledgement !== COVER_RECOVERY_ACKNOWLEDGEMENT || !dto.reason?.trim() || dto.reason.length > 500)
			throw new ConflictException('Explicit uncertainty acknowledgement and bounded operator reason required');
		this.contexts.delete(dto.context_id); // One attempt, including failures; never restored across restart.
		// The server-bound scope is known synchronously. No public DTO grants dispatch/evidence authority.
		const lease = this.lane.begin(context.target.physicalIdentity, () => {
			context.target.retire();
			for (const [id, issued] of this.contexts)
				if (issued.target.physicalIdentity === context.target.physicalIdentity) this.contexts.delete(id);
		});
		let probe: ReturnType<CoverRecoveryTarget['begin']>;
		let committed = false;
		const current = () =>
			lease.isCurrent() &&
			context.target.isCurrent() &&
			context.expiresAt > Date.now() &&
			context.metadataGeneration === this.metadata.getGeneration();
		try {
			if (!current()) throw new ConflictException('Cover recovery authority changed');
			probe = context.target.begin(); // Permanently retires the old session; rejects its full active method lifetime.
			const fresh = await probe.session
				.read(() => current() && probe.isCurrent())
				.catch(() => {
					throw new ConflictException('Fresh guarded cover status unavailable; ordering remains unresolved');
				});
			if (!fresh || !['open', 'closed', 'stopped'].includes(fresh.raw.state) || !current() || !probe.isCurrent())
				throw new ConflictException('Fresh calibrated, tag-capable, fault-free nonmoving cover status required');
			const live = await this.load(deviceId, channelId, propertyId);
			if (live.revision !== context.revision || !current() || !probe.isCurrent())
				throw new ConflictException('Cover mapping/source/configuration/connection changed');
			await this.structure.runExclusive(() =>
				this.database.transaction(async (manager) => {
					if (!current() || !probe.isCurrent()) throw new ConflictException('Cover recovery authority changed');
					const row = await manager.findOneBy(ShellyCoverOrderingEntity, {
						physicalIdentity: context.target.physicalIdentity,
					});
					if (!row || row.token !== context.token) throw new ConflictException('Unresolved reservation changed');
					const removed = await manager.delete(ShellyCoverOrderingEntity, {
						physicalIdentity: row.physicalIdentity,
						token: context.token,
					});
					if (removed.affected !== 1) throw new ConflictException('Unresolved reservation compare-and-set failed');
					await manager.insert(ShellyCoverRecoveryEntity, {
						id: lease.epoch,
						actorId,
						createdAt: new Date(),
						physicalIdentity: row.physicalIdentity,
						deviceId,
						channelId,
						propertyId,
						oldToken: row.token,
						oldStartedAt: row.startedAt,
						contextRevision: context.revision,
						reason: dto.reason.trim(),
						observedState: fresh.raw.state,
						observedPosition: fresh.raw.current_pos,
						observedAt: fresh.observedAt,
						advisory: 'operator_overridden_unresolved_ordering',
					});
					if (!current() || !probe.isCurrent()) throw new ConflictException('Cover changed during recovery audit');
					// Tentative only: admission stays closed until commit; rollback retires/removes this session.
					probe.install();
				}),
			);
			committed = true;
			return Object.assign(new CoverRecoveryModel(), {
				override_epoch: lease.epoch,
				advisory: 'operator_overridden_unresolved_ordering',
				observed_state: fresh.raw.state,
				observed_at: fresh.observedAt.toISOString(),
			});
		} finally {
			if (!committed) probe?.session.retire();
			probe?.dispose();
			lease.dispose();
		}
	}
}
