import { Repository } from 'typeorm';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import {
	ZigbeePropertyMapping,
	ZigbeeSourceIdentity,
	propertySourceContract,
	sourceFingerprint,
} from '../contracts/sample-source.contract';
import { ZigbeeSampleSourceEntity } from '../entities/zigbee-sample-source.entity';

export interface ZigbeeSourceAdmission {
	readonly qualified: boolean;
	readonly reason: string;
	readonly isCurrent: () => boolean;
}

/** Baselines are created only at new-device adoption or explicit compatible re-adoption. */
@Injectable()
export class ZigbeeSampleSourcesService implements OnModuleDestroy {
	private closed = false;
	private failed = false;
	private readonly bindingEpochs = new Map<string, number>();
	private pendingChecks: Promise<void> = Promise.resolve();
	private readonly sources = new Map<string, ZigbeeSourceIdentity>();
	private readonly rows = new Map<string, ZigbeeSampleSourceEntity>();
	private readonly blocked = new Set<string>();

	constructor(
		@InjectRepository(ZigbeeSampleSourceEntity) private readonly repository: Repository<ZigbeeSampleSourceEntity>,
	) {}

	/** The synchronous part revokes accepted guards before persistence or transformer queues await. */
	observeRegistry(identities: readonly ZigbeeSourceIdentity[]): Promise<void> {
		const next = new Map(identities.map((identity) => [identity.friendlyName, identity]));
		const changed =
			next.size !== this.sources.size ||
			[...next].some(([name, identity]) => this.sources.get(name)?.fingerprint !== identity.fingerprint);
		if (!changed) return this.pendingChecks;
		this.sources.clear();
		for (const [name, identity] of next) this.sources.set(name, identity);
		for (const row of this.rows.values()) if (this.mismatch(row, identities)) this.blocked.add(row.propertyId);
		const epochs = new Map(this.bindingEpochs);
		this.pendingChecks = this.pendingChecks
			.then(async () => {
				const rows = await this.repository.find();
				if (this.closed) return;
				for (const row of rows) {
					if ((epochs.get(row.deviceId) ?? 0) !== (this.bindingEpochs.get(row.deviceId) ?? 0)) continue;
					const reason = this.mismatch(row, identities);
					if (!reason || row.quarantined) continue;
					this.blocked.add(row.propertyId);
					this.rows.delete(row.propertyId);
					await this.repository.update(
						{ propertyId: row.propertyId, revision: row.revision },
						{ quarantined: true, reason },
					);
				}
			})
			.catch(() => {
				this.failed = true;
			});
		return this.pendingChecks;
	}

	getIdentity(friendlyName: string): ZigbeeSourceIdentity | null {
		return this.sources.get(friendlyName) ?? null;
	}
	invalidateConnection(): void {
		this.sources.clear();
	}

	async findBoundDeviceId(ieeeAddress: string): Promise<string | null> {
		const rows = await this.repository.find({ where: { ieeeAddress: ieeeAddress.toLowerCase() } });
		const ids = new Set(rows.map((row) => row.deviceId));
		if (ids.size > 1) throw new Error('Zigbee IEEE identity is already bound to multiple logical devices');
		return ids.size === 1 ? [...ids][0] : null;
	}

	private mismatch(row: ZigbeeSampleSourceEntity, identities: readonly ZigbeeSourceIdentity[]): string | null {
		const routed = identities.find((identity) => identity.friendlyName === row.friendlyName);
		if (routed && routed.ieeeAddress !== row.ieeeAddress) return 'zigbee_friendly_name_reassigned';
		// A pure rename preserves physical identity, but old routing guards become obsolete.
		const source = routed ?? identities.find((identity) => identity.ieeeAddress === row.ieeeAddress);
		if (!source) return 'zigbee_bound_source_missing';
		const field = source.fields.find((candidate) => candidate.property === row.field);
		return field && sourceFingerprint(field) === sourceFingerprint(row.expose)
			? null
			: 'zigbee_expose_contract_changed';
	}

	private compatible(
		property: ChannelPropertyEntity,
		identity: ZigbeeSourceIdentity,
		mapping: ZigbeePropertyMapping,
	): boolean {
		const field = identity.fields.find((candidate) => candidate.property === mapping.field);
		if (!field) return false;
		if (String(property.category) !== 'temperature') return true;
		const celsius = new Set(['°C', 'C', 'Celsius', 'celsius']);
		// No automatic Fahrenheit/percent/voltage relabeling. Existing mapping must return native Celsius.
		return (
			field.type === 'numeric' &&
			(field.access & 1) === 1 &&
			typeof field.unit === 'string' &&
			typeof property.unit === 'string' &&
			celsius.has(field.unit) &&
			celsius.has(property.unit)
		);
	}

	/** Caller is the existing validated adoption workflow, never an API override flag. */
	async bindDevice(
		deviceId: string,
		identity: ZigbeeSourceIdentity,
		entries: readonly {
			property: ChannelPropertyEntity;
			mapping: ZigbeePropertyMapping;
		}[],
	): Promise<void> {
		await this.pendingChecks;
		if (this.closed || this.failed || this.sources.get(identity.friendlyName)?.fingerprint !== identity.fingerprint)
			throw new Error('Zigbee source metadata changed during adoption');
		const current = this.sources.get(identity.friendlyName);
		const bindable = entries.filter(({ property, mapping }) => this.compatible(property, current, mapping));
		this.bindingEpochs.set(deviceId, (this.bindingEpochs.get(deviceId) ?? 0) + 1);
		for (const [id, row] of this.rows) if (row.deviceId === deviceId) this.rows.delete(id);
		const before = await this.repository.find({ where: { deviceId } });
		if (this.sources.get(identity.friendlyName) !== current)
			throw new Error('Zigbee source metadata changed during adoption');
		const identifiedAt = new Date();
		const records = bindable.map(({ property, mapping }) => {
			const expose = current.fields.find((field) => field.property === mapping.field);
			const output = propertySourceContract(property, mapping);
			return this.repository.create({
				propertyId: property.id,
				deviceId,
				friendlyName: current.friendlyName,
				ieeeAddress: current.ieeeAddress,
				field: mapping.field,
				expose,
				mapping: output,
				fingerprint: sourceFingerprint({ ieeeAddress: current.ieeeAddress, expose, mapping: output }),
				identifiedAt,
				revision: (before.find((row) => row.propertyId === property.id)?.revision ?? 0) + 1,
				quarantined: false,
				reason: null,
			});
		});
		await this.repository.manager.transaction(async (manager) => {
			const other = await manager.find(ZigbeeSampleSourceEntity, { where: { ieeeAddress: current.ieeeAddress } });
			if (other.some((row) => row.deviceId !== deviceId))
				throw new Error('Zigbee IEEE identity is bound to another logical device');
			// A confirmed mapping may drop a leaf; retain its identity/history but quarantine it.
			for (const row of before)
				if (!records.some((record) => record.propertyId === row.propertyId))
					await manager.update(ZigbeeSampleSourceEntity, row.propertyId, {
						quarantined: true,
						reason: 'zigbee_mapping_not_confirmed',
					});
			for (const record of records) await manager.save(ZigbeeSampleSourceEntity, record);
		});
		if (this.sources.get(identity.friendlyName) !== current) {
			// The registry callback may have read before this transaction inserted its records.
			// Persist refusal explicitly; a later restart must not revive a stale adoption.
			for (const record of records) {
				this.blocked.add(record.propertyId);
				await this.repository.update(
					{ propertyId: record.propertyId, revision: record.revision },
					{ quarantined: true, reason: 'zigbee_source_changed_during_adoption' },
				);
			}
			throw new Error('Zigbee source metadata changed during adoption');
		}
		for (const record of records) {
			this.rows.set(record.propertyId, record);
			this.blocked.delete(record.propertyId);
		}
	}

	async prepareSample(
		deviceId: string,
		friendlyName: string,
		property: ChannelPropertyEntity,
		mapping: ZigbeePropertyMapping,
		observedAt: Date,
		mappingIsCurrent: () => boolean,
	): Promise<ZigbeeSourceAdmission> {
		const identity = this.sources.get(friendlyName);
		const epoch = this.bindingEpochs.get(deviceId) ?? 0;
		const refuse = (reason: string): ZigbeeSourceAdmission => ({ qualified: false, reason, isCurrent: () => false });
		await this.pendingChecks;
		if (!identity || this.closed || this.failed || this.sources.get(friendlyName) !== identity)
			return refuse('zigbee_source_registry_unavailable_or_changed');
		let row = this.rows.get(property.id);
		if (!row) {
			row = await this.repository.findOne({ where: { propertyId: property.id } });
			if (row) this.rows.set(property.id, row);
		}
		if (
			epoch !== (this.bindingEpochs.get(deviceId) ?? 0) ||
			this.sources.get(friendlyName) !== identity ||
			!mappingIsCurrent()
		)
			return refuse('zigbee_source_generation_changed');
		if (!row) return refuse('zigbee_source_identity_unbound_requires_deliberate_adoption');
		if (row.quarantined || this.blocked.has(property.id))
			return refuse(row.reason ?? 'zigbee_source_identity_quarantined');
		if ((row.expose.access & 1) !== 1) return refuse('zigbee_expose_has_no_reported_state');
		const expose = identity.fields.find((field) => field.property === mapping.field);
		const fingerprint = sourceFingerprint({
			ieeeAddress: identity.ieeeAddress,
			expose,
			mapping: propertySourceContract(property, mapping),
		});
		if (row.deviceId !== deviceId || row.friendlyName !== friendlyName || row.fingerprint !== fingerprint) {
			this.blocked.add(property.id);
			this.rows.delete(property.id);
			await this.repository.update(
				{ propertyId: row.propertyId, revision: row.revision },
				{ quarantined: true, reason: 'zigbee_property_source_contract_changed' },
			);
			return refuse('zigbee_property_source_contract_changed');
		}
		if (!Number.isFinite(observedAt.getTime()) || observedAt.getTime() <= row.identifiedAt.getTime())
			return refuse('zigbee_sample_precedes_source_binding');
		const accepted = row;
		const isCurrent = (): boolean =>
			!this.closed &&
			!this.failed &&
			epoch === (this.bindingEpochs.get(deviceId) ?? 0) &&
			!this.blocked.has(property.id) &&
			this.sources.get(friendlyName) === identity &&
			this.rows.get(property.id) === accepted &&
			mappingIsCurrent();
		return { qualified: isCurrent(), reason: 'zigbee_bound_ieee_and_expose_contract', isCurrent };
	}

	async prepareDispatch(
		deviceId: string,
		friendlyName: string,
		requiredPropertyIds: readonly string[] = [],
	): Promise<{
		allowed: boolean;
		bound: boolean;
		reasons: readonly string[];
		isCurrent(): boolean;
	}> {
		const identity = this.sources.get(friendlyName);
		const epoch = this.bindingEpochs.get(deviceId) ?? 0;
		await this.pendingChecks;
		const rows = await this.repository.find({ where: { deviceId } });
		const bound = rows.length > 0;
		const isCurrent = (): boolean =>
			!this.closed &&
			!this.failed &&
			epoch === (this.bindingEpochs.get(deviceId) ?? 0) &&
			((!bound && requiredPropertyIds.length === 0) ||
				Boolean(
					identity &&
					this.sources.get(friendlyName) === identity &&
					requiredPropertyIds.every((id) => rows.some((row) => row.propertyId === id)) &&
					rows.every(
						(row) =>
							!row.quarantined &&
							!this.blocked.has(row.propertyId) &&
							row.friendlyName === friendlyName &&
							this.mismatch(row, [identity]) === null,
					),
				));
		return {
			allowed: isCurrent(),
			bound,
			reasons: isCurrent() ? [] : [bound ? 'zigbee_bound_source_dispatch_refused' : 'zigbee_dispatch_identity_unbound'],
			isCurrent,
		};
	}

	async getReadiness(
		propertyId: string,
	): Promise<{ bound: boolean; quarantined: boolean; reason: string | null; ieeeAddress: string | null }> {
		await this.pendingChecks;
		const row = await this.repository.findOne({ where: { propertyId } });
		return {
			bound: Boolean(row),
			quarantined: Boolean(row?.quarantined || this.blocked.has(propertyId)),
			reason: row?.reason ?? (!row ? 'zigbee_source_identity_unbound_requires_deliberate_adoption' : null),
			ieeeAddress: row?.ieeeAddress ?? null,
		};
	}

	onModuleDestroy(): void {
		this.closed = true;
		this.sources.clear();
		this.rows.clear();
	}
}
