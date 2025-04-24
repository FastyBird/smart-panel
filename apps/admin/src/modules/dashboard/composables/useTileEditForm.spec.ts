import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';
import { DashboardValidationException } from '../dashboard.exceptions';
import { TileEditFormSchema } from '../schemas/tiles.schemas';
import { TileSchema } from '../store/tiles.store.schemas';

import { useTileEditForm } from './useTileEditForm';

const TestTileSchema = TileSchema.extend({
	value: z.string(),
});

type ITestTileSchema = z.infer<typeof TestTileSchema>;

const TestTileEditFormSchema = TileEditFormSchema.extend({
	value: z.string(),
});

type ITestTileEditForm = z.infer<typeof TestTileEditFormSchema>;

const mockTile: ITestTileSchema = {
	id: uuid().toString(),
	type: 'test-plugin',
	row: 1,
	col: 1,
	rowSpan: 1,
	colSpan: 1,
	hidden: false,
	value: 'test-value',
	draft: true,
} as ITestTileSchema;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			edit: mockEdit,
			save: mockSave,
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
		info: mockInfo,
	}),
}));

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
		schemas: {
			tileSchema: TestTileSchema,
			tileEditFormSchema: TestTileEditFormSchema,
		},
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./useTilesPlugins', () => ({
	useTilesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useTileEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with tile data', () => {
		const form = useTileEditForm<ITestTileEditForm>({ tile: mockTile });

		expect(form.model.id).toBe(mockTile.id);
		expect(form.model.value).toBe(mockTile.value);
	});

	it('sets formChanged to true if field is edited', async () => {
		const form = useTileEditForm<ITestTileEditForm>({ tile: mockTile });

		form.model.value = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = useTileEditForm<ITestTileEditForm>({ tile: mockTile });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DashboardValidationException);
	});

	it('submits and saves if tile is a draft', async () => {
		const form = useTileEditForm<ITestTileEditForm>({ tile: mockTile });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			id: mockTile.id,
			data: {
				id: mockTile.id,
				type: 'test-plugin',
				row: 1,
				col: 1,
				rowSpan: 1,
				colSpan: 1,
				hidden: false,
				value: mockTile.value,
			},
		});
		expect(mockSave).toHaveBeenCalledWith({ id: mockTile.id });
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if tile is not a draft', async () => {
		const tile = { ...mockTile, draft: false };
		const form = useTileEditForm<ITestTileEditForm>({ tile });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
