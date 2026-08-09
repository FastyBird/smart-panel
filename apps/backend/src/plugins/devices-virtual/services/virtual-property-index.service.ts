import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';

/**
 * One virtual property's projection wiring, reduced to plain ids.
 *
 * Deliberately *not* an entity reference. Everything a consumer needs to decide what a virtual
 * device's connection state should be is either an id (resolve it live, against whatever service
 * owns the current answer) or the single fact that no id is left at all (`sourcePropertyId === null`
 * — orphaned). Caching a hydrated `DeviceEntity` here instead would freeze `device.status` at the
 * moment of the last rebuild(), and nothing rebuilds on a connection change — that is exactly the
 * staleness this shape exists to remove.
 */
export interface VirtualPropertyLink {
	/** The virtual property's own id. */
	propertyId: string;
	/**
	 * The property whose value this one projects, or null once that source row was deleted and the
	 * `sourcePropertyId` FK's ON DELETE SET NULL fired. Null here is precisely "orphaned".
	 */
	sourcePropertyId: string | null;
	/**
	 * The device owning `sourcePropertyId`. Null when the property is orphaned (there is no source to
	 * own it) and, defensively, when the relation hops needed to reach it were not loaded.
	 */
	sourceDeviceId: string | null;
}

/**
 * What one rebuild() pass changed, as the two transitions its callers have to react to.
 *
 * Reported by rebuild() rather than derived by a caller because rebuild() is the only place the
 * outgoing and incoming index versions both exist. Deriving either from an event instead is not
 * equivalent, and not merely less tidy: DevicesService.remove() deletes a device's channels and
 * properties before it emits DEVICE_DELETED, and a rebuild triggered by those property deletions can
 * and does complete in between — so by the time the deletion event arrives, the index has already
 * forgotten everything the device was linked to.
 */
export interface VirtualIndexRebuildResult {
	/**
	 * Virtual devices whose set of links is not what it was, so their aggregated connection state has
	 * to be recomputed. Includes a device that lost every link it had — which is the only signal such a
	 * device will ever get, since it drops out of `bySourceDevice` and no DEVICE_CONNECTION_CHANGED
	 * event can select it again.
	 */
	rewiredVirtualDeviceIds: string[];
	/**
	 * Source devices that were referenced by at least one virtual device before this pass and by none
	 * after it. Hidden ones among them have nothing standing in for them anymore and should be visible
	 * again.
	 */
	abandonedSourceDeviceIds: string[];
}

/**
 * In-memory index over every PROJECTING virtual property — `valueOrigin === SOURCE`, whether or not
 * it still has a source. OWNED (LOCAL) properties store their own value, are nobody's projection and
 * never affect a virtual device's connection state, so they are the only kind skipped outright.
 *
 * Three lookups matter, all driven off system-wide, per-event traffic where a database query would
 * not scale:
 * - `findBySourceProperty` — read by the projection listener on every property value change.
 * - `findVirtualDeviceIdsBySourceDevice` — read by the connection-status listener on every source
 *   device connection change, to find which virtual devices a source device change affects.
 * - `findLinksByVirtualDevice` — read by the same connection-status listener to enumerate one
 *   affected virtual device's projections, so it can aggregate a CONNECTED/DISCONNECTED state.
 *
 * ## This service never fills itself
 *
 * There is no lifecycle hook here: VirtualIndexMaintenanceListener owns both the bootstrap hydration
 * and every rebuild after it, and this class only exposes rebuild() / add() / removeVirtualDevice()
 * for it to call. That is not merely tidier — rebuild() reports which virtual devices came out wired
 * differently (see VirtualIndexRebuildResult), and *something has to act on that report*. Hydrating
 * from in here would mean either discarding the first pass's report, which is how a virtual device
 * orphaned while the process was down keeps a stale CONNECTED status forever, or reaching from this
 * service back into the status listener that already depends on it. One owner for every pass,
 * bootstrap included, removes the choice.
 *
 * ## Ids, not hydrated entities
 *
 * `byVirtualDevice` and `bySourceDevice` hold ids only (see VirtualPropertyLink). A cached entity is
 * a snapshot: `DeviceEntitySubscriber.afterLoad` copies a device's connection status field by field
 * at load time, so an indexed `sourceProperty.channel.device.status` reflects whenever the last
 * rebuild() ran and nothing ever refreshes it — no structural event fires on a connection change,
 * and the connection-state property's own PATCH emits CHANNEL_PROPERTY_VALUE_SET, which this index
 * deliberately does not subscribe to. Holding ids makes the question "is this source online?" a live
 * read at the point of use instead.
 *
 * `bySourceProperty` is the one exception and holds entities on purpose: its consumer
 * (VirtualProjectionListener) needs a full ChannelPropertyEntity to re-emit as the event payload,
 * and it runs on every property value change in the entire system. Resolving that live would put a
 * database read on the exact hot path this index exists to keep clear. What it caches is a property
 * row's own structure — refreshed by rebuild() on every CHANNEL_PROPERTY_* event — not another
 * device's connection status, so it does not carry the staleness described above.
 *
 * ## Orphans are indexed, not skipped
 *
 * An orphaned property (SOURCE origin, `sourcePropertyId === null`) contributes nothing to
 * `bySourceProperty` (there is no key to file it under) or to `bySourceDevice` (no source device),
 * but it *is* recorded in `byVirtualDevice`, because "this virtual device has a projection that lost
 * its source" is precisely the condition the connection-status listener degrades on. Filtering
 * orphans out of the index entirely — as an earlier version did — made that degradation branch
 * unreachable by construction.
 */
@Injectable()
export class VirtualPropertyIndexService {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualPropertyIndexService');

	private bySourceProperty = new Map<string, VirtualChannelPropertyEntity[]>();
	private bySourceDevice = new Map<string, Set<string>>();
	private byVirtualDevice = new Map<string, VirtualPropertyLink[]>();

	constructor(
		@InjectRepository(VirtualChannelPropertyEntity)
		private readonly repository: Repository<VirtualChannelPropertyEntity>,
	) {}

	/**
	 * Whether any *stored* projection still reads a property of this source device.
	 *
	 * The in-memory answers below are as fresh as the last rebuild, which is enough for the reads that
	 * happen on every value change. It is not enough for a decision that unhides a source device: a
	 * projection created after that rebuild is committed and invisible here, and nothing re-hides a
	 * source once it has been made visible, so the physical device would sit beside the virtual one
	 * that had just claimed it. This asks the database instead, and is only worth its round trip where
	 * that distinction matters.
	 */
	async isSourceDeviceReferenced(sourceDeviceId: string): Promise<boolean> {
		const referencing = await this.repository
			.createQueryBuilder('projection')
			.innerJoin('projection.sourceProperty', 'source')
			.innerJoin('source.channel', 'sourceChannel')
			.where('sourceChannel.deviceId = :sourceDeviceId', { sourceDeviceId })
			.getCount();

		return referencing > 0;
	}

	/**
	 * Which projection, if any, is accountable for this meter's kWh — read from storage.
	 *
	 * Asked of the database rather than of the maps below for the same reason
	 * `isSourceDeviceReferenced` is: a claim made since the last rebuild is committed and invisible
	 * here, and a check that missed it would hand a second projection the same meter. The unique index
	 * would then refuse the write, so the answer would be a 409 rather than the sentence naming what
	 * already holds it.
	 */
	async findEnergyClaimant(sourcePropertyId: string): Promise<string | null> {
		const claimant = await this.repository.findOne({
			where: { energyClaimPropertyId: sourcePropertyId },
			select: ['id'],
		});

		return claimant?.id ?? null;
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
	 * Every projecting property indexed for the given virtual device, as ids (see
	 * VirtualPropertyLink). O(1), synchronous, no I/O. Owned (LOCAL) properties are never in here, so
	 * a virtual device assembled solely from owned properties reports nothing at all — the
	 * connection-status listener treats that vacuous case as CONNECTED. Orphaned properties *are*
	 * reported, with `sourcePropertyId: null`.
	 */
	findLinksByVirtualDevice(id: string): VirtualPropertyLink[] {
		return this.byVirtualDevice.get(id) ?? [];
	}

	/**
	 * The same links findLinksByVirtualDevice() serves from memory, read from the database instead,
	 * for one virtual device.
	 *
	 * Exists because the in-memory maps lag every write. A structural event only *schedules* a
	 * rebuild (VirtualIndexMaintenanceListener defers it past the emitting transaction and runs it
	 * fire-and-forget), and no mutation response waits for it — so the moment a linked property is
	 * created, remapped or deleted, the maps still describe the previous wiring for as long as that
	 * rebuild takes. That is the correct trade for the two consumers the index exists for, which run
	 * on system-wide per-event traffic; it is the wrong trade for an HTTP read of a single device,
	 * where a client that just wrote is entitled to read back what it wrote.
	 *
	 * Deliberately scoped to one virtual device rather than reusing rebuild()'s query: the link shape
	 * and the projecting/orphan handling are shared with it (see toLink()), but the WHERE clause is
	 * not — this loads one device's properties, not every virtual property in the system, so it costs
	 * a fraction of a rebuild and stays proportionate to an HTTP read of a single device.
	 *
	 * `channel.device` is joined for the WHERE alone; `sourceProperty.channel.device` is what actually
	 * gets read back out, since neither ChannelEntity#device nor ChannelPropertyEntity#channel is
	 * populated unless its exact relation path is requested.
	 */
	async loadLinksByVirtualDevice(id: string): Promise<VirtualPropertyLink[]> {
		const properties = await this.repository.find({
			where: { channel: { device: { id } } },
			relations: ['sourceProperty', 'sourceProperty.channel', 'sourceProperty.channel.device'],
		});

		return properties
			.filter((property) => property.isProjecting)
			.map((property) => this.toLink(property, this.resolveSourceDeviceId(property)));
	}

	/**
	 * Indexes one projecting property after a CRUD create/update, without a full reload.
	 * `sourceDeviceId` is supplied by the caller — by the time a property is linked, whoever
	 * created/updated it has already resolved and validated its source, so re-deriving it here would
	 * be redundant work. It is ignored for an orphaned property, which by definition has no source
	 * device. The owning virtual device id, in contrast, is local to `property` itself and is
	 * resolved from its own channel relation.
	 *
	 * Safe to call again for a property id already indexed: existing entries for that id are
	 * replaced, not duplicated, so this also serves an update in place.
	 */
	add(property: VirtualChannelPropertyEntity, sourceDeviceId: string): void {
		if (!property.isProjecting) {
			return;
		}

		this.indexProperty(this.bySourceProperty, this.bySourceDevice, this.byVirtualDevice, property, sourceDeviceId);
	}

	/** Removes every trace of one virtual device, leaving no stale entries in any of the three maps. */
	removeVirtualDevice(id: string): void {
		const links = this.byVirtualDevice.get(id);

		if (!links) {
			return;
		}

		for (const link of links) {
			this.unindexBySourceProperty(this.bySourceProperty, link);
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

	/**
	 * Re-hydrates all three maps from the database in a single query, and reports which virtual devices
	 * came out of it wired differently than they went in.
	 *
	 * Builds into fresh local maps and swaps them in only once the query has returned, rather than
	 * clearing the live maps up front. The query is a five-hop relation-loaded SELECT — a real,
	 * awaited round trip — and the maps are read synchronously by listeners that fire on ordinary
	 * traffic throughout that window. Clearing first would make the index look empty for the duration
	 * of every rebuild: projections silently not emitted, connection changes silently not propagated.
	 * The swap itself is three plain assignments with no await between them, so no reader can ever
	 * observe a half-replaced index.
	 *
	 * Both halves of the returned VirtualIndexRebuildResult are computed by comparing the outgoing maps
	 * with the incoming ones, in the one moment both versions coexist — see that interface for why
	 * neither can be derived from an event instead.
	 */
	async rebuild(): Promise<VirtualIndexRebuildResult> {
		const bySourceProperty = new Map<string, VirtualChannelPropertyEntity[]>();
		const bySourceDevice = new Map<string, Set<string>>();
		const byVirtualDevice = new Map<string, VirtualPropertyLink[]>();

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
			if (!property.isProjecting) {
				continue;
			}

			this.indexProperty(
				bySourceProperty,
				bySourceDevice,
				byVirtualDevice,
				property,
				this.resolveSourceDeviceId(property),
			);
		}

		const result: VirtualIndexRebuildResult = {
			rewiredVirtualDeviceIds: this.diffVirtualDevices(this.byVirtualDevice, byVirtualDevice),
			abandonedSourceDeviceIds: [...this.bySourceDevice.keys()].filter(
				(sourceDeviceId) => !bySourceDevice.has(sourceDeviceId),
			),
		};

		this.bySourceProperty = bySourceProperty;
		this.bySourceDevice = bySourceDevice;
		this.byVirtualDevice = byVirtualDevice;

		return result;
	}

	/**
	 * Virtual device ids whose set of links is not identical between two `byVirtualDevice` maps.
	 *
	 * Keyed off the union of both maps' keys, so it reports a device that gained links, one that lost
	 * every link it had (its entry disappears — indistinguishable here from the device itself having
	 * been deleted, which is harmless: recomputing a deleted device is a no-op, because
	 * DeviceConnectivityService.setConnectionState() finds no device and returns), and one whose links
	 * merely changed shape — a source property deleted out from under it, leaving a link that is now an
	 * orphan.
	 *
	 * Compared as an order-independent fingerprint rather than field by field: the links for one device
	 * come out of a `find()` whose row order is not guaranteed stable across calls, and a reordering is
	 * not a change. All three fields participate, because all three feed aggregateState() — the orphan
	 * test reads `sourcePropertyId`, and the set of devices to poll for online-ness reads
	 * `sourceDeviceId`.
	 */
	private diffVirtualDevices(
		before: Map<string, VirtualPropertyLink[]>,
		after: Map<string, VirtualPropertyLink[]>,
	): string[] {
		const changed: string[] = [];

		for (const virtualDeviceId of new Set([...before.keys(), ...after.keys()])) {
			if (this.fingerprintLinks(before.get(virtualDeviceId)) !== this.fingerprintLinks(after.get(virtualDeviceId))) {
				changed.push(virtualDeviceId);
			}
		}

		return changed;
	}

	private fingerprintLinks(links: VirtualPropertyLink[] | undefined): string {
		return (links ?? [])
			.map((link) => `${link.propertyId}>${link.sourcePropertyId ?? ''}@${link.sourceDeviceId ?? ''}`)
			.sort()
			.join('|');
	}

	/**
	 * Indexes one already-projecting property into the three supplied maps, shared by `add()` (which
	 * passes the live maps and a caller-supplied `sourceDeviceId`, always resolvable by contract) and
	 * `rebuild()` (which passes its fresh local maps and a resolved-from-relations `sourceDeviceId`
	 * that, on a malformed row, may not be).
	 *
	 * `bySourceProperty` is populated first, before either device id is looked at: it reads only
	 * `property.sourcePropertyId`, a plain column already on the row with no relation dependency, so
	 * a failure to resolve a device below must never evict the property from the index the projection
	 * listener depends on for every value change in the system. The two device-level maps are
	 * populated independently — `byVirtualDevice` only needs `virtualDeviceId` to resolve;
	 * `bySourceDevice` additionally needs `sourceDeviceId`.
	 */
	private indexProperty(
		bySourceProperty: Map<string, VirtualChannelPropertyEntity[]>,
		bySourceDevice: Map<string, Set<string>>,
		byVirtualDevice: Map<string, VirtualPropertyLink[]>,
		property: VirtualChannelPropertyEntity,
		sourceDeviceId: string | undefined,
	): void {
		this.indexBySourceProperty(bySourceProperty, property);

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

		const link = this.toLink(property, sourceDeviceId);

		// A LINKED property that cannot resolve a source device is a real problem: its source channel
		// and device are required (non-nullable) relations, so this means the query did not load what
		// it expected to. An orphan resolving to null is not — see toLink().
		if (property.isLinked && !link.sourceDeviceId) {
			this.logger.warn(
				`Could not resolve the source device for property id=${property.id}, skipping its source-device index`,
			);
		}

		// Recorded against its virtual device either way, orphan included — bySourceProperty above
		// already holds whatever it could, and this single record is what lets the connection-status
		// listener see an orphan at all.
		this.indexByVirtualDevice(byVirtualDevice, virtualDeviceId, link);

		if (link.sourceDeviceId) {
			this.indexBySourceDevice(bySourceDevice, link.sourceDeviceId, virtualDeviceId);
		}
	}

	/**
	 * Reduces one projecting property to the plain-id link shape both the index maps and
	 * loadLinksByVirtualDevice() hand out, so the two can never disagree about what a link is.
	 *
	 * `sourceDeviceId` is passed in rather than always resolved here because `add()` supplies one its
	 * caller already validated, while rebuild() and loadLinksByVirtualDevice() resolve it from the
	 * loaded relations. It is discarded for an orphaned property, which by definition has no source
	 * device to name — not a failure, just nothing to resolve.
	 */
	private toLink(property: VirtualChannelPropertyEntity, sourceDeviceId: string | undefined): VirtualPropertyLink {
		return {
			propertyId: property.id,
			sourcePropertyId: property.sourcePropertyId,
			sourceDeviceId: property.isOrphaned ? null : (sourceDeviceId ?? null),
		};
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

	private indexBySourceProperty(
		bySourceProperty: Map<string, VirtualChannelPropertyEntity[]>,
		property: VirtualChannelPropertyEntity,
	): void {
		const key = property.sourcePropertyId;

		if (!key) {
			return;
		}

		const siblings = (bySourceProperty.get(key) ?? []).filter((candidate) => candidate.id !== property.id);

		siblings.push(property);

		bySourceProperty.set(key, siblings);
	}

	private unindexBySourceProperty(
		bySourceProperty: Map<string, VirtualChannelPropertyEntity[]>,
		link: VirtualPropertyLink,
	): void {
		const key = link.sourcePropertyId;

		if (!key) {
			return;
		}

		const remaining = (bySourceProperty.get(key) ?? []).filter((candidate) => candidate.id !== link.propertyId);

		if (remaining.length > 0) {
			bySourceProperty.set(key, remaining);
		} else {
			bySourceProperty.delete(key);
		}
	}

	private indexByVirtualDevice(
		byVirtualDevice: Map<string, VirtualPropertyLink[]>,
		virtualDeviceId: string,
		link: VirtualPropertyLink,
	): void {
		const siblings = (byVirtualDevice.get(virtualDeviceId) ?? []).filter(
			(candidate) => candidate.propertyId !== link.propertyId,
		);

		siblings.push(link);

		byVirtualDevice.set(virtualDeviceId, siblings);
	}

	private indexBySourceDevice(
		bySourceDevice: Map<string, Set<string>>,
		sourceDeviceId: string,
		virtualDeviceId: string,
	): void {
		const virtualDeviceIds = bySourceDevice.get(sourceDeviceId) ?? new Set<string>();

		virtualDeviceIds.add(virtualDeviceId);

		bySourceDevice.set(sourceDeviceId, virtualDeviceIds);
	}
}
