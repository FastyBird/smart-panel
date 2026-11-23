import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import LocalSceneActionCard from './local-scene-action-card.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => ({ 'scenesLocalPlugin.actionCard.on': 'On', 'scenesLocalPlugin.actionCard.off': 'Off' })[key] ?? key,
	}),
}));

const createAction = (overrides: Record<string, unknown> = {}) => ({
	id: 'action-1',
	type: 'local',
	enabled: true,
	configuration: {},
	deviceId: 'device-1',
	channelId: 'channel-1',
	propertyId: 'property-1',
	...overrides,
});

const chipText = (action: Record<string, unknown>): string =>
	mount(LocalSceneActionCard, { props: { action: action as never } })
		.find('[data-test-id="local-scene-action-value"]')
		.text();

describe('LocalSceneActionCard', () => {
	it('shows only the value: the host draws the device, channel and property', () => {
		const wrapper = mount(LocalSceneActionCard, { props: { action: createAction({ value: 40 }) as never } });

		expect(wrapper.text()).toBe('40');
	});

	it('names a boolean value as On or Off', () => {
		expect(chipText(createAction({ value: true }))).toBe('On');
		expect(chipText(createAction({ value: false }))).toBe('Off');
	});

	it('reads the value an older action keeps in its configuration', () => {
		expect(chipText(createAction({ configuration: { value: 'auto' } }))).toBe('auto');
	});
});
