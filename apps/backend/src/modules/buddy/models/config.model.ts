import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	ANOMALY_STUCK_SENSOR_HOURS,
	ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
	BUDDY_DEFAULT_NAME,
	BUDDY_MODULE_NAME,
	CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
	ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
	ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
	ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
	HEARTBEAT_DEFAULT_INTERVAL_MS,
	LLM_PROVIDER_NONE,
	SttProvider,
	TTS_DEFAULT_SPEED,
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
		description:
			'LLM provider plugin type to use for chat conversations (e.g. buddy-openai-plugin, buddy-claude-plugin, buddy-ollama-plugin, or none)',
		type: 'string',
		example: LLM_PROVIDER_NONE,
	})
	@Expose()
	@IsOptional()
	@IsString()
	provider: string = LLM_PROVIDER_NONE;

	// Legacy fields – kept so existing YAML configs pass forbidNonWhitelisted validation.
	// Values are discarded on read; provider-specific settings now live in each plugin's config.
	@Expose({ name: 'api_key' })
	@Transform(() => undefined, { toClassOnly: true })
	@IsOptional()
	@IsString()
	apiKey?: string;

	@Expose()
	@Transform(() => undefined, { toClassOnly: true })
	@IsOptional()
	@IsString()
	model?: string;

	@Expose({ name: 'ollama_url' })
	@Transform(() => undefined, { toClassOnly: true })
	@IsOptional()
	@IsString()
	ollamaUrl?: string;

	@ApiPropertyOptional({
		name: 'voice_enabled',
		description: 'Master toggle for the voice interface (STT + TTS). When false, audio endpoints are disabled.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'voice_enabled' })
	@IsOptional()
	@IsBoolean()
	voiceEnabled: boolean = true;

	@ApiPropertyOptional({
		name: 'stt_provider',
		description: 'Speech-to-text provider (none, whisper_api, whisper_local)',
		type: 'string',
		enum: Object.values(SttProvider),
		example: SttProvider.NONE,
	})
	@Expose({ name: 'stt_provider' })
	@IsOptional()
	@IsString()
	sttProvider: string = SttProvider.NONE;

	@ApiPropertyOptional({
		name: 'stt_api_key',
		description: 'API key for the STT provider (required for whisper_api)',
		type: 'string',
	})
	@Expose({ name: 'stt_api_key' })
	@Transform(
		({ value }): string | undefined =>
			typeof value === 'string' && value.length > 0 ? '***' : (value as string | undefined),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	sttApiKey?: string;

	@ApiPropertyOptional({
		name: 'stt_model',
		description: 'Model identifier for the STT provider',
		type: 'string',
		example: 'whisper-1',
	})
	@Expose({ name: 'stt_model' })
	@IsOptional()
	@IsString()
	sttModel?: string;

	@ApiPropertyOptional({
		name: 'stt_language',
		description: 'ISO 639-1 language code for transcription (e.g. en, cs)',
		type: 'string',
		example: 'en',
	})
	@Expose({ name: 'stt_language' })
	@IsOptional()
	@IsString()
	sttLanguage?: string;

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

	// Legacy field – kept so existing YAML configs pass forbidNonWhitelisted validation.
	// Value is discarded on read; TTS API keys now live in each plugin's config.
	@Expose({ name: 'tts_api_key' })
	@Transform(() => undefined, { toClassOnly: true })
	@IsOptional()
	@IsString()
	ttsApiKey?: string;

	// Legacy field – kept for backwards compatibility
	@Expose({ name: 'tts_provider' })
	@Transform(() => undefined, { toClassOnly: true })
	@IsOptional()
	@IsString()
	ttsProvider?: string;

	@ApiPropertyOptional({
		name: 'tts_voice',
		description: 'Voice identifier for TTS (provider-specific, e.g. alloy for OpenAI; voice ID for ElevenLabs)',
		type: 'string',
		example: 'alloy',
	})
	@Expose({ name: 'tts_voice' })
	@IsOptional()
	@IsString()
	ttsVoice?: string;

	@ApiPropertyOptional({
		name: 'tts_speed',
		description: 'Speech speed multiplier (0.25 to 4.0)',
		type: 'number',
		example: 1.0,
	})
	@Expose({ name: 'tts_speed' })
	@IsOptional()
	@IsNumber()
	@Min(0.25)
	@Max(4.0)
	ttsSpeed: number = TTS_DEFAULT_SPEED;

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
}
