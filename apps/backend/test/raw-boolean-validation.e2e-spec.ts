/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { DisplayAwareThrottlerGuard } from '../src/modules/auth/guards/display-aware-throttler.guard';

/**
 * The global ValidationPipe and toInstance() both run class-transformer with implicit conversion, which turns a
 * boolean-typed property into Boolean(value) before @IsBoolean sees it: "false" would arrive as true. Every request
 * boolean is read from the raw JSON instead, and each one must refuse anything but a real true or false.
 */

const PLACEHOLDER_ID = '11111111-1111-4111-8111-111111111111';

const INVALID_VALUES: [string, unknown][] = [
	['the string "false"', 'false'],
	['the string "true"', 'true'],
	['1', 1],
	['0', 0],
];

type Method = 'post' | 'patch' | 'put';

interface RawBooleanCase {
	/** Shown in the test name */
	label: string;
	method: Method;
	path: () => string;
	/** The request body carrying the value under test */
	body: (value: unknown) => object;
	/** Field name as the validation error reports it */
	field: string;
	/** Path in front of the reported error, as ValidationExceptionFactory prefixes nested errors */
	prefix?: string;
	headers?: Record<string, string>;
	/** False when a valid value would start real work, such as installing an update or reaching a device */
	control?: boolean;
	/** Sent without a token: the route is public */
	anonymous?: boolean;
	/**
	 * The spaces module answers any invalid space payload with 422 and no field details. For those routes the
	 * control request proves the field is what fails: the same body with a real boolean is accepted.
	 */
	spaces?: boolean;
}

const data = (fields: Record<string, unknown>): object => ({ data: fields });

describe('Raw boolean validation (e2e)', () => {
	let app: INestApplication;
	let ownerToken: string;

	const fixtures = {
		deviceId: PLACEHOLDER_ID,
		channelId: PLACEHOLDER_ID,
		pageId: PLACEHOLDER_ID,
		tileId: PLACEHOLDER_ID,
		sceneId: PLACEHOLDER_ID,
		actionId: PLACEHOLDER_ID,
		propertyId: PLACEHOLDER_ID,
		roomId: PLACEHOLDER_ID,
		signageId: PLACEHOLDER_ID,
	};

	const send = (method: Method, path: string, body: object, anonymous = false): request.Test => {
		const call = request(app.getHttpServer())[method](path);

		return anonymous ? call.send(body) : call.set('Authorization', `Bearer ${ownerToken}`).send(body);
	};

	const createdBody = async <T extends { id: string }>(path: string, body: object): Promise<T> => {
		const response = await send('post', path, body);

		if (response.status !== 201) {
			throw new Error(`Fixture ${path} could not be created: ${response.status} ${JSON.stringify(response.body)}`);
		}

		return (response.body as { data: T }).data;
	};

	const created = async (path: string, body: object): Promise<string> => (await createdBody(path, body)).id;

	/** The validation messages that name the field directly at the given path */
	const fieldErrors = (body: unknown, prefix: string, field: string): string[] => {
		const messages = (body as { message?: unknown }).message;

		if (!Array.isArray(messages)) {
			return [];
		}

		return (messages as string[]).filter((message) => {
			if (!message.startsWith(prefix)) {
				return false;
			}

			const rest = message.slice(prefix.length);

			return (rest.startsWith('[') || rest.startsWith('{')) && rest.includes(`"field":"${field}"`);
		});
	};

	const configPlugin = (plugin: string, field: string, nested?: string): RawBooleanCase => ({
		label: `PATCH config plugin ${plugin}${nested ? ` ${nested}` : ''}`,
		method: 'patch',
		path: () => `/modules/config/config/plugin/${plugin}`,
		body: (value) => data({ type: plugin, ...(nested ? { [nested]: { [field]: value } } : { [field]: value }) }),
		field,
		prefix: nested ? `${nested}.` : '',
	});

	const configModule = (module: string, field: string): RawBooleanCase => ({
		label: `PATCH config module ${module}`,
		method: 'patch',
		path: () => `/modules/config/config/module/${module}`,
		body: (value) => data({ type: module, [field]: value }),
		field,
		prefix: '',
	});

	// The home control routes are served by the spaces module, under its historical URLs
	const homeControl = (path: string): string => `/modules/spaces/spaces/${fixtures.roomId}/${path}`;

	const cases: RawBooleanCase[] = [
		// Automations
		{
			label: 'POST automations',
			method: 'post',
			path: () => '/modules/automations/automations',
			body: (value) => data({ name: 'Raw boolean', enabled: value }),
			field: 'enabled',
		},
		{
			label: 'PATCH automations/:id',
			method: 'patch',
			path: () => `/modules/automations/automations/${PLACEHOLDER_ID}`,
			body: (value) => data({ revision: 1, enabled: value }),
			field: 'enabled',
		},
		{
			label: 'POST automations/validate',
			method: 'post',
			path: () => '/modules/automations/automations/validate',
			body: (value) => data({ graph: { version: 1, nodes: [], edges: [] }, enabled: value }),
			field: 'enabled',
		},

		// Auth
		{
			label: 'PATCH tokens/:id',
			method: 'patch',
			path: () => `/modules/auth/tokens/${PLACEHOLDER_ID}`,
			body: (value) => data({ type: 'long-live', revoked: value }),
			field: 'revoked',
		},

		// Configuration
		configModule('devices-module', 'enabled'),
		configModule('buddy-module', 'voice_enabled'),
		configModule('extensions-module', 'enabled'),
		configModule('mcp-module', 'oauth_enabled'),
		configModule('remote-access-module', 'trust_forwarded_headers'),
		configModule('scenes-module', 'continue_on_action_failure'),
		configModule('system-module', 'onboarding_completed'),
		configPlugin('simulator-plugin', 'enabled'),
		...[
			'buddy-claude-plugin',
			'buddy-claude-setup-token-plugin',
			'buddy-discord-plugin',
			'buddy-elevenlabs-plugin',
			'buddy-ollama-plugin',
			'buddy-openai-plugin',
			'buddy-openai-codex-plugin',
			'buddy-stt-whisper-local-plugin',
			'buddy-system-tts-plugin',
			'buddy-telegram-plugin',
			'buddy-voiceai-plugin',
			'buddy-whatsapp-plugin',
			'data-sources-weather-plugin',
			'logger-rotating-file-plugin',
			'notifications-discord-plugin',
			'notifications-slack-plugin',
			'notifications-telegram-plugin',
			'notifications-webhook-plugin',
			'remote-access-cloudflare-tunnel-plugin',
			'weather-open-meteo-plugin',
			'weather-openweathermap-plugin',
			'weather-openweathermap-onecall-plugin',
		].map((plugin) => configPlugin(plugin, 'enabled')),
		configPlugin('devices-shelly-ng-plugin', 'enabled', 'mdns'),
		configPlugin('devices-shelly-v1-plugin', 'enabled', 'discovery'),
		configPlugin('devices-wled-plugin', 'enabled', 'mdns'),
		configPlugin('devices-wled-plugin', 'auto_add', 'mdns'),
		configPlugin('devices-wled-plugin', 'enabled', 'websocket'),
		configPlugin('devices-zigbee2mqtt-plugin', 'clean_session', 'mqtt'),
		configPlugin('devices-zigbee2mqtt-plugin', 'enabled', 'tls'),
		configPlugin('devices-zigbee2mqtt-plugin', 'reject_unauthorized', 'tls'),
		configPlugin('devices-zigbee2mqtt-plugin', 'auto_add', 'discovery'),
		configPlugin('devices-zigbee2mqtt-plugin', 'sync_on_startup', 'discovery'),
		configPlugin('devices-zigbee2mqtt-plugin', 'secure', 'ws'),
		...['accept_dns', 'accept_routes', 'ssh', 'serve_https', 'funnel'].map((field) =>
			configPlugin('remote-access-tailscale-plugin', field),
		),

		// Dashboard
		{
			label: 'POST pages',
			method: 'post',
			path: () => '/modules/dashboard/pages',
			body: (value) => data({ type: 'pages-tiles', title: 'Raw boolean', order: 1, show_top_bar: value }),
			field: 'show_top_bar',
			prefix: '',
		},
		{
			label: 'PATCH pages/:id',
			method: 'patch',
			path: () => `/modules/dashboard/pages/${fixtures.pageId}`,
			body: (value) => data({ type: 'pages-tiles', show_top_bar: value }),
			field: 'show_top_bar',
			prefix: '',
		},
		{
			label: 'POST tiles',
			method: 'post',
			path: () => '/modules/dashboard/tiles',
			body: (value) =>
				data({
					type: 'tiles-time',
					parent: { type: 'page', id: fixtures.pageId },
					row: 1,
					col: 1,
					hidden: value,
				}),
			field: 'hidden',
			prefix: '',
		},
		{
			label: 'PATCH tiles/:id',
			method: 'patch',
			path: () => `/modules/dashboard/tiles/${fixtures.tileId}`,
			body: (value) => data({ type: 'tiles-time', hidden: value }),
			field: 'hidden',
			prefix: '',
		},

		// Devices
		...['enabled', 'hidden', 'auto_simulate'].map(
			(field): RawBooleanCase => ({
				label: 'POST devices',
				method: 'post',
				path: () => '/modules/devices/devices',
				body: (value) => data({ type: 'simulator', category: 'generic', name: 'Raw boolean', [field]: value }),
				field,
				prefix: '',
			}),
		),
		...['enabled', 'hidden', 'auto_simulate'].map(
			(field): RawBooleanCase => ({
				label: 'PATCH devices/:id',
				method: 'patch',
				path: () => `/modules/devices/devices/${fixtures.deviceId}`,
				body: (value) => data({ type: 'simulator', [field]: value }),
				field,
				prefix: '',
			}),
		),
		{
			label: 'POST devices/bulk-update',
			method: 'post',
			path: () => '/modules/devices/devices/bulk-update',
			body: (value) => data({ ids: [PLACEHOLDER_ID], enabled: value }),
			field: 'enabled',
		},
		{
			label: 'PATCH devices/:deviceId/channels/:id',
			method: 'patch',
			path: () => `/modules/devices/devices/${fixtures.deviceId}/channels/${fixtures.channelId}`,
			body: (value) => data({ type: 'simulator', enabled: value }),
			field: 'enabled',
			prefix: '',
		},

		// Displays
		...['audio_output_supported', 'audio_input_supported'].map(
			(field): RawBooleanCase => ({
				label: 'POST displays/register',
				method: 'post',
				path: () => '/modules/displays/register',
				headers: { 'User-Agent': 'FastyBird Smart Panel' },
				anonymous: true,
				body: (value) =>
					data({
						mac_address: '00:1A:2B:3C:4D:7E',
						version: '1.0.0',
						build: '42',
						screen_width: 1920,
						screen_height: 1080,
						pixel_ratio: 1.5,
						[field]: value,
					}),
				field,
				// A valid registration hands out a display token: nothing else to prove
				control: false,
			}),
		),
		...['dark_mode', 'screen_saver', 'screen_power_off', 'speaker', 'microphone'].map(
			(field): RawBooleanCase => ({
				label: 'PATCH displays/:id',
				method: 'patch',
				path: () => `/modules/displays/displays/${PLACEHOLDER_ID}`,
				body: (value) => data({ [field]: value }),
				field,
			}),
		),

		// Extensions
		{
			label: 'PATCH extensions/:type',
			method: 'patch',
			path: () => '/modules/extensions/extensions/devices-wled-plugin',
			body: (value) => data({ enabled: value }),
			field: 'enabled',
		},
		{
			label: 'POST extensions/bulk-update',
			method: 'post',
			path: () => '/modules/extensions/extensions/bulk-update',
			body: (value) => data({ types: ['devices-wled-plugin'], enabled: value }),
			field: 'enabled',
		},

		// MCP
		{
			label: 'PATCH mcp clients/:id',
			method: 'patch',
			path: () => `/modules/mcp/clients/${PLACEHOLDER_ID}`,
			body: (value) => data({ enabled: value }),
			field: 'enabled',
		},
		{
			label: 'PATCH mcp oauth/clients/:id',
			method: 'patch',
			path: () => `/modules/mcp/oauth/clients/${PLACEHOLDER_ID}`,
			body: (value) => data({ enabled: value }),
			field: 'enabled',
		},

		// Notifications
		...['read', 'dismissed'].map(
			(field): RawBooleanCase => ({
				label: 'PATCH notifications/:id',
				method: 'patch',
				path: () => `/modules/notifications/notifications/${PLACEHOLDER_ID}`,
				body: (value) => data({ [field]: value }),
				field,
			}),
		),
		...['read', 'dismissed'].map(
			(field): RawBooleanCase => ({
				label: 'POST notifications/bulk-update',
				method: 'post',
				path: () => '/modules/notifications/notifications/bulk-update',
				body: (value) => data({ ids: [PLACEHOLDER_ID], [field]: value }),
				field,
			}),
		),

		// Scenes
		...['enabled', 'triggerable'].map(
			(field): RawBooleanCase => ({
				label: 'POST scenes',
				method: 'post',
				path: () => '/modules/scenes/scenes',
				body: (value) => data({ name: 'Raw boolean', [field]: value }),
				field,
				prefix: '',
			}),
		),
		...['enabled', 'triggerable'].map(
			(field): RawBooleanCase => ({
				label: 'PATCH scenes/:id',
				method: 'patch',
				path: () => `/modules/scenes/scenes/${fixtures.sceneId}`,
				body: (value) => data({ [field]: value }),
				field,
				prefix: '',
			}),
		),
		{
			label: 'POST scenes/:sceneId/actions',
			method: 'post',
			path: () => `/modules/scenes/scenes/${fixtures.sceneId}/actions`,
			body: (value) =>
				data({
					type: 'scenes-local',
					device_id: fixtures.deviceId,
					channel_id: fixtures.channelId,
					property_id: fixtures.propertyId,
					value: true,
					enabled: value,
				}),
			field: 'enabled',
			prefix: '',
		},
		{
			label: 'PATCH scenes/:sceneId/actions/:id',
			method: 'patch',
			path: () => `/modules/scenes/scenes/${fixtures.sceneId}/actions/${fixtures.actionId}`,
			body: (value) => data({ enabled: value }),
			field: 'enabled',
			prefix: '',
		},
		{
			label: 'POST scenes/bulk-update',
			method: 'post',
			path: () => '/modules/scenes/scenes/bulk-update',
			body: (value) => data({ ids: [PLACEHOLDER_ID], enabled: value }),
			field: 'enabled',
		},

		// System
		{
			label: 'POST system/update/install',
			method: 'post',
			path: () => '/modules/system/system/update/install',
			body: (value) => ({ allow_major: value }),
			// The property has no message of its own, so the error names it by its class property
			field: 'allowMajor',
			prefix: '',
			// A valid request would start an update
			control: false,
		},

		// Spaces
		{
			label: 'POST spaces (room)',
			spaces: true,
			method: 'post',
			path: () => '/modules/spaces/spaces',
			body: (value) => data({ type: 'room', name: 'Raw boolean', suggestions_enabled: value }),
			field: 'suggestions_enabled',
			prefix: '',
		},
		{
			label: 'PATCH spaces/:id (room)',
			spaces: true,
			method: 'patch',
			path: () => `/modules/spaces/spaces/${fixtures.roomId}`,
			body: (value) => data({ type: 'room', suggestions_enabled: value }),
			field: 'suggestions_enabled',
			prefix: '',
		},
		...['show_clock', 'show_weather', 'show_announcements', 'show_feed'].map(
			(field): RawBooleanCase => ({
				label: 'POST spaces (signage info panel)',
				spaces: true,
				method: 'post',
				path: () => '/modules/spaces/spaces',
				body: (value) => data({ type: 'signage_info_panel', name: 'Raw boolean', [field]: value }),
				field,
				prefix: '',
			}),
		),
		...['show_clock', 'show_weather', 'show_announcements', 'show_feed'].map(
			(field): RawBooleanCase => ({
				label: 'PATCH spaces/:id (signage info panel)',
				spaces: true,
				method: 'patch',
				path: () => `/modules/spaces/spaces/${fixtures.signageId}`,
				body: (value) => data({ type: 'signage_info_panel', [field]: value }),
				field,
				prefix: '',
			}),
		),
		{
			label: 'PUT home control activity mode config',
			method: 'put',
			path: () => homeControl('activity-modes/away/config'),
			body: (value) => data({ expected_revision: 1, enabled: value }),
			field: 'enabled',
		},
		{
			label: 'PUT home control occupancy',
			method: 'put',
			path: () => homeControl('occupancy'),
			body: (value) => data({ expected_revision: 1, enabled: value }),
			field: 'enabled',
		},
		{
			label: 'PUT home control schedules',
			method: 'put',
			path: () => homeControl('schedules'),
			body: (value) => data({ expected_revision: 1, enabled: value, entries: [] }),
			field: 'enabled',
		},
		{
			label: 'PUT home control schedules entry',
			method: 'put',
			path: () => homeControl('schedules'),
			body: (value) =>
				data({
					expected_revision: 1,
					enabled: false,
					entries: [{ id: 'e1', mode: 'away', time: '08:00', days_of_week: [1], enabled: value }],
				}),
			field: 'enabled',
			prefix: 'data.entries.0.',
		},
		{
			label: 'POST home control lighting intent',
			method: 'post',
			path: () => homeControl('intents/lighting'),
			body: (value) => data({ type: 'role_set', role: 'main', on: value }),
			field: 'on',
		},
		{
			label: 'POST home control lighting intent (brightness delta)',
			method: 'post',
			path: () => homeControl('intents/lighting'),
			body: (value) => data({ type: 'brightness_delta', delta: 'small', increase: value }),
			field: 'increase',
		},
		{
			label: 'POST home control climate intent',
			method: 'post',
			path: () => homeControl('intents/climate'),
			body: (value) => data({ type: 'setpoint_delta', delta: 'small', increase: value }),
			field: 'increase',
		},
		{
			label: 'POST home control covers intent',
			method: 'post',
			path: () => homeControl('intents/covers'),
			body: (value) => data({ type: 'position_delta', delta: 'small', increase: value }),
			field: 'increase',
		},

		// Device plugins
		{
			label: 'POST home assistant discovered-helpers/adopt',
			method: 'post',
			path: () => '/plugins/devices-home-assistant/discovered-helpers/adopt',
			body: (value) => ({
				entity_id: 'input_boolean.raw',
				name: 'Raw',
				category: 'generic',
				enabled: value,
				channels: [],
			}),
			field: 'enabled',
			prefix: '',
			control: false,
		},
		{
			label: 'POST home assistant discovered-devices/adopt',
			method: 'post',
			path: () => '/plugins/devices-home-assistant/discovered-devices/adopt',
			body: (value) => ({ ha_device_id: 'raw', name: 'Raw', category: 'generic', enabled: value, channels: [] }),
			field: 'enabled',
			prefix: '',
			control: false,
		},
		{
			label: 'POST home assistant discovered-devices/:id/preview-mapping',
			method: 'post',
			path: () => '/plugins/devices-home-assistant/discovered-devices/raw/preview-mapping',
			body: (value) => ({ entity_overrides: [{ entity_id: 'light.raw', skip: value }] }),
			field: 'skip',
			prefix: 'entityOverrides.0.',
			control: false,
		},
		{
			label: 'POST zigbee2mqtt discovered-devices/adopt',
			method: 'post',
			path: () => '/plugins/devices-zigbee2mqtt/discovered-devices/adopt',
			body: (value) =>
				data({ ieee_address: '0x0000000000000001', name: 'Raw', category: 'generic', enabled: value, channels: [] }),
			field: 'enabled',
			control: false,
		},
		{
			label: 'POST zigbee2mqtt discovered-devices/:ieeeAddress/preview-mapping',
			method: 'post',
			path: () => '/plugins/devices-zigbee2mqtt/discovered-devices/0x0000000000000001/preview-mapping',
			body: (value) => data({ expose_overrides: [{ expose_name: 'state', skip: value }] }),
			field: 'skip',
			prefix: 'data.exposeOverrides.0.',
			control: false,
		},
		{
			label: 'POST modbus endpoints',
			method: 'post',
			path: () => '/plugins/devices-modbus/endpoints',
			body: (value) => data({ name: 'Raw boolean', host: '127.0.0.1', enabled: value }),
			field: 'enabled',
		},
		{
			label: 'POST modbus probe/points',
			method: 'post',
			path: () => '/plugins/devices-modbus/probe/points',
			body: (value) =>
				data({
					host: '127.0.0.1',
					points: [
						{
							key: 'raw',
							binding: { register_type: 'holding_register', address: 0, data_type: 'uint16', invert: value },
						},
					],
				}),
			field: 'invert',
			prefix: 'data.points.0.binding.',
			control: false,
		},
		{
			label: 'PUT virtual thermostat comfort',
			method: 'put',
			path: () => `/plugins/devices-virtual/producers/thermostats/${PLACEHOLDER_ID}/comfort`,
			body: (value) => ({ expected_revision: 1, expected_graph_revision: 1, automation_enabled: value, presets: [] }),
			field: 'automation_enabled',
			prefix: '',
		},
		{
			label: 'POST virtual thermostat comfort/selection',
			method: 'post',
			path: () => `/plugins/devices-virtual/producers/thermostats/${PLACEHOLDER_ID}/comfort/selection`,
			body: (value) => ({ expected_revision: 1, expected_graph_revision: 1, preset: null, clear_user_off: value }),
			field: 'clear_user_off',
			prefix: '',
		},
		{
			label: 'POST wled discovery/adopt',
			method: 'post',
			path: () => '/plugins/devices-wled/discovery/adopt',
			body: (value) => data({ devices: [{ host: '127.0.0.1', name: 'Raw', category: 'lighting', enabled: value }] }),
			field: 'enabled',
			prefix: 'data.devices.0.',
			control: false,
		},
		...['required_channels_only', 'required_properties_only', 'auto_simulate'].map(
			(field): RawBooleanCase => ({
				label: 'POST simulator generate',
				method: 'post',
				path: () => '/plugins/simulator/simulator/generate',
				body: (value) => data({ category: 'generic', name: 'Raw boolean', [field]: value }),
				field,
			}),
		),
	];

	beforeAll(async () => {
		// Each route here takes many requests in a row; the throttle is covered by trusted-proxy-throttler.e2e-spec.ts
		jest
			.spyOn(DisplayAwareThrottlerGuard.prototype as unknown as { shouldSkip: () => Promise<boolean> }, 'shouldSkip')
			.mockResolvedValue(true);

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleFixture.createNestApplication();

		// The same pipe as src/main.ts
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: true },
				exceptionFactory: (validationErrors) => ValidationExceptionFactory.createException(validationErrors),
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize (especially module mappings)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// The first registered account becomes the owner
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'rawowner', password: 'securePassword123!', email: 'rawowner@example.com' } });

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'rawowner', password: 'securePassword123!' } });

		ownerToken = (login.body as { data: { access_token: string } }).data.access_token;

		expect(ownerToken).toEqual(expect.any(String));

		// The polymorphic update routes look the entity up before they know which DTO validates the body
		const device = await createdBody<{ id: string; channels: { id: string; properties: { id: string }[] }[] }>(
			'/modules/devices/devices',
			{
				data: {
					type: 'simulator',
					category: 'generic',
					name: 'Raw boolean fixture',
					channels: [
						{
							type: 'simulator',
							category: 'generic',
							identifier: 'generic',
							name: 'Raw boolean channel',
							properties: [
								{
									type: 'simulator',
									category: 'generic',
									identifier: 'generic',
									name: 'Raw boolean property',
									permissions: ['rw'],
									data_type: 'bool',
									value: false,
								},
							],
						},
					],
				},
			},
		);

		fixtures.deviceId = device.id;
		fixtures.channelId = device.channels[0].id;
		fixtures.propertyId = device.channels[0].properties[0].id;
		fixtures.pageId = await created('/modules/dashboard/pages', {
			data: { type: 'pages-tiles', title: 'Raw boolean fixture', order: 1 },
		});
		fixtures.tileId = await created('/modules/dashboard/tiles', {
			data: { type: 'tiles-time', parent: { type: 'page', id: fixtures.pageId }, row: 1, col: 1 },
		});
		fixtures.sceneId = await created('/modules/scenes/scenes', {
			data: { name: 'Raw boolean fixture' },
		});
		fixtures.actionId = await created(`/modules/scenes/scenes/${fixtures.sceneId}/actions`, {
			data: {
				type: 'scenes-local',
				device_id: fixtures.deviceId,
				channel_id: fixtures.channelId,
				property_id: fixtures.propertyId,
				value: true,
			},
		});
		fixtures.roomId = await created('/modules/spaces/spaces', {
			data: { type: 'room', name: 'Raw boolean room' },
		});
		fixtures.signageId = await created('/modules/spaces/spaces', {
			data: { type: 'signage_info_panel', name: 'Raw boolean signage' },
		});
	}, 60_000);

	afterAll(async () => {
		jest.restoreAllMocks();

		await app.close();
	});

	describe.each(cases.map((item): [string, RawBooleanCase] => [`${item.label} ${item.field}`, item]))(
		'%s',
		(_name, item) => {
			const prefix = item.prefix ?? 'data.';

			const call = (value: unknown): request.Test => {
				const test = send(item.method, item.path(), item.body(value), item.anonymous);

				for (const [header, headerValue] of Object.entries(item.headers ?? {})) {
					test.set(header, headerValue);
				}

				return test;
			};

			it.each(INVALID_VALUES)('refuses %s', async (_label, value) => {
				const response = await call(value);

				if (item.spaces) {
					expect(response.status).toBe(422);

					return;
				}

				expect(response.status).toBe(400);
				expect(fieldErrors(response.body, prefix, item.field)).not.toHaveLength(0);
			});

			if (item.control !== false) {
				it('accepts a real boolean for the field', async () => {
					const response = await call(false);

					if (item.spaces) {
						expect(response.status).toBeLessThan(300);

						return;
					}

					expect(fieldErrors(response.body, prefix, item.field)).toHaveLength(0);
				});
			}
		},
	);
});
