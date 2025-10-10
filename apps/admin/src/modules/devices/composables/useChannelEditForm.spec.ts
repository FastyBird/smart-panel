import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory } from '../../../openapi';
import { DEVICES_MODULE_NAME, FormResult } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { ChannelSchema } from '../store/channels.store.schemas';
import type { IChannel } from '../store/channels.store.types';

import { useChannelEditForm } from './useChannelEditForm';

const channelId = uuid().toString();
const deviceId = uuid().toString();

const mockChannel: IChannel = {
	id: channelId.toString(),
	type: 'test-type',
	device: deviceId.toString(),
	name: 'Channel Name',
	description: 'Some desc',
	category: DevicesModuleChannelCategory.light,
	draft: true,
} as IChannel;

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

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({
				edit: mockEdit,
				save: mockSave,
				findForDevice: () => [],
			}),
		}),
		useFlashMessage: () => ({
			success: mockSuccess,
			error: mockError,
			info: mockInfo,
		}),
	};
});

vi.mock('./useDevices', () => ({
	useDevices: () => ({
		devices: { value: [{ id: deviceId.toString(), category: 'generic', name: 'Device 1' }] },
		fetchDevices: vi.fn().mockResolvedValue(undefined),
		areLoading: false,
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

describe('useChannelEditForm', () => {
	beforeEach(() => {
		mockEdit.mockClear();
		mockSave.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
	});

	it('initializes model with channel data', () => {
		const form = useChannelEditForm({ channel: mockChannel });

		expect(form.model.id).toBe(mockChannel.id);
		expect(form.model.name).toBe(mockChannel.name);
		expect(form.model.description).toBe(mockChannel.description);
	});

	it('sets formChanged to true when model changes', async () => {
		const form = useChannelEditForm({ channel: mockChannel });

		form.model.name = 'Updated';
		await nextTick();

		expect(form.formChanged.value).toBe(true);
	});

	it('throws if form is invalid', async () => {
		const form = useChannelEditForm({ channel: mockChannel });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(false),
		} as unknown as FormInstance;

		await expect(form.submit()).rejects.toThrow(DevicesValidationException);
	});

	it('submits and saves if draft', async () => {
		const form = useChannelEditForm({ channel: mockChannel });

		form.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		await form.submit();

		expect(mockEdit).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(mockSuccess).toHaveBeenCalled();
		expect(form.formResult.value).toBe(FormResult.OK);
	});

	it('submits and edits if not draft', async () => {
		const form = useChannelEditForm({ channel: { ...mockChannel, draft: false } });

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
