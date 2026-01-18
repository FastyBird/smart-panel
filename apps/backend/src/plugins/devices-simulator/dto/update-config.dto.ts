import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginUpdateConfig' })
export class SimulatorUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DEVICES_SIMULATOR_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SIMULATOR_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Whether to simulate device values when the service starts',
		name: 'update_on_start',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'update_on_start' })
	@Transform(
		({ obj }: { obj: { update_on_start?: boolean; updateOnStart?: boolean } }) =>
			obj.update_on_start ?? obj.updateOnStart,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsBoolean({ message: '[{"field":"update_on_start","reason":"Must be a boolean."}]' })
	updateOnStart?: boolean;

	@ApiPropertyOptional({
		description: 'Interval in milliseconds for automatic simulation updates. Set to 0 to disable.',
		name: 'simulation_interval',
		type: 'number',
		example: 30000,
	})
	@Expose({ name: 'simulation_interval' })
	@Transform(
		({ obj }: { obj: { simulation_interval?: number; simulationInterval?: number } }) =>
			obj.simulation_interval ?? obj.simulationInterval,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"simulation_interval","reason":"Must be a number."}]' })
	@Min(0, { message: '[{"field":"simulation_interval","reason":"Must be at least 0."}]' })
	@Max(3600000, { message: '[{"field":"simulation_interval","reason":"Must be at most 3600000 (1 hour)."}]' })
	simulationInterval?: number;

	@ApiPropertyOptional({
		description: 'Latitude for location-based simulation (affects temperature, daylight, etc.)',
		type: 'number',
		example: 50.0,
	})
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"latitude","reason":"Must be a number."}]' })
	@Min(-90, { message: '[{"field":"latitude","reason":"Must be at least -90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Must be at most 90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Whether to use smooth transitions for simulated values',
		name: 'smooth_transitions',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'smooth_transitions' })
	@Transform(
		({ obj }: { obj: { smooth_transitions?: boolean; smoothTransitions?: boolean } }) =>
			obj.smooth_transitions ?? obj.smoothTransitions,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsBoolean({ message: '[{"field":"smooth_transitions","reason":"Must be a boolean."}]' })
	smoothTransitions?: boolean;
}
