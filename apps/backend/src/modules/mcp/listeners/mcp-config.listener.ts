import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpServerService } from '../services/mcp-server.service';

interface ConfigUpdatedEvent {
	source: string;
	type: 'module' | 'plugin';
}

@Injectable()
export class McpConfigListener {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpConfigListener');

	constructor(
		private readonly configService: ConfigService,
		private readonly serverService: McpServerService,
	) {}

	@OnEvent(EventType.CONFIG_UPDATED)
	onConfigUpdated(event: ConfigUpdatedEvent): void {
		if (event.type !== 'module' || event.source !== MCP_MODULE_NAME) {
			return;
		}

		const config = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME);

		if (!config.enabled) {
			this.closeAllStreams('module disable');

			return;
		}

		this.serverService.invalidatePolicies();
		this.serverService.notifyToolsChanged();
		this.serverService.notifyResourcesChanged();
	}

	@OnEvent(EventType.CONFIG_RESET)
	onConfigReset(): void {
		this.closeAllStreams('configuration reset');
	}

	private closeAllStreams(reason: string): void {
		void this.serverService.closeAll().catch((error: unknown) => {
			const err = error instanceof Error ? error : new Error('Unknown MCP handler shutdown error');
			this.logger.error(`Failed to close MCP streams after ${reason}`, {
				message: err.message,
				stack: err.stack,
			});
		});
	}
}
