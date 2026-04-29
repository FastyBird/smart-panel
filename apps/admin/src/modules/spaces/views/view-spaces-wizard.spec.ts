/* eslint-disable vue/one-component-per-file */
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewSpacesWizard from './view-spaces-wizard.vue';

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
}));

const OtherWizard = defineComponent({
	name: 'OtherWizard',
	template: '<div data-test-id="other-wizard" />',
});

const SpacesWizard = defineComponent({
	name: 'SpacesWizard',
	template: '<div data-test-id="spaces-wizard" />',
});

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		EntityNotFound: defineVueComponent({
			name: 'EntityNotFound',
			template: '<div data-test-id="entity-not-found" />',
		}),
	};
});

vi.mock('../composables', () => ({
	useSpacesPlugins: () => ({
		getByPluginType: (type: string) =>
			type === 'multi-module-plugin'
				? {
						type: 'multi-module-plugin',
						elements: [
							{
								type: 'other-module-wizard',
								modules: ['other-module'],
								components: {
									spaceWizard: OtherWizard,
								},
							},
							{
								type: 'spaces-module-wizard',
								modules: ['spaces-module'],
								components: {
									spaceWizard: SpacesWizard,
								},
							},
						],
					}
				: undefined,
	}),
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: {
		SPACES: 'spaces',
	},
	SPACES_MODULE_NAME: 'spaces-module',
}));

describe('ViewSpacesWizard', () => {
	it('renders the spaces-scoped wizard element when plugin also has other module wizards', () => {
		const wrapper = mount(ViewSpacesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(wrapper.find('[data-test-id="spaces-wizard"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="other-wizard"]').exists()).toBe(false);
	});
});
