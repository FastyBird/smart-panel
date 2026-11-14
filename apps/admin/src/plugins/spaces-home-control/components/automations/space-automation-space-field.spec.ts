import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import SpaceAutomationSpaceField from './space-automation-space-field.vue';

const mocks = vi.hoisted(() => ({ fetchSpaces: vi.fn() }));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const spaces = ref<{ id: string; name: string; type: string }[]>([]);
const fetching = ref<boolean>(false);
const firstLoadFinished = ref<boolean>(false);

vi.mock('../../../../modules/spaces/composables/useSpaces', () => ({
	useSpaces: () => ({
		spaces: computed(() => spaces.value),
		roomSpaces: computed(() => spaces.value.filter((space) => space.type === 'room')),
		zoneSpaces: computed(() => spaces.value.filter((space) => space.type === 'zone')),
		fetching: computed(() => fetching.value),
		firstLoadFinished: computed(() => firstLoadFinished.value),
		fetchSpaces: mocks.fetchSpaces,
		findById: (id: string) => spaces.value.find((space) => space.id === id) ?? null,
	}),
}));

describe('SpaceAutomationSpaceField', (): void => {
	it('says when the spaces could not be loaded, and loads them again on retry', async (): Promise<void> => {
		mocks.fetchSpaces.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => {
			spaces.value = [{ id: 'r-1', name: 'Living room', type: 'room' }];

			return spaces.value;
		});

		const wrapper = mount(SpaceAutomationSpaceField, { props: { modelValue: undefined }, global: { stubs: { Icon: true } } });

		await flushPromises();

		expect(wrapper.find('[data-test-id="spaces-load-failed"]').text()).toContain('spacesHomeControlPlugin.automations.fields.space.loadFailed');
		expect(wrapper.findAllComponents({ name: 'ElOption' })).toHaveLength(0);

		await wrapper.find('[data-test-id="retry-load-spaces"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchSpaces).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="spaces-load-failed"]').exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['r-1']);

		wrapper.unmount();
	});

	it('says when a read another part of the admin started fails, and loads them again on retry', async (): Promise<void> => {
		spaces.value = [];
		mocks.fetchSpaces.mockReset();
		mocks.fetchSpaces.mockImplementationOnce(async () => {
			spaces.value = [{ id: 'z-1', name: 'Ground floor', type: 'zone' }];
			firstLoadFinished.value = true;

			return spaces.value;
		});

		// Another consumer's read is under way when the field mounts
		fetching.value = true;

		const wrapper = mount(SpaceAutomationSpaceField, { props: { modelValue: undefined }, global: { stubs: { Icon: true } } });

		await flushPromises();

		expect(mocks.fetchSpaces).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test-id="spaces-load-failed"]').exists()).toBe(false);

		// That read fails: the store ends it without the first load finished
		fetching.value = false;
		await flushPromises();

		expect(wrapper.find('[data-test-id="spaces-load-failed"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="retry-load-spaces"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchSpaces).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="spaces-load-failed"]').exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['z-1']);

		wrapper.unmount();
	});
});
