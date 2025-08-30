import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { TileSchema } from '../store/tiles.store.schemas';

import { useTilesPlugin } from './useTilesPlugin';

const tileSchema = TileSchema;

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
					tileSchema,
				},
			},
		],
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./useTilesPlugins', () => ({
	useTilesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useTilesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useTilesPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined plugin for unknown type', () => {
		const { plugin } = useTilesPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = useTilesPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = useTilesPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
