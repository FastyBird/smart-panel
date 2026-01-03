import { describe, expect, it, vi } from 'vitest';

import { CONFIG_MODULE_NAME } from '../config.constants';

import { useModules } from './useModules';

import { CONFIG_MODULE_MODULE_TYPE } from '../config.constants';

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
	{
		type: 'unrelated-module',
		name: 'Unrelated Module',
		description: 'Desc2',
		elements: [
			{
				type: 'another-type',
			},
		],
		modules: ['other-module'],
	},
];

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectModulesManager: () => ({
			getModules: () => mockModuleList,
		}),
	};
});

describe('useModules', () => {
	it('returns only modules related to config module', () => {
		const { modules } = useModules();
		expect(modules.value.length).toBe(1);
		expect(modules.value[0]?.type).toBe('test-module');
	});

	it('returns correct options list', () => {
		const { options } = useModules();
		expect(options.value).toEqual([
			{
				value: 'test-module',
				label: 'Test Module',
			},
		]);
	});

	it('getByName returns correct module', () => {
		const { getByName } = useModules();
		const module = getByName('test-module');
		expect(module?.name).toBe('Test Module');
	});

	it('getByName returns undefined for unknown module', () => {
		const { getByName } = useModules();
		const module = getByName('nonexistent');
		expect(module).toBeUndefined();
	});

	it('getElement returns correct element', () => {
		const { getElement } = useModules();
		const element = getElement('test-module');
		expect(element?.type).toBe(CONFIG_MODULE_MODULE_TYPE);
	});

	it('getElement returns undefined for module without config element', () => {
		const { getElement } = useModules();
		const element = getElement('unrelated-module');
		expect(element).toBeUndefined();
	});
});

