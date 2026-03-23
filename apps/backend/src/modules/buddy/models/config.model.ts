import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	ANOMALY_STUCK_SENSOR_HOURS,
	ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
	BUDDY_DEFAULT_NAME,
	BUDDY_DEFAULT_PERSONALITY_PATH,
	BUDDY_MODULE_NAME,
	CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
	DEFAULT_MAX_TOOL_ITERATIONS,
	ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
	ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
	ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
	HEARTBEAT_DEFAULT_INTERVAL_MS,
	LLM_DEFAULT_TIMEOUT_MS,
	LLM_PROVIDER_NONE,
	PROVIDER_TIMEOUT_MAX_MS,
	PROVIDER_TIMEOUT_MIN_MS,
	STT_DEFAULT_TIMEOUT_MS,
	STT_PLUGIN_NONE,
	TTS_DEFAULT_TIMEOUT_MS,
	TTS_PLUGIN_NONE,
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
		description: 'Custom display name for the buddy assistant',
		type: 'string',
		example: BUDDY_DEFAULT_NAME,
	})
	@Expose()
	@IsOptional()
	@IsString()
	name: string = BUDDY_DEFAULT_NAME;

	@ApiPropertyOptional({
		name: 'personality_path',
		description: 'File path to the personality.md file that defines the buddy tone and style',
		type: 'string',
		example: BUDDY_DEFAULT_PERSONALITY_PATH,
	})
	@Expose({ name: 'personality_path' })
	@IsOptional()
	@IsString()
	personalityPath: string = BUDDY_DEFAULT_PERSONALITY_PATH;

	@ApiPropertyOptional({
		description:
			'LLM provider plugin type to use for chat conversations (e.g. buddy-openai-plugin, buddy-claude-plugin, buddy-ollama-plugin, or none)',
		type: 'string',
		example: LLM_PROVIDER_NONE,
	})
	@Expose()
	@IsOptional()
	@IsString()
	provider: string = LLM_PROVIDER_NONE;

	@ApiPropertyOptional({
		name: 'voice_enabled',
		description: 'Master toggle for the voice interface (STT + TTS). When false, audio endpoints are disabled.',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'voice_enabled' })
	@IsOptional()
	@IsBoolean()
	voiceEnabled: boolean = false;

	@ApiPropertyOptional({
		name: 'stt_plugin',
		description: 'STT provider plugin type (e.g. buddy-openai-plugin, buddy-stt-whisper-local-plugin, or none)',
		type: 'string',
		example: STT_PLUGIN_NONE,
	})
	@Expose({ name: 'stt_plugin' })
	@IsOptional()
	@IsString()
	sttPlugin: string = STT_PLUGIN_NONE;

	@ApiPropertyOptional({
		name: 'tts_plugin',
		description:
			'TTS provider plugin type (e.g. buddy-openai-plugin, buddy-elevenlabs-plugin, buddy-system-tts-plugin, or none)',
		type: 'string',
		example: TTS_PLUGIN_NONE,
	})
	@Expose({ name: 'tts_plugin' })
	@IsOptional()
	@IsString()
	ttsPlugin: string = TTS_PLUGIN_NONE;

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
		name: 'max_tool_iterations',
		description: 'Maximum number of tool execution iterations per message (minimum 3, maximum 20)',
		type: 'integer',
		example: DEFAULT_MAX_TOOL_ITERATIONS,
	})
	@Expose({ name: 'max_tool_iterations' })
	@IsOptional()
	@IsInt()
	@Min(3)
	@Max(20)
	maxToolIterations: number = DEFAULT_MAX_TOOL_ITERATIONS;

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

	@ApiPropertyOptional({
		name: 'energy_excess_solar_threshold_kw',
		description: 'Surplus solar production (kW) above consumption to trigger an excess solar suggestion',
		type: 'number',
		example: 1,
	})
	@Expose({ name: 'energy_excess_solar_threshold_kw' })
	@IsOptional()
	@IsNumber()
	@Min(0.1)
	energyExcessSolarThresholdKw: number = ENERGY_EXCESS_SOLAR_THRESHOLD_KW;

	@ApiPropertyOptional({
		name: 'energy_high_consumption_threshold_kw',
		description: 'Grid draw (kW) to trigger a high consumption suggestion',
		type: 'number',
		example: 5,
	})
	@Expose({ name: 'energy_high_consumption_threshold_kw' })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	energyHighConsumptionThresholdKw: number = ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW;

	@ApiPropertyOptional({
		name: 'energy_battery_low_threshold_percent',
		description: 'Battery level (%) below which a low battery suggestion is triggered',
		type: 'number',
		example: 20,
	})
	@Expose({ name: 'energy_battery_low_threshold_percent' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	energyBatteryLowThresholdPercent: number = ENERGY_BATTERY_LOW_THRESHOLD_PERCENT;

	@ApiPropertyOptional({
		name: 'conflict_lights_unoccupied_minutes',
		description: 'Minutes of no occupancy before suggesting to turn off lights',
		type: 'integer',
		example: 15,
	})
	@Expose({ name: 'conflict_lights_unoccupied_minutes' })
	@IsOptional()
	@IsInt()
	@Min(1)
	conflictLightsUnoccupiedMinutes: number = CONFLICT_LIGHTS_UNOCCUPIED_MINUTES;

	@ApiPropertyOptional({
		name: 'stt_timeout_ms',
		description: 'Speech-to-text provider timeout in milliseconds',
		type: 'integer',
		example: 30000,
	})
	@Expose({ name: 'stt_timeout_ms' })
	@IsOptional()
	@IsInt()
	@Min(PROVIDER_TIMEOUT_MIN_MS)
	@Max(PROVIDER_TIMEOUT_MAX_MS)
	sttTimeoutMs: number = STT_DEFAULT_TIMEOUT_MS;

	@ApiPropertyOptional({
		name: 'tts_timeout_ms',
		description: 'Text-to-speech provider timeout in milliseconds',
		type: 'integer',
		example: 15000,
	})
	@Expose({ name: 'tts_timeout_ms' })
	@IsOptional()
	@IsInt()
	@Min(PROVIDER_TIMEOUT_MIN_MS)
	@Max(PROVIDER_TIMEOUT_MAX_MS)
	ttsTimeoutMs: number = TTS_DEFAULT_TIMEOUT_MS;

	@ApiPropertyOptional({
		name: 'llm_timeout_ms',
		description: 'LLM provider timeout in milliseconds',
		type: 'integer',
		example: 60000,
	})
	@Expose({ name: 'llm_timeout_ms' })
	@IsOptional()
	@IsInt()
	@Min(PROVIDER_TIMEOUT_MIN_MS)
	@Max(PROVIDER_TIMEOUT_MAX_MS)
	llmTimeoutMs: number = LLM_DEFAULT_TIMEOUT_MS;
}
