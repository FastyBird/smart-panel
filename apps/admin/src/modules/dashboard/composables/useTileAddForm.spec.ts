import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';
import { TileAddFormSchema } from '../schemas/tiles.schemas';

import { useTileAddForm } from './useTileAddForm';

const TestTileAddFormSchema = TileAddFormSchema.extend({
	value: z.string(),
});

type ITestTileAddForm = z.infer<typeof TestTileAddFormSchema>;

const mockAdd = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({
				add: mockAdd,
			}),
		}),
		useFlashMessage: () => ({
			success: vi.fn(),
			error: vi.fn(),
		}),
	};
});

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
					tileAddFormSchema: TestTileAddFormSchema,
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

describe('useTileAddForm', () => {
	let form: ReturnType<typeof useTileAddForm<ITestTileAddForm>>;

	const tileId = uuid().toString();

	beforeEach(() => {
		form = useTileAddForm<ITestTileAddForm>({ id: tileId, type: 'test-type', parent: 'page', parentId: 'page-id' });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('should initialize with default values', () => {
		expect(form.model.id).toBe(tileId);
		expect(form.model.type).toBe('test-type');
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.value = 'Some value';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		form.model.value = 'Some value';

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: tileId,
			draft: false,
			parent: {
				id: 'page-id',
				type: 'page',
			},
			data: {
				id: tileId,
				type: 'test-type',
				row: 1,
				col: 1,
				rowSpan: 1,
				colSpan: 1,
				hidden: false,
				value: 'Some value',
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
