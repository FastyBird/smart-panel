import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { PageSchema } from '../store/pages.store.schemas';

import { usePagesPlugin } from './usePagesPlugin';

const pageSchema = PageSchema;

const mockPluginList = [
	{
		type: 'test-plugin',
		source: 'source',
		name: 'Test Plugin',
		description: 'Description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'test-type',
				schemas: {
					pageSchema,
				},
			},
		],
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./usePagesPlugins', () => ({
	usePagesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('usePagesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = usePagesPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined plugin for unknown type', () => {
		const { plugin } = usePagesPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = usePagesPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = usePagesPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
