import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { GenerateDeviceCommand } from './commands/generate-device.command';
import { PopulateValuesCommand } from './commands/populate-values.command';
import { SetConnectionStateCommand } from './commands/set-connection-state.command';
import { SimulateCommand } from './commands/simulate.command';
import { SimulatorController } from './controllers/simulator.controller';
import {
	DEVICES_SIMULATOR_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_SIMULATOR_PLUGIN_API_TAG_NAME,
	DEVICES_SIMULATOR_PLUGIN_NAME,
	DEVICES_SIMULATOR_TYPE,
} from './devices-simulator.constants';
import { DEVICES_SIMULATOR_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-simulator.openapi';
import { CreateSimulatorChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateSimulatorChannelDto } from './dto/create-channel.dto';
import { CreateSimulatorDeviceDto } from './dto/create-device.dto';
import { UpdateSimulatorChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateSimulatorChannelDto } from './dto/update-channel.dto';
import { SimulatorUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateSimulatorDeviceDto } from './dto/update-device.dto';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from './entities/devices-simulator.entity';
import { SimulatorConfigModel } from './models/config.model';
import { SimulatorDevicePlatform } from './platforms/simulator-device.platform';
import { DeviceGeneratorService } from './services/device-generator.service';
import { SimulationService } from './services/simulation.service';

@ApiTag({
	tagName: DEVICES_SIMULATOR_PLUGIN_NAME,
	displayName: DEVICES_SIMULATOR_PLUGIN_API_TAG_NAME,
	description: DEVICES_SIMULATOR_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SimulatorDeviceEntity, SimulatorChannelEntity, SimulatorChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [
		SimulatorDevicePlatform,
		DeviceGeneratorService,
		SimulationService,
		GenerateDeviceCommand,
		PopulateValuesCommand,
		SetConnectionStateCommand,
		SimulateCommand,
	],
	controllers: [SimulatorController],
	exports: [DeviceGeneratorService, SimulationService],
})
export class DevicesSimulatorPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly simulatorDevicePlatform: SimulatorDevicePlatform,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<SimulatorConfigModel, SimulatorUpdatePluginConfigDto>({
			type: DEVICES_SIMULATOR_PLUGIN_NAME,
			class: SimulatorConfigModel,
			configDto: SimulatorUpdatePluginConfigDto,
		});

		// Register device type mapping
		this.devicesMapper.registerMapping<SimulatorDeviceEntity, CreateSimulatorDeviceDto, UpdateSimulatorDeviceDto>({
			type: DEVICES_SIMULATOR_TYPE,
			class: SimulatorDeviceEntity,
			createDto: CreateSimulatorDeviceDto,
			updateDto: UpdateSimulatorDeviceDto,
		});

		// Register channel type mapping
		this.channelsMapper.registerMapping<SimulatorChannelEntity, CreateSimulatorChannelDto, UpdateSimulatorChannelDto>({
			type: DEVICES_SIMULATOR_TYPE,
			class: SimulatorChannelEntity,
			createDto: CreateSimulatorChannelDto,
			updateDto: UpdateSimulatorChannelDto,
		});

		// Register channel property type mapping
		this.channelsPropertiesMapper.registerMapping<
			SimulatorChannelPropertyEntity,
			CreateSimulatorChannelPropertyDto,
			UpdateSimulatorChannelPropertyDto
		>({
			type: DEVICES_SIMULATOR_TYPE,
			class: SimulatorChannelPropertyEntity,
			createDto: CreateSimulatorChannelPropertyDto,
			updateDto: UpdateSimulatorChannelPropertyDto,
		});

		// Register platform for handling property updates
		this.platformRegistryService.register(this.simulatorDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_SIMULATOR_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminator mappings for polymorphic types
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: SimulatorDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: CreateSimulatorDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: UpdateSimulatorDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: SimulatorChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: CreateSimulatorChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: UpdateSimulatorChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: SimulatorChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: CreateSimulatorChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SIMULATOR_TYPE,
			modelClass: UpdateSimulatorChannelPropertyDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_SIMULATOR_PLUGIN_NAME,
			name: 'Device Simulator',
			description: 'Plugin for creating simulated devices for testing and development',
			author: 'FastyBird',
			readme: `# Device Simulator Plugin

Plugin for creating virtual devices for testing purposes without requiring physical hardware.

## Features

- **Generate Devices** - Create simulated devices of any category with proper channels and properties
- **Realistic Simulation** - Time-based and environmental simulation for realistic device behavior
- **Smart Simulators** - Dedicated simulators for sensors, lighting, AC, heaters, thermostats, and more
- **Connection Testing** - Simulate connection state changes (online/offline)
- **Auto-Simulation** - Enable automatic value updates at configurable intervals
- **Location-Aware** - Latitude-based simulation for accurate daylight and temperature patterns

## Supported Device Categories with Realistic Simulators

- **Sensors** - Temperature, humidity, motion, illuminance, pressure, contact, leak, smoke, CO, CO2, air quality
- **Lighting** - Time-based on/off, brightness, color temperature, RGB colors
- **Air Conditioners** - Cooling/heating modes, fan control, temperature regulation
- **Heating Units** - Temperature control, power consumption
- **Thermostats** - Scheduled temperature control with hysteresis
- **Outlets** - Power monitoring, energy consumption tracking
- **Fans** - Temperature-based speed control
- **Locks** - Time-based lock/unlock patterns
- **Window Coverings** - Position based on time of day and season

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| \`update_on_start\` | Simulate values when service starts | \`false\` |
| \`simulation_interval\` | Auto-simulation interval (ms), 0 = disabled | \`0\` |
| \`latitude\` | Location for daylight/temperature calculations | \`50.0\` |
| \`smooth_transitions\` | Gradual value changes for realism | \`true\` |

## CLI Commands

### Realistic Simulation (New!)
\`\`\`bash
pnpm run cli simulator:simulate --list              # List devices with simulator info
pnpm run cli simulator:simulate --all               # Simulate all devices once
pnpm run cli simulator:simulate --device <id>       # Simulate specific device
pnpm run cli simulator:simulate --config            # Show configuration
pnpm run cli simulator:simulate --start --interval 5000  # Start auto-simulation
pnpm run cli simulator:simulate --stop              # Stop auto-simulation
pnpm run cli simulator:simulate                     # Interactive mode
\`\`\`

### Generate Devices
\`\`\`bash
pnpm run cli simulator:generate --list
pnpm run cli simulator:generate --category sensor --name "Living Room Sensor"
pnpm run cli simulator:generate --category thermostat --count 3
\`\`\`

### Random Values (Legacy)
\`\`\`bash
pnpm run cli simulator:populate --all
pnpm run cli simulator:populate --device <id>
\`\`\`

### Connection State
\`\`\`bash
pnpm run cli simulator:connection --all --state connected
pnpm run cli simulator:connection --device <id> --state lost
\`\`\`

## REST API Endpoints

- \`GET /simulator/categories\` - List available device categories
- \`POST /simulator/generate\` - Generate a new simulated device
- \`POST /simulator/{deviceId}/simulate-value\` - Set a property value
- \`POST /simulator/{deviceId}/simulate-connection\` - Change connection state
- \`POST /simulator/{deviceId}/simulate-all\` - Generate random values`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
