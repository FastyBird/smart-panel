import { Repository } from 'typeorm';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { ModuleConfigCommit } from '../../config/services/module-config-mutation-registry.service';
import { UpdateMcpConfigDto } from '../dto/update-config.dto';
import { McpOAuthServerStateEntity } from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, MCP_OAUTH_SERVER_STATE_KEY, McpCapability } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { toMcpOAuthScope } from '../oauth/mcp-oauth-scope.utils';

import { McpAuditOutcome, McpAuditService, McpOAuthInvalidationReason } from './mcp-audit.service';
import { McpOAuthGlobalGeneration, McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

@Injectable()
export class McpOAuthModuleConfigMutationService {
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(McpOAuthServerStateEntity)
		private readonly serverState: Repository<McpOAuthServerStateEntity>,
		private readonly subscriptions: McpSubscriptionRegistryService,
		private readonly globalInvalidation: McpOAuthGlobalInvalidationService,
		private readonly auditService: McpAuditService,
	) {}

	async update(update: UpdateMcpConfigDto, commit: ModuleConfigCommit): Promise<void> {
		const current = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME);
		const nextEnabled = update.enabled ?? current.enabled;
		const moduleDisabled = current.enabled && !nextEnabled;
		const moduleEnabled = !current.enabled && nextEnabled;
		const nextCapabilities = update.capabilities ?? current.capabilities;
		const capabilitiesChanged = !this.sameCapabilities(current.capabilities, nextCapabilities);
		const nextPublicBaseUrl =
			update.oauth_public_base_url === undefined ? current.oauthPublicBaseUrl : update.oauth_public_base_url;
		const publicIdentityChanged = current.oauthPublicBaseUrl !== nextPublicBaseUrl;

		if (moduleDisabled) {
			const generations: McpOAuthGlobalGeneration[] = [
				'oauthEnabledGeneration',
				...(publicIdentityChanged ? (['publicIdentityGeneration'] as const) : []),
				...(capabilitiesChanged ? (['modulePolicyGeneration'] as const) : []),
			];

			await this.runGlobalInvalidation(
				generations,
				[
					'module_disabled',
					...(publicIdentityChanged ? (['public_identity_changed'] as const) : []),
					...(capabilitiesChanged ? (['module_policy_changed'] as const) : []),
				],
				'all',
				commit,
			);
			return;
		}

		if (moduleEnabled) {
			const generations: McpOAuthGlobalGeneration[] = [
				'oauthEnabledGeneration',
				...(publicIdentityChanged ? (['publicIdentityGeneration'] as const) : []),
				...(capabilitiesChanged ? (['modulePolicyGeneration'] as const) : []),
			];

			await this.runGlobalInvalidation(
				generations,
				[
					'module_enabled_reconciliation',
					...(publicIdentityChanged ? (['public_identity_changed'] as const) : []),
					...(capabilitiesChanged ? (['module_policy_changed'] as const) : []),
				],
				'oauth',
				commit,
			);
			return;
		}

		if (publicIdentityChanged) {
			const generations: McpOAuthGlobalGeneration[] = [
				'publicIdentityGeneration',
				...(capabilitiesChanged ? (['modulePolicyGeneration'] as const) : []),
			];

			await this.runGlobalInvalidation(
				generations,
				['public_identity_changed', ...(capabilitiesChanged ? (['module_policy_changed'] as const) : [])],
				'oauth',
				commit,
			);
			return;
		}

		if (!capabilitiesChanged) {
			await commit();
			return;
		}

		let commitError: unknown;
		let commitFailed = false;

		await this.subscriptions.closeOAuthScopeContractions(nextCapabilities.map(toMcpOAuthScope), async () => {
			const result = await this.serverState.increment({ key: MCP_OAUTH_SERVER_STATE_KEY }, 'modulePolicyGeneration', 1);

			if (result.affected !== 1) {
				throw new ServiceUnavailableException('MCP OAuth module policy state is unavailable');
			}

			try {
				await commit();
			} catch (error) {
				this.configService.reload();
				commitFailed = true;
				commitError = error;
			}
		});

		this.auditService.recordOAuthAuthorizationInvalidation({
			reasons: ['module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: commitFailed ? McpAuditOutcome.PARTIAL : McpAuditOutcome.COMPLETED,
		});

		if (commitFailed) throw commitError;
	}

	private async runGlobalInvalidation(
		generations: McpOAuthGlobalGeneration[],
		reasons: McpOAuthInvalidationReason[],
		authorizationProfile: 'all' | 'oauth',
		commit: ModuleConfigCommit,
	): Promise<void> {
		let commitFailed = false;
		const persist = async (): Promise<void> => {
			try {
				await commit();
			} catch (error) {
				commitFailed = true;
				this.configService.reload();
				throw error;
			}
		};

		try {
			if (authorizationProfile === 'all') {
				await this.globalInvalidation.invalidateAll(generations, persist);
			} else {
				await this.globalInvalidation.invalidate(generations, persist);
			}
		} catch (error) {
			if (commitFailed) {
				this.auditService.recordOAuthAuthorizationInvalidation({
					reasons,
					authorizationProfile,
					outcome: McpAuditOutcome.PARTIAL,
				});
			}

			throw error;
		}

		this.auditService.recordOAuthAuthorizationInvalidation({
			reasons,
			authorizationProfile,
			outcome: McpAuditOutcome.COMPLETED,
		});
	}

	private sameCapabilities(first: McpCapability[], second: McpCapability[]): boolean {
		return first.length === second.length && first.every((capability) => second.includes(capability));
	}
}
