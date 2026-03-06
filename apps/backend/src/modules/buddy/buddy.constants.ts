export const BUDDY_MODULE_PREFIX = 'buddy';

export const BUDDY_MODULE_NAME = 'buddy-module';

export const BUDDY_MODULE_API_TAG_NAME = 'Buddy module';

export const BUDDY_MODULE_API_TAG_DESCRIPTION =
	'AI assistant module providing text chat, context-aware suggestions, and proactive home automation insights.';

export enum EventType {
	SUGGESTION_CREATED = 'BuddyModule.Suggestion.Created',
	CONVERSATION_MESSAGE_RECEIVED = 'BuddyModule.Conversation.MessageReceived',
}

export const LLM_PROVIDER_NONE = 'none';

export const TTS_PLUGIN_NONE = 'none';

/**
 * Capability identifiers for buddy-related plugins.
 * Plugins declare these when registering metadata to indicate what they support.
 */
export enum BuddyCapability {
	LLM = 'llm',
	TTS = 'tts',
	STT = 'stt',
	TOOLS = 'tools',
}

export enum SttProvider {
	NONE = 'none',
	WHISPER_API = 'whisper_api',
	WHISPER_LOCAL = 'whisper_local',
}

export enum TtsProvider {
	NONE = 'none',
	OPENAI_TTS = 'openai_tts',
	ELEVENLABS = 'elevenlabs',
	SYSTEM = 'system',
}

export const TTS_AUDIO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const TTS_DEFAULT_VOICE_OPENAI = 'alloy';

export const TTS_DEFAULT_VOICE_ELEVENLABS = '21m00Tcm4TlvDq8ikWAM'; // Rachel

export const TTS_DEFAULT_SPEED = 1.0;

export const TTS_DEFAULT_TIMEOUT = 30_000;

export const STT_ALLOWED_MIME_TYPES = [
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/webm',
	'audio/ogg',
	'audio/mpeg',
];

export const BUDDY_DEFAULT_NAME = 'Buddy';

/**
 * Maps legacy enum-based provider values (from pre-plugin configs)
 * to the new plugin-based provider names.
 *
 * IMPORTANT: Keep in sync with apps/admin/src/modules/buddy/buddy.constants.ts
 */
export const LEGACY_PROVIDER_MAP = new Map<string, string>([
	['claude', 'buddy-claude-plugin'],
	['openai', 'buddy-openai-plugin'],
	['ollama', 'buddy-ollama-plugin'],
]);

export enum MessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	SYSTEM = 'system',
}

export enum SuggestionType {
	PATTERN_SCENE_CREATE = 'pattern_scene_create',
	LIGHTING_OPTIMISE = 'lighting_optimise',
	GENERAL_TIP = 'general_tip',
	ANOMALY_SENSOR_DRIFT = 'anomaly_sensor_drift',
	ANOMALY_STUCK_SENSOR = 'anomaly_stuck_sensor',
	ANOMALY_UNUSUAL_ACTIVITY = 'anomaly_unusual_activity',
	ENERGY_EXCESS_SOLAR = 'energy_excess_solar',
	ENERGY_HIGH_CONSUMPTION = 'energy_high_consumption',
	ENERGY_BATTERY_LOW = 'energy_battery_low',
	CONFLICT_HEATING_WINDOW = 'conflict_heating_window',
	CONFLICT_AC_WINDOW = 'conflict_ac_window',
	CONFLICT_LIGHTS_UNOCCUPIED = 'conflict_lights_unoccupied',
}

export const ACTION_OBSERVER_BUFFER_SIZE = 200;

export const SUGGESTION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

export const SUGGESTION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const SUGGESTION_CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

export const PATTERN_MIN_OCCURRENCES = 3;

export const PATTERN_TIME_WINDOW_MINUTES = 60;

export const PATTERN_LOOKBACK_DAYS = 7;

export const HEARTBEAT_DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const HEARTBEAT_MAX_CYCLE_MS = 30_000; // 30 seconds — log warning if exceeded

export const ANOMALY_TEMPERATURE_DRIFT_THRESHOLD = 5; // °C deviation from setpoint

export const ANOMALY_STUCK_SENSOR_HOURS = 2; // hours of unchanged value to trigger

export const ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD = 10; // intent count threshold

export const ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES = 15; // time window in minutes

export const ENERGY_GLOBAL_SPACE_ID = 'global'; // Fixed spaceId for house-level energy suggestions

export const ENERGY_EXCESS_SOLAR_THRESHOLD_KW = 1; // kW surplus to trigger excess solar suggestion

export const ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW = 5; // kW grid draw to trigger high consumption suggestion

export const ENERGY_BATTERY_LOW_THRESHOLD_PERCENT = 20; // % battery level to trigger low battery suggestion

export const CONFLICT_LIGHTS_UNOCCUPIED_MINUTES = 15; // minutes of no occupancy before suggesting lights off

export const BUDDY_CORE_TOOLS_PROVIDER = 'buddy-core-tools';

export const CONTEXT_CACHE_GLOBAL_KEY = '__global__';

export const TELEGRAM_MESSAGE_RATE_LIMIT = 30; // messages per second (Telegram API limit)

export const TELEGRAM_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000]; // exponential backoff for Telegram API errors
