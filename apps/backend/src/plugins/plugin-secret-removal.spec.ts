import { toInstance } from '../common/utils/transform.utils';
import { ConfigSecretsService } from '../modules/config/services/config-secrets.service';

import { UpdateBuddyClaudeSetupTokenConfigDto } from './buddy-claude-setup-token/dto/update-config.dto';
import { UpdateBuddyClaudeConfigDto } from './buddy-claude/dto/update-config.dto';
import { UpdateBuddyDiscordConfigDto } from './buddy-discord/dto/update-config.dto';
import { UpdateBuddyElevenlabsConfigDto } from './buddy-elevenlabs/dto/update-config.dto';
import { UpdateBuddyOpenaiCodexConfigDto } from './buddy-openai-codex/dto/update-config.dto';
import { UpdateBuddyOpenaiConfigDto } from './buddy-openai/dto/update-config.dto';
import { BuddyOpenaiConfigModel } from './buddy-openai/models/config.model';
import { UpdateBuddyTelegramConfigDto } from './buddy-telegram/dto/update-config.dto';
import { UpdateBuddyVoiceaiConfigDto } from './buddy-voiceai/dto/update-config.dto';
import { HomeAssistantUpdatePluginConfigDto } from './devices-home-assistant/dto/update-config.dto';
import { HomeyUpdatePluginConfigDto } from './devices-homey/dto/update-config.dto';
import { Zigbee2mqttUpdatePluginConfigDto } from './devices-zigbee2mqtt/dto/update-config.dto';
import { UpdateInfluxV1ConfigDto } from './influx-v1/dto/update-config.dto';
import { UpdateInfluxV2ConfigDto } from './influx-v2/dto/update-config.dto';
import { UpdateOpenWeatherMapOneCallConfigDto } from './weather-openweathermap-onecall/dto/update-config.dto';
import { UpdateOpenWeatherMapConfigDto } from './weather-openweathermap/dto/update-config.dto';

/**
 * Every redacted secret, named by the wire field a client submits and the property the update
 * DTO exposes it as. Mirrors the `secretFields` each plugin registers - a new registration
 * there wants a row here.
 */
/**
 * `devices-home-assistant` declares its secret with a `= null` class default, so an absent field
 * arrives as `null` rather than `undefined`. Harmless, because `resolveUpdate()` decides from the
 * submitted body rather than from the DTO, but it means this one row cannot make the
 * absent-is-not-null assertion the others do.
 */
const DEFAULTS_TO_NULL = 'devices-home-assistant';

const SECRETS: { label: string; dto: object; submit: Record<string, unknown>; read: (instance: object) => unknown }[] =
	[
		['buddy-claude', UpdateBuddyClaudeConfigDto, 'api_key', 'apiKey'],
		['buddy-claude-setup-token', UpdateBuddyClaudeSetupTokenConfigDto, 'access_token', 'accessToken'],
		['buddy-discord', UpdateBuddyDiscordConfigDto, 'bot_token', 'botToken'],
		['buddy-elevenlabs', UpdateBuddyElevenlabsConfigDto, 'api_key', 'apiKey'],
		['buddy-openai', UpdateBuddyOpenaiConfigDto, 'api_key', 'apiKey'],
		['buddy-openai-codex client secret', UpdateBuddyOpenaiCodexConfigDto, 'client_secret', 'clientSecret'],
		['buddy-openai-codex access token', UpdateBuddyOpenaiCodexConfigDto, 'access_token', 'accessToken'],
		['buddy-openai-codex refresh token', UpdateBuddyOpenaiCodexConfigDto, 'refresh_token', 'refreshToken'],
		['buddy-telegram', UpdateBuddyTelegramConfigDto, 'bot_token', 'botToken'],
		['buddy-voiceai', UpdateBuddyVoiceaiConfigDto, 'api_key', 'apiKey'],
		['devices-home-assistant', HomeAssistantUpdatePluginConfigDto, 'api_key', 'api_key'],
		['devices-homey', HomeyUpdatePluginConfigDto, 'api_key', 'apiKey'],
		['influx-v1', UpdateInfluxV1ConfigDto, 'password', 'password'],
		['influx-v2', UpdateInfluxV2ConfigDto, 'token', 'token'],
		['weather-openweathermap', UpdateOpenWeatherMapConfigDto, 'api_key', 'apiKey'],
		['weather-openweathermap-onecall', UpdateOpenWeatherMapOneCallConfigDto, 'api_key', 'apiKey'],
	].map(([label, dto, wire, property]) => ({
		label: label as string,
		dto: dto as object,
		submit: { [wire as string]: null },
		read: (instance: object): unknown => (instance as Record<string, unknown>)[property as string],
	}));

const instantiate = (dto: object, plain: Record<string, unknown>): object =>
	toInstance(dto as new () => object, plain, { excludeExtraneousValues: false });

// `resolveUpdate()` keeps a stored secret whenever the submitted field is absent or blank and
// removes it only for `null`. So `null` has to survive the DTO, and survive it as `null` rather
// than as "absent" - the two are indistinguishable downstream, and one of them means the
// opposite of what the operator asked for.
describe('an explicit null on a redacted secret', () => {
	describe.each(SECRETS)('$label', ({ label, dto, submit, read }) => {
		it('reaches the update DTO as null rather than as an absent field', () => {
			expect(read(instantiate(dto, submit))).toBeNull();
		});

		it('is still distinguishable from a field that was never submitted', () => {
			if (label === DEFAULTS_TO_NULL) {
				return;
			}

			expect(read(instantiate(dto, {}))).toBeUndefined();
		});
	});

	// The nested pair, which the flat table cannot describe.
	it('reaches the zigbee2mqtt DTO as null on both nested secrets', () => {
		const instance = instantiate(Zigbee2mqttUpdatePluginConfigDto, {
			mqtt: { password: null },
			tls: { key: null },
		}) as {
			mqtt?: { password?: string | null };
			tls?: { key?: string | null };
		};

		expect(instance.mqtt?.password).toBeNull();
		expect(instance.tls?.key).toBeNull();
	});
});

// The chain that actually broke: `resolveUpdate()` decided correctly, and then the decision was
// handed straight back through the DTO, which turned the `null` into an absent field again. The
// merge that followed therefore kept the credential while the API reported a successful removal.
describe('removing a stored secret end to end', () => {
	const secrets = new ConfigSecretsService();
	const fields = [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] }];

	const stored = (): BuddyOpenaiConfigModel =>
		toInstance(BuddyOpenaiConfigModel, { type: 'buddy-openai', enabled: true, api_key: 'sk-stored', model: 'gpt-4o' });

	const applyUpdate = (submitted: Record<string, unknown>): BuddyOpenaiConfigModel => {
		const existing = stored();
		const instance = instantiate(UpdateBuddyOpenaiConfigDto, submitted);

		// The two steps `ConfigService.resolvePluginConfigUpdate()` performs, in order.
		const resolved = secrets.resolveUpdate(existing, instance, submitted, fields);
		const reInstanced = instantiate(UpdateBuddyOpenaiConfigDto, resolved as Record<string, unknown>);

		return toInstance(BuddyOpenaiConfigModel, secrets.merge(existing, { type: 'buddy-openai', ...reInstanced }));
	};

	it('leaves nothing stored when the secret is submitted as null', () => {
		expect(applyUpdate({ type: 'buddy-openai', api_key: null }).apiKey).toBeNull();
	});

	it('replaces what is stored when a new secret is submitted', () => {
		expect(applyUpdate({ type: 'buddy-openai', api_key: 'sk-replacement' }).apiKey).toBe('sk-replacement');
	});

	it('keeps what is stored when the secret is not submitted at all', () => {
		expect(applyUpdate({ type: 'buddy-openai', model: 'gpt-4o-mini' }).apiKey).toBe('sk-stored');
	});

	it('keeps what is stored when the secret is submitted blank', () => {
		expect(applyUpdate({ type: 'buddy-openai', api_key: '' }).apiKey).toBe('sk-stored');
	});
});
