import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
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
		config = Object.assign(new McpConfigModel(), {
			enabled: true,
			capabilities: [McpCapability.READ, McpCapability.WRITE],
			allowedOrigins: [],
		});
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
		listener.onApplicationBootstrap();
	});

	it('ignores configuration changes outside the MCP module', () => {
		listener.onConfigUpdated({ source: 'devices-module', type: 'module' });
		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'plugin' });

		expect(serverService.closeAll).not.toHaveBeenCalled();
		expect(serverService.notifyToolsChanged).not.toHaveBeenCalled();
		expect(serverService.invalidatePolicies).not.toHaveBeenCalled();
	});

	it('publishes list changes before closing all active streams when the MCP module is disabled', () => {
		const order: string[] = [];
		serverService.invalidatePolicies.mockImplementation(() => order.push('invalidate'));
		serverService.notifyToolsChanged.mockImplementation(() => order.push('tools'));
		serverService.notifyResourcesChanged.mockImplementation(() => order.push('resources'));
		serverService.closeAll.mockImplementation(() => {
			order.push('close');
			return Promise.resolve();
		});
		config.enabled = false;

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(order).toEqual(['invalidate', 'tools', 'resources', 'close']);
		expect(serverService.closeAll).toHaveBeenCalledTimes(1);
	});

	it('notifies only the tool list when non-read capabilities change', () => {
		config.capabilities = [McpCapability.READ];

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.notifyToolsChanged).toHaveBeenCalledTimes(1);
		expect(serverService.notifyResourcesChanged).not.toHaveBeenCalled();
		expect(serverService.invalidatePolicies).toHaveBeenCalledTimes(1);
		expect(serverService.closeAll).not.toHaveBeenCalled();
	});

	it('notifies tool and resource lists when read capability is removed', () => {
		config.capabilities = [McpCapability.WRITE];

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.notifyToolsChanged).toHaveBeenCalledTimes(1);
		expect(serverService.notifyResourcesChanged).toHaveBeenCalledTimes(1);
		expect(serverService.invalidatePolicies).toHaveBeenCalledTimes(1);
	});

	it('invalidates policy without list notifications when only allowed origins change', () => {
		config.allowedOrigins = ['https://agent.example.com'];

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.invalidatePolicies).toHaveBeenCalledTimes(1);
		expect(serverService.notifyToolsChanged).not.toHaveBeenCalled();
		expect(serverService.notifyResourcesChanged).not.toHaveBeenCalled();
		expect(serverService.closeAll).not.toHaveBeenCalled();
	});

	it('publishes the newly available lists when the module is enabled', () => {
		config.enabled = false;
		listener.onApplicationBootstrap();
		jest.clearAllMocks();
		config.enabled = true;

		listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' });

		expect(serverService.notifyToolsChanged).toHaveBeenCalledTimes(1);
		expect(serverService.notifyResourcesChanged).toHaveBeenCalledTimes(1);
		expect(serverService.closeAll).not.toHaveBeenCalled();
	});

	it('still closes streams when a best-effort notification fails', () => {
		serverService.notifyToolsChanged.mockImplementation(() => {
			throw new Error('Notification failed');
		});
		config.enabled = false;

		expect(() => listener.onConfigUpdated({ source: MCP_MODULE_NAME, type: 'module' })).not.toThrow();

		expect(serverService.notifyResourcesChanged).toHaveBeenCalledTimes(1);
		expect(serverService.closeAll).toHaveBeenCalledTimes(1);
	});

	it('publishes list changes and closes all active streams when configuration is reset', () => {
		listener.onConfigReset();

		expect(serverService.notifyToolsChanged).toHaveBeenCalledTimes(1);
		expect(serverService.notifyResourcesChanged).toHaveBeenCalledTimes(1);
		expect(serverService.closeAll).toHaveBeenCalledTimes(1);
	});
});
