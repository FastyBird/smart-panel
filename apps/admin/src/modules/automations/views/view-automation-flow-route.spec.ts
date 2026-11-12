import { defineComponent, h, onMounted } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import ViewAutomationFlowRoute from './view-automation-flow-route.vue';

const mocks = vi.hoisted(() => ({
	mounted: [] as string[],
}));

vi.mock('./view-automation-flow.vue', () => ({
	default: defineComponent({
		name: 'ViewAutomationFlow',
		props: { id: { type: String, required: true } },
		setup(props) {
			// What the editor reads its automation by is taken once, when it is set up
			const id = props.id;

			onMounted((): void => {
				mocks.mounted.push(id);
			});

			return () => h('div', { 'data-test-id': 'flow-view-stub' }, id);
		},
	}),
}));

describe('ViewAutomationFlowRoute', (): void => {
	it('gives every automation an editor of its own when the route goes from one flow straight to another', async (): Promise<void> => {
		const wrapper = mount(ViewAutomationFlowRoute, { props: { id: 'automation-a' } });

		await flushPromises();

		expect(mocks.mounted).toEqual(['automation-a']);

		await wrapper.setProps({ id: 'automation-b' });
		await flushPromises();

		expect(mocks.mounted).toEqual(['automation-a', 'automation-b']);
		expect(wrapper.find('[data-test-id="flow-view-stub"]').text()).toBe('automation-b');

		wrapper.unmount();
	});
});
