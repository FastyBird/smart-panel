import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { BUDDY_MODULE_NAME, LlmProvider } from '../buddy.constants';

@ApiSchema({ name: 'ConfigModuleUpdateBuddy' })
export class UpdateBuddyConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'buddy-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = BUDDY_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'LLM provider to use for chat conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LlmProvider, { message: '[{"field":"provider","reason":"Provider must be a valid LLM provider."}]' })
	provider?: LlmProvider;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	api_key?: string | null;

	@ApiPropertyOptional({
		description: 'Model name to use with the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a valid string."}]' })
	model?: string | null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for the Ollama API endpoint',
		type: 'string',
		nullable: true,
		example: 'http://localhost:11434',
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString({ message: '[{"field":"ollama_url","reason":"Ollama URL must be a valid string."}]' })
	ollama_url?: string | null;

	@ApiPropertyOptional({
		name: 'heartbeat_interval_ms',
		description: 'Heartbeat evaluation interval in milliseconds (minimum 60000)',
		type: 'integer',
		example: 300000,
	})
	@Expose({ name: 'heartbeat_interval_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"heartbeat_interval_ms","reason":"Heartbeat interval must be a valid integer."}]' })
	@Min(60_000, { message: '[{"field":"heartbeat_interval_ms","reason":"Heartbeat interval must be at least 60s."}]' })
	heartbeat_interval_ms?: number;

	@ApiPropertyOptional({
		name: 'anomaly_temperature_drift_threshold',
		description: 'Temperature deviation (°C) from setpoint to trigger a drift anomaly',
		type: 'number',
		example: 5,
	})
	@Expose({ name: 'anomaly_temperature_drift_threshold' })
	@IsOptional()
	@IsNumber(
		{},
		{
			message:
				'[{"field":"anomaly_temperature_drift_threshold","reason":"Temperature drift threshold must be a number."}]',
		},
	)
	@Min(1, {
		message:
			'[{"field":"anomaly_temperature_drift_threshold","reason":"Temperature drift threshold must be at least 1."}]',
	})
	anomaly_temperature_drift_threshold?: number;

	@ApiPropertyOptional({
		name: 'anomaly_stuck_sensor_hours',
		description: 'Hours of unchanged sensor value to trigger a stuck sensor anomaly',
		type: 'number',
		example: 2,
	})
	@Expose({ name: 'anomaly_stuck_sensor_hours' })
	@IsOptional()
	@IsNumber(
		{},
		{
			message: '[{"field":"anomaly_stuck_sensor_hours","reason":"Stuck sensor hours must be a number."}]',
		},
	)
	@Min(0.5, {
		message: '[{"field":"anomaly_stuck_sensor_hours","reason":"Stuck sensor hours must be at least 0.5."}]',
	})
	anomaly_stuck_sensor_hours?: number;

	@ApiPropertyOptional({
		name: 'anomaly_unusual_activity_threshold',
		description: 'Intent count threshold within the time window to trigger an unusual activity anomaly',
		type: 'integer',
		example: 10,
	})
	@Expose({ name: 'anomaly_unusual_activity_threshold' })
	@IsOptional()
	@IsInt({
		message:
			'[{"field":"anomaly_unusual_activity_threshold","reason":"Unusual activity threshold must be an integer."}]',
	})
	@Min(3, {
		message:
			'[{"field":"anomaly_unusual_activity_threshold","reason":"Unusual activity threshold must be at least 3."}]',
	})
	anomaly_unusual_activity_threshold?: number;

	@ApiPropertyOptional({
		name: 'anomaly_unusual_activity_window_minutes',
		description: 'Time window in minutes for unusual activity detection',
		type: 'integer',
		example: 15,
	})
	@Expose({ name: 'anomaly_unusual_activity_window_minutes' })
	@IsOptional()
	@IsInt({
		message:
			'[{"field":"anomaly_unusual_activity_window_minutes","reason":"Unusual activity window must be an integer."}]',
	})
	@Min(5, {
		message:
			'[{"field":"anomaly_unusual_activity_window_minutes","reason":"Unusual activity window must be at least 5 minutes."}]',
	})
	anomaly_unusual_activity_window_minutes?: number;

	@ApiPropertyOptional({
		name: 'energy_excess_solar_threshold_kw',
		description: 'Grid export (kW) to trigger an excess solar suggestion',
		type: 'number',
		example: 1,
	})
	@Expose({ name: 'energy_excess_solar_threshold_kw' })
	@IsOptional()
	@IsNumber(
		{},
		{ message: '[{"field":"energy_excess_solar_threshold_kw","reason":"Excess solar threshold must be a number."}]' },
	)
	@Min(0.1, {
		message: '[{"field":"energy_excess_solar_threshold_kw","reason":"Excess solar threshold must be at least 0.1."}]',
	})
	energy_excess_solar_threshold_kw?: number;

	@ApiPropertyOptional({
		name: 'energy_high_consumption_threshold_kw',
		description: 'Grid draw (kW) to trigger a high consumption suggestion',
		type: 'number',
		example: 5,
	})
	@Expose({ name: 'energy_high_consumption_threshold_kw' })
	@IsOptional()
	@IsNumber(
		{},
		{
			message:
				'[{"field":"energy_high_consumption_threshold_kw","reason":"High consumption threshold must be a number."}]',
		},
	)
	@Min(0.5, {
		message:
			'[{"field":"energy_high_consumption_threshold_kw","reason":"High consumption threshold must be at least 0.5."}]',
	})
	energy_high_consumption_threshold_kw?: number;

	@ApiPropertyOptional({
		name: 'energy_battery_low_threshold_percent',
		description: 'Battery level (%) below which a low battery suggestion is triggered',
		type: 'number',
		example: 20,
	})
	@Expose({ name: 'energy_battery_low_threshold_percent' })
	@IsOptional()
	@IsNumber(
		{},
		{
			message: '[{"field":"energy_battery_low_threshold_percent","reason":"Battery low threshold must be a number."}]',
		},
	)
	@Min(1, {
		message: '[{"field":"energy_battery_low_threshold_percent","reason":"Battery low threshold must be at least 1."}]',
	})
	energy_battery_low_threshold_percent?: number;

	@ApiPropertyOptional({
		name: 'conflict_lights_unoccupied_minutes',
		description: 'Minutes of no occupancy before suggesting to turn off lights',
		type: 'integer',
		example: 15,
	})
	@Expose({ name: 'conflict_lights_unoccupied_minutes' })
	@IsOptional()
	@IsInt({
		message:
			'[{"field":"conflict_lights_unoccupied_minutes","reason":"Lights unoccupied minutes must be an integer."}]',
	})
	@Min(1, {
		message:
			'[{"field":"conflict_lights_unoccupied_minutes","reason":"Lights unoccupied minutes must be at least 1."}]',
	})
	conflict_lights_unoccupied_minutes?: number;
}
