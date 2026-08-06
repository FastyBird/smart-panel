import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpServerService } from '../services/mcp-server.service';

import { McpConfigListener } from './mcp-config.listener';

describe('McpConfigListener', () => {
	let config: McpConfigModel;
	let serverService: {
		closeAll: jest.Mock;
		invalidatePolicies: jest.Mock;
		notifyResourcesChanged: jest.Mock;
		notifyToolsChanged: jest.Mock;
	};
	let listener: McpConfigListener;

	beforeEach(() => {
		config = Object.assign(new McpConfigModel(), { enabled: true });
		serverService = {
			closeAll: jest.fn().mockResolvedValue(undefined),
			invalidatePolicies: jest.fn(),
			notifyResourcesChanged: jest.fn(),
			notifyToolsChanged: jest.fn(),
		};
		listener = new McpConfigListener(
			{ getModuleConfig: jest.fn(() => config) } as unknown as ConfigService,
			serverService as unknown as McpServerService,
		);
	});

	it('ignores configuration changes outside the MCP module', () => {
		listener.onConfigUpdated({ source: 'devices-module', type: 'module' });
		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'plugin' });

		expect(serverService.closeAll).not.toHaveBeenCalled();
		expect(serverService.notifyToolsChanged).not.toHaveBeenCalled();
	});

	it('closes all active streams when the MCP module is disabled', () => {
		config.enabled = false;

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.closeAll).toHaveBeenCalledTimes(1);
		expect(serverService.notifyToolsChanged).not.toHaveBeenCalled();
	});

	it('notifies active clients when enabled policy changes', () => {
		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.notifyToolsChanged).toHaveBeenCalledTimes(1);
		expect(serverService.notifyResourcesChanged).toHaveBeenCalledTimes(1);
		expect(serverService.invalidatePolicies).toHaveBeenCalledTimes(1);
		expect(serverService.closeAll).not.toHaveBeenCalled();
	});

	it('closes all active streams when configuration is reset', () => {
		listener.onConfigReset();

		expect(serverService.closeAll).toHaveBeenCalledTimes(1);
		expect(serverService.notifyToolsChanged).not.toHaveBeenCalled();
	});
});
