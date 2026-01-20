import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginCreateDevice' })
export class CreateSimulatorDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_SIMULATOR_TYPE,
		example: DEVICES_SIMULATOR_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_SIMULATOR_TYPE;

	@ApiPropertyOptional({
		description: 'Whether to auto-simulate value changes',
		name: 'auto_simulate',
		type: 'boolean',
		default: false,
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"auto_simulate","reason":"Auto simulate must be a boolean."}]' })
	auto_simulate?: boolean;

	@ApiPropertyOptional({
		description: 'Simulation interval in milliseconds (when auto_simulate is true)',
		name: 'simulate_interval',
		type: 'number',
		default: 5000,
		minimum: 1000,
		maximum: 60000,
		example: 5000,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"simulate_interval","reason":"Simulate interval must be an integer."}]' })
	@Min(1000, { message: '[{"field":"simulate_interval","reason":"Simulate interval must be at least 1000ms."}]' })
	@Max(60000, { message: '[{"field":"simulate_interval","reason":"Simulate interval must not exceed 60000ms."}]' })
	simulate_interval?: number;
}
