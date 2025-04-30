import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyData_type } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { ChannelPropertySchema } from '../store/channels.properties.store.schemas';
import type { IChannelProperty } from '../store/channels.properties.store.types';

import { useChannelPropertyEditForm } from './useChannelPropertyEditForm';

const channelId = uuid().toString();
const propertyId = uuid().toString();

const mockProperty: IChannelProperty = {
	id: propertyId.toString(),
	type: 'test-plugin',
	channel: channelId.toString(),
	name: 'My Property',
	category: DevicesModuleChannelPropertyCategory.brightness,
	dataType: DevicesModuleChannelPropertyData_type.float,
	permissions: [],
	unit: '',
	format: [],
	invalid: '',
	step: null,
	draft: true,
	value: null,
	createdAt: new Date(),
	updatedAt: null,
} as IChannelProperty;

const mockEdit = vi.fn();
const mockSave = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();

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
			findForChannel: () => [],
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

vi.mock('./useChannels', () => ({
	useChannels: () => ({
		channels: {
			value: [{ id: channelId.toString(), category: 'light', name: 'Channel A' }],
		},
		fetchChannels: vi.fn().mockResolvedValue(undefined),
		areLoading: false,
	}),
}));

const channelPropertySchema = ChannelPropertySchema;

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
			channelPropertySchema,
		},
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useChannelsPropertiesPlugins', () => ({
	useChannelsPropertiesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useChannelPropertyEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model from property', () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		expect(form.model.id).toBe(mockProperty.id);
		expect(form.model.channel).toBe(mockProperty.channel);
		expect(form.model.name).toBe(mockProperty.name);
	});

	it('detects form changes', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		form.model.name = 'Changed';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws on invalid form', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DevicesValidationException);
	});

	it('submits and saves when draft', async () => {
		const form = useChannelPropertyEditForm({ property: mockProperty });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
		expect(mockSuccess).toHaveBeenCalled();
	});

	it('submits and edits when not draft', async () => {
		const form = useChannelPropertyEditForm({ property: { ...mockProperty, draft: false } });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
		expect(mockSuccess).toHaveBeenCalled();
	});
});
