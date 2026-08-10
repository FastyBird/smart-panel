import { EventEmitter } from 'node:events';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { OutgoingHttpHeader, OutgoingHttpHeaders } from 'node:http';
import type Provider from 'oidc-provider';
import { IsNull, Repository } from 'typeorm';

import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import { ConfigService } from '../../config/services/config.service';
import { MDNS_DEFAULT_SERVICE_NAME, MDNS_MODULE_NAME } from '../../mdns/mdns.constants';
import { MdnsConfigModel } from '../../mdns/models/config.model';
import { ApproveMcpOAuthInteractionDto } from '../dto/mcp-oauth-interaction.dto';
import { McpOAuthInteractionEntity } from '../entities/mcp-oauth.entity';
import { MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS, MCP_OAUTH_GRANT_LIFETIME_MS, McpOAuthScope } from '../mcp.constants';
import {
	McpOAuthInteractionAction,
	McpOAuthInteractionCompletionModel,
	McpOAuthInteractionModel,
} from '../models/mcp-oauth-interaction.model';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthApproverAuthorityService } from './mcp-oauth-approver-authority.service';
import { McpOAuthArtifactService } from './mcp-oauth-artifact.service';
import { McpOAuthClientService } from './mcp-oauth-client.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

const DAYS_TO_MILLISECONDS = 24 * 60 * 60 * 1_000;

class CapturedServerResponse extends EventEmitter {
	statusCode = 200;
	statusMessage = '';
	finished = false;
	writableEnded = false;
	writableFinished = false;
	destroyed = false;
	private readonly headers = new Map<string, OutgoingHttpHeader>();

	get headersSent(): boolean {
		return this.finished;
	}

	setHeader(name: string, value: OutgoingHttpHeader): this {
		this.headers.set(name.toLowerCase(), value);
		return this;
	}

	getHeader(name: string): OutgoingHttpHeader | undefined {
		return this.headers.get(name.toLowerCase());
	}

	getHeaders(): OutgoingHttpHeaders {
		return Object.fromEntries(this.headers);
	}

	getHeaderNames(): string[] {
		return [...this.headers.keys()];
	}

	hasHeader(name: string): boolean {
		return this.headers.has(name.toLowerCase());
	}

	removeHeader(name: string): void {
		this.headers.delete(name.toLowerCase());
	}

	writeHead(
		statusCode: number,
		statusMessageOrHeaders?: string | OutgoingHttpHeaders,
		headers?: OutgoingHttpHeaders,
	): this {
		this.statusCode = statusCode;

		if (typeof statusMessageOrHeaders === 'string') {
			this.statusMessage = statusMessageOrHeaders;
			this.applyHeaders(headers);
		} else {
			this.applyHeaders(statusMessageOrHeaders);
		}

		return this;
	}

	write(): boolean {
		return true;
	}

	end(): this {
		this.finished = true;
		this.writableEnded = true;
		this.writableFinished = true;
		this.emit('finish');
		return this;
	}

	private applyHeaders(headers?: OutgoingHttpHeaders): void {
		for (const [name, value] of Object.entries(headers ?? {})) {
			if (value !== undefined) this.setHeader(name, value);
		}
	}
}

@Injectable()
export class McpOAuthInteractionService {
	constructor(
		@InjectRepository(McpOAuthInteractionEntity)
		private readonly interactions: Repository<McpOAuthInteractionEntity>,
		private readonly runtimeService: McpOAuthRuntimeService,
		private readonly clientsService: McpOAuthClientService,
		private readonly artifactService: McpOAuthArtifactService,
		private readonly approverAuthority: McpOAuthApproverAuthorityService,
		private readonly installationService: McpInstallationService,
		private readonly configService: ConfigService,
	) {}

	async getInteraction(rawUid: string, userId: string, request: IncomingMessage): Promise<McpOAuthInteractionModel> {
		this.assertUid(rawUid);
		const { provider } = this.runtimeService.getActive();
		const details = await provider.interactionDetails(request, this.captureResponse());

		if (details.uid !== rawUid) {
			throw new ForbiddenException('OAuth interaction binding does not match the current browser');
		}

		const context = await this.resolveContext(details, rawUid, userId);

		if (details.prompt.name === 'login') {
			const completion = await this.finish(provider, request, {
				login: { accountId: userId, acr: 'smart-panel-session', amr: ['pwd'] },
			});
			const model = Object.assign(new McpOAuthInteractionModel(), {
				action: McpOAuthInteractionAction.REDIRECT,
				redirectTo: completion.redirectTo,
			});
			model.setCookies = completion.setCookies;

			return model;
		}

		if (details.prompt.name !== 'consent') {
			throw new BadRequestException(`Unsupported OAuth interaction prompt: ${details.prompt.name}`);
		}

		return Object.assign(new McpOAuthInteractionModel(), {
			action: McpOAuthInteractionAction.CONSENT,
			installationName: this.getInstallationName(),
			installationId: await this.installationService.getInstallationId(),
			clientIdentifier: context.client.clientIdentifier,
			clientName: context.client.name,
			redirectUri: context.redirectUri,
			requestedScopes: context.requestedScopes,
			accessExpiresInSeconds: Math.floor(MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS / 1_000),
			maximumGrantExpiresInDays: Math.floor(MCP_OAUTH_GRANT_LIFETIME_MS / DAYS_TO_MILLISECONDS),
			physicalDeviceWarning:
				context.requestedScopes.includes(McpOAuthScope.WRITE) ||
				context.requestedScopes.includes(McpOAuthScope.TRIGGER),
		});
	}

	async approve(
		rawUid: string,
		userId: string,
		dto: ApproveMcpOAuthInteractionDto,
		request: IncomingMessage,
	): Promise<McpOAuthInteractionCompletionModel> {
		this.assertUid(rawUid);
		const { provider, urls } = this.runtimeService.getActive();
		const details = await provider.interactionDetails(request, this.captureResponse());

		if (details.uid !== rawUid || details.prompt.name !== 'consent') {
			throw new ForbiddenException('OAuth consent interaction does not match the current browser');
		}

		const context = await this.resolveContext(details, rawUid, userId);
		this.assertApprovedScopes(dto.scopes, context.requestedScopes, context.client.maximumScopes);
		await this.consumeInteraction(context.interaction, userId);

		const providerGrant = new provider.Grant({ accountId: userId, clientId: context.client.clientIdentifier });
		const capabilityScopes = dto.scopes.filter((scope) => scope !== McpOAuthScope.OFFLINE_ACCESS);

		if (capabilityScopes.length > 0) {
			providerGrant.addResourceScope(urls.resource, capabilityScopes.join(' '));
		}
		if (dto.scopes.includes(McpOAuthScope.OFFLINE_ACCESS)) {
			providerGrant.addOIDCScope(McpOAuthScope.OFFLINE_ACCESS);
		}

		(providerGrant as unknown as { expiresIn: number }).expiresIn = dto.expiresInDays * 24 * 60 * 60;
		return this.approverAuthority.runAuthorized(userId, async (approverAuthorityGeneration) => {
			const savedGrantId = await providerGrant.save();
			await this.artifactService.createGrant({
				providerGrantId: savedGrantId,
				clientId: context.client.id,
				approvedById: userId,
				approvedScopes: dto.scopes,
				expiresAt: new Date(Date.now() + dto.expiresInDays * DAYS_TO_MILLISECONDS),
				approverAuthorityGeneration,
			});

			return this.finish(provider, request, { consent: { grantId: savedGrantId } }, true);
		});
	}

	async deny(rawUid: string, userId: string, request: IncomingMessage): Promise<McpOAuthInteractionCompletionModel> {
		this.assertUid(rawUid);
		const { provider } = this.runtimeService.getActive();
		const details = await provider.interactionDetails(request, this.captureResponse());

		if (details.uid !== rawUid) {
			throw new ForbiddenException('OAuth interaction binding does not match the current browser');
		}

		const context = await this.resolveContext(details, rawUid, userId);
		await this.consumeInteraction(context.interaction, userId);
		const completion = await this.finish(provider, request, {
			error: 'access_denied',
			error_description: 'The resource owner denied the request',
		});

		return completion;
	}

	private async resolveContext(details: Provider['Interaction']['prototype'], rawUid: string, userId: string) {
		const clientIdentifier = details.params.client_id;
		const redirectUri = details.params.redirect_uri;
		const scope = details.params.scope;

		if (typeof clientIdentifier !== 'string' || typeof redirectUri !== 'string' || typeof scope !== 'string') {
			throw new BadRequestException('OAuth interaction parameters are incomplete');
		}

		const client = await this.clientsService.findActiveByIdentifier(clientIdentifier);

		if (!client || !this.clientsService.isRedirectUriAllowed(client, redirectUri)) {
			throw new ForbiddenException('OAuth client or redirect URI is no longer authorized');
		}

		const requestedScopes = scope
			.split(' ')
			.filter((value): value is McpOAuthScope => Object.values(McpOAuthScope).includes(value as McpOAuthScope));

		if (requestedScopes.length !== scope.split(' ').filter(Boolean).length) {
			throw new BadRequestException('OAuth interaction contains an unsupported scope');
		}

		let interaction = await this.interactions.findOneBy({ uidHash: hashToken(rawUid) });

		if (!interaction) {
			try {
				interaction = await this.interactions.save(
					this.interactions.create({
						uidHash: hashToken(rawUid),
						clientId: client.id,
						authenticatedUserId: userId,
						redirectUri,
						requestedScopes,
						expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
						consumedAt: null,
					}),
				);
			} catch {
				interaction = await this.interactions.findOneBy({ uidHash: hashToken(rawUid) });
			}
		}

		if (!interaction || interaction.authenticatedUserId !== userId) {
			throw new ForbiddenException('OAuth interaction is bound to another authenticated account');
		}
		if (interaction.consumedAt || interaction.expiresAt <= new Date()) {
			throw new ConflictException('OAuth interaction is expired or already completed');
		}

		return { client, redirectUri, requestedScopes, interaction };
	}

	private assertApprovedScopes(approved: McpOAuthScope[], requested: McpOAuthScope[], maximum: McpOAuthScope[]): void {
		if (
			approved.length === 0 ||
			!approved.some((scope) => scope !== McpOAuthScope.OFFLINE_ACCESS) ||
			approved.some((scope) => !requested.includes(scope) || !maximum.includes(scope))
		) {
			throw new BadRequestException(
				'Approved scopes must be a capability-bearing subset of the request and client maximum',
			);
		}
	}

	private async consumeInteraction(interaction: McpOAuthInteractionEntity, userId: string): Promise<void> {
		const result = await this.interactions.update(
			{ id: interaction.id, authenticatedUserId: userId, consumedAt: IsNull() },
			{ consumedAt: new Date() },
		);

		if (!result.affected) {
			throw new ConflictException('OAuth interaction was completed by another request');
		}
	}

	private async finish(
		provider: Provider,
		request: IncomingMessage,
		result: Parameters<Provider['interactionFinished']>[2],
		mergeWithLastSubmission = false,
	): Promise<McpOAuthInteractionCompletionModel> {
		const response = new CapturedServerResponse();

		await provider.interactionFinished(request, response as unknown as ServerResponse, result, {
			mergeWithLastSubmission,
		});
		const location = response.getHeader('location');

		if (typeof location !== 'string') {
			throw new BadRequestException('OAuth interaction did not produce a safe redirect');
		}

		const completion = new McpOAuthInteractionCompletionModel();
		completion.redirectTo = location;
		const setCookie = response.getHeader('set-cookie');
		completion.setCookies = Array.isArray(setCookie)
			? setCookie.map(String)
			: setCookie === undefined
				? []
				: [String(setCookie)];

		return completion;
	}

	private captureResponse(): ServerResponse {
		return new CapturedServerResponse() as unknown as ServerResponse;
	}

	private getInstallationName(): string {
		try {
			return this.configService.getModuleConfig<MdnsConfigModel>(MDNS_MODULE_NAME).serviceName;
		} catch {
			return MDNS_DEFAULT_SERVICE_NAME;
		}
	}

	private assertUid(rawUid: string): void {
		if (!/^[A-Za-z0-9_-]{20,200}$/.test(rawUid)) {
			throw new BadRequestException('Invalid OAuth interaction identifier');
		}
	}
}
