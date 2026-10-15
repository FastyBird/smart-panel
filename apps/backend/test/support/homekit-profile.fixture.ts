import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../src/modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../src/modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../src/modules/devices/models/property-value-state.model';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../src/modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../src/modules/devices/services/property-value-source.registry.service';
import { HomeKitEventListener } from '../../src/plugins/devices-homekit/listeners/homekit-event.listener';
import { HomeKitCommandDispatcher } from '../../src/plugins/devices-homekit/services/homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from '../../src/plugins/devices-homekit/services/homekit-mapper-registry.service';
import { HomeKitPropertyStateService } from '../../src/plugins/devices-homekit/services/homekit-property-state.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualValueSourceService } from '../../src/plugins/devices-virtual/services/virtual-value-source.service';

/** Process-local production authority/event pipeline, without bridge advertising or hardware. */
export class HomeKitProfileFixture {
	readonly events = new EventEmitter2();
	readonly producers = new PropertyProducerRegistryService(this.events);
	readonly sources = new PropertyValueSourceRegistryService();
	readonly registry: HomeKitMapperRegistryService;
	readonly commands = {
		canExecuteCompositeProperty: () => true,
		executePropertyCommandById: jest.fn().mockResolvedValue({ success: true }),
	};
	readonly dispatcher = new HomeKitCommandDispatcher(this.commands as never);
	private readonly leases = new Map<string, PropertyProducerLease>();
	private sequence = 0;
	constructor() {
		this.sources.register(new VirtualValueSourceService());
		this.registry = new HomeKitMapperRegistryService(new HomeKitPropertyStateService(this.producers, this.sources));
		const listener = new HomeKitEventListener(this.registry);
		this.events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
	}
	device(category = DeviceCategory.SENSOR): VirtualDeviceEntity {
		return Object.assign(new VirtualDeviceEntity(), {
			id: `device-${++this.sequence}`,
			name: 'Virtual profile',
			category,
			mode: VirtualDeviceMode.ACTUATOR_GROUP,
			channels: [],
			status: { online: true },
		});
	}
	property(
		device: VirtualDeviceEntity,
		category: ChannelCategory,
		quantity: PropertyCategory,
		metadata: Partial<ChannelPropertyEntity> = {},
	): VirtualChannelPropertyEntity {
		let channel = device.channels.find((candidate) => candidate.category === category) as VirtualChannelEntity;
		if (!channel) {
			channel = Object.assign(new VirtualChannelEntity(), {
				id: `channel-${++this.sequence}`,
				category,
				device,
				properties: [],
			});
			device.channels.push(channel);
		}
		const property = Object.assign(new VirtualChannelPropertyEntity(), {
			id: `property-${++this.sequence}`,
			channel,
			category: quantity,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.BOOL,
			format: null,
			step: null,
			valueOrigin: VirtualValueOrigin.DERIVED,
			value: new PropertyValueState(777),
			...metadata,
		});
		channel.properties.push(property);
		return property;
	}
	publish(
		property: ChannelPropertyEntity,
		value: string | number | boolean | null,
		quality: 'good' | 'degraded' = 'good',
	): void {
		let lease = this.leases.get(property.id);
		if (!lease) {
			lease = this.producers.register(property, 1);
			this.leases.set(property.id, lease);
		}
		const now = Date.now();
		expect(
			this.producers.commit(
				lease,
				new PropertyValueState(value),
				{
					quality,
					reasons: quality === 'degraded' ? ['mixed'] : [],
					sampledAt: new Date(now),
					evaluatedAt: new Date(now),
					expiresAt: new Date(now + 1000),
				},
				this.producers.version(lease),
			),
		).toBe(true);
	}
	build(device: DeviceEntity) {
		const staged = this.registry.buildAccessory(device, this.dispatcher);
		if (!staged) throw new Error('Missing accessory');
		this.registry.commitStaged(staged);
		return staged.accessory;
	}
	destroy(): void {
		this.producers.onModuleDestroy();
		this.events.removeAllListeners();
	}
}
