import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME, FormResult } from '../dashboard.constants';
import { DashboardValidationException } from '../dashboard.exceptions';
import type { IPage } from '../store/pages.store.types';

import { usePageEditForm } from './usePageEditForm';

const mockPage: IPage = {
	id: 'page-1',
	type: 'test-plugin',
	title: 'Test Page',
	order: 99,
	draft: true,
} as IPage;

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
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./usePagesPlugins', () => ({
	usePagesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('usePageEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with page data', () => {
		const form = usePageEditForm({ page: mockPage });

		expect(form.model.id).toBe(mockPage.id);
		expect(form.model.title).toBe(mockPage.title);
		expect(form.model.order).toBe(mockPage.order);
	});

	it('sets formChanged to true if name or description is edited', async () => {
		const form = usePageEditForm({ page: mockPage });

		form.model.title = 'Updated';
		await Promise.resolve();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws validation error if form is invalid', async () => {
		const form = usePageEditForm({ page: mockPage });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DashboardValidationException);
	});

	it('submits and saves if page is a draft', async () => {
		const form = usePageEditForm({ page: mockPage });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalledWith({
			id: mockPage.id,
			data: {
				type: 'test-plugin',
				title: mockPage.title,
				icon: null,
				order: mockPage.order,
			},
		});
		expect(mockSave).toHaveBeenCalledWith({ id: mockPage.id });
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if page is not a draft', async () => {
		const page = { ...mockPage, draft: false };
		const form = usePageEditForm({ page });

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
