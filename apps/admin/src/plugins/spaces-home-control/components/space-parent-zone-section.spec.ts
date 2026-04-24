import { nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import { SpaceType } from '../../../modules/spaces/spaces.constants';

import SpaceParentZoneSection from './space-parent-zone-section.vue';

const mocks = vi.hoisted(() => ({
	editSpace: vi.fn(),
	findById: vi.fn(),
	floorZoneSpaces: { value: [] },
	flashSuccess: vi.fn(),
	flashError: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({
		success: mocks.flashSuccess,
		error: mocks.flashError,
	}),
}));

vi.mock('../../../modules/spaces/composables', () => ({
	useSpace: () => ({
		editSpace: mocks.editSpace,
	}),
	useSpaces: () => ({
		floorZoneSpaces: mocks.floorZoneSpaces,
		findById: mocks.findById,
	}),
}));

describe('SpaceParentZoneSection', () => {
	it('does not add a bottom border to the final detail row', () => {
		const wrapper = shallowMount(SpaceParentZoneSection, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					Icon: true,
				},
			},
		});

		expect(wrapper.find('dt').classes()).not.toContain('b-b');
		expect(wrapper.find('dd').classes()).not.toContain('b-b');
	});

	it('opens the inline floor selector from the keyboard', async () => {
		const wrapper = shallowMount(SpaceParentZoneSection, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					Icon: true,
				},
			},
		});

		const editorTrigger = wrapper.find('[role="button"]');

		expect(editorTrigger.attributes('tabindex')).toBe('0');
		expect(editorTrigger.attributes('aria-expanded')).toBeUndefined();

		await editorTrigger.trigger('keydown', { key: 'Enter' });
		await nextTick();

		expect(wrapper.find('el-select-stub').exists()).toBe(true);
	});
});
