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
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ScenesModule } from '../../modules/scenes/scenes.module';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	AirConditionerRealisticBehavior,
	DoorRealisticBehavior,
	HumidifierRealisticBehavior,
	LockRealisticBehavior,
	ProjectorDelayedBehavior,
	SpeakerRealisticBehavior,
	TelevisionDelayedBehavior,
	ThermostatRealisticBehavior,
	ValveRealisticBehavior,
	WaterHeaterRealisticBehavior,
	WindowCoveringRealisticBehavior,
} from './behaviors';
import { GenerateDeviceCommand } from './commands/generate-device.command';
import { PopulateValuesCommand } from './commands/populate-values.command';
import { ScenarioCommand } from './commands/scenario.command';
import { SetConnectionStateCommand } from './commands/set-connection-state.command';
import { SimulateCommand } from './commands/simulate.command';
import { SimulatorController } from './controllers/simulator.controller';
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
} from './entities/simulator.entity';
import { SimulatorConfigModel } from './models/config.model';
import { SimulatorDevicePlatform } from './platforms/simulator-device.platform';
import { DeviceBehaviorManagerService } from './services/device-behavior-manager.service';
import { DeviceGeneratorService } from './services/device-generator.service';
import { ScenarioExecutorService } from './services/scenario-executor.service';
import { ScenarioLoaderService } from './services/scenario-loader.service';
import { SimulationService } from './services/simulation.service';
import { SimulatorActionsService } from './services/simulator-actions.service';
import {
	SIMULATOR_PLUGIN_API_TAG_DESCRIPTION,
	SIMULATOR_PLUGIN_API_TAG_NAME,
	SIMULATOR_PLUGIN_NAME,
	SIMULATOR_TYPE,
} from './simulator.constants';
import { SIMULATOR_PLUGIN_SWAGGER_EXTRA_MODELS } from './simulator.openapi';

@ApiTag({
	tagName: SIMULATOR_PLUGIN_NAME,
	displayName: SIMULATOR_PLUGIN_API_TAG_NAME,
	description: SIMULATOR_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SimulatorDeviceEntity, SimulatorChannelEntity, SimulatorChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		ScenesModule,
		SpacesModule,
		SwaggerModule,
	],
	providers: [
		SimulatorDevicePlatform,
		DeviceGeneratorService,
		ScenarioLoaderService,
		ScenarioExecutorService,
		SimulationService,
		DeviceBehaviorManagerService,
		SimulatorActionsService,
		GenerateDeviceCommand,
		PopulateValuesCommand,
		ScenarioCommand,
		SetConnectionStateCommand,
		SimulateCommand,
	],
	controllers: [SimulatorController],
	exports: [DeviceGeneratorService, SimulationService, DeviceBehaviorManagerService],
})
export class SimulatorPlugin {
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
		private readonly pluginServiceManager: PluginServiceManagerService,
		private readonly simulationService: SimulationService,
		private readonly behaviorManager: DeviceBehaviorManagerService,
	) {}

	onModuleInit() {
		// Register plugin configuration
		this.configMapper.registerMapping<SimulatorConfigModel, SimulatorUpdatePluginConfigDto>({
			type: SIMULATOR_PLUGIN_NAME,
			class: SimulatorConfigModel,
			configDto: SimulatorUpdatePluginConfigDto,
		});

		// Register device type mapping
		this.devicesMapper.registerMapping<SimulatorDeviceEntity, CreateSimulatorDeviceDto, UpdateSimulatorDeviceDto>({
			type: SIMULATOR_TYPE,
			class: SimulatorDeviceEntity,
			createDto: CreateSimulatorDeviceDto,
			updateDto: UpdateSimulatorDeviceDto,
		});

		// Register channel type mapping
		this.channelsMapper.registerMapping<SimulatorChannelEntity, CreateSimulatorChannelDto, UpdateSimulatorChannelDto>({
			type: SIMULATOR_TYPE,
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
			type: SIMULATOR_TYPE,
			class: SimulatorChannelPropertyEntity,
			createDto: CreateSimulatorChannelPropertyDto,
			updateDto: UpdateSimulatorChannelPropertyDto,
		});

		// Register platform for handling property updates
		this.platformRegistryService.register(this.simulatorDevicePlatform);

		// Register Swagger models
		for (const model of SIMULATOR_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminator mappings for polymorphic types
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: SimulatorDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: CreateSimulatorDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: UpdateSimulatorDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: SimulatorChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: CreateSimulatorChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: UpdateSimulatorChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: SimulatorChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: CreateSimulatorChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: SIMULATOR_TYPE,
			modelClass: UpdateSimulatorChannelPropertyDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: SIMULATOR_PLUGIN_NAME,
			name: 'Simulator',
			description: 'Plugin for creating simulated devices, spaces, and scenes for testing and development',
			author: 'FastyBird',
			readme: `# Simulator

> Plugin · by FastyBird · platform: devices

Creates virtual devices, channels and properties for testing and development — and for showing the panel off without any physical hardware. Supports loading entire homes from YAML scenarios, generating individual devices, realistic time- and location-aware behaviour, and toggling connection state on demand.

## What you get

- A complete, believable home in seconds: pick a scenario (small apartment, penthouse, office) and the simulator seeds devices, channels and properties that look exactly like real ones to the rest of the system
- A way to develop dashboards, scenes and Buddy logic without touching real hardware — values change realistically over time, daylight follows your latitude, AC and heaters react to setpoints
- A reproducible test bed for QA: fixed scenarios with known expected behaviour mean dashboards and scenes can be tested end-to-end
- A live demo mode: pair with auto-simulation and the panel becomes a self-driving showroom
- Granular control: simulate a single property, the entire device, or the whole home; flip connection states to exercise offline / reconnect handling

## Features

- **Scenarios** — load predefined device sets from YAML (small apartment, penthouse, office, …) or your own custom files
- **Device generation** — synthesise devices of any supported category with sensible defaults for channels and properties
- **Realistic simulators** — time-based and environmental simulation for sensors, lighting, AC, heaters, thermostats, outlets, fans, locks and window coverings
- **Connection testing** — flip devices between connected / lost states to exercise reconnect logic in scenes, dashboards and Buddy
- **Auto-simulation** — periodic value updates at a configurable interval, optionally with smooth transitions for realism
- **Location-aware** — latitude-based daylight and temperature curves so the simulated home behaves differently in summer vs. winter, day vs. night
- **Smooth transitions** — values gradually move toward the next target rather than snapping, so dashboards look alive

## Supported Categories

Sensors (temperature, humidity, motion, illuminance, pressure, contact, leak, smoke, CO, CO₂, air quality), lighting (on / off, brightness, CCT, RGB), air conditioners, heating units, thermostats, outlets (with power & energy), fans, locks and window coverings.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`update_on_start\` | Simulate values immediately on service start | \`false\` |
| \`simulation_interval\` | Auto-simulation interval in ms (\`0\` = disabled) | \`0\` |
| \`latitude\` | Latitude used for daylight / temperature patterns | \`50.0\` |
| \`smooth_transitions\` | Gradual value changes for realism | \`true\` |

## API Endpoints

- \`GET /api/v1/plugins/simulator/categories\` — list device categories
- \`POST /api/v1/plugins/simulator/generate\` — generate a simulated device
- \`POST /api/v1/plugins/simulator/{device_id}/simulate-value\` — set a property value
- \`POST /api/v1/plugins/simulator/{device_id}/simulate-connection\` — change connection state
- \`POST /api/v1/plugins/simulator/{device_id}/simulate-all\` — randomise all properties

## CLI Commands

\`\`\`bash
# Realistic simulation
pnpm run cli simulator:simulate --list
pnpm run cli simulator:simulate --all
pnpm run cli simulator:simulate --device <id>
pnpm run cli simulator:simulate --start --interval 5000
pnpm run cli simulator:simulate --stop

# Scenarios
pnpm run cli simulator:scenario --list
pnpm run cli simulator:scenario -s small-apartment
pnpm run cli simulator:scenario --truncate -s office
pnpm run cli simulator:scenario -f /path/to/custom.yaml
pnpm run cli simulator:scenario --dry-run -s penthouse

# Device generation
pnpm run cli simulator:generate --list
pnpm run cli simulator:generate --category sensor --name "Living Room Sensor"
pnpm run cli simulator:generate --category thermostat --count 3

# Random values (legacy)
pnpm run cli simulator:populate --all
pnpm run cli simulator:populate --device <id>

# Connection state
pnpm run cli simulator:connection --all --state connected
pnpm run cli simulator:connection --device <id> --state lost
\`\`\``,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register device behaviors for realistic command responses
		this.behaviorManager.registerBehavior(new ThermostatRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new TelevisionDelayedBehavior(), true);
		this.behaviorManager.registerBehavior(new ProjectorDelayedBehavior(), true);
		this.behaviorManager.registerBehavior(new HumidifierRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new AirConditionerRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new LockRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new ValveRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new WindowCoveringRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new DoorRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new SpeakerRealisticBehavior(), true);
		this.behaviorManager.registerBehavior(new WaterHeaterRealisticBehavior(), true);

		// Register service with centralized plugin service manager
		this.pluginServiceManager.register(this.simulationService);
	}
}
