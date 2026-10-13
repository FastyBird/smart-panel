import { Repository } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { NativeTemperatureSnapshot } from '../contracts/native-temperature.contract';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { UpdateShellyNgChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ShellySampleSourceEntity } from '../entities/shelly-sample-source.entity';

export interface ShellySampleSourceLease {
	readonly metadata: ShellySampleSourceEntity;
	readonly activatedAt: Date;
}

/** Identity writes happen at adoption/config changes; samples never manufacture durable freshness. */
@Injectable()
export class ShellySampleSourcesService {
	private generation = 0;
	private readonly mutating = new Set<string>();
	private readonly leases = new Map<string, ShellySampleSourceLease>();

	constructor(
		@InjectRepository(ShellySampleSourceEntity)
		private readonly repository: Repository<ShellySampleSourceEntity>,
		private readonly properties: ChannelsPropertiesService,
		@Optional() private readonly values?: PropertyValueService,
	) {}

	async bind(
		propertyId: string,
		deviceId: string,
		snapshot: NativeTemperatureSnapshot,
	): Promise<ShellySampleSourceEntity> {
		const mutationKey = `${deviceId}|${snapshot.componentKey}`;
		this.mutating.add(mutationKey);
		for (const [id, lease] of this.leases) {
			if (
				lease.metadata.deviceId === deviceId &&
				lease.metadata.componentKey === snapshot.componentKey &&
				lease.metadata.fingerprint !== snapshot.fingerprint
			)
				this.leases.delete(id);
		}
		this.generation++;
		try {
			const previous = await this.repository.find({
				where: { deviceId, componentKey: snapshot.componentKey, active: true },
			});
			const current = previous.find((row) => row.propertyId === propertyId && row.fingerprint === snapshot.fingerprint);
			if (current) return current;
			// Revoke process-local leases before awaiting persistence, fencing old configuration RPC callbacks.
			for (const row of previous) this.leases.delete(row.propertyId);
			const identifiedAt = new Date();
			const record = this.repository.create({
				propertyId,
				deviceId,
				componentKey: snapshot.componentKey,
				fingerprint: snapshot.fingerprint,
				unit: snapshot.unit,
				expression: snapshot.expression,
				configuration: snapshot.configuration,
				peripheral: snapshot.peripheral,
				identifiedAt,
				active: true,
			});
			await this.repository.manager.transaction(async (manager) => {
				for (const row of previous) await manager.update(ShellySampleSourceEntity, row.propertyId, { active: false });
				await manager.save(ShellySampleSourceEntity, record);
			});
			for (const row of previous) {
				await this.properties.reportSample(
					row.propertyId,
					toInstance(UpdateShellyNgChannelPropertyDto, { type: DEVICES_SHELLY_NG_TYPE, value: null }),
					{
						sampledAt: identifiedAt,
						receivedAt: new Date(),
						observedAt: identifiedAt,
						provenance: 'live',
					},
				);
			}
			this.leases.set(propertyId, Object.freeze({ metadata: record, activatedAt: new Date() }));
			return record;
		} finally {
			this.mutating.delete(mutationKey);
			this.generation++;
		}
	}

	async invalidateComponent(deviceId: string, componentKey: string): Promise<void> {
		const key = `${deviceId}|${componentKey}`;
		this.mutating.add(key);
		this.generation++;
		for (const [id, lease] of this.leases) {
			if (lease.metadata.deviceId === deviceId && lease.metadata.componentKey === componentKey) this.leases.delete(id);
		}
		try {
			const rows = await this.repository.find({ where: { deviceId, componentKey, active: true } });
			const observedAt = new Date();
			for (const row of rows) {
				await this.properties.reportSample(
					row.propertyId,
					toInstance(UpdateShellyNgChannelPropertyDto, { type: DEVICES_SHELLY_NG_TYPE, value: null }),
					{ sampledAt: observedAt, receivedAt: new Date(), observedAt, provenance: 'live' },
				);
			}
			if (rows.length) await this.repository.update({ deviceId, componentKey, active: true }, { active: false });
		} finally {
			this.mutating.delete(key);
			this.generation++;
		}
	}

	async get(propertyId: string, retries = 2): Promise<ShellySampleSourceLease | null> {
		const existing = this.leases.get(propertyId);
		if (existing) return existing;
		const generation = this.generation;
		const row = await this.repository.findOne({ where: { propertyId, active: true } });
		if (!row || this.mutating.has(`${row.deviceId}|${row.componentKey}`)) return null;
		if (generation !== this.generation) return retries > 0 ? this.get(propertyId, retries - 1) : null;
		const lease = Object.freeze({ metadata: row, activatedAt: new Date() });
		this.leases.set(propertyId, lease);
		return lease;
	}

	isCurrent(lease: ShellySampleSourceLease, observedAt: Date | undefined): boolean {
		return (
			this.leases.get(lease.metadata.propertyId) === lease &&
			lease.metadata.active &&
			!this.mutating.has(`${lease.metadata.deviceId}|${lease.metadata.componentKey}`) &&
			observedAt instanceof Date &&
			Number.isFinite(observedAt.getTime()) &&
			observedAt.getTime() > Math.max(lease.activatedAt.getTime(), lease.metadata.identifiedAt.getTime())
		);
	}

	async getReadiness(
		property: ChannelPropertyEntity,
		maxAgeMs: number,
		now = new Date(),
	): Promise<{
		metadata: ShellySampleSourceEntity | null;
		currentQualification: 'awaiting_sample' | 'live';
	}> {
		const lease = await this.get(property.id);
		const sample = lease && this.values?.readQualifiedSample(property, maxAgeMs, now);
		return {
			metadata: lease?.metadata ?? (await this.repository.findOne({ where: { propertyId: property.id } })),
			currentQualification:
				sample &&
				sample.receivedAt.getTime() > Math.max(lease.activatedAt.getTime(), lease.metadata.identifiedAt.getTime())
					? 'live'
					: 'awaiting_sample',
		};
	}

	/** Clear restart/connection authority without altering durable identity or history. */
	revoke(propertyId: string): void {
		this.leases.delete(propertyId);
	}
}
