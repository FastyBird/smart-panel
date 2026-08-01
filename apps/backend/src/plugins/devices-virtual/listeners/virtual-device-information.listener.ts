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
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

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
 * A freshly created virtual device has no linked properties yet, so it is vacuously CONNECTED by the
 * same rule VirtualStatusListener applies to a source-less device — CONNECTED is therefore the correct
 * initial state to record, not an arbitrary choice.
 *
 * Every channel and property here is created only if missing (matching DeviceConnectivityService's own
 * find-or-create idempotency), so a redelivered or duplicate DEVICE_CREATED event is harmless.
 */
@Injectable()
export class VirtualDeviceInformationListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDeviceInformationListener');

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
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

			// Strictly before setConnectionState below, so that call never has to create it — see the
			// class docstring for why creating it afterwards is not equivalent.
			await this.ensureConnectionStateProperty(channel);

			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
				reason: 'virtual device created',
			});

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
	 * Finds or creates the device_information channel, so this listener holds it before anything else
	 * can create it — specifically before setConnectionState would, which is what forces the ordering
	 * the class docstring describes.
	 *
	 * Mirrors DeviceConnectivityService.findOrCreateConnectionChannel(), including its re-find on a
	 * failed create: `@Unique(['identifier', 'device'])` makes a concurrent creation surface as a
	 * constraint violation rather than a duplicate row, and the right response is to use the row that
	 * won, not to fail.
	 */
	private async ensureDeviceInformationChannel(device: DeviceEntity): Promise<ChannelEntity | null> {
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
		} catch {
			return await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);
		}
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
	 */
	private async ensureConnectionStateProperty(channel: ChannelEntity): Promise<void> {
		const existing = await this.channelsPropertiesService.findOneBy<VirtualChannelPropertyEntity>(
			'category',
			PropertyCategory.STATUS,
			channel.id,
		);

		if (existing) {
			if (existing.isProjecting) {
				await this.channelsPropertiesService.update(existing.id, {
					type: existing.type,
					value_origin: VirtualValueOrigin.LOCAL,
				});

				this.logger.debug(`Marked connection state property id=${existing.id} as owned by its virtual device`);
			}

			return;
		}

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
