import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import VirtualPlacementFields from './virtual-placement-fields.vue';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(async () => undefined) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			fetch: mocks.fetch,
			findAll: () => [
				{ id: 'room-b', name: 'Kitchen', type: 'room', category: null },
				{ id: 'room-a', name: 'Bedroom', type: 'room', category: null },
				{ id: 'zone', name: 'Downstairs', type: 'zone', category: 'indoor' },
				{ id: 'floor', name: 'Ground floor', type: 'zone', category: 'floor_ground' },
			],
		}),
	}),
}));

describe('virtual placement fields', () => {
	it('offers rooms and assignable zones, and reports the choice', async () => {
		const wrapper = mount(VirtualPlacementFields, { props: { roomId: null, zoneIds: [] } });
		await flushPromises();
		expect(mocks.fetch).toHaveBeenCalled();
		const [room, zones] = wrapper.findAllComponents({ name: 'ElSelect' });
		expect(room!.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label'))).toEqual(['Bedroom', 'Kitchen']);
		// A floor zone follows from the room and cannot be assigned directly.
		expect(zones!.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label'))).toEqual(['Downstairs']);
		room!.vm.$emit('update:modelValue', 'room-a');
		room!.vm.$emit('update:modelValue', '');
		zones!.vm.$emit('update:modelValue', ['zone']);
		expect(wrapper.emitted('update:roomId')).toEqual([['room-a'], [null]]);
		expect(wrapper.emitted('update:zoneIds')).toEqual([[['zone']]]);
		wrapper.unmount();
	});
});
