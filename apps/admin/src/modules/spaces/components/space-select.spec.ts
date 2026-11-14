import { computed } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import SpaceSelect from './space-select.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const SPACES = [
	{ id: 'r-1', name: 'Living room', type: 'room' },
	{ id: 'z-1', name: 'Ground floor', type: 'zone' },
	{ id: 'm-1', name: 'Master', type: 'master' },
	{ id: 'e-1', name: 'Entry', type: 'entry' },
];

vi.mock('../composables/useSpaces', () => ({
	useSpaces: () => ({
		spaces: computed(() => SPACES),
		roomSpaces: computed(() => SPACES.filter((space) => space.type === 'room')),
		zoneSpaces: computed(() => SPACES.filter((space) => space.type === 'zone')),
		fetching: computed(() => false),
		findById: (id: string) => SPACES.find((space) => space.id === id) ?? null,
	}),
}));

const options = (props: Record<string, unknown>): [unknown, boolean][] =>
	mount(SpaceSelect, { props: { modelValue: null, ...props }, global: { stubs: { Icon: true } } })
		.findAllComponents({ name: 'ElOption' })
		.map((option) => [option.props('value'), option.props('disabled') === true]);

describe('SpaceSelect', (): void => {
	it('lists every space type with the "all" filter', (): void => {
		expect(options({}).map(([value]) => value)).toEqual(['r-1', 'z-1', 'e-1', 'm-1']);
	});

	it('lists only rooms and zones with the "rooms_and_zones" filter', (): void => {
		expect(options({ filter: 'rooms_and_zones' })).toEqual([
			['r-1', false],
			['z-1', false],
		]);
	});

	it('keeps a selected space of another type listed, but not to be picked', (): void => {
		expect(options({ filter: 'rooms_and_zones', modelValue: 'm-1' })).toEqual([
			['r-1', false],
			['z-1', false],
			['m-1', true],
		]);
	});
});
