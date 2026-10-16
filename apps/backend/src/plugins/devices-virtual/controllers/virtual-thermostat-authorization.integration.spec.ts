import { useContainer } from 'class-validator';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { TokenOwnerType } from '../../../modules/auth/auth.constants';
import { AuthGuard } from '../../../modules/auth/guards/auth.guard';
import { TokensService } from '../../../modules/auth/services/tokens.service';
import { hashToken } from '../../../modules/auth/utils/token.utils';
import { PropertyCommandController } from '../../../modules/devices/controllers/property-command.controller';
import { PropertyCommandEntryInterceptor } from '../../../modules/devices/interceptors/property-command-entry.interceptor';
import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyCommandTargetConstraintValidator } from '../../../modules/devices/validators/property-command-target-constraint.validator';
import { McpAuditService } from '../../../modules/mcp/services/mcp-audit.service';
import { McpClientService } from '../../../modules/mcp/services/mcp-client.service';
import { McpInstallationService } from '../../../modules/mcp/services/mcp-installation.service';
import { McpOAuthRouteGateService } from '../../../modules/mcp/services/mcp-oauth-route-gate.service';
import { RolesGuard } from '../../../modules/users/guards/roles.guard';
import { UsersService } from '../../../modules/users/services/users.service';
import { UserRole } from '../../../modules/users/users.constants';
import { VirtualThermostatAuthoringService } from '../services/virtual-thermostat-authoring.service';
import { VirtualThermostatComfortService } from '../services/virtual-thermostat-comfort.service';
import { VirtualThermostatConfigService } from '../services/virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from '../services/virtual-thermostat-runtime.service';

import { VirtualThermostatAuthoringController } from './virtual-thermostat-authoring.controller';
import { VirtualThermostatComfortController } from './virtual-thermostat-comfort.controller';
import { VirtualThermostatConfigController } from './virtual-thermostat-config.controller';

const id = '4c77864b-e1e5-4650-aed7-f5eae2f14321';
const path = `/producers/thermostats/${id}`;
const fence = { expected_revision: 1, expected_graph_revision: 2 };
const definition = {
	heating_range: { minimum: 10, maximum: 25 },
	cooling_range: null,
	presets: [{ preset: 'eco', setpoints: { heating_setpoint: 16, cooling_setpoint: null } }],
	automation_enabled: true,
};
const configuration = {
	schema_version: 1,
	...fence,
	requested_mode: 'off',
	policy: {
		heatingSetpoint: 20,
		coolingSetpoint: null,
		coldTolerance: 0.5,
		hotTolerance: 0.5,
		neutralMargin: 1,
		minimumOffMs: 0,
		changeoverMs: 0,
		floor: null,
	},
	contact_opening_ms: 0,
	contact_closing_ms: 0,
	sources: [{ role: 'ambient', source_property: id, maximum_age_seconds: 300 }],
	actuators: [{ role: 'heating', source_property: id, lease_seconds: 30 }],
	settings: [],
	comfort: definition,
};
const creation = {
	device: { type: 'virtual', category: 'thermostat', mode: 'climate_controller', name: 'Thermostat', channels: [] },
	configuration: { ...configuration, expected_revision: 0 },
};

describe('thermostat HTTP authorization', () => {
	let app: NestFastifyApplication;
	const jwt = new JwtService({ secret: 'thermostat-route-test-only' });
	const bearer = {
		// Forged role claims must never promote stored display/user principals.
		display: jwt.sign({ sub: 'display-id', type: TokenOwnerType.DISPLAY, role: UserRole.OWNER }),
		user: jwt.sign({ sub: 'user-id', role: UserRole.OWNER }),
		owner: jwt.sign({ sub: 'owner-id', role: UserRole.OWNER }),
		admin: jwt.sign({ sub: 'admin-id', role: UserRole.ADMIN }),
	};
	const tokens = {
		findAuthenticationTokenByHash: jest.fn((hash: string) =>
			Promise.resolve(
				hash === hashToken(bearer.display)
					? { id: 'token-id', ownerType: TokenOwnerType.DISPLAY, ownerId: 'display-id', revoked: false }
					: null,
			),
		),
		findAuthenticationAccessToken: jest.fn((userId: string, hash: string) => {
			const role = [UserRole.USER, UserRole.OWNER, UserRole.ADMIN].find(
				(role) => userId === `${role}-id` && hash === hashToken(bearer[role]),
			);
			return Promise.resolve(role ? { owner: { id: userId, role }, revoked: false, refreshRevoked: false } : null);
		}),
		recordUsage: jest.fn(),
	};
	const configs = { configure: jest.fn().mockResolvedValue({ revision: 2 }), get: jest.fn().mockResolvedValue({}) };
	const authoring = { create: jest.fn().mockResolvedValue({}) };
	const comfort = {
		configure: jest.fn().mockResolvedValue({}),
		select: jest.fn().mockResolvedValue({}),
		override: jest.fn().mockResolvedValue({}),
		cancel: jest.fn().mockResolvedValue({}),
	};
	const commands = {
		captureCommandEntry: jest.fn(),
		releaseCommandEntry: jest.fn(),
		executePropertyCommands: jest.fn().mockResolvedValue({ success: true, results: [] }),
	};

	beforeAll(async () => {
		// Production guards verify signed bearers over HTTP. Only credential persistence and
		// downstream mutations are substituted; the test never injects req.auth.
		const module = await Test.createTestingModule({
			controllers: [
				VirtualThermostatConfigController,
				VirtualThermostatComfortController,
				VirtualThermostatAuthoringController,
				PropertyCommandController,
			],
			providers: [
				{ provide: APP_GUARD, useClass: AuthGuard },
				{ provide: APP_GUARD, useClass: RolesGuard },
				{ provide: JwtService, useValue: jwt },
				{ provide: TokensService, useValue: tokens },
				{ provide: VirtualThermostatConfigService, useValue: configs },
				{ provide: VirtualThermostatRuntimeService, useValue: {} },
				{ provide: VirtualThermostatAuthoringService, useValue: authoring },
				{ provide: VirtualThermostatComfortService, useValue: comfort },
				{ provide: PropertyCommandService, useValue: commands },
				PropertyCommandEntryInterceptor,
				...[
					UsersService,
					McpClientService,
					McpInstallationService,
					McpAuditService,
					McpOAuthRouteGateService,
					CACHE_MANAGER,
				].map((provide) => ({ provide, useValue: {} })),
			],
		}).compile();
		app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const metadata = { findOne: jest.fn().mockResolvedValue({ id, channel: { id, device: { id } } }) };
		useContainer(
			{
				get: <T>(type: new () => T): T => {
					if (type === (PropertyCommandTargetConstraintValidator as never))
						return new PropertyCommandTargetConstraintValidator(metadata as unknown as PropertyMetadataService) as T;
					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});
	beforeEach(() => jest.clearAllMocks());
	afterAll(async () => {
		await app?.close();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});

	it.each(['display', 'user'] as const)(
		'rejects %s configuration on every authoring write before mutation',
		async (caller) => {
			for (const route of [
				{ method: 'PUT' as const, url: path, payload: configuration },
				{ method: 'PUT' as const, url: path, payload: { comfort: { automation_enabled: true } } },
				{ method: 'PUT' as const, url: path, payload: { ...configuration, comfort: undefined } },
				{ method: 'PUT' as const, url: `${path}/comfort`, payload: { ...fence, ...definition } },
				{ method: 'POST' as const, url: '/producers/thermostats', payload: creation },
			]) {
				const response = await app.inject({ ...route, headers: { authorization: `Bearer ${bearer[caller]}` } });
				expect(response.statusCode).toBe(403);
			}
			expect(configs.configure).not.toHaveBeenCalled();
			expect(comfort.configure).not.toHaveBeenCalled();
			expect(authoring.create).not.toHaveBeenCalled();
			expect(
				tokens[caller === 'display' ? 'findAuthenticationTokenByHash' : 'findAuthenticationAccessToken'],
			).toHaveBeenCalled();
		},
	);

	it.each(['owner', 'admin'] as const)('allows %s configuration and nested comfort creation', async (caller) => {
		const headers = { authorization: `Bearer ${bearer[caller]}` };
		expect((await app.inject({ method: 'PUT', url: path, payload: configuration, headers })).statusCode).toBe(200);
		expect(
			(await app.inject({ method: 'PUT', url: `${path}/comfort`, payload: { ...fence, ...definition }, headers }))
				.statusCode,
		).toBe(200);
		expect(
			(await app.inject({ method: 'POST', url: '/producers/thermostats', payload: creation, headers })).statusCode,
		).toBe(201);
		expect(configs.configure).toHaveBeenCalledWith(id, expect.objectContaining({ comfort: definition }));
		expect(comfort.configure).toHaveBeenCalledWith(id, expect.anything(), definition);
		expect(authoring.create).toHaveBeenCalledWith(
			// Jest asymmetric matchers are intentionally nested.
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			expect.objectContaining({ configuration: expect.objectContaining({ comfort: definition }) }),
		);
	});

	it.each(['display', 'user'] as const)(
		'preserves %s reads, selections, overrides and exact cancellation',
		async (caller) => {
			const headers = { authorization: `Bearer ${bearer[caller]}` };
			expect((await app.inject({ method: 'GET', url: path, headers })).statusCode).toBe(200);
			const select = { ...fence, preset: 'eco', clear_user_off: false };
			expect(
				(await app.inject({ method: 'POST', url: `${path}/comfort/selection`, payload: select, headers })).statusCode,
			).toBe(201);
			expect(comfort.select).toHaveBeenCalledWith(id, expect.objectContaining(select), 'eco', false);
			const override = { ...fence, preset: 'eco', setpoints: null, expires_at: '2026-10-15T12:00:00Z' };
			expect(
				(await app.inject({ method: 'POST', url: `${path}/comfort/override`, payload: override, headers })).statusCode,
			).toBe(201);
			expect(comfort.override).toHaveBeenCalledWith(
				id,
				expect.objectContaining(override),
				{ preset: 'eco', setpoints: null, expires_at: override.expires_at },
				caller === 'display' ? 'display:display-id:token:token-id' : 'user-id',
				caller === 'display' ? 'panel' : 'user',
			);
			const cancel = { ...fence, override_id: id };
			expect(
				(await app.inject({ method: 'POST', url: `${path}/comfort/override/cancel`, payload: cancel, headers }))
					.statusCode,
			).toBe(201);
			expect(comfort.cancel).toHaveBeenCalledWith(id, expect.objectContaining(cancel), id);
			expect(
				(
					await app.inject({
						method: 'POST',
						url: `${path}/comfort/override`,
						payload: { ...override, actor_id: 'owner-id', source: 'automation' },
						headers,
					})
				).statusCode,
			).toBe(400);
			expect(comfort.override).toHaveBeenCalledTimes(1);
		},
	);

	it.each(['display', 'owner', 'admin'] as const)(
		'preserves %s property commands with authenticated display attribution',
		async (caller) => {
			const response = await app.inject({
				method: 'POST',
				url: '/property-commands',
				headers: { authorization: `Bearer ${bearer[caller]}` },
				payload: {
					request_id: id,
					properties: [{ device: id, channel: id, property: id, value: false }],
					context: { display_id: id },
				},
			});
			expect(response.statusCode).toBe(200);
			expect(commands.executePropertyCommands).toHaveBeenCalledWith(
				[{ propertyId: id, requestedDeviceId: id, requestedChannelId: id, value: false }],
				expect.objectContaining({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					context: expect.objectContaining({
						origin: caller === 'display' ? 'panel.device' : 'admin',
						displayId: caller === 'display' ? 'display-id' : id,
					}),
				}),
			);
		},
	);
	it('keeps the existing normal-user property command restriction', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/property-commands',
			headers: { authorization: `Bearer ${bearer.user}` },
			payload: { request_id: id, properties: [{ device: id, channel: id, property: id, value: false }] },
		});
		expect(response.statusCode).toBe(403);
		expect(commands.executePropertyCommands).not.toHaveBeenCalled();
	});

	it('requires authentication before every configuration mutation', async () => {
		for (const route of [
			{ method: 'PUT' as const, url: path, payload: configuration },
			{ method: 'PUT' as const, url: `${path}/comfort`, payload: { ...fence, ...definition } },
			{ method: 'POST' as const, url: '/producers/thermostats', payload: creation },
		])
			expect((await app.inject(route)).statusCode).toBe(401);
		expect(configs.configure).not.toHaveBeenCalled();
		expect(comfort.configure).not.toHaveBeenCalled();
		expect(authoring.create).not.toHaveBeenCalled();
	});
});
