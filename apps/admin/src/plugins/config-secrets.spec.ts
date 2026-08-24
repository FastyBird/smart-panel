import { describe, expect, it, vi } from 'vitest';
import type { ZodTypeAny } from 'zod';

import { ClaudeSetupTokenConfigEditFormSchema } from './buddy-claude-setup-token/schemas/config.schemas';
import { ClaudeSetupTokenConfigSchema } from './buddy-claude-setup-token/store/config.store.schemas';
import { ClaudeConfigEditFormSchema } from './buddy-claude/schemas/config.schemas';
import { ClaudeConfigSchema } from './buddy-claude/store/config.store.schemas';
import { DiscordConfigEditFormSchema } from './buddy-discord/schemas/config.schemas';
import { DiscordConfigSchema } from './buddy-discord/store/config.store.schemas';
import { ElevenlabsConfigEditFormSchema } from './buddy-elevenlabs/schemas/config.schemas';
import { ElevenlabsConfigSchema } from './buddy-elevenlabs/store/config.store.schemas';
import { OpenAiCodexConfigEditFormSchema } from './buddy-openai-codex/schemas/config.schemas';
import { OpenAiCodexConfigSchema } from './buddy-openai-codex/store/config.store.schemas';
import { OpenAiConfigEditFormSchema } from './buddy-openai/schemas/config.schemas';
import { OpenAiConfigSchema } from './buddy-openai/store/config.store.schemas';
import { TelegramConfigEditFormSchema } from './buddy-telegram/schemas/config.schemas';
import { TelegramConfigSchema } from './buddy-telegram/store/config.store.schemas';
import { VoiceaiConfigEditFormSchema } from './buddy-voiceai/schemas/config.schemas';
import { VoiceaiConfigSchema } from './buddy-voiceai/store/config.store.schemas';
import { HomeAssistantConfigEditFormSchema } from './devices-home-assistant/schemas/config.schemas';
import { HomeAssistantConfigSchema } from './devices-home-assistant/store/config.store.schemas';
import { HomeyConfigEditFormSchema } from './devices-homey/schemas/config.schemas';
import { HomeyConfigSchema } from './devices-homey/store/config.store.schemas';
import { Zigbee2mqttConfigEditFormSchema } from './devices-zigbee2mqtt/schemas/config.schemas';
import { Zigbee2mqttConfigSchema } from './devices-zigbee2mqtt/store/config.store.schemas';
import { InfluxV1ConfigEditFormSchema } from './influx-v1/schemas/config.schemas';
import { InfluxV1ConfigSchema } from './influx-v1/store/config.store.schemas';
import { InfluxV2ConfigEditFormSchema } from './influx-v2/schemas/config.schemas';
import { InfluxV2ConfigSchema } from './influx-v2/store/config.store.schemas';
import { OpenWeatherMapOneCallConfigEditFormSchema } from './weather-openweathermap-onecall/schemas/config.schemas';
import { OpenWeatherMapOneCallConfigSchema } from './weather-openweathermap-onecall/store/config.store.schemas';
import { OpenWeatherMapConfigEditFormSchema } from './weather-openweathermap/schemas/config.schemas';
import { OpenWeatherMapConfigSchema } from './weather-openweathermap/store/config.store.schemas';

// Every plugin's edit-form schema reaches for `ConfigPluginEditFormSchema` through the config
// module's barrel, which pulls in the whole component tree behind it. Only that one export is
// needed here, and it has a path of its own.
vi.mock('../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../modules/config/schemas/plugins.schemas')>('../modules/config/schemas/plugins.schemas');

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

/**
 * Every secret the backend redacts, and the two schemas a removal has to pass on its way out:
 * the edit form's, and the store's. Mirrors the `secretFields` each plugin registers on the
 * backend - a new registration there needs a row here.
 */
const REDACTED_SECRETS: { plugin: string; field: string; editForm: unknown; store: unknown }[] = [
	{ plugin: 'buddy-claude', field: 'apiKey', editForm: ClaudeConfigEditFormSchema, store: ClaudeConfigSchema },
	{
		plugin: 'buddy-claude-setup-token',
		field: 'accessToken',
		editForm: ClaudeSetupTokenConfigEditFormSchema,
		store: ClaudeSetupTokenConfigSchema,
	},
	{ plugin: 'buddy-discord', field: 'botToken', editForm: DiscordConfigEditFormSchema, store: DiscordConfigSchema },
	{ plugin: 'buddy-elevenlabs', field: 'apiKey', editForm: ElevenlabsConfigEditFormSchema, store: ElevenlabsConfigSchema },
	{ plugin: 'buddy-openai', field: 'apiKey', editForm: OpenAiConfigEditFormSchema, store: OpenAiConfigSchema },
	{ plugin: 'buddy-openai-codex', field: 'clientSecret', editForm: OpenAiCodexConfigEditFormSchema, store: OpenAiCodexConfigSchema },
	{ plugin: 'buddy-openai-codex', field: 'accessToken', editForm: OpenAiCodexConfigEditFormSchema, store: OpenAiCodexConfigSchema },
	{ plugin: 'buddy-openai-codex', field: 'refreshToken', editForm: OpenAiCodexConfigEditFormSchema, store: OpenAiCodexConfigSchema },
	{ plugin: 'buddy-telegram', field: 'botToken', editForm: TelegramConfigEditFormSchema, store: TelegramConfigSchema },
	{ plugin: 'buddy-voiceai', field: 'apiKey', editForm: VoiceaiConfigEditFormSchema, store: VoiceaiConfigSchema },
	{ plugin: 'devices-home-assistant', field: 'apiKey', editForm: HomeAssistantConfigEditFormSchema, store: HomeAssistantConfigSchema },
	{ plugin: 'devices-homey', field: 'apiKey', editForm: HomeyConfigEditFormSchema, store: HomeyConfigSchema },
	{ plugin: 'devices-zigbee2mqtt', field: 'mqtt.password', editForm: Zigbee2mqttConfigEditFormSchema, store: Zigbee2mqttConfigSchema },
	{ plugin: 'devices-zigbee2mqtt', field: 'tls.key', editForm: Zigbee2mqttConfigEditFormSchema, store: Zigbee2mqttConfigSchema },
	{ plugin: 'influx-v1', field: 'password', editForm: InfluxV1ConfigEditFormSchema, store: InfluxV1ConfigSchema },
	{ plugin: 'influx-v2', field: 'token', editForm: InfluxV2ConfigEditFormSchema, store: InfluxV2ConfigSchema },
	{ plugin: 'weather-openweathermap', field: 'apiKey', editForm: OpenWeatherMapConfigEditFormSchema, store: OpenWeatherMapConfigSchema },
	{
		plugin: 'weather-openweathermap-onecall',
		field: 'apiKey',
		editForm: OpenWeatherMapOneCallConfigEditFormSchema,
		store: OpenWeatherMapOneCallConfigSchema,
	},
];

/** Walks a dotted path into an object schema's shape, so a nested secret can be reached. */
const fieldSchema = (schema: unknown, path: string): ZodTypeAny => {
	return path.split('.').reduce<ZodTypeAny>((current, key) => {
		const shape = (current as unknown as { shape?: Record<string, ZodTypeAny> }).shape;

		expect(shape, `${path}: '${key}' is not reachable`).toBeDefined();
		expect(shape![key], `${path}: '${key}' is not declared`).toBeDefined();

		return shape![key];
	}, schema as ZodTypeAny);
};

// The backend keeps a stored secret whenever the field is absent or blank and removes it only
// for `null`, so `null` is the one value a form has to be able to put on the wire. It passes
// through two schemas on the way, and neither rejects nor strips loudly - a secret declared
// `z.string().optional()` simply makes removal impossible, which is how influx-v2 shipped.
describe.each(REDACTED_SECRETS)('$plugin $field', ({ field, editForm, store }) => {
	it('accepts null in the edit form schema, which is how a removal is expressed', () => {
		expect(fieldSchema(editForm, field).safeParse(null).success).toBe(true);
	});

	it('accepts null in the store schema, which the edit merges through', () => {
		expect(fieldSchema(store, field).safeParse(null).success).toBe(true);
	});

	// An untouched form leaves the field alone entirely, and that has to stay valid too -
	// otherwise saving any other setting would fail on a secret nobody meant to change.
	it('accepts an absent value, which is what an untouched form submits', () => {
		expect(fieldSchema(editForm, field).safeParse(undefined).success).toBe(true);
	});
});
