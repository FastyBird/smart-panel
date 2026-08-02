import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
	isUnsupportedOwnedPermissionsPair,
} from '../entities/devices-virtual.entity';

import { VirtualStatusListener } from './virtual-status.listener';

interface OwnedPropertyDefinition {
	identifier: string;
	name: string;
	category: PropertyCategory;
	value: string;
}

/**
 * Synthesizes the three owned `device_information` properties the v1 category boundary requires
 * every virtual device to have (docs/superpowers/specs/2026-07-31-virtual-devices-design.md,
 * "v1 category boundary": "device_information requires manufacturer, model and serial_number, all ro
 * strings... the only owned properties, which keeps the wizard to pure wiring").
 *
 * It also owns the `device_information` channel and the connection-state property inside it, creating
 * both *before* recording connectivity. DeviceConnectivityService.setConnectionState would happily
 * find-or-create them itself — and this listener used to let it — but that is generic module code with
 * no `value_origin` to give, so on a virtual device the property it creates takes
 * VirtualChannelPropertyEntity's SOURCE column default with a null source: verbatim
 * VirtualPropertyIndexService's definition of an ORPHAN. Creating them here first means
 * setConnectionState finds both and only writes a value, and the property is never anything but owned.
 *
 * Fixing it afterwards instead is not sufficient, and the difference is not theoretical: the property's
 * creation emits CHANNEL_PROPERTY_CREATED, VirtualIndexMaintenanceListener rebuilds the index on it and
 * recomputes the connection state of any virtual device whose links changed, and an orphan aggregates
 * to DISCONNECTED. So a repair-afterwards races a spurious DISCONNECTED write against its own fix,
 * on every single virtual device creation. A LOCAL property is skipped by the index entirely, so no
 * rebuild ever sees a link change and none of that fires.
 *
 * ## Why the initial state is aggregated rather than assumed
 *
 * A virtual device created on its own has no linked properties yet, so it is vacuously CONNECTED by
 * the same rule VirtualStatusListener applies to a source-less device. This class used to record that
 * CONNECTED directly — which is right for that device and wrong for the other creation shape the API
 * allows: channels and linked properties nested in the same request as the device.
 *
 * There, CHANNEL_PROPERTY_CREATED fires for each nested property *before* DEVICE_CREATED, so
 * VirtualIndexMaintenanceListener's rebuild can correctly aggregate DISCONNECTED for an offline source
 * before this handler has run at all — and an unconditional CONNECTED landing afterwards silently
 * overwrote it. Nothing corrected it: the next rebuild pass reports no re-wiring, because by then the
 * links have not changed again, so no further recompute is ever scheduled.
 *
 * Delegating to VirtualStatusListener.recompute() fixes both halves. It aggregates from the indexed
 * sources rather than assuming, so the answer is right whenever the index is current; and it takes
 * that listener's serialization queue, which holds across the index read as well as the write, so this
 * synthesis and a concurrent rebuild-driven recompute cannot interleave read-then-write at all — see
 * recompute()'s own docstring.
 *
 * The afterCreate ownership hook below closed the concurrent *property creation*; this closes the
 * later *status write*, which that hook does not touch.
 *
 * Every channel and property here is created only if missing (matching DeviceConnectivityService's own
 * find-or-create idempotency), so a redelivered or duplicate DEVICE_CREATED event is harmless.
 *
 * ## Ordering alone is not enough, so this class does not rely on it
 *
 * Creating the property first only wins if this listener gets there first, and on a virtual device
 * created with linked channels and properties in one request it may not: CHANNEL_PROPERTY_CREATED is
 * emitted for each of those *before* DEVICE_CREATED, VirtualIndexMaintenanceListener rebuilds on it and
 * recomputes the affected virtual device's connection state, and that recompute reaches the very same
 * generic DeviceConnectivityService.setConnectionState() find-or-create — concurrently with this
 * handler, since EventEmitter2 does not await listeners. Whoever loses that insert loses it on the
 * `@Unique(['identifier', 'channel'])` constraint.
 *
 * Two independent mechanisms close that, because ordering cannot:
 *
 * 1. `claimDeviceInformationProperty()` below is registered as the `afterCreate` hook on this plugin's
 *    channel-property mapping, so *whatever* code path creates a property in a virtual device's
 *    `device_information` channel — this listener, the generic connectivity service, a redelivery —
 *    the property is converted to owned inside `ChannelsPropertiesService.create()` itself, before that
 *    call returns and before it emits CHANNEL_PROPERTY_CREATED. No caller, and no event, ever observes
 *    the row as an orphan; there is no window to lose.
 * 2. `ensureConnectionStateProperty()` retries its lookup when its own insert loses, and applies the
 *    ownership update to the row that won, instead of swallowing the constraint violation and leaving
 *    an orphan behind.
 *
 * (1) is what makes the guarantee unconditional; (2) is what makes this listener's postcondition — "the
 * connection-state property exists and is owned when I return" — true rather than merely likely, and is
 * also the repair path for a device created before any of this existed.
 */
@Injectable()
export class VirtualDeviceInformationListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDeviceInformationListener');

	/**
	 * Bounds ensureConnectionStateProperty()'s find-or-create loop. A losing insert is resolved by the
	 * very next lookup — the winning row is committed by the time the unique constraint rejects ours —
	 * so one retry is the realistic worst case; the extra attempt covers the pathological interleaving
	 * where the winner is deleted again in between, and the bound is what guarantees the loop cannot
	 * spin forever against a create that fails for some reason other than losing a race.
	 */
	private static readonly MAX_CONNECTION_STATE_ATTEMPTS = 3;

	/**
	 * Bounds ensureDeviceInformationChannel()'s find-or-create loop, for the same reasons and with the
	 * same shape as MAX_CONNECTION_STATE_ATTEMPTS above — see that method for the failure a single
	 * attempt could not survive.
	 */
	private static readonly MAX_DEVICE_INFORMATION_CHANNEL_ATTEMPTS = 3;

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly statusListener: VirtualStatusListener,
	) {}

	@OnEvent(EventType.DEVICE_CREATED)
	async handleDeviceCreated(device: DeviceEntity): Promise<void> {
		if (device.type !== DEVICES_VIRTUAL_TYPE) {
			return;
		}

		try {
			const channel = await this.ensureDeviceInformationChannel(device);

			if (!channel) {
				this.logger.warn(
					`Device information channel missing for virtual device id=${device.id}, cannot synthesize its properties`,
				);

				return;
			}

			// Strictly before the connectivity write below, so that call never has to create it — see
			// the class docstring for why creating it afterwards is not equivalent.
			await this.ensureConnectionStateProperty(channel);

			// Aggregated from whatever sources the device actually has, never hard-coded — see the
			// "Why the initial state is aggregated" section of the class docstring. A device with no
			// linked properties yet still comes out CONNECTED, vacuously, which is the case this used
			// to state directly.
			await this.statusListener.recompute(device.id, 'virtual device created');

			for (const definition of this.ownedPropertyDefinitions(device)) {
				await this.ensureOwnedProperty(channel, definition);
			}

			this.logger.debug(`Synthesized device information properties for virtual device id=${device.id}`);
		} catch (error) {
			// Fire-and-forget from an event handler: EventEmitter2's .emit() does not await listeners,
			// so an uncaught rejection here would become an unhandled promise rejection rather than
			// something any caller could observe. Matches VirtualIndexMaintenanceListener's own
			// rationale for catching within the handler.
			this.logger.warn(`Failed to synthesize device information for virtual device id=${device.id}: ${error}`);
		}
	}

	/**
	 * `afterCreate` hook for this plugin's channel-property mapping — see DevicesVirtualPlugin.
	 *
	 * Claims any property created as an orphan inside a virtual device's `device_information` channel.
	 * That channel is owned end to end: the design spec's creation flow exempts it from mapping
	 * entirely ("it is synthesized automatically as owned properties and is never presented for
	 * mapping"), so a property there that projects a source it does not have is never something anyone
	 * asked for — it is VirtualChannelPropertyEntity's SOURCE column default showing through code that
	 * had no `value_origin` to give.
	 *
	 * Two separate paths produce exactly that, and this hook is what makes both safe:
	 *
	 * - **The creation race** (class docstring): the generic DeviceConnectivityService wins the insert
	 *   for the connection-state property. Repairing that afterwards from this listener is a second
	 *   statement racing a third — the winner's own `setConnectionState` continues into a value write,
	 *   which reloads the row and saves it back, so a repair landing in the middle of that is written
	 *   straight back out. Running *inside* `create()` has no such window: the row is corrected before
	 *   `create()` re-reads it, before it emits CHANNEL_PROPERTY_CREATED, and before its caller holds a
	 *   copy at all, so no in-memory entity anywhere is ever a stale `source`.
	 * - **Deletion and recreation**: the connection-state property is reachable through
	 *   `DELETE /channels/:id/properties/:id`. Synthesis runs only on DEVICE_CREATED, so before this
	 *   hook the next `setConnectionState` recreated it generically as an orphan and nothing ever
	 *   re-owned it — the device went permanently DISCONNECTED (follow-up 2.7). The recreation now goes
	 *   through here, so it comes back owned, and no deletion event has to be watched for.
	 *
	 * Deliberately narrow: only an *orphan* is claimed. A property in that channel that names a real
	 * source is a deliberate act, and silently rewriting it would be worse than the incoherent state
	 * the DTO constraints exist to reject up front.
	 *
	 * Returns the property because that is the mapping hook's signature; the caller ignores the return
	 * and re-reads the row itself, which is what makes the value written here the one that is published.
	 */
	async claimDeviceInformationProperty(property: ChannelPropertyEntity): Promise<ChannelPropertyEntity> {
		if (!(property instanceof VirtualChannelPropertyEntity) || !property.isOrphaned) {
			return property;
		}

		const channel = property.channel;

		if (!channel || typeof channel === 'string') {
			// Every path into this hook re-reads the property through ChannelsPropertiesService, whose
			// queries always join `channel`, so this is unreachable in practice — but the alternative to
			// checking is dereferencing a string, and an unclaimed device_information property is an
			// offline device, which is worth a log rather than a silent skip.
			this.logger.warn(
				`Could not resolve the channel of property id=${property.id}, cannot decide whether it is device information`,
			);

			return property;
		}

		if (channel.category !== ChannelCategory.DEVICE_INFORMATION) {
			return property;
		}

		await this.claimProperty(property);

		return property;
	}

	/**
	 * Finds or creates the device_information channel, so this listener holds it before anything else
	 * can create it — specifically before setConnectionState would, which is what forces the ordering
	 * the class docstring describes.
	 *
	 * Mirrors DeviceConnectivityService.findOrCreateConnectionChannel(), including its re-find on a
	 * failed create: `@Unique(['identifier', 'device'])` makes a concurrent creation surface as a
	 * constraint violation rather than a duplicate row, and the right response is to use the row that
	 * won, not to fail.
	 *
	 * ## Why one attempt is not enough
	 *
	 * A single create followed by a single re-find can come away with nothing, and on a device created
	 * with its channels nested in the same request it demonstrably does — observed on roughly one e2e
	 * run in four, leaving a virtual device with no device_information channel at all: no connection
	 * state, no manufacturer, model or serial number, and no second event to try again on, since this
	 * synthesis runs only on DEVICE_CREATED.
	 *
	 * That shape is what makes it reachable. On the nested path CHANNEL_PROPERTY_CREATED fires before
	 * DEVICE_CREATED, so VirtualIndexMaintenanceListener's rebuild drives a recompute into
	 * DeviceConnectivityService.setConnectionState(), whose own find-or-create for this very channel is
	 * then genuinely in flight while this one runs. Two concurrent `repository.save()` calls on SQLite
	 * share one process-wide QueryRunner (follow-up 3.3), and the loser does not always fail cleanly:
	 * the observed failure was `getOneOrThrow` immediately after `save()` reporting "Channel does not
	 * exist" — an INSERT that reported success and was then rolled back underneath, rather than a
	 * unique-constraint violation the re-find would have resolved.
	 *
	 * Going back round the loop covers both outcomes with one mechanism: a lost race is resolved by the
	 * next lookup finding the winner's row, and a rolled-back insert by simply inserting again. The
	 * driver-level defect is pre-existing and not this plugin's to fix; honouring this method's own
	 * postcondition against it is.
	 *
	 * Still returns null rather than throwing when every attempt fails — the caller logs and gives up,
	 * which is the same contract as before.
	 */
	private async ensureDeviceInformationChannel(device: DeviceEntity): Promise<ChannelEntity | null> {
		for (
			let attempt = 1;
			attempt <= VirtualDeviceInformationListener.MAX_DEVICE_INFORMATION_CHANNEL_ATTEMPTS;
			attempt++
		) {
			const existing = await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);

			if (existing) {
				return existing;
			}

			try {
				return await this.channelsService.create({
					device: device.id,
					type: device.type,
					identifier: 'device_information',
					category: ChannelCategory.DEVICE_INFORMATION,
					name: 'Device Information',
				});
			} catch (error) {
				this.logger.debug(
					`Attempt ${attempt} to create the device information channel for device id=${device.id} failed, re-reading: ${error}`,
				);
			}
		}

		return null;
	}

	/**
	 * Ensures the connection-state property exists and is OWNED (LOCAL).
	 *
	 * It is owned by the virtual device and projected from nowhere, so LOCAL is what it has always
	 * meant — but left to the generic path it is created with no `value_origin` at all, taking
	 * VirtualChannelPropertyEntity's SOURCE column default with a null source, which is exactly what
	 * VirtualPropertyIndexService classifies as an orphan. VirtualStatusListener.aggregateState() then
	 * returns DISCONNECTED for the device however healthy its real sources are, and
	 * PropertyCommandService refuses every command against an offline device: every virtual device
	 * permanently uncommandable.
	 *
	 * ## The shape here is deliberately not a second source of truth
	 *
	 * DeviceConnectivityService finds this property by *category* (PropertyCategory.STATUS), not by
	 * identifier, so its find-or-create will use whatever this creates regardless of any drift in
	 * identifier, name or permissions. `format` is derived from the ConnectionState enum rather than
	 * copied, so the set of values it accepts cannot drift from the set of values that service writes.
	 *
	 * ## The update branch
	 *
	 * Reached when a connection-state property already exists but is still projecting: a virtual device
	 * created before this listener owned the property, or one whose earlier synthesis failed partway.
	 * Correcting it is not sufficient on its own — see the class docstring on why creating it correctly
	 * in the first place is what actually avoids the spurious DISCONNECTED — but it is the right repair
	 * for a device that is already in that state.
	 *
	 * ## Why the create is a retry loop rather than a single attempt
	 *
	 * The lookup above and the create below are two statements, and the generic
	 * DeviceConnectivityService.setConnectionState() runs the same find-or-create concurrently on a
	 * device created with linked properties (see the class docstring). Losing that insert raises the
	 * `@Unique(['identifier', 'channel'])` violation, and a version of this method that let it escape
	 * left the *winner's* row — created generically, with no `value_origin`, so SOURCE with a null
	 * source — in place unrepaired: an orphan, and a permanently DISCONNECTED, uncommandable device.
	 * Going back round the loop finds that row and applies the ownership update to it instead. It is
	 * guaranteed to find it: SQLite raises the constraint only against a row that is already committed
	 * and therefore already visible to the very next read.
	 *
	 * Mirrors ensureDeviceInformationChannel()'s re-find above, and DeviceConnectivityService's own
	 * re-find, with the one difference that a found row here also has to be *claimed*, not merely used.
	 */
	private async ensureConnectionStateProperty(channel: ChannelEntity): Promise<void> {
		for (let attempt = 1; ; attempt++) {
			const existing = await this.channelsPropertiesService.findOneBy<VirtualChannelPropertyEntity>(
				'category',
				PropertyCategory.STATUS,
				channel.id,
			);

			if (existing) {
				await this.claimProperty(existing);

				return;
			}

			try {
				await this.channelsPropertiesService.create(channel.id, {
					type: channel.type,
					identifier: 'connection_state',
					name: 'Connection State',
					category: PropertyCategory.STATUS,
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.ENUM,
					format: Object.values(ConnectionState),
					value_origin: VirtualValueOrigin.LOCAL,
				});

				return;
			} catch (error) {
				if (attempt >= VirtualDeviceInformationListener.MAX_CONNECTION_STATE_ATTEMPTS) {
					throw error;
				}

				this.logger.debug(
					`Lost the race to create the connection state property in channel id=${channel.id}, re-reading to claim the row that won: ${error}`,
				);
			}
		}
	}

	/**
	 * Converts a projecting property to owned, and does nothing to one that already is.
	 *
	 * Sends `value_origin` and `source_property` — and, only when it has to, `permissions` — plus the
	 * `type` discriminator ChannelsPropertiesService.update() requires to resolve the mapping. Every
	 * other column on the entity is left `undefined` and dropped by that method's
	 * `omitBy(..., isUndefined)`, so this cannot disturb a name or format someone has since edited.
	 *
	 * The source is cleared rather than left alone because owned means owned outright. Both callers
	 * reach here with a null source in every path either has been observed to take — one guards on
	 * `isOrphaned`, and the row the other finds was created by DeviceConnectivityService, which has no
	 * source to give — but `ensureConnectionStateProperty` only guards on `isProjecting`, so a *linked*
	 * status property somebody POSTed into the device_information channel by hand would arrive here
	 * still holding its source. Sending only `value_origin` would then merge into `local` + a source:
	 * the one pair the entity has no state for, which `VirtualDevicesService
	 * .assertValueOriginPairSupported` now refuses to persist — turning a silently inert row into a
	 * throw out of a listener. Clearing it makes the claim mean what it says instead, in every path.
	 *
	 * `permissions` is the exact same hazard one field over, and is handled the same way. A *writable*
	 * projecting property is perfectly legal — that is what forwarding a command to a source means —
	 * and both callers can reach one: a writable orphan POSTed into the device_information channel
	 * arrives through `claimDeviceInformationProperty`, and a writable status property through
	 * `ensureConnectionStateProperty`. Carrying those permissions across would merge into an owned
	 * property that claims to be writable, which `VirtualDevicesService.assertOwnedPropertyNotWritable`
	 * refuses — and a refusal here is a throw out of a listener, or out of the `afterCreate` hook,
	 * which is a self-inflicted outage rather than a guard. Downgrading is not a silent rewrite of the
	 * user's intent either: this only ever runs inside a `device_information` channel, whose contents
	 * are read-only by definition, and the property is already being converted from projecting to
	 * owned. Making it read-only is the rest of that same conversion.
	 */
	private async claimProperty(property: VirtualChannelPropertyEntity): Promise<void> {
		if (!property.isProjecting) {
			return;
		}

		await this.channelsPropertiesService.update(property.id, {
			type: property.type,
			value_origin: VirtualValueOrigin.LOCAL,
			source_property: null,
			// Left undefined — and so dropped by `omitBy(..., isUndefined)` — unless the property is
			// actually writable, so a claim of an already read-only property still touches nothing but
			// the two origin fields.
			permissions: isUnsupportedOwnedPermissionsPair(VirtualValueOrigin.LOCAL, property.permissions)
				? [PermissionType.READ_ONLY]
				: undefined,
		});

		this.logger.debug(`Marked property id=${property.id} as owned by its virtual device`);
	}

	private ownedPropertyDefinitions(device: DeviceEntity): OwnedPropertyDefinition[] {
		return [
			{
				identifier: 'manufacturer',
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				value: 'FastyBird',
			},
			{ identifier: 'model', name: 'Model', category: PropertyCategory.MODEL, value: 'Virtual Device' },
			{
				identifier: 'serial_number',
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				value: device.id,
			},
		];
	}

	private async ensureOwnedProperty(channel: ChannelEntity, definition: OwnedPropertyDefinition): Promise<void> {
		const existing = await this.channelsPropertiesService.findOneBy('category', definition.category, channel.id);

		if (existing) {
			return;
		}

		await this.channelsPropertiesService.create(channel.id, {
			type: channel.type,
			identifier: definition.identifier,
			name: definition.name,
			category: definition.category,
			permissions: [PermissionType.READ_ONLY],
			data_type: DataTypeType.STRING,
			value: definition.value,
			value_origin: VirtualValueOrigin.LOCAL,
		});
	}
}
