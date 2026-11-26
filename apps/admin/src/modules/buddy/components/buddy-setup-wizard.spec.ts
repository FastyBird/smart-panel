import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { LLM_PROVIDER_NONE } from '../buddy.constants';
import type { IProviderStatus } from '../composables/useBuddyProviders';

import BuddySetupWizard from './buddy-setup-wizard.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	edit: vi.fn(),
	fetchLlm: vi.fn(),
	// Assigned by the mock factories below, which are the first place `ref` is available
	llm: null as unknown as Ref<IProviderStatus[]>,
	llmFailed: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	const store = {
		edit: mocks.edit,
		fetch: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(undefined),
		findByType: () => ({}),
	};

	return {
		StateView: defineVueComponent({
			name: 'StateView',
			props: ['kind', 'title', 'icon'],
			setup:
				(_, { slots }) =>
				() =>
					h('div', slots.action?.()),
		}),
		// The shell is stubbed so the tests read its flags and fire its events directly; its own spec covers the markup
		WizardShell: defineVueComponent({
			name: 'WizardShell',
			props: ['steps', 'current', 'canContinue', 'skippable', 'busy', 'nextLabel', 'cancellable'],
			emits: ['back', 'next', 'skip', 'cancel', 'step'],
			setup:
				(_, { slots }) =>
				() =>
					h('div', slots.default?.()),
		}),
		injectStoresManager: () => ({ getStore: () => store }),
		useFlashMessage: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
	};
});

vi.mock('../../config/composables/usePlugins', () => ({
	usePlugins: () => ({ getByName: () => undefined }),
}));

vi.mock('../../onboarding/components/integration-config-dialog.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({ name: 'IntegrationConfigDialog', props: ['visible', 'pluginType', 'pluginName'], setup: () => () => h('div') }),
	};
});

vi.mock('./buddy-provider-option.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'BuddyProviderOption',
			props: ['provider', 'group', 'icon', 'selected', 'model', 'canToggle', 'toggling', 'hasConfigForm'],
			emits: ['select', 'toggle', 'configure'],
			setup: () => () => h('div'),
		}),
	};
});

vi.mock('../composables/useBuddyProviders', async () => {
	const { ref } = await import('vue');

	mocks.llm = ref<IProviderStatus[]>([]);
	mocks.llmFailed = ref(false);

	return {
		useBuddyProviders: () => ({
			providerStatuses: mocks.llm,
			providerStatusesFetched: ref(true),
			providerFetchFailed: mocks.llmFailed,
			fetchProviderStatuses: mocks.fetchLlm,
		}),
	};
});

// No voice or messaging providers: the wizard is the provider step and the summary
vi.mock('../composables/useBuddyTtsProviders', async () => {
	const { ref } = await import('vue');

	return { useBuddyTtsProviders: () => ({ ttsProviderStatuses: ref([]), fetchTtsProviderStatuses: vi.fn().mockResolvedValue(undefined) }) };
});

vi.mock('../composables/useBuddySttProviders', async () => {
	const { ref } = await import('vue');

	return { useBuddySttProviders: () => ({ sttProviderStatuses: ref([]), fetchSttProviderStatuses: vi.fn().mockResolvedValue(undefined) }) };
});

vi.mock('../composables/useBuddyMessagingProviders', async () => {
	const { ref } = await import('vue');

	return {
		useBuddyMessagingProviders: () => ({
			messagingProviderStatuses: ref([]),
			fetchMessagingProviderStatuses: vi.fn().mockResolvedValue(undefined),
		}),
	};
});

const provider = (type: string, selected: boolean): IProviderStatus => ({
	type,
	name: type,
	description: '',
	default_model: '',
	enabled: true,
	configured: true,
	selected,
});

const PROVIDERS = [provider('provider-a', true), provider('provider-b', false)];

const mountWizard = async () => {
	const wrapper = mount(BuddySetupWizard);

	await flushPromises();

	return wrapper;
};

const shell = (wrapper: Awaited<ReturnType<typeof mountWizard>>) => wrapper.findComponent({ name: 'WizardShell' });

const option = (wrapper: Awaited<ReturnType<typeof mountWizard>>, type: string) =>
	wrapper.findAllComponents({ name: 'BuddyProviderOption' }).find((item) => (item.props('provider') as IProviderStatus).type === type)!;

const finish = async (wrapper: Awaited<ReturnType<typeof mountWizard>>): Promise<void> => {
	// To the summary, then Finish
	shell(wrapper).vm.$emit('next');
	await flushPromises();

	expect(shell(wrapper).props('current')).toBe('done');

	shell(wrapper).vm.$emit('next');
	await flushPromises();
};

describe('BuddySetupWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.edit.mockResolvedValue(undefined);
		mocks.llm.value = PROVIDERS;
		mocks.llmFailed.value = false;
		mocks.fetchLlm.mockResolvedValue(undefined);
	});

	it('starts on the provider Buddy is set to use, and saves the one picked instead', async () => {
		const wrapper = await mountWizard();

		expect(option(wrapper, 'provider-a').props('selected')).toBe(true);

		option(wrapper, 'provider-b').vm.$emit('select');
		await finish(wrapper);

		expect(wrapper.emitted('completed')).toHaveLength(1);
		expect(mocks.edit).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: 'provider-b' }) });
	});

	it('saves a skipped provider step as no provider, not as the provider set before', async () => {
		const wrapper = await mountWizard();

		shell(wrapper).vm.$emit('skip');
		await flushPromises();

		shell(wrapper).vm.$emit('next');
		await flushPromises();

		expect(mocks.edit).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: LLM_PROVIDER_NONE }) });
	});

	it('keeps the provider picked when a later refresh of the providers fails', async () => {
		const wrapper = await mountWizard();

		option(wrapper, 'provider-b').vm.$emit('select');
		await flushPromises();

		// A plugin's config saved on a later step reads the providers again, and that read fails
		shell(wrapper).vm.$emit('next');
		await flushPromises();

		mocks.llmFailed.value = true;
		await flushPromises();

		expect(shell(wrapper).props('canContinue')).toBe(true);

		shell(wrapper).vm.$emit('next');
		await flushPromises();

		expect(mocks.edit).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: 'provider-b' }) });
	});

	it('holds the provider step after a failed read, saves no provider choice, and keeps a pick through Retry', async () => {
		mocks.llm.value = [];
		mocks.llmFailed.value = true;

		const wrapper = await mountWizard();

		expect(shell(wrapper).props('canContinue')).toBe(false);
		expect(shell(wrapper).props('skippable')).toBe(false);

		// Retry reads them
		mocks.fetchLlm.mockImplementationOnce(() => {
			mocks.llm.value = PROVIDERS;
			mocks.llmFailed.value = false;

			return Promise.resolve();
		});

		await wrapper.get('[data-test-id="buddy-setup-providers-retry"]').trigger('click');
		await flushPromises();

		expect(shell(wrapper).props('canContinue')).toBe(true);
		expect(option(wrapper, 'provider-a').props('selected')).toBe(true);

		option(wrapper, 'provider-b').vm.$emit('select');
		await flushPromises();

		// A refresh on this step fails, and Retry reads the providers again: the pick stays, not the saved provider
		mocks.llmFailed.value = true;
		await flushPromises();

		mocks.fetchLlm.mockImplementationOnce(() => {
			mocks.llmFailed.value = false;

			return Promise.resolve();
		});

		await wrapper.get('[data-test-id="buddy-setup-providers-retry"]').trigger('click');
		await flushPromises();

		expect(option(wrapper, 'provider-b').props('selected')).toBe(true);

		await finish(wrapper);

		expect(mocks.edit).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: 'provider-b' }) });
	});
});
