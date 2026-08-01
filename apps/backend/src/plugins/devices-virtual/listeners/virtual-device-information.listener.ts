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
 * DeviceConnectivityService.setConnectionState already finds-or-creates the device_information
 * channel and its `status` property as a side effect of recording connectivity, so this listener
 * calls it first to obtain that channel rather than duplicating channel-creation. A freshly created
 * virtual device has no linked properties yet, so it is vacuously CONNECTED by the same rule
 * VirtualStatusListener applies to a source-less device — CONNECTED is therefore the correct initial
 * state to record here, not an arbitrary choice.
 *
 * Borrowing that generic path has one consequence this listener must then repair: it creates the
 * `status` property without a `value_origin`, which on a virtual device means the SOURCE column
 * default and therefore an orphan. See claimConnectionStateProperty().
 *
 * Each property is created only if missing (matching DeviceConnectivityService's own
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
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
				reason: 'virtual device created',
			});

			const channel = await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);

			if (!channel) {
				this.logger.warn(
					`Device information channel missing for virtual device id=${device.id}, cannot synthesize its properties`,
				);

				return;
			}

			await this.claimConnectionStateProperty(channel);

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
	 * Re-marks the connection-state property as LOCAL, because the generic path that just synthesized
	 * it cannot know to.
	 *
	 * DeviceConnectivityService.findOrCreateConnectionProperty creates the `status` property through
	 * the ordinary ChannelsPropertiesService.create() with no `value_origin` in its DTO — it is module
	 * code and has no business knowing a plugin-specific column exists. On a virtual device that lands
	 * on VirtualChannelPropertyEntity, whose column default is SOURCE, with `sourcePropertyId` null:
	 * exactly the shape VirtualPropertyIndexService classifies as an *orphan*.
	 *
	 * That misclassification is not cosmetic. The next connection change on any source device makes
	 * VirtualStatusListener.aggregateState() see an orphaned link and return DISCONNECTED however
	 * healthy the real sources are, and PropertyCommandService then refuses every command against an
	 * offline device — every virtual device permanently uncommandable. This property is owned by the
	 * virtual device and projected from nowhere, so LOCAL is what it has always meant.
	 *
	 * Correcting after the fact rather than pre-creating the property here keeps the ten-entry
	 * ConnectionState `format` list and the identifier/name/permissions shape in
	 * DeviceConnectivityService as their single definition, instead of a second copy to drift. The
	 * intervening window is not observable: a device this handler is running for was created moments
	 * ago with no linked properties at all, so it appears in no source device's reverse index and no
	 * DEVICE_CONNECTION_CHANGED event can select it for aggregation until the user links something.
	 * Storage does not move either — VirtualValueSourceService.resolve() returns null for an orphan
	 * *and* for an owned property, so the state written by setConnectionState() above is already under
	 * this property's own key.
	 *
	 * Idempotent: a redelivered DEVICE_CREATED finds the property already LOCAL and issues no write,
	 * matching the find-or-create behaviour of the rest of this listener.
	 */
	private async claimConnectionStateProperty(channel: ChannelEntity): Promise<void> {
		const property = await this.channelsPropertiesService.findOneBy<VirtualChannelPropertyEntity>(
			'category',
			PropertyCategory.STATUS,
			channel.id,
		);

		if (!property) {
			this.logger.warn(
				`Connection state property missing for virtual device channel id=${channel.id}, cannot mark it as owned`,
			);

			return;
		}

		if (!property.isProjecting) {
			return;
		}

		await this.channelsPropertiesService.update(property.id, {
			type: property.type,
			value_origin: VirtualValueOrigin.LOCAL,
		});

		this.logger.debug(`Marked connection state property id=${property.id} as owned by its virtual device`);
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
