import { AutomationNodeTypeRegistryService } from '../services/node-type-registry.service';

import { AutomationNodeTypesController } from './node-types.controller';

describe('AutomationNodeTypesController', () => {
	let pluginEnabled: boolean;

	const configService = {
		getModuleConfig: jest.fn(() => ({ enabled: true })),
		getPluginConfig: jest.fn(() => ({ enabled: pluginEnabled })),
	};

	const registry = new AutomationNodeTypeRegistryService();

	registry.register({
		type: 'module.trigger',
		kind: 'trigger',
		name: 'Module',
		description: '',
		validateConfig: () => [],
	});
	registry.register({
		type: 'plugin.trigger',
		kind: 'trigger',
		name: 'Plugin',
		description: '',
		validateConfig: () => [],
		owner: { kind: 'plugin', type: 'test-plugin' },
	});

	const controller = new AutomationNodeTypesController(registry, configService as never);

	beforeEach(() => {
		pluginEnabled = true;
	});

	it('lists the node types of an enabled plugin', () => {
		expect(controller.findAll().data.map((nodeType) => nodeType.type)).toEqual(['module.trigger', 'plugin.trigger']);
	});

	it('leaves out the node types of a disabled plugin, which stay registered', () => {
		pluginEnabled = false;

		expect(controller.findAll().data.map((nodeType) => nodeType.type)).toEqual(['module.trigger']);
		expect(registry.has('plugin.trigger')).toBe(true);
	});
});
