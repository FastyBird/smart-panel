import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpServerService } from '../services/mcp-server.service';

interface ConfigUpdatedEvent {
	source: string;
	type: 'module' | 'plugin';
}

interface McpConfigSnapshot {
	enabled: boolean;
	capabilities: McpCapability[];
}

@Injectable()
export class McpConfigListener implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpConfigListener');
	private previousConfig?: McpConfigSnapshot;

	constructor(
		private readonly configService: ConfigService,
		private readonly serverService: McpServerService,
	) {}

	onApplicationBootstrap(): void {
		this.previousConfig = this.snapshot(this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME));
	}

	@OnEvent(EventType.CONFIG_UPDATED)
	onConfigUpdated(event: ConfigUpdatedEvent): void {
		if (event.type !== 'module' || event.source !== MCP_MODULE_NAME) {
			return;
		}

		const previous = this.previousConfig;
		const current = this.snapshot(this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME));
		this.previousConfig = current;

		const capabilitiesChanged = !previous || !this.sameCapabilities(previous.capabilities, current.capabilities);
		const toolsChanged = !previous || previous.enabled !== current.enabled || (current.enabled && capabilitiesChanged);
		const resourcesChanged =
			!previous ||
			(previous.enabled && previous.capabilities.includes(McpCapability.READ)) !==
				(current.enabled && current.capabilities.includes(McpCapability.READ));

		this.serverService.invalidatePolicies();

		if (toolsChanged) {
			this.notifyBestEffort('tool-list change', () => this.serverService.notifyToolsChanged());
		}

		if (resourcesChanged) {
			this.notifyBestEffort('resource-list change', () => this.serverService.notifyResourcesChanged());
		}

		if (!current.enabled) {
			this.closeAllStreams('module disable');
		}
	}

	@OnEvent(EventType.CONFIG_RESET)
	onConfigReset(): void {
		this.previousConfig = undefined;
		this.notifyBestEffort('tool-list change before configuration reset', () => this.serverService.notifyToolsChanged());
		this.notifyBestEffort('resource-list change before configuration reset', () =>
			this.serverService.notifyResourcesChanged(),
		);
		this.closeAllStreams('configuration reset');
	}

	private snapshot(config: McpConfigModel): McpConfigSnapshot {
		return { enabled: config.enabled, capabilities: [...config.capabilities] };
	}

	private sameCapabilities(first: McpCapability[], second: McpCapability[]): boolean {
		return first.length === second.length && first.every((capability) => second.includes(capability));
	}

	private notifyBestEffort(reason: string, callback: () => void): void {
		try {
			callback();
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown MCP notification error');
			this.logger.error(`Failed to publish MCP ${reason}`, {
				message: err.message,
				stack: err.stack,
			});
		}
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
