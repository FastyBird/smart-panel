import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { ChannelPropertySchema } from '../store/channels.properties.store.schemas';

import { useChannelPropertyAddForm } from './useChannelPropertyAddForm';

const mockAdd = vi.fn();

vi.mock('./useChannels', () => ({
	useChannels: () => ({
		channels: {
			value: [{ id: 'channel-1', name: 'Channel 1', category: DevicesModuleChannelCategory.light }],
		},
		fetchChannels: vi.fn().mockResolvedValue(undefined),
		areLoading: { value: false },
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findForChannel: () => [],
			add: mockAdd,
		}),
	}),
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
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

describe('useChannelPropertyAddForm', () => {
	let form: ReturnType<typeof useChannelPropertyAddForm>;

	const propertyId = uuid().toString();
	const channelId = uuid().toString();

	beforeEach(() => {
		form = useChannelPropertyAddForm({ id: propertyId.toString(), type: 'test-plugin', channelId: channelId.toString() });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('initializes the form with provided id and channelId', () => {
		expect(form.model.id).toBe(propertyId.toString());
		expect(form.model.type).toBe('test-plugin');
		expect(form.model.channel).toBe(channelId.toString());
		expect(form.formResult.value).toBe(FormResult.NONE);
		expect(form.formChanged.value).toBe(false);
	});

	it('should mark form as changed when model updates', async () => {
		expect(form.formChanged.value).toBe(false);

		form.model.name = 'New Device';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('should submit and call store add method', async () => {
		form.model.name = 'name';
		form.model.category = DevicesModuleChannelPropertyCategory.generic;

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: propertyId.toString(),
			channelId: channelId.toString(),
			draft: false,
			data: {
				type: 'test-plugin',
				id: propertyId.toString(),
				channel: channelId.toString(),
				category: DevicesModuleChannelPropertyCategory.generic,
				name: 'name',
				dataType: 'unknown',
				format: null,
				invalid: null,
				permissions: [],
				step: null,
				unit: null,
				enumValues: [],
				maxValue: undefined,
				minValue: undefined,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
