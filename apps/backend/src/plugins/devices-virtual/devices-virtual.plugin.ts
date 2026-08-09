import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesValidationException } from '../../modules/devices/devices.exceptions';
import { DevicesModule } from '../../modules/devices/devices.module';
import { CreateChannelPropertyDto } from '../../modules/devices/dto/create-channel-property.dto';
import { CreateChannelDto } from '../../modules/devices/dto/create-channel.dto';
import { CreateDeviceDto } from '../../modules/devices/dto/create-device.dto';
import { UpdateChannelPropertyDto } from '../../modules/devices/dto/update-channel-property.dto';
import { UpdateChannelDto } from '../../modules/devices/dto/update-channel.dto';
import { UpdateDeviceDto } from '../../modules/devices/dto/update-device.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { PropertyValueSourceRegistryService } from '../../modules/devices/services/property-value-source.registry.service';
import { EnergyModule } from '../../modules/energy/energy.module';
import { EnergyClaimRegistryService } from '../../modules/energy/services/energy-claim.registry.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { VirtualDevicesController } from './controllers/virtual-devices.controller';
import {
	DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	DEVICES_VIRTUAL_PLUGIN_NAME,
	DEVICES_VIRTUAL_TYPE,
} from './devices-virtual.constants';
import {
	VirtualCategoryChangeUnsafeException,
	VirtualChannelCategoryChangeUnsafeException,
	VirtualOwnedPropertyNotWritableException,
	VirtualOwnerNotVirtualException,
	VirtualProjectionIncompatibleException,
	VirtualValueOriginConflictException,
} from './devices-virtual.exceptions';
import { DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-virtual.openapi';
import { CreateVirtualChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from './dto/create-channel.dto';
import { CreateVirtualDeviceDto } from './dto/create-device.dto';
import { UpdateVirtualChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from './dto/update-channel.dto';
import { VirtualUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateVirtualDeviceDto } from './dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from './entities/devices-virtual.entity';
import { VirtualDeviceInformationListener } from './listeners/virtual-device-information.listener';
import { VirtualIndexMaintenanceListener } from './listeners/virtual-index-maintenance.listener';
import { VirtualProjectionListener } from './listeners/virtual-projection.listener';
import { VirtualStatusListener } from './listeners/virtual-status.listener';
import { VirtualConfigModel } from './models/config.model';
import { VirtualDevicePlatform } from './platforms/virtual-device.platform';
import { VirtualDevicesService } from './services/virtual-devices.service';
import { VirtualEnergyClaimService } from './services/virtual-energy-claim.service';
import { VirtualPropertyIndexService } from './services/virtual-property-index.service';
import { VirtualValueSourceService } from './services/virtual-value-source.service';
import { CategoryAllowedConstraintValidator } from './validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from './validators/device-is-virtual-constraint.validator';
import { SourceNotVirtualConstraintValidator } from './validators/source-not-virtual-constraint.validator';

@ApiTag({
	tagName: DEVICES_VIRTUAL_PLUGIN_NAME,
	displayName: DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	description: DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		// DeviceEntity is registered here on top of the plugin's own entities because
		// VirtualIndexMaintenanceListener writes one column no DTO can express — `hiddenBy`, cleared
		// back to null when it unhides a source device (see its unhideSource()). Repeating a
		// DevicesModule registration is fine: TypeORM scopes repositories per module and both owners
		// get their own instance over the same table.
		TypeOrmModule.forFeature([VirtualDeviceEntity, VirtualChannelPropertyEntity, DeviceEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
		// For the energy claim registry alone: a projected meter is billed to the virtual device that
		// presents it, and the energy module has no way to know that without being told.
		EnergyModule,
	],
	providers: [
		VirtualValueSourceService,
		VirtualEnergyClaimService,
		VirtualDevicePlatform,
		VirtualPropertyIndexService,
		VirtualDevicesService,
		VirtualProjectionListener,
		VirtualStatusListener,
		VirtualIndexMaintenanceListener,
		VirtualDeviceInformationListener,
		CategoryAllowedConstraintValidator,
		DeviceIsVirtualConstraintValidator,
		SourceNotVirtualConstraintValidator,
	],
	controllers: [VirtualDevicesController],
})
export class DevicesVirtualPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly virtualValueSourceService: VirtualValueSourceService,
		private readonly propertyValueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly virtualEnergyClaimService: VirtualEnergyClaimService,
		private readonly energyClaimRegistry: EnergyClaimRegistryService,
		private readonly virtualDevicePlatform: VirtualDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly deviceInformationListener: VirtualDeviceInformationListener,
		private readonly virtualDevicesService: VirtualDevicesService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<VirtualConfigModel, VirtualUpdatePluginConfigDto>({
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			class: VirtualConfigModel,
			configDto: VirtualUpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<VirtualDeviceEntity, CreateVirtualDeviceDto, UpdateVirtualDeviceDto>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualDeviceEntity,
			createDto: CreateVirtualDeviceDto,
			updateDto: UpdateVirtualDeviceDto,
			// A virtual device's whole structure is derived from its category, and a device PATCH writes
			// no property, so no property hook sees a recategorisation. This is the only point at which
			// one can be judged against the channels the device already carries.
			beforeUpdate: async (device: VirtualDeviceEntity, previous): Promise<void> => {
				try {
					await this.virtualDevicesService.assertCategoryChangeSafe(device, previous.category);
				} catch (error) {
					// Translated for the same reason the property hooks translate theirs: the plugin's own
					// exception vocabulary means nothing to the devices controller, which reports a
					// `DevicesException` as an unprocessable entity and everything else as a 500. A refused
					// PATCH is the caller's mistake, not the server's.
					if (error instanceof VirtualCategoryChangeUnsafeException) {
						throw new DevicesValidationException(error.message);
					}

					throw error;
				}
			},
		});

		this.channelsMapper.registerMapping<VirtualChannelEntity, CreateVirtualChannelDto, UpdateVirtualChannelDto>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualChannelEntity,
			createDto: CreateVirtualChannelDto,
			updateDto: UpdateVirtualChannelDto,
			// A virtual channel's category decides which spec slots its properties fill: every projection
			// under it was judged against `device.category` *and* this one. Moving it leaves those
			// projections attached to slots the new category never defines — an invalid device that reads
			// and commands go on using — and no property hook sees a channel PATCH, so this is the only
			// point at which it can be judged. Refused rather than repaired, for the same reason a device
			// recategorisation is: the structure is built for the category it was created with, and
			// rebuilding it is the operation that was actually meant.
			beforeUpdate: async (channel: VirtualChannelEntity, previous): Promise<void> => {
				try {
					await this.virtualDevicesService.assertChannelCategoryChangeSafe(channel, previous.category);
				} catch (error) {
					if (error instanceof VirtualChannelCategoryChangeUnsafeException) {
						throw new DevicesValidationException(error.message);
					}

					throw error;
				}
			},
		});

		this.channelsPropertiesMapper.registerMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
			// Runs inside ChannelsPropertiesService.create(), before it re-reads the row and before it
			// emits CHANNEL_PROPERTY_CREATED — which is the whole point. A property created in a virtual
			// device's device_information channel with no `value_origin` takes the SOURCE column default
			// with a null source, i.e. an orphan, and an orphan forces the device to DISCONNECTED and
			// makes it reject every command. The generic DeviceConnectivityService creates exactly that,
			// both when it wins the creation race against VirtualDeviceInformationListener and whenever
			// it recreates a connection-state property someone deleted by hand. Claiming it here means
			// neither case can be observed as an orphan by anything, rather than repaired after the fact
			// by something racing the same service's next write.
			afterCreate: async (property: VirtualChannelPropertyEntity): Promise<VirtualChannelPropertyEntity> => {
				await this.deviceInformationListener.claimDeviceInformationProperty(property);

				return property;
			},
			// Containment. A channel property's `type` is chosen from the request payload while its
			// channel is a route parameter, so nothing before this stopped a virtual property being
			// created inside an ordinary *physical* channel — after which
			// VirtualPropertyIndexService files the physical device under `byVirtualDevice` and
			// VirtualStatusListener overwrites its real connectivity with the projection aggregate,
			// making that device's own commands fail as offline. See
			// VirtualDevicesService.assertChannelOwnerIsVirtual.
			//
			// A `beforeCreate` hook rather than a class-validator constraint precisely because the
			// channel id never reaches the DTO; it runs before `repository.save`, so a refused
			// attachment leaves no row, emits no CHANNEL_PROPERTY_CREATED, and never reaches the
			// `afterCreate` claim above.
			//
			// The plugin's own exceptions are translated to DevicesValidationException rather than
			// left to escape, for the same reason as in `beforeUpdate` below: this hook's caller
			// reports a DevicesException as an unprocessable entity and anything else as a 500, and a
			// refused payload is not a server fault. Any other exception is re-thrown untouched.
			beforeCreate: async (property: VirtualChannelPropertyEntity, channelId: string): Promise<void> => {
				try {
					await this.virtualDevicesService.assertChannelOwnerIsVirtual(channelId);
					// Repeated here as well as on the create DTO so that *every* creation path is covered,
					// including this plugin's own listeners and any future internal caller that bypasses
					// the DTO. The DTO constraint still owns the user-facing error, which names the field.
					this.virtualDevicesService.assertOwnedPropertyNotWritable(property);
					// The wizard previews compatibility, but a preview is not a guard: it is not atomic with
					// this write, and a direct API call never makes it at all. Checked here rather than on
					// the DTO because the spec slot is resolved from the owning channel and its device,
					// which the payload does not carry.
					await this.virtualDevicesService.assertProjectionCompatible(property, channelId);
				} catch (error) {
					if (
						error instanceof VirtualOwnerNotVirtualException ||
						error instanceof VirtualOwnedPropertyNotWritableException ||
						error instanceof VirtualProjectionIncompatibleException
					) {
						throw new DevicesValidationException(error.message);
					}

					throw error;
				}
			},
			// Runs inside ChannelsPropertiesService.update() on the loaded row with the PATCH already
			// merged into it, and before that row is saved. Both checks here judge a pair of fields the
			// update DTO can only see when both halves arrive together, and a PATCH may send either
			// alone:
			//
			// - (`value_origin`, `source_property`) — `{value_origin: 'local'}` against a linked
			//   property and `{source_property: <id>}` against an owned one are each valid in isolation
			//   and only become the unsupported pair here.
			// - (`value_origin`, `permissions`) — `{permissions: ['rw']}` against an owned property and
			//   `{value_origin: 'local'}` against a writable orphan likewise.
			//
			// In both cases the DTO constraint is complementary, not redundant: it still gives the
			// better, field-named 400 for the combined payload.
			//
			// The plugin's own exceptions are translated to DevicesValidationException rather than left
			// to escape, mirroring SourceNotVirtualConstraintValidator's translation of the same
			// service's exceptions into its caller's failure vocabulary: this hook's caller reports a
			// DevicesException as an unprocessable entity and anything else as a 500, and a rejected
			// payload is not a server fault. Any *other* exception is re-thrown untouched — a bug in
			// here must not be reported to the client as invalid input.
			beforeUpdate: async (property: VirtualChannelPropertyEntity): Promise<void> => {
				try {
					this.virtualDevicesService.assertValueOriginPairSupported(property);
					this.virtualDevicesService.assertOwnedPropertyNotWritable(property);

					// A remap is the other way an incompatible projection gets stored, and the one the
					// wizard's preview covers least well: the source can change permissions or data type
					// between the preview and this write. Judged on the merged row like the two checks
					// above, so it does not matter whether the PATCH carried `source_property`,
					// `value_origin`, or both — what is being stored is what gets checked. The channel id
					// comes off the row because this hook, unlike `beforeCreate`, is not handed one.
					const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

					if (channelId) {
						await this.virtualDevicesService.assertProjectionCompatible(property, channelId);
					}
				} catch (error) {
					if (
						error instanceof VirtualValueOriginConflictException ||
						error instanceof VirtualOwnedPropertyNotWritableException ||
						error instanceof VirtualProjectionIncompatibleException
					) {
						throw new DevicesValidationException(error.message);
					}

					throw error;
				}
			},
		});

		for (const model of DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualChannelPropertyDto,
		});

		this.propertyValueSourceRegistry.register(this.virtualValueSourceService);

		this.energyClaimRegistry.register(this.virtualEnergyClaimService);

		this.platformRegistryService.register(this.virtualDevicePlatform);

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			name: 'Virtual Devices',
			description: 'Build devices by splitting or combining the channels and properties of other devices',
			author: 'FastyBird',
			readme: `# Virtual Devices

> Plugin · by FastyBird · platform: devices

Build new devices out of channels and properties that already belong to other devices. Split one physical device into several logical ones — for example a four-relay switch into four separate room switches — or combine several physical devices into one, such as a Zigbee temperature sensor and a relay presented together as a single device.

Every channel and property a virtual device exposes is a real row with a real id, so it works with rooms, spaces, tiles, scenes and dashboards exactly like a native device. Nothing is duplicated: a linked property reads and writes through its source, so the value and its history live in one place, not two.

## What you get

- A way to reorganise devices around how your home is actually laid out, instead of how the hardware happens to be wired
- One dashboard tile, one room assignment and one set of scenes for properties that used to be scattered across several devices — or split apart from one device that covered too much
- No duplicated history: energy and timeseries data are recorded once, at the source, no matter how many virtual devices project it

## Features

- **Splitting** — turn one multi-channel physical device into several independent devices, each with its own room, category and identity
- **Composition** — assemble one logical device from channels and properties taken from several physical devices
- **Live projection** — a linked property always reflects its source; writes are forwarded back to the source rather than stored separately
- **Graceful degradation** — if a source property is deleted, the property that projected it is marked orphaned instead of breaking the device, so it can be remapped later

## What it doesn't do (yet)

- **No closed-loop control.** Categories that need a control algorithm to turn a setpoint into action — thermostats, air conditioners, humidifiers and similar — aren't offered, so a virtual device never accepts a command it can't actually carry out
- **No computed or aggregated values.** Every linked property mirrors its source 1:1; there is no averaging, scaling or combining of several sources into one value
- **Admin only.** Virtual devices are configured from the admin app; there is no panel-side creation flow

## Use Cases

- Splitting a multi-relay device so each load gets its own room and its own place on the dashboard
- Combining a temperature sensor and a switch into one device that reads and behaves like a single piece of hardware
- Reshaping how imported or auto-discovered devices are organised without touching the integration that created them`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
