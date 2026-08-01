import { Repository } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

/**
 * In-memory index over LINKED virtual properties (valueOrigin === SOURCE with a non-null
 * sourcePropertyId — see VirtualChannelPropertyEntity.isOrphaned). OWNED (LOCAL) properties store
 * their own value and have nothing to index; ORPHANED properties lost their source and are
 * likewise skipped — none of the three maps below ever holds one.
 *
 * Three lookups matter, all driven off system-wide, per-event traffic where a database query would
 * not scale:
 * - `findBySourceProperty` — read by the projection listener on every property value change.
 * - `findVirtualDeviceIdsBySourceDevice` — read by the connection-status listener on every source
 *   device connection change, to find which virtual devices a source device change affects.
 * - `findByVirtualDevice` — read by the same connection-status listener to enumerate one affected
 *   virtual device's properties, so it can aggregate a CONNECTED/DISCONNECTED state from them.
 *
 * `byVirtualDevice` started as bookkeeping that let `removeVirtualDevice` undo everything one
 * virtual device contributed to the other two maps without a linear scan over every indexed
 * property; `findByVirtualDevice` exposes that same map read-only rather than adding a fourth.
 * Because it is only ever populated with properties that were LINKED at add()/rebuild() time, a
 * virtual device with solely owned properties reports no properties here at all (vacuously — see
 * the connection-status listener, which treats that as CONNECTED). A property that orphans in the
 * database via the sourceProperty FK's ON DELETE SET NULL — after already being indexed — is a
 * different case: nothing currently re-runs add() for it, so its cached copy lingers here exactly
 * as it looked when indexed, `isOrphaned` and all, until the next full `rebuild()`. Orphan checks
 * against this map are therefore only as fresh as the last add()/rebuild(), not live.
 */
@Injectable()
export class VirtualPropertyIndexService implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualPropertyIndexService');

	private readonly bySourceProperty = new Map<string, VirtualChannelPropertyEntity[]>();
	private readonly bySourceDevice = new Map<string, Set<string>>();
	private readonly byVirtualDevice = new Map<string, VirtualChannelPropertyEntity[]>();

	constructor(
		@InjectRepository(VirtualChannelPropertyEntity)
		private readonly repository: Repository<VirtualChannelPropertyEntity>,
	) {}

	// Hydrated here rather than onModuleInit: every plugin's entities must already be registered
	// for a query spanning the devices module's STI hierarchy to see virtual rows correctly.
	async onApplicationBootstrap(): Promise<void> {
		await this.rebuild();
	}

	/** Which virtual properties project the given source property. O(1), synchronous, no I/O. */
	findBySourceProperty(id: string): VirtualChannelPropertyEntity[] {
		return this.bySourceProperty.get(id) ?? [];
	}

	/** Which virtual devices draw from the given source device. O(1), synchronous, no I/O. */
	findVirtualDeviceIdsBySourceDevice(id: string): string[] {
		const virtualDeviceIds = this.bySourceDevice.get(id);

		return virtualDeviceIds ? Array.from(virtualDeviceIds) : [];
	}

	/**
	 * Every LINKED property currently indexed for the given virtual device. O(1), synchronous, no
	 * I/O. See the class docstring: owned properties are never in here, and an orphaned one lingers
	 * only as stale, still-linked-looking data until the next add()/rebuild() — this is not a live
	 * enumeration of everything the virtual device owns.
	 */
	findByVirtualDevice(id: string): VirtualChannelPropertyEntity[] {
		return this.byVirtualDevice.get(id) ?? [];
	}

	/**
	 * Indexes one linked property after a CRUD create/update, without a full reload. `sourceDeviceId`
	 * is supplied by the caller — by the time a property is linked, whoever created/updated it has
	 * already resolved and validated its source, so re-deriving it here would be redundant work.
	 * The owning virtual device id, in contrast, is local to `property` itself and is resolved from
	 * its own channel relation.
	 *
	 * Safe to call again for a property id already indexed: existing entries for that id are
	 * replaced, not duplicated, so this also serves an update in place.
	 */
	add(property: VirtualChannelPropertyEntity, sourceDeviceId: string): void {
		if (!this.isLinked(property)) {
			return;
		}

		this.indexLinkedProperty(property, sourceDeviceId);
	}

	/** Removes every trace of one virtual device, leaving no stale entries in any of the three maps. */
	removeVirtualDevice(id: string): void {
		const properties = this.byVirtualDevice.get(id);

		if (!properties) {
			return;
		}

		for (const property of properties) {
			this.unindexBySourceProperty(property);
		}

		this.byVirtualDevice.delete(id);

		// bySourceDevice is keyed by source device, not by virtual device, so there is no direct
		// entry to delete — only this id's membership in whichever sets it joined. A bounded scan
		// over the distinct source devices in the system is the price of keeping to three maps
		// instead of adding a fourth reverse index; removal is a rare CRUD-time operation, not the
		// hot read path the O(1) requirement targets.
		for (const [sourceDeviceId, virtualDeviceIds] of this.bySourceDevice) {
			virtualDeviceIds.delete(id);

			if (virtualDeviceIds.size === 0) {
				this.bySourceDevice.delete(sourceDeviceId);
			}
		}
	}

	/** Clears all three maps and re-hydrates them from the database in a single query. */
	async rebuild(): Promise<void> {
		this.bySourceProperty.clear();
		this.bySourceDevice.clear();
		this.byVirtualDevice.clear();

		// Both the property's own device (via channel) and its source's device (via
		// sourceProperty.channel) are loaded so every row carries everything needed for both
		// indexes — neither ChannelEntity#device nor ChannelPropertyEntity#channel is populated
		// unless its exact relation path is requested, so each hop must be spelled out explicitly.
		const properties = await this.repository.find({
			relations: [
				'channel',
				'channel.device',
				'sourceProperty',
				'sourceProperty.channel',
				'sourceProperty.channel.device',
			],
		});

		for (const property of properties) {
			if (!this.isLinked(property)) {
				continue;
			}

			this.indexLinkedProperty(property, this.resolveSourceDeviceId(property));
		}
	}

	/** Linked = projects a source (SOURCE) and still has one (sourcePropertyId set). */
	private isLinked(property: VirtualChannelPropertyEntity): boolean {
		return property.valueOrigin === VirtualValueOrigin.SOURCE && property.sourcePropertyId !== null;
	}

	/**
	 * Indexes one already-linked property into all three maps, shared by `add()` (caller-supplied
	 * `sourceDeviceId`, always resolvable by contract) and `rebuild()` (a resolved-from-relations
	 * `sourceDeviceId` that, on a malformed row, may not be).
	 *
	 * `bySourceProperty` is populated unconditionally, before either device id is looked at: it
	 * reads only `property.sourcePropertyId`, a plain column already on the row with no relation
	 * dependency, so a failure to resolve a device below must never evict the property from the
	 * index the projection listener depends on for every value change in the system. The two
	 * device-level maps are populated independently — `byVirtualDevice` only needs `virtualDeviceId`
	 * to resolve; `bySourceDevice` additionally needs `sourceDeviceId`.
	 */
	private indexLinkedProperty(property: VirtualChannelPropertyEntity, sourceDeviceId: string | undefined): void {
		this.indexBySourceProperty(property);

		const virtualDeviceId = this.resolveDeviceId(property.channel);

		if (!virtualDeviceId) {
			// The property's own channel relation was not loaded far enough to reach a device. The
			// source-property index above still stands regardless — the device-level bookkeeping
			// below simply has nothing to key on.
			this.logger.warn(
				`Could not resolve the owning virtual device for property id=${property.id} from its channel relation`,
			);

			return;
		}

		this.indexByVirtualDevice(virtualDeviceId, property);

		if (!sourceDeviceId) {
			// Every linked property's source channel and device are required (non-nullable)
			// relations, so this indicates the query above did not load what it expected to rather
			// than a legitimate state. bySourceProperty and byVirtualDevice still hold this property;
			// only the source-device side is left incomplete for it.
			this.logger.warn(
				`Could not resolve the source device for property id=${property.id}, skipping its source-device index`,
			);

			return;
		}

		this.indexBySourceDevice(sourceDeviceId, virtualDeviceId);
	}

	private resolveSourceDeviceId(property: VirtualChannelPropertyEntity): string | undefined {
		if (!property.sourceProperty) {
			return undefined;
		}

		return this.resolveDeviceId(property.sourceProperty.channel);
	}

	private resolveDeviceId(channel: ChannelEntity | string | null | undefined): string | undefined {
		if (!channel || typeof channel === 'string') {
			return undefined;
		}

		return typeof channel.device === 'string' ? channel.device : channel.device?.id;
	}

	private indexBySourceProperty(property: VirtualChannelPropertyEntity): void {
		const key = property.sourcePropertyId;

		if (!key) {
			return;
		}

		const siblings = (this.bySourceProperty.get(key) ?? []).filter((candidate) => candidate.id !== property.id);

		siblings.push(property);

		this.bySourceProperty.set(key, siblings);
	}

	private unindexBySourceProperty(property: VirtualChannelPropertyEntity): void {
		const key = property.sourcePropertyId;

		if (!key) {
			return;
		}

		const remaining = (this.bySourceProperty.get(key) ?? []).filter((candidate) => candidate.id !== property.id);

		if (remaining.length > 0) {
			this.bySourceProperty.set(key, remaining);
		} else {
			this.bySourceProperty.delete(key);
		}
	}

	private indexByVirtualDevice(virtualDeviceId: string, property: VirtualChannelPropertyEntity): void {
		const siblings = (this.byVirtualDevice.get(virtualDeviceId) ?? []).filter(
			(candidate) => candidate.id !== property.id,
		);

		siblings.push(property);

		this.byVirtualDevice.set(virtualDeviceId, siblings);
	}

	private indexBySourceDevice(sourceDeviceId: string, virtualDeviceId: string): void {
		const virtualDeviceIds = this.bySourceDevice.get(sourceDeviceId) ?? new Set<string>();

		virtualDeviceIds.add(virtualDeviceId);

		this.bySourceDevice.set(sourceDeviceId, virtualDeviceIds);
	}
}
