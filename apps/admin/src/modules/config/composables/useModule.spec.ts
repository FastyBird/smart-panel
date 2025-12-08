import { describe, expect, it, vi } from 'vitest';

import { CONFIG_MODULE_NAME, CONFIG_MODULE_MODULE_TYPE } from '../config.constants';

import { useModule } from './useModule';

const mockModuleList = [
	{
		type: 'test-module',
		name: 'Test Module',
		description: 'Description',
		elements: [
			{
				type: CONFIG_MODULE_MODULE_TYPE,
			},
		],
		modules: [CONFIG_MODULE_NAME],
	},
];

vi.mock('./useModules', () => ({
	useModules: () => ({
		getByName: (name: string) => mockModuleList.find((m) => m.type === name),
	}),
}));

describe('useModule', () => {
	it('returns module by name', () => {
		const { module } = useModule({ name: 'test-module' });
		expect(module.value?.name).toBe('Test Module');
	});

	it('returns undefined for unknown name', () => {
		const { module } = useModule({ name: 'unknown-module' });
		expect(module.value).toBeUndefined();
	});

	it('returns element for module with config element', () => {
		const { element } = useModule({ name: 'test-module' });
		expect(element.value?.type).toBe(CONFIG_MODULE_MODULE_TYPE);
	});

	it('returns undefined element for unknown module', () => {
		const { element } = useModule({ name: 'unknown-module' });
		expect(element.value).toBeUndefined();
	});
});

