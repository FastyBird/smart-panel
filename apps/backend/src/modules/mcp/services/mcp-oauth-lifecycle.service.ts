import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

export type McpOAuthLifecycleMutation = () => Promise<void> | void;

@Injectable()
export class McpOAuthLifecycleService implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpOAuthLifecycleService');

	constructor(
		private readonly configService: ConfigService,
		private readonly readiness: McpOAuthReadinessService,
		private readonly routeGate: McpOAuthRouteGateService,
		private readonly runtime: McpOAuthRuntimeService,
	) {}

	async onApplicationBootstrap(): Promise<void> {
		const config = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME);

		if (!config.enabled || !config.oauthEnabled) {
			this.routeGate.closeInternal();
			this.runtime.deactivateInternal();
			return;
		}

		try {
			await this.activateInternal();
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown MCP OAuth startup activation error');
			this.logger.error('MCP OAuth startup activation failed; the OAuth route gate remains closed', {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	@OnEvent(EventType.CONFIG_RESET)
	onConfigReset(): void {
		this.routeGate.closeInternal();
		this.runtime.deactivateInternal();
	}

	async activateInternal(): Promise<void> {
		this.routeGate.closeInternal();
		this.readiness.assertReady();
		this.runtime.allowActivationInternal();

		try {
			await this.runtime.activateInternal();
			this.readiness.assertReady();
			this.routeGate.openInternal();
		} catch (error) {
			this.routeGate.closeInternal();
			this.runtime.deactivateInternal();
			throw error;
		}
	}

	async reconfigureInternal(mutation: McpOAuthLifecycleMutation): Promise<void> {
		this.routeGate.closeInternal();
		this.runtime.deactivateInternal();

		await mutation();
		await this.activateInternal();
	}
}
