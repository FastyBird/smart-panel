import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	ANOMALY_STUCK_SENSOR_HOURS,
	ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
	BUDDY_MODULE_NAME,
	HEARTBEAT_DEFAULT_INTERVAL_MS,
	LlmProvider,
} from '../buddy.constants';

@ApiSchema({ name: 'ConfigModuleDataBuddy' })
export class BuddyConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'buddy-module',
	})
	@Expose()
	@IsString()
	type: string = BUDDY_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'LLM provider to use for chat conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LlmProvider)
	provider: LlmProvider = LlmProvider.NONE;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		description: 'Model name to use with the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for the Ollama API endpoint',
		type: 'string',
		nullable: true,
		example: 'http://localhost:11434',
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString()
	ollamaUrl: string | null = null;

	@ApiPropertyOptional({
		name: 'heartbeat_interval_ms',
		description: 'Heartbeat evaluation interval in milliseconds (minimum 60000)',
		type: 'integer',
		example: 300000,
	})
	@Expose({ name: 'heartbeat_interval_ms' })
	@IsOptional()
	@IsInt()
	@Min(60_000)
	heartbeatIntervalMs: number = HEARTBEAT_DEFAULT_INTERVAL_MS;

	@ApiPropertyOptional({
		name: 'anomaly_temperature_drift_threshold',
		description: 'Temperature deviation (°C) from setpoint to trigger a drift anomaly',
		type: 'number',
		example: 5,
	})
	@Expose({ name: 'anomaly_temperature_drift_threshold' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	anomalyTemperatureDriftThreshold: number = ANOMALY_TEMPERATURE_DRIFT_THRESHOLD;

	@ApiPropertyOptional({
		name: 'anomaly_stuck_sensor_hours',
		description: 'Hours of unchanged sensor value to trigger a stuck sensor anomaly',
		type: 'number',
		example: 2,
	})
	@Expose({ name: 'anomaly_stuck_sensor_hours' })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	anomalyStuckSensorHours: number = ANOMALY_STUCK_SENSOR_HOURS;

	@ApiPropertyOptional({
		name: 'anomaly_unusual_activity_threshold',
		description: 'Intent count threshold within the time window to trigger an unusual activity anomaly',
		type: 'integer',
		example: 10,
	})
	@Expose({ name: 'anomaly_unusual_activity_threshold' })
	@IsOptional()
	@IsInt()
	@Min(3)
	anomalyUnusualActivityThreshold: number = ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD;

	@ApiPropertyOptional({
		name: 'anomaly_unusual_activity_window_minutes',
		description: 'Time window in minutes for unusual activity detection',
		type: 'integer',
		example: 15,
	})
	@Expose({ name: 'anomaly_unusual_activity_window_minutes' })
	@IsOptional()
	@IsInt()
	@Min(5)
	anomalyUnusualActivityWindowMinutes: number = ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES;
}
