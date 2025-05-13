export const DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX = 'devices-home-assistant-plugin';

export const DEVICES_HOME_ASSISTANT_PLUGIN_NAME = 'devices-home-assistant-plugin';

export const DEVICES_HOME_ASSISTANT_TYPE = 'home-assistant';

export enum HomeAssistantDomain {
	ALARM_CONTROL_PANEL = 'alarm_control_panel',
	AUTOMATION = 'automation',
	BINARY_SENSOR = 'binary_sensor',
	BUTTON = 'button',
	CALENDAR = 'calendar',
	CAMERA = 'camera',
	CLIMATE = 'climate',
	COVER = 'cover',
	DEVICE_TRACKER = 'device_tracker',
	EVENT = 'event',
	FAN = 'fan',
	HUMIDIFIER = 'humidifier',
	IMAGE = 'image',
	IMAGE_PROCESSING = 'image_processing',
	INPUT_BOOLEAN = 'input_boolean',
	INPUT_BUTTON = 'input_button',
	INPUT_DATETIME = 'input_datetime',
	INPUT_NUMBER = 'input_number',
	INPUT_SELECT = 'input_select',
	INPUT_TEXT = 'input_text',
	LIGHT = 'light',
	LOCK = 'lock',
	MEDIA_PLAYER = 'media_player',
	NUMBER = 'number',
	PERSON = 'person',
	REMOTE = 'remote',
	SCENE = 'scene',
	SCRIPT = 'script',
	SELECT = 'select',
	SENSOR = 'sensor',
	SIREN = 'siren',
	SWITCH = 'switch',
	TEXT = 'text',
	TIMER = 'timer',
	UPDATE = 'update',
	VACUUM = 'vacuum',
	VALVE = 'valve',
	LAWN_MOWER = 'lawn_mower',
	WATER_HEATER = 'water_heater',
	WEATHER = 'weather',
	ZONE = 'zone',
}

export const DEVICE_NO_ENTITY = 'fb.no_entity';
export const ENTITY_NO_ATTRIBUTE = 'fb.no_attribute';
export const ENTITY_MAIN_STATE_ATTRIBUTE = 'fb.main_state';

export enum BinarySensorEntityAttribute {}

export enum CameraEntityAttribute {
	// A short-lived token used for accessing the camera stream securely
	ACCESS_TOKEN = 'access_token',
	// Name of the camera's model, if provided by the integration
	MODEL_NAME = 'model_name',
	// Brand of the camera, if provided by the integration
	BRAND = 'brand',
	// Indicates whether motion detection is currently enabled
	MOTION_DETECTION = 'motion_detection',
	// The stream type used by the frontend, such as 'hls' or 'webrtc'
	FRONTEND_STREAM_TYPE = 'frontend_stream_type',
}

export enum ClimateEntityAttribute {
	// Current measured temperature from the climate device
	CURRENT_TEMPERATURE = 'current_temperature',
	// Target temperature if `TARGET_TEMPERATURE` feature is supported
	TEMPERATURE = 'temperature',
	// Upper target temperature for range mode if `TARGET_TEMPERATURE_RANGE` is supported
	TARGET_TEMP_HIGH = 'target_temp_high',
	// Lower target temperature for range mode if `TARGET_TEMPERATURE_RANGE` is supported
	TARGET_TEMP_LOW = 'target_temp_low',
	// Current measured humidity from the climate device
	CURRENT_HUMIDITY = 'current_humidity',
	// Target humidity if `TARGET_HUMIDITY` feature is supported
	HUMIDITY = 'humidity',
	// Current fan mode if `FAN_MODE` feature is supported
	FAN_MODE = 'fan_mode',
	// Current HVAC action (e.g., heating, cooling)
	HVAC_ACTION = 'hvac_action',
	// Current preset mode (e.g., away, eco) if `PRESET_MODE` feature is supported
	PRESET_MODE = 'preset_mode',
	// Current vertical swing mode if `SWING_MODE` feature is supported
	SWING_MODE = 'swing_mode',
	// Current horizontal swing mode if `SWING_HORIZONTAL_MODE` is supported
	SWING_HORIZONTAL_MODE = 'swing_horizontal_mode',
	// Whether auxiliary heat is enabled if `AUX_HEAT` feature is supported
	AUX_HEAT = 'aux_heat',
}

export enum CoverEntityAttribute {
	// Current position of the cover: 0 = closed, 100 = fully open
	CURRENT_POSITION = 'current_position',
	// Current tilt position of the cover: 0 = no tilt, 100 = maximum tilt
	CURRENT_TILT_POSITION = 'current_tilt_position',
}

export enum FanEntityAttribute {
	// Current direction of the fan (e.g., 'forward', 'reverse')
	DIRECTION = 'direction',
	// Whether the fan is oscillating
	OSCILLATING = 'oscillating',
	// Current speed of the fan in percent (0–100)
	PERCENTAGE = 'percentage',
	// Step size for percentage increments (e.g., 5, 10)
	PERCENTAGE_STEP = 'percentage_step',
	// Current preset mode of the fan (e.g., 'auto', 'sleep')
	PRESET_MODE = 'preset_mode',
}

export enum HumidifierEntityAttribute {
	// The current operating action of the humidifier (e.g., humidifying, idle, off)
	ACTION = 'action',
	// Current measured humidity reported by the device
	CURRENT_HUMIDITY = 'current_humidity',
	// Target humidity set on the device
	HUMIDITY = 'humidity',
	// Current operational mode (e.g., normal, eco) if `MODES` feature is supported
	MODE = 'mode',
}

export enum LightEntityAttribute {
	// Transition time in seconds for light changes
	TRANSITION = 'transition',
	// RGB color as [r, g, b]
	RGB_COLOR = 'rgb_color',
	// RGBW color as [r, g, b, w]
	RGBW_COLOR = 'rgbw_color',
	// RGBWW color as [r, g, b, cw, ww]
	RGBWW_COLOR = 'rgbww_color',
	// XY color space values
	XY_COLOR = 'xy_color',
	// Hue-saturation color as [h, s]
	HS_COLOR = 'hs_color',
	// Color temperature in kelvins
	COLOR_TEMP_KELVIN = 'color_temp_kelvin',
	// Minimum supported color temperature
	MIN_COLOR_TEMP_KELVIN = 'min_color_temp_kelvin',
	// Maximum supported color temperature
	MAX_COLOR_TEMP_KELVIN = 'max_color_temp_kelvin',
	// Name of the currently set color
	COLOR_NAME = 'color_name',
	// White channel intensity
	WHITE = 'white',
	// Brightness of the light (0–255 or %)
	BRIGHTNESS = 'brightness',
	// Brightness in percent (0–100)
	BRIGHTNESS_PCT = 'brightness_pct',
	// Incremental brightness step (0–255)
	BRIGHTNESS_STEP = 'brightness_step',
	// Incremental brightness step in percent (0–100)
	BRIGHTNESS_STEP_PCT = 'brightness_step_pct',
	// Name of the active light profile
	PROFILE = 'profile',
	// Flash behavior ('short' or 'long')
	FLASH = 'flash',
	// List of available light effects
	EFFECT_LIST = 'effect_list',
	// Currently active light effect
	EFFECT = 'effect',
}

export enum LockEntityAttribute {
	// Describes what or who triggered the last lock state change (e.g., user, system)
	CHANGED_BY = 'changed_by',
	// Regular expression pattern indicating required code format, or `null` if no code is needed
	CODE_FORMAT = 'code_format',
}

export enum MediaPlayerEntityAttribute {
	// List of group members when media player supports grouping
	GROUP_MEMBERS = 'group_members',
	// Title of the current media
	MEDIA_TITLE = 'media_title',
	// Artist of the current media
	MEDIA_ARTIST = 'media_artist',
	// Album name of the current media
	MEDIA_ALBUM_NAME = 'media_album_name',
	// Track number of the current media
	MEDIA_TRACK = 'media_track',
	// Series title (for TV shows or episodes)
	MEDIA_SERIES_TITLE = 'media_series_title',
	// Season number (for TV shows)
	MEDIA_SEASON = 'media_season',
	// Episode number (for TV shows)
	MEDIA_EPISODE = 'media_episode',
	// Genre of the current media
	MEDIA_GENRE = 'media_genre',
	// Duration of the current media in seconds
	MEDIA_DURATION = 'media_duration',
	// Position in seconds of the currently playing media
	MEDIA_POSITION = 'media_position',
	// Timestamp of the last position update
	MEDIA_POSITION_UPDATED_AT = 'media_position_updated_at',
	// Media content ID (source identifier or URI)
	MEDIA_CONTENT_ID = 'media_content_id',
	// Type of media content, e.g., `music`, `video`, etc
	MEDIA_CONTENT_TYPE = 'media_content_type',
	// Type of media image, e.g., `thumbnail`, `poster`, etc
	MEDIA_IMAGE_ASPECT_RATIO = 'media_image_aspect_ratio',
	// Remote URL to the media image
	ENTITY_PICTURE = 'entity_picture',
	// Local/internal URL to the media image (for remote access scenarios)
	ENTITY_PICTURE_LOCAL = 'entity_picture_local',
	// Current sound volume (0.0–1.0)
	VOLUME_LEVEL = 'volume_level',
	// Whether volume is muted
	IS_VOLUME_MUTED = 'is_volume_muted',
	// Current media playback state, e.g., `playing`, `paused`, `idle`
	PLAYBACK_STATE = 'media_playback_state',
	// Repeat mode of the media player, e.g., `off`, `one`, `all`
	REPEAT = 'repeat',
	// Shuffle mode state
	SHUFFLE = 'shuffle',
}

export enum SensorEntityAttribute {
	// Timestamp when the total-measuring sensor was last reset (only for state_class 'total')
	LAST_RESET = 'last_reset',
}

export enum SwitchEntityAttribute {}

export enum VacuumEntityAttribute {
	// Current battery level of the vacuum, as a percentage (0–100)
	BATTERY_LEVEL = 'battery_level',
	// Icon representing the battery state (e.g., charging, low)
	BATTERY_ICON = 'battery_icon',
	// Current fan or suction speed setting of the vacuum
	FAN_SPEED = 'fan_speed',
}

export enum ValveEntityAttribute {
	// Current position of the valve, typically a percentage from 0 (closed) to 100 (open)
	CURRENT_POSITION = 'current_position',
}

export enum WaterHeaterEntityAttribute {
	// Current temperature of the water heater
	CURRENT_TEMPERATURE = 'current_temperature',
	// Target temperature set for the water heater
	TEMPERATURE = 'temperature',
	// Upper bound of the target temperature range (if supported)
	TARGET_TEMP_HIGH = 'target_temp_high',
	// Lower bound of the target temperature range (if supported)
	TARGET_TEMP_LOW = 'target_temp_low',
	// Current operation mode of the water heater (e.g., 'eco', 'performance')
	OPERATION_MODE = 'operation_mode',
	// Whether away mode is active; typically 'on' or 'off'
	AWAY_MODE = 'away_mode',
}
