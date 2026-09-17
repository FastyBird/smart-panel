import { mount } from '@vue/test-utils';
import { ElButton, ElTag } from 'element-plus';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory } from '../../../../openapi.constants';
import type { IChannelInputOccurrence } from '../../store/channel-input-occurrences.store.types';
import type { IChannel } from '../../store/channels.store.types';
import ChannelInputDiagnostics from './channel-input-diagnostics.vue';

const { mockGet, mockOccurrences } = vi.hoisted(() => ({
	mockGet: vi.fn(),
	mockOccurrences: { value: [] as IChannelInputOccurrence[] },
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: {
				GET: mockGet,
			},
		}),
		injectStoresManager: () => ({
			getStore: () => ({
				findByChannel: () => mockOccurrences.value,
				clear: vi.fn(),
			}),
		}),
	};
});

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: { count?: number }) => {
				if (params?.count !== undefined) {
					return `${key} (${params.count})`;
				}
				return key;
			},
		}),
	};
});

const mockChannel: IChannel = {
	id: 'channel-btn-1',
	type: 'device-channel',
	device: 'device-1',
	category: DevicesModuleChannelCategory.button,
	name: 'Wall switch button 1',
	identifier: 'btn_1',
	description: null,
	parent: null,
	draft: false,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: null,
};

describe('ChannelInputDiagnostics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOccurrences.value = [];
		mockGet.mockResolvedValue({
			data: {
				data: {
					channel_id: 'channel-btn-1',
					device_id: 'device-1',
					input_category: 'button',
					supported_events: ['press', 'double_press', 'long_press'],
					event_metadata: {},
				},
			},
		});
	});

	it('fetches and displays input capabilities for the channel', async () => {
		const wrapper = mount(ChannelInputDiagnostics, {
			props: {
				channel: mockChannel,
			},
			global: {
				components: {
					ElTag,
					ElButton,
				},
			},
		});

		await wrapper.vm.$nextTick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		await wrapper.vm.$nextTick();

		expect(mockGet).toHaveBeenCalledWith(
			expect.stringContaining('channels/{id}/input-capabilities'),
			expect.objectContaining({
				params: { path: { id: 'channel-btn-1' } },
			})
		);
		const badges = wrapper.findAllComponents(ElTag);
		expect(badges.length).toBeGreaterThan(0);
	});

	it('renders fallback when no capabilities are provided or fetch fails', async () => {
		mockGet.mockRejectedValueOnce(new Error('Network error'));

		const wrapper = mount(ChannelInputDiagnostics, {
			props: {
				channel: mockChannel,
			},
			global: {
				components: {
					ElTag,
					ElButton,
				},
			},
		});

		await wrapper.vm.$nextTick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('devicesModule.diagnostics.noCapabilities');
	});

	it('renders empty table message when no occurrences have arrived yet', async () => {
		const wrapper = mount(ChannelInputDiagnostics, {
			props: {
				channel: mockChannel,
			},
			global: {
				components: {
					ElTag,
					ElButton,
				},
			},
		});

		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('devicesModule.diagnostics.emptyEvents');
	});

	it('renders live events table and allows clearing', async () => {
		mockOccurrences.value = [
			{
				id: 'occ-1',
				deviceId: 'device-1',
				channelId: 'channel-btn-1',
				propertyId: 'prop-1',
				deviceCategory: 'button',
				channelCategory: 'button',
				propertyCategory: 'event',
				event: 'press',
				timestamp: '2026-09-17T00:00:00.000Z',
				sourceTimestamp: null,
				sourceOccurrenceId: null,
				nativeEventType: null,
				data: { state: 'pressed' },
				integration: 'test',
				endpoint: null,
				receivedAt: 1700000000000,
			},
		];

		const wrapper = mount(ChannelInputDiagnostics, {
			props: {
				channel: mockChannel,
			},
			global: {
				components: {
					ElTag,
					ElButton,
				},
			},
		});

		await wrapper.vm.$nextTick();

		const clearBtn = wrapper.findComponent(ElButton);
		expect(clearBtn.exists()).toBe(true);
		expect(wrapper.text()).toContain('devicesModule.diagnostics.clearEvents');
	});
});
