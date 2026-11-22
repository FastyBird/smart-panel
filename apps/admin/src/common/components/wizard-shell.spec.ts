import { computed, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';

import type { WizardShellProps, WizardShellStep } from './wizard-shell.types';
import WizardShell from './wizard-shell.vue';

const sizeClass = ref<SizeClass>('dt');

vi.mock('../composables/useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const STEPS: WizardShellStep[] = [
	{ id: 'discover', label: 'Discover' },
	{ id: 'select', label: 'Select' },
	{ id: 'confirm', label: 'Confirm' },
	{ id: 'results', label: 'Results' },
];

const render = (props: Partial<WizardShellProps> = {}) =>
	mount(WizardShell, {
		props: { steps: STEPS, current: 'select', ...props },
		slots: { default: '<div data-test-id="step-body">Body</div>' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

const find = (wrapper: ReturnType<typeof render>, id: string) => wrapper.find(`[data-test-id="wizard-shell-${id}"]`);

const steps = (wrapper: ReturnType<typeof render>) => wrapper.findAll('[data-test-id="wizard-shell-step"]');

describe('WizardShell.vue', () => {
	let wrapper: ReturnType<typeof render> | undefined;

	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	afterEach(() => {
		wrapper?.unmount();
		wrapper = undefined;
	});

	it('renders the step body inside the step card', () => {
		wrapper = render();

		expect(find(wrapper, 'step-card').find('[data-test-id="step-body"]').exists()).toBe(true);
		expect(find(wrapper, 'step-card').attributes('aria-label')).toBe('Select');
	});

	it('limits the step card to 720 px for forms and 960 px for tables', () => {
		wrapper = render();

		expect(find(wrapper, 'step-card').classes()).toContain('max-w-[720px]');

		wrapper.unmount();
		wrapper = render({ stepWidth: 'table' });

		expect(find(wrapper, 'step-card').classes()).toContain('max-w-[960px]');
	});

	it('shows the stepper card from tablet portrait up, marking done, current and later steps', () => {
		sizeClass.value = 'tp';
		wrapper = render({ current: 'confirm' });

		expect(find(wrapper, 'progress').exists()).toBe(false);
		expect(find(wrapper, 'stepper').attributes('aria-label')).toBe('Wizard steps');

		const items = steps(wrapper);

		expect(items.map((item) => item.attributes('aria-current'))).toEqual([undefined, undefined, 'step', undefined]);
		expect(items[0].text()).toContain('(completed)');
		expect(items[3].attributes('aria-disabled')).toBe('true');
		expect(items[1].attributes('aria-disabled')).toBeUndefined();
	});

	it('shows a progress bar instead of the stepper on phone', () => {
		sizeClass.value = 'phone';
		wrapper = render();

		expect(find(wrapper, 'stepper').exists()).toBe(false);
		expect(find(wrapper, 'progress').text()).toContain('Step 2 of 4 · Select');

		const bar = find(wrapper, 'progress').find('[role="progressbar"]');

		expect(bar.attributes('aria-valuenow')).toBe('2');
		expect(bar.attributes('aria-valuemax')).toBe('4');
		expect(bar.find('div').attributes('style')).toContain('width: 50%');
	});

	it('goes back to a completed step from the stepper, but not forward', async () => {
		wrapper = render({ current: 'confirm' });

		await steps(wrapper)[0].trigger('click');
		await steps(wrapper)[2].trigger('click');
		await steps(wrapper)[3].trigger('click');

		expect(wrapper.emitted('step')).toEqual([['discover']]);
	});

	it('is one Tab stop and moves between steps with the arrow keys, Home and End', async () => {
		wrapper = render({ current: 'select' });

		const items = () => steps(wrapper!);
		const tabbable = () => items().map((item) => item.attributes('tabindex'));
		const focused = () => items().findIndex((item) => item.element === document.activeElement);

		expect(tabbable()).toEqual(['-1', '0', '-1', '-1']);

		(items()[1].element as HTMLElement).focus();

		await items()[1].trigger('keydown', { key: 'ArrowRight' });
		expect(focused()).toBe(2);
		expect(tabbable()).toEqual(['-1', '-1', '0', '-1']);

		await items()[2].trigger('keydown', { key: 'End' });
		expect(focused()).toBe(3);

		await items()[3].trigger('keydown', { key: 'ArrowRight' });
		expect(focused()).toBe(0);

		await items()[0].trigger('keydown', { key: 'ArrowLeft' });
		expect(focused()).toBe(3);

		await items()[3].trigger('keydown', { key: 'Home' });
		expect(focused()).toBe(0);

		await items()[0].trigger('keydown', { key: 'ArrowDown' });
		expect(focused()).toBe(1);

		await items()[1].trigger('keydown', { key: 'ArrowUp' });
		expect(focused()).toBe(0);

		await items()[0].trigger('keydown', { key: 'Enter' });
		await items()[0].trigger('click');
		expect(wrapper.emitted('step')).toEqual([['discover']]);
	});

	it('returns the Tab stop to the current step when the step changes', async () => {
		wrapper = render({ current: 'select' });

		(steps(wrapper)[1].element as HTMLElement).focus();
		await steps(wrapper)[1].trigger('keydown', { key: 'Home' });

		await wrapper.setProps({ current: 'confirm' });

		expect(steps(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['-1', '-1', '0', '-1']);
	});

	it('keeps a Tab stop when the focused step is removed', async () => {
		wrapper = render({ current: 'select' });

		(steps(wrapper)[1].element as HTMLElement).focus();
		await steps(wrapper)[1].trigger('keydown', { key: 'End' });

		expect(steps(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['-1', '-1', '-1', '0']);

		await wrapper.setProps({ steps: STEPS.slice(0, 3) });

		expect(steps(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
	});

	it('lets the footer wrap instead of clipping at phone width', () => {
		wrapper = render();

		expect(find(wrapper, 'footer').classes()).toEqual(expect.arrayContaining(['flex-wrap', 'min-h-16']));
		expect(find(wrapper, 'footer').classes()).not.toContain('h-16');
	});

	it('orders the footer Cancel, selection count, Skip, Back, Next', () => {
		wrapper = render({ selectedCount: 4, skippable: true });

		const ids = find(wrapper, 'footer')
			.findAll('[data-test-id]')
			.map((el) => el.attributes('data-test-id'));

		expect(ids).toEqual(['wizard-shell-cancel', 'wizard-shell-selected', 'wizard-shell-skip', 'wizard-shell-back', 'wizard-shell-next']);
		expect(find(wrapper, 'selected').text()).toBe('4 selected');
		expect(find(wrapper, 'footer').classes()).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'shadow-top']));
	});

	it('hides Back on the first step, Skip unless skippable and the count unless given', () => {
		wrapper = render({ current: 'discover' });

		expect(find(wrapper, 'back').exists()).toBe(false);
		expect(find(wrapper, 'skip').exists()).toBe(false);
		expect(find(wrapper, 'selected').exists()).toBe(false);
	});

	it('labels the primary button Next, Finish on the last step, or the given label', () => {
		wrapper = render();
		expect(find(wrapper, 'next').text()).toBe('Next');

		wrapper.unmount();
		wrapper = render({ current: 'results' });
		expect(find(wrapper, 'next').text()).toBe('Finish');

		wrapper.unmount();
		wrapper = render({ nextLabel: 'Review 4 devices' });
		expect(find(wrapper, 'next').text()).toBe('Review 4 devices');
	});

	it('emits back, next, cancel and skip', async () => {
		wrapper = render({ skippable: true });

		await find(wrapper, 'back').trigger('click');
		await find(wrapper, 'next').trigger('click');
		await find(wrapper, 'cancel').trigger('click');
		await find(wrapper, 'skip').trigger('click');

		expect(wrapper.emitted('back')).toHaveLength(1);
		expect(wrapper.emitted('next')).toHaveLength(1);
		expect(wrapper.emitted('cancel')).toHaveLength(1);
		expect(wrapper.emitted('skip')).toHaveLength(1);
	});

	it('disables Next until the step can continue', () => {
		wrapper = render({ canContinue: false });

		expect(find(wrapper, 'next').attributes('disabled')).toBeDefined();
	});

	it('holds every action while busy', async () => {
		wrapper = render({ busy: true, skippable: true, current: 'confirm' });

		expect(find(wrapper, 'next').classes()).toContain('is-loading');
		expect(find(wrapper, 'back').attributes('disabled')).toBeDefined();
		expect(find(wrapper, 'cancel').attributes('disabled')).toBeDefined();
		expect(find(wrapper, 'skip').attributes('disabled')).toBeDefined();

		await steps(wrapper)[0].trigger('click');

		expect(wrapper.emitted('step')).toBeUndefined();
	});
	it('puts further step actions left of Skip, Back and Next', () => {
		wrapper = mount(WizardShell, {
			props: { steps: STEPS, current: 'select', skippable: true },
			slots: { actions: '<button data-test-id="extra">Scan again</button>' },
			global: { plugins: [i18n] },
		});

		const ids = find(wrapper, 'footer')
			.findAll('button')
			.map((button) => button.attributes('data-test-id'));

		expect(ids).toEqual(['wizard-shell-cancel', 'extra', 'wizard-shell-skip', 'wizard-shell-back', 'wizard-shell-next']);
	});

	it('hides Cancel and Next on request and shows Back on the first step when asked', () => {
		wrapper = render({ current: 'discover', cancellable: false, nextVisible: false, backable: true });

		expect(find(wrapper, 'cancel').exists()).toBe(false);
		expect(find(wrapper, 'next').exists()).toBe(false);
		expect(find(wrapper, 'back').exists()).toBe(true);

		wrapper.unmount();
		wrapper = render({ current: 'confirm', backable: false });

		expect(find(wrapper, 'back').exists()).toBe(false);
	});

	it('leaves the stepper out until there are steps', () => {
		wrapper = render({ steps: [], current: '' });

		expect(find(wrapper, 'stepper').exists()).toBe(false);
		expect(find(wrapper, 'step-card').exists()).toBe(true);
	});
});
