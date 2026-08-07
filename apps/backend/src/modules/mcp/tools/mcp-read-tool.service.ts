import { z } from 'zod';

import { AuthInfo, McpServer, ResourceTemplate, ServerContext } from '@modelcontextprotocol/server';
import { ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';

import { withTimeout } from '../../../common/utils/http.utils';
import { BucketDuration } from '../../devices/services/property-timeseries.service';
import { WeatherNotFoundException } from '../../weather/weather.exceptions';
import { MCP_TOOL_CALL_TIMEOUT_MS, McpCapability } from '../mcp.constants';
import { McpAuditOutcome, McpAuditService } from '../services/mcp-audit.service';
import { McpContextService, McpInstallationContext } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

const toolOutputSchema = z.object({
	installation: z.object({
		id: z.string(),
		name: z.string(),
		version: z.string(),
		timezone: z.string(),
		endpoint: z.string().nullable(),
		effective_capabilities: z.array(z.enum(McpCapability)),
	}),
	tool: z.string(),
	request_id: z.string(),
	observed_at: z.string(),
	data: z.unknown().nullable(),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
		})
		.optional(),
});

const emptyInputSchema = z.object({});

interface ToolData {
	data: Record<string, unknown>;
	text: string;
}

interface ToolEnvelope {
	installation: McpInstallationContext;
	tool: string;
	request_id: string;
	observed_at: string;
	data: unknown;
	error?: { code: string; message: string };
}

@Injectable()
export class McpReadToolService {
	constructor(
		private readonly contextService: McpContextService,
		private readonly policyService: McpPolicyService,
		private readonly auditService: McpAuditService,
	) {}

	register(server: McpServer, authInfo?: AuthInfo): void {
		if (!authInfo?.scopes.includes(McpCapability.READ)) {
			return;
		}

		server.registerTool(
			'get_home_context',
			{
				description: 'Returns a bounded current overview of the installation or one space.',
				inputSchema: z.object({ space_id: z.string().uuid().optional() }),
				outputSchema: toolOutputSchema,
			},
			async ({ space_id }, ctx) =>
				this.runTool('get_home_context', ctx, async () => {
					const data = await this.contextService.getHomeContext(space_id);
					const deviceCount = Array.isArray(data.devices) ? data.devices.length : 0;

					return { data, text: `Retrieved current context with ${deviceCount} device(s).` };
				}),
		);

		server.registerTool(
			'get_device_state',
			{
				description: 'Returns one device with its channels and current property values.',
				inputSchema: z.object({ device_id: z.string().uuid() }),
				outputSchema: toolOutputSchema,
			},
			async ({ device_id }, ctx) =>
				this.runTool('get_device_state', ctx, async () => ({
					data: await this.contextService.getDeviceState(device_id),
					text: `Retrieved current state for device ${device_id}.`,
				})),
		);

		server.registerTool(
			'get_property_timeseries',
			{
				description: 'Returns bounded, downsampled history for one device property.',
				inputSchema: z.object({
					property_id: z.string().uuid(),
					from: z.string().min(1),
					to: z.string().min(1),
					bucket: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
				}),
				outputSchema: toolOutputSchema,
			},
			async ({ property_id, from, to, bucket }, ctx) =>
				this.runTool('get_property_timeseries', ctx, async () => {
					const data = await this.contextService.getPropertyTimeseries(property_id, from, to, bucket as BucketDuration);
					const pointCount = Array.isArray(data.points) ? data.points.length : 0;

					return { data, text: `Retrieved ${pointCount} history point(s) for property ${property_id}.` };
				}),
		);

		server.registerTool(
			'get_energy_summary',
			{
				description: 'Returns a bounded energy summary for the home or one space.',
				inputSchema: z.object({
					space_id: z.string().uuid().optional(),
					from: z.string().min(1).optional(),
					to: z.string().min(1).optional(),
				}),
				outputSchema: toolOutputSchema,
			},
			async ({ space_id, from, to }, ctx) =>
				this.runTool('get_energy_summary', ctx, async () => ({
					data: await this.contextService.getEnergySummary(from, to, space_id),
					text: `Retrieved energy summary for ${space_id ? `space ${space_id}` : 'the installation'}.`,
				})),
		);

		server.registerTool(
			'get_weather',
			{
				description: 'Returns current conditions and a short forecast for a configured location.',
				inputSchema: z.object({ location_id: z.string().uuid().optional() }),
				outputSchema: toolOutputSchema,
			},
			async ({ location_id }, ctx) =>
				this.runTool('get_weather', ctx, async () => ({
					data: await this.contextService.getWeather(location_id),
					text: 'Retrieved current weather and short forecast.',
				})),
		);

		server.registerTool(
			'get_security_status',
			{
				description: 'Returns the current security state and a bounded list of active alerts.',
				inputSchema: emptyInputSchema,
				outputSchema: toolOutputSchema,
			},
			async (_args, ctx) =>
				this.runTool('get_security_status', ctx, async () => ({
					data: await this.contextService.getSecurityStatus(),
					text: 'Retrieved current security status.',
				})),
		);

		this.registerResources(server);
	}

	private registerResources(server: McpServer): void {
		server.registerResource(
			'installation',
			'smart-panel://installation',
			{
				title: 'Smart Panel installation',
				description: 'Installation identity, version, timezone, endpoint, and effective MCP capabilities.',
				mimeType: 'application/json',
			},
			async (uri, ctx) =>
				this.readResource(uri, ctx, async (policy, endpoint) =>
					this.contextService.getInstallation(policy.effectiveCapabilities, endpoint),
				),
		);

		server.registerResource(
			'home-context',
			'smart-panel://home/context',
			{
				title: 'Current home context',
				description: 'Bounded current context for the Smart Panel installation.',
				mimeType: 'application/json',
			},
			async (uri, ctx) =>
				this.readResource(uri, ctx, async (policy, endpoint) => ({
					installation: await this.contextService.getInstallation(policy.effectiveCapabilities, endpoint),
					observed_at: new Date().toISOString(),
					data: await this.contextService.getHomeContext(),
				})),
		);

		server.registerResource(
			'space-snapshot',
			new ResourceTemplate('smart-panel://spaces/{spaceId}/snapshot', {
				list: undefined,
			}),
			{
				title: 'Space snapshot',
				description: 'Current bounded context for one Smart Panel space.',
				mimeType: 'application/json',
			},
			async (uri, variables, ctx) => {
				const spaceId = String(variables.spaceId ?? '');

				return this.readResource(uri, ctx, async (policy, endpoint) => ({
					installation: await this.contextService.getInstallation(policy.effectiveCapabilities, endpoint),
					observed_at: new Date().toISOString(),
					data: await this.contextService.getHomeContext(spaceId),
				}));
			},
		);

		// ResourceTemplate.list callbacks in the pinned SDK do not receive the resources/list request cursor and
		// the built-in aggregator drops nextCursor. Replace only that low-level handler so the existing registered
		// read and template handlers remain SDK-managed while resource discovery can be paginated correctly.
		server.server.setRequestHandler('resources/list', async (request, ctx) =>
			this.runResourceOperation(
				'resource listing',
				async () => {
					await this.authorizeRead(ctx);
					const cursor = request.params?.cursor;
					const page = await this.contextService.listSpaces(cursor);
					const staticResources =
						cursor === undefined
							? [
									{
										uri: 'smart-panel://installation',
										name: 'installation',
										title: 'Smart Panel installation',
										description: 'Installation identity, version, timezone, endpoint, and effective MCP capabilities.',
										mimeType: 'application/json',
									},
									{
										uri: 'smart-panel://home/context',
										name: 'home-context',
										title: 'Current home context',
										description: 'Bounded current context for the Smart Panel installation.',
										mimeType: 'application/json',
									},
								]
							: [];

					return {
						resources: [
							...staticResources,
							...page.spaces.map((space) => ({
								uri: `smart-panel://spaces/${space.id}/snapshot`,
								name: `${space.name} snapshot`,
								title: `${space.name} snapshot`,
								description: `Current bounded context for the ${space.name} ${space.type}.`,
								mimeType: 'application/json',
							})),
						],
						...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
					};
				},
				ctx,
			),
		);
	}

	private async runTool(
		tool: string,
		ctx: ServerContext,
		callback: () => Promise<ToolData>,
	): Promise<{
		content: Array<{ type: 'text'; text: string }>;
		structuredContent: ToolEnvelope;
		isError?: boolean;
	}> {
		const requestId = String(ctx.mcpReq.id);
		const startedAt = Date.now();
		const identity = {
			requestId,
			...(ctx.http?.authInfo?.clientId ? { clientId: ctx.http.authInfo.clientId } : {}),
		};
		let installation = this.getInstallationFallback(ctx);

		try {
			const execution = await this.withDeadline(`tool ${tool}`, async () => {
				const policy = await this.authorizeRead(ctx);
				const liveInstallation = await this.contextService.getInstallation(
					policy.effectiveCapabilities,
					this.getEndpoint(ctx.http?.authInfo),
				);

				return { installation: liveInstallation, result: await callback() };
			});
			installation = execution.installation;
			const structuredContent: ToolEnvelope = {
				installation,
				tool,
				request_id: requestId,
				observed_at: new Date().toISOString(),
				data: execution.result.data,
			};
			this.auditService.recordToolResult({
				...identity,
				tool,
				capability: McpCapability.READ,
				durationMs: Date.now() - startedAt,
				outcome: McpAuditOutcome.COMPLETED,
			});

			return {
				content: [{ type: 'text', text: execution.result.text }],
				structuredContent,
			};
		} catch (error) {
			const sanitized = this.sanitizeError(error);
			const outcome = this.getAuditOutcome(error);
			const structuredContent: ToolEnvelope = {
				installation,
				tool,
				request_id: requestId,
				observed_at: new Date().toISOString(),
				data: null,
				error: sanitized,
			};

			if (outcome === McpAuditOutcome.DENIED) {
				this.auditService.recordPolicyDenial(identity, 'capability_denied', {
					capability: McpCapability.READ,
					tool,
				});
			}

			this.auditService.recordToolResult({
				...identity,
				tool,
				capability: McpCapability.READ,
				durationMs: Date.now() - startedAt,
				outcome,
			});

			return {
				content: [{ type: 'text', text: sanitized.message }],
				structuredContent,
				isError: true,
			};
		}
	}

	private async readResource(
		uri: URL,
		ctx: ServerContext,
		callback: (policy: Awaited<ReturnType<McpPolicyService['authorizeClient']>>, endpoint?: string) => Promise<unknown>,
	): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
		return this.runResourceOperation(
			`resource ${uri.href}`,
			async () => {
				const policy = await this.authorizeRead(ctx);
				const data = await callback(policy, this.getEndpoint(ctx.http?.authInfo));

				return {
					contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data) }],
				};
			},
			ctx,
		);
	}

	private async authorizeRead(ctx: ServerContext) {
		const authInfo = ctx.http?.authInfo;
		const tokenId = this.getExtraString(authInfo?.extra?.tokenId);

		if (!authInfo?.clientId || !tokenId) {
			throw new UnauthorizedException('MCP request identity is unavailable');
		}

		return this.policyService.authorizeClient(tokenId, authInfo.clientId, McpCapability.READ);
	}

	private getInstallationFallback(ctx: ServerContext): McpInstallationContext {
		const authInfo = ctx.http?.authInfo;
		const capabilities = (authInfo?.scopes ?? []).filter((scope): scope is McpCapability =>
			Object.values(McpCapability).includes(scope as McpCapability),
		);

		return {
			id: this.getExtraString(authInfo?.extra?.installationId) ?? 'unknown',
			name: 'FastyBird Smart Panel',
			version: 'unknown',
			timezone: 'UTC',
			endpoint: this.getEndpoint(authInfo) ?? null,
			effective_capabilities: capabilities,
		};
	}

	private withDeadline<T>(label: string, callback: () => Promise<T>): Promise<T> {
		return withTimeout(Promise.resolve().then(callback), MCP_TOOL_CALL_TIMEOUT_MS, `MCP ${label}`);
	}

	private async runResourceOperation<T>(label: string, callback: () => Promise<T>, ctx: ServerContext): Promise<T> {
		try {
			return await this.withDeadline(label, callback);
		} catch (error) {
			if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
				const authInfo = ctx.http?.authInfo;

				this.auditService.recordPolicyDenial(
					{
						requestId: String(ctx.mcpReq.id),
						...(authInfo?.clientId ? { clientId: authInfo.clientId } : {}),
					},
					'capability_denied',
					{ capability: McpCapability.READ },
				);
			}

			throw new Error(this.sanitizeError(error).message, { cause: error });
		}
	}

	private sanitizeError(error: unknown): { code: string; message: string } {
		if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
			return { code: 'permission_denied', message: 'The MCP client is not authorized for this read operation.' };
		}

		if (error instanceof WeatherNotFoundException || (error instanceof HttpException && error.getStatus() === 404)) {
			return { code: 'not_found', message: 'The requested Smart Panel item was not found.' };
		}

		if (error instanceof HttpException && error.getStatus() === 400) {
			return { code: 'invalid_request', message: error.message };
		}

		return { code: 'read_failed', message: 'Smart Panel could not complete the requested read operation.' };
	}

	private getAuditOutcome(error: unknown): McpAuditOutcome {
		if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
			return McpAuditOutcome.DENIED;
		}

		if (error instanceof Error && /timeout after \d+ms$/i.test(error.message)) {
			return McpAuditOutcome.TIMED_OUT;
		}

		return McpAuditOutcome.FAILED;
	}

	private getEndpoint(authInfo?: AuthInfo): string | undefined {
		return this.getExtraString(authInfo?.extra?.endpoint);
	}

	private getExtraString(value: unknown): string | undefined {
		return typeof value === 'string' && value.length > 0 ? value : undefined;
	}
}
