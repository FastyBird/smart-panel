import { AuthInfo, McpServer, ResourceTemplate, ServerContext } from '@modelcontextprotocol/server';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { WeatherNotFoundException } from '../../weather/weather.exceptions';
import { MCP_TOOL_CALL_TIMEOUT_MS, McpCapability } from '../mcp.constants';
import { McpEndpointDisabledException } from '../mcp.exceptions';
import { McpAuditService } from '../services/mcp-audit.service';
import { McpContextService } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

import { McpReadToolService } from './mcp-read-tool.service';

type ToolCallback = (
	args: Record<string, unknown>,
	ctx: ServerContext,
) => Promise<{ isError?: boolean; structuredContent: Record<string, unknown> }>;
type ResourceReadResult = { contents: Array<{ uri: string; mimeType: string; text: string }> };
type ResourceCallback = (uri: URL, ctx: ServerContext) => Promise<ResourceReadResult>;
type ResourceTemplateCallback = (
	uri: URL,
	variables: Record<string, string>,
	ctx: ServerContext,
) => Promise<ResourceReadResult>;
type ResourceListCallback = (
	request: { params?: { cursor?: string } },
	ctx: ServerContext,
) => Promise<{ resources: Array<{ uri: string }>; nextCursor?: string }>;

describe('McpReadToolService', () => {
	let service: McpReadToolService;
	let contextService: {
		getDeviceState: jest.Mock;
		getEnergySummary: jest.Mock;
		getHomeContext: jest.Mock;
		getInstallation: jest.Mock;
		getPropertyTimeseries: jest.Mock;
		getSecurityStatus: jest.Mock;
		getWeather: jest.Mock;
		listSpaces: jest.Mock;
	};
	let policyService: { authorizeAuthInfo: jest.Mock };
	let auditService: { getRequestId: jest.Mock; recordPolicyDenial: jest.Mock; recordToolResult: jest.Mock };
	let registerTool: jest.Mock;
	let registerResource: jest.Mock;
	let callbacks: Map<string, ToolCallback>;
	let resourceCallbacks: Map<string, ResourceCallback>;
	let registeredResourceUris: Map<string, unknown>;
	let resourceTemplateCallbacks: Map<string, ResourceTemplateCallback>;
	let resourceListCallback: ResourceListCallback | undefined;

	beforeEach(() => {
		contextService = {
			getDeviceState: jest.fn(),
			getEnergySummary: jest.fn(),
			getHomeContext: jest.fn().mockResolvedValue({
				scope: { type: 'home' },
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: null,
				security: null,
				limits: {
					spaces_truncated: false,
					devices_truncated: false,
					scenes_truncated: false,
				},
			}),
			getInstallation: jest.fn().mockResolvedValue({
				id: 'installation-id',
				name: 'FastyBird Smart Panel',
				version: '1.0.0',
				timezone: 'UTC',
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				effective_capabilities: [McpCapability.READ],
			}),
			getPropertyTimeseries: jest.fn(),
			getSecurityStatus: jest.fn().mockResolvedValue({ active_alerts_count: 0 }),
			getWeather: jest.fn().mockResolvedValue({ location: 'Prague' }),
			listSpaces: jest.fn().mockResolvedValue({ spaces: [], nextCursor: undefined }),
		};
		policyService = {
			authorizeAuthInfo: jest.fn().mockResolvedValue({ effectiveCapabilities: [McpCapability.READ] }),
		};
		auditService = {
			getRequestId: jest.fn().mockReturnValue('17'),
			recordPolicyDenial: jest.fn(),
			recordToolResult: jest.fn(),
		};
		callbacks = new Map();
		resourceCallbacks = new Map();
		registeredResourceUris = new Map();
		resourceTemplateCallbacks = new Map();
		resourceListCallback = undefined;
		registerTool = jest.fn((name: string, _config: unknown, callback: ToolCallback) => {
			callbacks.set(name, callback);
		});
		registerResource = jest.fn(
			(name: string, uri: unknown, _config: unknown, callback: ResourceCallback | ResourceTemplateCallback) => {
				registeredResourceUris.set(name, uri);

				if (name === 'space-snapshot') {
					resourceTemplateCallbacks.set(name, callback as ResourceTemplateCallback);
				} else {
					resourceCallbacks.set(name, callback as ResourceCallback);
				}
			},
		);
		service = new McpReadToolService(
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService as unknown as McpAuditService,
		);
	});

	it('registers no catalog when read is outside the effective capability set', () => {
		service.register(server(), authInfo([]));

		expect(registerTool).not.toHaveBeenCalled();
		expect(registerResource).not.toHaveBeenCalled();
	});

	it('registers the six read tools and three initial resources', () => {
		service.register(server(), authInfo([McpCapability.READ]));

		expect([...callbacks.keys()]).toEqual([
			'get_home_context',
			'get_device_state',
			'get_property_timeseries',
			'get_energy_summary',
			'get_weather',
			'get_security_status',
		]);
		expect(registerResource).toHaveBeenCalledTimes(3);
		expect(registeredResourceUris.get('installation')).toBe('smart-panel://installation');
		expect(registeredResourceUris.get('home-context')).toBe('smart-panel://home/context');

		const spaceSnapshotTemplate = registeredResourceUris.get('space-snapshot');

		expect(spaceSnapshotTemplate).toBeInstanceOf(ResourceTemplate);
		if (!(spaceSnapshotTemplate instanceof ResourceTemplate)) {
			throw new Error('Space snapshot did not register an MCP ResourceTemplate');
		}
		expect(spaceSnapshotTemplate.uriTemplate.toString()).toBe('smart-panel://spaces/{spaceId}/snapshot');
	});

	it('forwards get_device_state arguments and envelopes the exact direct-read data unchanged', async () => {
		const deviceId = '10000000-0000-4000-8000-000000000001';
		const deviceState = {
			id: deviceId,
			name: 'Lamp',
			category: 'lighting',
			enabled: true,
			room_id: '20000000-0000-4000-8000-000000000001',
			zone_ids: ['30000000-0000-4000-8000-000000000001'],
			status: {
				online: true,
				state: 'connected',
				last_changed: '2026-08-06T12:00:00.000Z',
			},
			channels: [
				{
					id: '40000000-0000-4000-8000-000000000001',
					name: 'Light',
					category: 'light',
					properties: [
						{
							id: '50000000-0000-4000-8000-000000000001',
							name: 'Brightness',
							category: 'brightness',
							data_type: 'uchar',
							unit: '%',
							value: 50,
							last_updated: '2026-08-06T12:00:00.000Z',
							trend: 'stable',
						},
					],
					properties_truncated: false,
				},
			],
			channels_truncated: false,
		};
		contextService.getDeviceState.mockResolvedValue(deviceState);
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_device_state')?.({ device_id: deviceId }, requestContext());

		expect(contextService.getDeviceState).toHaveBeenCalledTimes(1);
		expect(contextService.getDeviceState).toHaveBeenCalledWith(deviceId);
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.tool).toBe('get_device_state');
		expect(result?.structuredContent.data).toBe(deviceState);
		expect(result?.structuredContent.data).toEqual(deviceState);
	});

	it('forwards get_property_timeseries arguments and envelopes the exact direct-read data unchanged', async () => {
		const propertyId = '50000000-0000-4000-8000-000000000001';
		const from = '2026-08-01T00:00:00.000Z';
		const to = '2026-08-01T01:00:00.000Z';
		const propertyTimeseries = {
			property_id: propertyId,
			from,
			to,
			bucket: '5m',
			points: [
				{ time: '2026-08-01T00:00:00.000Z', value: 1 },
				{ time: '2026-08-01T00:05:00.000Z', value: 2 },
			],
			truncated: false,
		};
		contextService.getPropertyTimeseries.mockResolvedValue(propertyTimeseries);
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_property_timeseries')?.(
			{ property_id: propertyId, from, to, bucket: '5m' },
			requestContext(),
		);

		expect(contextService.getPropertyTimeseries).toHaveBeenCalledTimes(1);
		expect(contextService.getPropertyTimeseries).toHaveBeenCalledWith(propertyId, from, to, '5m');
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.tool).toBe('get_property_timeseries');
		expect(result?.structuredContent.data).toBe(propertyTimeseries);
		expect(result?.structuredContent.data).toEqual(propertyTimeseries);
	});

	it('forwards get_energy_summary arguments in service order and envelopes the exact data unchanged', async () => {
		const from = '2026-08-01T00:00:00.000Z';
		const to = '2026-08-02T00:00:00.000Z';
		const spaceId = '20000000-0000-4000-8000-000000000001';
		const energySummary = {
			scope: { type: 'space', id: spaceId },
			from,
			to,
			totalConsumptionKwh: 12.5,
			totalCost: 4.25,
			currency: 'EUR',
		};
		contextService.getEnergySummary.mockResolvedValue(energySummary);
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_energy_summary')?.({ from, to, space_id: spaceId }, requestContext());

		expect(contextService.getEnergySummary).toHaveBeenCalledTimes(1);
		expect(contextService.getEnergySummary).toHaveBeenCalledWith(from, to, spaceId);
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.tool).toBe('get_energy_summary');
		expect(result?.structuredContent.data).toBe(energySummary);
		expect(result?.structuredContent.data).toEqual(energySummary);
	});

	it('reauthorizes a tool call and returns structured installation metadata', async () => {
		service.register(server(), authInfo([McpCapability.READ]));
		const callback = callbacks.get('get_security_status');

		expect(callback).toBeDefined();
		const result = await callback?.({}, requestContext());

		expect(policyService.authorizeAuthInfo).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 'client-id', token: 'raw-token' }),
			McpCapability.READ,
		);
		expect(contextService.getSecurityStatus).toHaveBeenCalledTimes(1);
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.installation).toEqual(expect.objectContaining({ id: 'installation-id' }));
		expect(result?.structuredContent.tool).toBe('get_security_status');
		expect(result?.structuredContent.request_id).toBe('17');
		expect(result?.structuredContent.data).toEqual({ active_alerts_count: 0 });
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: '17',
				clientId: 'client-id',
				tool: 'get_security_status',
				capability: McpCapability.READ,
				outcome: 'completed',
			}),
		);
	});

	it('requests whole-home context when get_home_context omits a space', async () => {
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_home_context')?.({}, requestContext());

		expect(contextService.getHomeContext).toHaveBeenCalledTimes(1);
		expect(contextService.getHomeContext).toHaveBeenCalledWith(undefined);
		expect(result?.structuredContent.tool).toBe('get_home_context');
		expect(result?.structuredContent.data).toEqual({
			scope: { type: 'home' },
			spaces: [],
			devices: [],
			scenes: [],
			weather: null,
			energy: null,
			security: null,
			limits: {
				spaces_truncated: false,
				devices_truncated: false,
				scenes_truncated: false,
			},
		});
	});

	it('passes the requested space to get_home_context and preserves bounded-output metadata in the envelope', async () => {
		const spaceId = '550e8400-e29b-41d4-a716-446655440000';
		const scopedContext = {
			scope: { type: 'space', id: spaceId, name: 'Living room' },
			spaces: [{ id: spaceId, name: 'Living room', type: 'room', device_count: 101 }],
			devices: [{ id: 'device-id', name: 'Ceiling light' }],
			scenes: [],
			weather: null,
			energy: null,
			security: {
				devices_truncated: true,
				channels_truncated: true,
				properties_truncated: true,
				state_truncated: true,
			},
			limits: {
				spaces_truncated: false,
				devices_truncated: true,
				scenes_truncated: true,
			},
		};
		contextService.getHomeContext.mockResolvedValue(scopedContext);
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_home_context')?.({ space_id: spaceId }, requestContext());
		const installation = result?.structuredContent.installation as { id: string } | undefined;

		expect(contextService.getHomeContext).toHaveBeenCalledTimes(1);
		expect(contextService.getHomeContext).toHaveBeenCalledWith(spaceId);
		expect(result?.isError).toBeUndefined();
		expect(installation?.id).toBe('installation-id');
		expect(result?.structuredContent.tool).toBe('get_home_context');
		expect(result?.structuredContent.request_id).toBe('17');
		expect(typeof result?.structuredContent.observed_at).toBe('string');
		expect(result?.structuredContent.data).toBe(scopedContext);
	});

	it('requests primary weather when get_weather omits a location', async () => {
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_weather')?.({}, requestContext());

		expect(contextService.getWeather).toHaveBeenCalledTimes(1);
		expect(contextService.getWeather).toHaveBeenCalledWith(undefined);
		expect(result?.structuredContent).toEqual(
			expect.objectContaining({
				tool: 'get_weather',
				data: { location: 'Prague' },
			}),
		);
	});

	it('passes an explicit location to get_weather and preserves its output in the envelope', async () => {
		const locationId = '550e8400-e29b-41d4-a716-446655440000';
		const weatherContext = {
			location_id: locationId,
			location: 'Prague',
			current: { temperature: 21 },
			forecast: [{ date: '2026-08-15', temperature_max: 25 }],
		};
		contextService.getWeather.mockResolvedValue(weatherContext);
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_weather')?.({ location_id: locationId }, requestContext());

		expect(contextService.getWeather).toHaveBeenCalledTimes(1);
		expect(contextService.getWeather).toHaveBeenCalledWith(locationId);
		expect(result?.structuredContent).toEqual(
			expect.objectContaining({
				tool: 'get_weather',
				data: weatherContext,
			}),
		);
		expect(result?.structuredContent.data).toBe(weatherContext);
	});

	it('returns a sanitized denial when live policy no longer grants read', async () => {
		policyService.authorizeAuthInfo.mockRejectedValue(new ForbiddenException('private policy detail'));
		service.register(server(), authInfo([McpCapability.READ]));
		const result = await callbacks.get('get_security_status')?.({}, requestContext());

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent).toEqual(
			expect.objectContaining({
				data: null,
				error: {
					code: 'permission_denied',
					message: 'The MCP client is not authorized for this read operation.',
				},
			}),
		);
		expect(contextService.getSecurityStatus).not.toHaveBeenCalled();
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'capability_denied',
			{ capability: McpCapability.READ, tool: 'get_security_status' },
		);
	});

	it('distinguishes a live credential rejection from a capability denial', async () => {
		policyService.authorizeAuthInfo.mockRejectedValue(new UnauthorizedException('private credential detail'));
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_security_status')?.({}, requestContext());

		expect(result?.isError).toBe(true);
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'invalid_credential',
			{ capability: McpCapability.READ, tool: 'get_security_status' },
		);
	});

	it('audits a module-disable race as an endpoint denial without confusing domain not-found errors', async () => {
		policyService.authorizeAuthInfo.mockRejectedValue(new McpEndpointDisabledException());
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_security_status')?.({}, requestContext());

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual({
			code: 'not_found',
			message: 'The requested Smart Panel item was not found.',
		});
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'endpoint_disabled',
			{ capability: McpCapability.READ, tool: 'get_security_status' },
		);
		expect(auditService.recordToolResult).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'denied' }));
	});

	it('returns a sanitized error when a domain call exceeds the MCP deadline', async () => {
		jest.useFakeTimers();
		contextService.getSecurityStatus.mockReturnValue(new Promise(() => undefined));
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const resultPromise = callbacks.get('get_security_status')?.({}, requestContext());

			await jest.advanceTimersByTimeAsync(MCP_TOOL_CALL_TIMEOUT_MS);
			const result = await resultPromise;

			expect(result?.isError).toBe(true);
			expect(result?.structuredContent.error).toEqual({
				code: 'read_failed',
				message: 'Smart Panel could not complete the requested read operation.',
			});
			expect(auditService.recordToolResult).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'timed_out' }));
		} finally {
			jest.useRealTimers();
		}
	});

	it('preserves weather not-found classification without exposing domain details', async () => {
		contextService.getWeather.mockRejectedValue(new WeatherNotFoundException('private location detail'));
		service.register(server(), authInfo([McpCapability.READ]));

		const result = await callbacks.get('get_weather')?.(
			{ location_id: '550e8400-e29b-41d4-a716-446655440000' },
			requestContext(),
		);

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual({
			code: 'not_found',
			message: 'The requested Smart Panel item was not found.',
		});
		expect(auditService.recordPolicyDenial).not.toHaveBeenCalled();
		expect(auditService.recordToolResult).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failed' }));
	});

	it('enforces the same deadline for resource reads', async () => {
		jest.useFakeTimers();
		contextService.getInstallation.mockReturnValue(new Promise(() => undefined));
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const resultPromise = resourceCallbacks.get('installation')?.(
				new URL('smart-panel://installation'),
				requestContext(),
			);
			if (resultPromise === undefined) {
				throw new Error('Installation resource callback was not registered');
			}
			const rejection = expect(resultPromise).rejects.toThrow(
				'Smart Panel could not complete the requested read operation.',
			);

			await jest.advanceTimersByTimeAsync(MCP_TOOL_CALL_TIMEOUT_MS);
			await rejection;
			expect(auditService.recordToolResult).toHaveBeenCalledWith(
				expect.objectContaining({
					tool: 'resources/read',
					capability: McpCapability.READ,
					outcome: 'timed_out',
				}),
			);
		} finally {
			jest.useRealTimers();
		}
	});

	it('reads the home-context resource with whole-home forwarding and the exact compatible JSON wrapper', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const result = await resourceCallbacks.get('home-context')?.(
				new URL('smart-panel://home/context'),
				requestContext(),
			);

			expect(contextService.getHomeContext).toHaveBeenCalledTimes(1);
			expect(contextService.getHomeContext).toHaveBeenCalledWith();
			expect(result).toEqual({
				contents: [
					{
						uri: 'smart-panel://home/context',
						mimeType: 'application/json',
						text: JSON.stringify({
							installation: {
								id: 'installation-id',
								name: 'FastyBird Smart Panel',
								version: '1.0.0',
								timezone: 'UTC',
								endpoint: 'https://panel.test/api/v1/modules/mcp',
								effective_capabilities: [McpCapability.READ],
							},
							observed_at: '2026-08-14T12:00:00.000Z',
							data: {
								scope: { type: 'home' },
								spaces: [],
								devices: [],
								scenes: [],
								weather: null,
								energy: null,
								security: null,
								limits: {
									spaces_truncated: false,
									devices_truncated: false,
									scenes_truncated: false,
								},
							},
						}),
					},
				],
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it('reads a space snapshot resource with scoped forwarding and the exact compatible JSON wrapper', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
		const spaceId = '20000000-0000-4000-8000-000000000001';
		const scopedContext = {
			scope: { type: 'space', id: spaceId, name: 'Living room' },
			spaces: [{ id: spaceId, name: 'Living room', type: 'room', device_count: 1 }],
			devices: [{ id: 'device-id', name: 'Lamp' }],
			scenes: [],
			weather: null,
			energy: null,
			security: null,
			limits: {
				spaces_truncated: false,
				devices_truncated: false,
				scenes_truncated: false,
			},
		};
		contextService.getHomeContext.mockResolvedValue(scopedContext);
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const uri = new URL(`smart-panel://spaces/${spaceId}/snapshot`);
			const result = await resourceTemplateCallbacks.get('space-snapshot')?.(uri, { spaceId }, requestContext());

			expect(contextService.getHomeContext).toHaveBeenCalledTimes(1);
			expect(contextService.getHomeContext).toHaveBeenCalledWith(spaceId);
			expect(result).toEqual({
				contents: [
					{
						uri: `smart-panel://spaces/${spaceId}/snapshot`,
						mimeType: 'application/json',
						text: JSON.stringify({
							installation: {
								id: 'installation-id',
								name: 'FastyBird Smart Panel',
								version: '1.0.0',
								timezone: 'UTC',
								endpoint: 'https://panel.test/api/v1/modules/mcp',
								effective_capabilities: [McpCapability.READ],
							},
							observed_at: '2026-08-14T12:00:00.000Z',
							data: scopedContext,
						}),
					},
				],
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it('audits a resource policy denial without exposing the resource request', async () => {
		policyService.authorizeAuthInfo.mockRejectedValue(new ForbiddenException('private resource policy'));
		service.register(server(), authInfo([McpCapability.READ]));
		const resultPromise = resourceCallbacks.get('installation')?.(
			new URL('smart-panel://installation'),
			requestContext(),
		);

		if (resultPromise === undefined) {
			throw new Error('Installation resource callback was not registered');
		}

		await expect(resultPromise).rejects.toThrow('The MCP client is not authorized for this read operation.');
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'capability_denied',
			{ capability: McpCapability.READ, tool: 'resources/read' },
		);
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ tool: 'resources/read', outcome: 'denied' }),
		);
	});

	it('paginates resource discovery without repeating static resources', async () => {
		contextService.listSpaces.mockResolvedValue({
			spaces: [{ id: 'space-51', name: 'Workshop', type: 'room' }],
			nextCursor: '51',
		});
		service.register(server(), authInfo([McpCapability.READ]));

		const firstPage = await resourceListCallback?.({ params: {} }, requestContext());
		expect(firstPage?.resources.map((resource) => resource.uri)).toEqual([
			'smart-panel://installation',
			'smart-panel://home/context',
			'smart-panel://spaces/space-51/snapshot',
		]);
		expect(firstPage?.nextCursor).toBe('51');
		expect(contextService.listSpaces).toHaveBeenLastCalledWith(undefined);
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ tool: 'resources/list', outcome: 'completed' }),
		);

		const nextPage = await resourceListCallback?.({ params: { cursor: '50' } }, requestContext());
		expect(nextPage?.resources.map((resource) => resource.uri)).toEqual(['smart-panel://spaces/space-51/snapshot']);
		expect(contextService.listSpaces).toHaveBeenLastCalledWith('50');
	});

	function server(): McpServer {
		return {
			registerTool,
			registerResource,
			server: {
				setRequestHandler: jest.fn((method: string, callback: ResourceListCallback) => {
					if (method === 'resources/list') {
						resourceListCallback = callback;
					}
				}),
			},
		} as unknown as McpServer;
	}

	function authInfo(scopes: McpCapability[]): AuthInfo {
		return {
			token: 'raw-token',
			clientId: 'client-id',
			scopes,
			extra: {
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				installationId: 'installation-id',
				tokenId: 'token-id',
			},
		};
	}

	function requestContext(): ServerContext {
		return {
			http: { authInfo: authInfo([McpCapability.READ]) },
			mcpReq: { id: 17 },
		} as unknown as ServerContext;
	}
});
