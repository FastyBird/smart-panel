import { isAutomationNodeTypeOffered, isAutomationNodeTypeOwnerEnabled } from './node-type-owner.utils';

describe('node type owner', () => {
	const configService = {
		getModuleConfig: jest.fn((type: string) => ({ type, enabled: type === 'enabled-module' })),
		getPluginConfig: jest.fn((type: string) => {
			if (type === 'missing-plugin') throw new Error('Configuration for plugin missing-plugin not found');

			return { type, enabled: type === 'enabled-plugin' };
		}),
	};

	it('tells whether the module or plugin is enabled', () => {
		expect(isAutomationNodeTypeOwnerEnabled(configService as never, { kind: 'module', type: 'enabled-module' })).toBe(
			true,
		);
		expect(isAutomationNodeTypeOwnerEnabled(configService as never, { kind: 'module', type: 'other-module' })).toBe(
			false,
		);
		expect(isAutomationNodeTypeOwnerEnabled(configService as never, { kind: 'plugin', type: 'enabled-plugin' })).toBe(
			true,
		);
		expect(isAutomationNodeTypeOwnerEnabled(configService as never, { kind: 'plugin', type: 'other-plugin' })).toBe(
			false,
		);
	});

	it('takes an owner without a configuration as not enabled', () => {
		expect(isAutomationNodeTypeOwnerEnabled(configService as never, { kind: 'plugin', type: 'missing-plugin' })).toBe(
			false,
		);
	});

	it('always offers a node type of the automations module itself', () => {
		expect(isAutomationNodeTypeOffered(configService as never, {})).toBe(true);
		expect(
			isAutomationNodeTypeOffered(configService as never, { owner: { kind: 'plugin', type: 'other-plugin' } }),
		).toBe(false);
	});
});
