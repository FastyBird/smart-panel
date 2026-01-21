import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginDataConfig' })
export class SimulatorConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DEVICES_SIMULATOR_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_SIMULATOR_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;

	@ApiProperty({
		description: 'Whether to simulate device values when the service starts',
		name: 'update_on_start',
		type: 'boolean',
		example: false,
		default: false,
	})
	@Expose({ name: 'update_on_start' })
	@IsBoolean()
	updateOnStart: boolean = false;

	@ApiProperty({
		description: 'Interval in milliseconds for automatic simulation updates. Set to 0 to disable.',
		name: 'simulation_interval',
		type: 'number',
		example: 30000,
		default: 0,
	})
	@Expose({ name: 'simulation_interval' })
	@IsNumber()
	@Min(0)
	@Max(3600000) // Max 1 hour
	simulationInterval: number = 0;

	@ApiProperty({
		description: 'Latitude for location-based simulation (affects temperature, daylight, etc.)',
		type: 'number',
		example: 50.0,
		default: 50.0,
	})
	@Expose()
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude: number = 50.0;

	@ApiProperty({
		description: 'Whether to use smooth transitions for simulated values',
		name: 'smooth_transitions',
		type: 'boolean',
		example: true,
		default: true,
	})
	@Expose({ name: 'smooth_transitions' })
	@IsBoolean()
	smoothTransitions: boolean = true;

	@ApiProperty({
		description: 'Initial connection state for all simulator devices at service start',
		name: 'connection_state_on_start',
		enum: ConnectionState,
		example: ConnectionState.CONNECTED,
		required: false,
	})
	@Expose({ name: 'connection_state_on_start' })
	@IsEnum(ConnectionState)
	@IsOptional()
	connectionStateOnStart?: ConnectionState;
}
