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
 * likewise skipped.
 *
 * Two lookups matter, both driven off system-wide, per-event traffic where a database query would
 * not scale:
 * - `findBySourceProperty` — read by the projection listener on every property value change.
 * - `findVirtualDeviceIdsBySourceDevice` — read by the connection-status listener on every source
 *   device connection change.
 *
 * `byVirtualDevice` is not a third public index — it is bookkeeping that lets `removeVirtualDevice`
 * undo everything one virtual device contributed to the other two maps without a linear scan over
 * every indexed property.
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

		this.indexBySourceProperty(property);

		const virtualDeviceId = this.resolveDeviceId(property.channel);

		if (!virtualDeviceId) {
			// The property's own channel relation was not loaded far enough to reach a device. The
			// source-property index above still stands — that is the one the projection listener's
			// correctness depends on — but the device-level bookkeeping has nothing to key on.
			this.logger.warn(
				`Could not resolve the owning virtual device for property id=${property.id} from its channel relation`,
			);

			return;
		}

		this.indexByVirtualDevice(virtualDeviceId, property);
		this.indexBySourceDevice(sourceDeviceId, virtualDeviceId);
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

			const sourceDeviceId = this.resolveSourceDeviceId(property);

			if (!sourceDeviceId) {
				// Every linked property's source channel and device are required (non-nullable)
				// relations, so this indicates the query above did not load what it expected to
				// rather than a legitimate state. Skip rather than index a property this index
				// cannot later find by source device.
				this.logger.warn(`Could not resolve the source device for property id=${property.id}, skipping`);

				continue;
			}

			this.add(property, sourceDeviceId);
		}
	}

	/** Linked = projects a source (SOURCE) and still has one (sourcePropertyId set). */
	private isLinked(property: VirtualChannelPropertyEntity): boolean {
		return property.valueOrigin === VirtualValueOrigin.SOURCE && property.sourcePropertyId !== null;
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
