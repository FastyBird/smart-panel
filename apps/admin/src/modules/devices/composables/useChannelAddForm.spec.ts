import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { ChannelSchema } from '../store/channels.store.schemas';

import { useChannelAddForm } from './useChannelAddForm';

const mockAdd = vi.fn();

vi.mock('./useDevices', () => ({
	useDevices: () => ({
		devices: {
			value: [{ id: 'device-1', name: 'Device 1', category: DevicesModuleChannelCategory.light }],
		},
		fetchDevices: vi.fn().mockResolvedValue(undefined),
		areLoading: { value: false },
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findForDevice: () => [],
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

const channelSchema = ChannelSchema;

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
					channelSchema,
				},
			},
		],
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useChannelsPlugins', () => ({
	useChannelsPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useChannelAddForm', () => {
	let form: ReturnType<typeof useChannelAddForm>;

	const channelId = uuid().toString();
	const deviceId = uuid().toString();

	beforeEach(() => {
		form = useChannelAddForm({ id: channelId.toString(), type: 'test-type', deviceId: deviceId.toString() });
		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;
	});

	it('initializes the form with provided id and deviceId', () => {
		expect(form.model.id).toBe(channelId.toString());
		expect(form.model.type).toBe('test-type');
		expect(form.model.device).toBe(deviceId.toString());
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
		form.model.category = DevicesModuleChannelCategory.generic;

		await form.submit();

		expect(mockAdd).toHaveBeenCalledWith({
			id: channelId.toString(),
			deviceId: deviceId.toString(),
			draft: false,
			data: {
				type: 'test-type',
				id: channelId.toString(),
				device: deviceId.toString(),
				category: DevicesModuleChannelCategory.generic,
				name: 'name',
				description: null,
			},
		});
		expect(form.formResult.value).toBe(FormResult.OK);
	});
});
