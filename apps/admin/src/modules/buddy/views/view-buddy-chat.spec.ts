import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../buddy.constants';
import type { IConversation } from '../buddy.types';

import ViewBuddyChat from './view-buddy-chat.vue';

// The route is shared by every mount, so a view left mounted would keep acting on the next test's navigation
enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	fetchConversations: vi.fn(),
	createConversation: vi.fn(),
	selectConversation: vi.fn(),
	closeConversation: vi.fn(),
	deleteConversation: vi.fn(),
	confirm: vi.fn(),
	navigate: vi.fn(),
	// Assigned by the mock factories below, which are the first place `ref` and `reactive` are available
	conversations: null as unknown as Ref<IConversation[]>,
	activeConversationId: null as unknown as Ref<string | null>,
	messagesLoadedFor: null as unknown as Ref<string | null>,
	providerNotConfigured: null as unknown as Ref<boolean>,
	isPhone: null as unknown as Ref<boolean>,
	isTabletPortrait: null as unknown as Ref<boolean>,
	route: null as unknown as { name: string; params: Record<string, string> },
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', async () => {
	const { reactive: vueReactive } = await import('vue');

	mocks.route = vueReactive({ name: 'buddy_module-chat', params: {} });

	// Navigating moves the shared route, as the router would, so the view's route watchers run
	const go = (to: { name: string; params?: Record<string, string> }): Promise<void> => {
		mocks.navigate(to);
		mocks.route.name = to.name;
		mocks.route.params = to.params ?? {};

		return Promise.resolve();
	};

	return {
		useRoute: () => mocks.route,
		useRouter: () => ({ push: go, replace: go }),
	};
});

vi.mock('element-plus', async (importOriginal) => ({
	...(await importOriginal<typeof import('element-plus')>()),
	ElMessageBox: { confirm: mocks.confirm },
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	mocks.isPhone = vueRef(false);
	mocks.isTabletPortrait = vueRef(false);

	return {
		ViewHeader: defineVueComponent({
			name: 'ViewHeader',
			props: ['title', 'subtitle', 'icon', 'actions'],
			setup:
				(_, { slots }) =>
				() =>
					h('header', slots.actions?.()),
		}),
		StateView: defineVueComponent({
			name: 'StateView',
			props: ['kind', 'title', 'icon', 'description'],
			setup:
				(_, { slots }) =>
				() =>
					h('div', slots.action?.()),
		}),
		useSizeClass: () => ({ isPhone: mocks.isPhone, isTabletPortrait: mocks.isTabletPortrait }),
	};
});

vi.mock('../../config/composables/useConfigModules', async () => {
	const { ref: vueRef } = await import('vue');

	return {
		useConfigModules: () => ({ enabled: () => true, loaded: vueRef(true), fetchConfigModules: vi.fn() }),
	};
});

vi.mock('../../spaces/composables/useSpaces', async () => {
	const { ref: vueRef } = await import('vue');

	return {
		useSpaces: () => ({ spaces: vueRef([]), fetchSpaces: vi.fn().mockResolvedValue(undefined) }),
	};
});

vi.mock('../composables/useBuddyChat', async () => {
	const { computed: vueComputed, ref: vueRef } = await import('vue');

	mocks.conversations = vueRef<IConversation[]>([]);
	mocks.activeConversationId = vueRef<string | null>(null);
	mocks.messagesLoadedFor = vueRef<string | null>(null);
	mocks.providerNotConfigured = vueRef(false);

	return {
		useBuddyChat: () => ({
			conversations: mocks.conversations,
			activeConversationId: mocks.activeConversationId,
			messagesLoadedFor: mocks.messagesLoadedFor,
			isLoadingConversations: vueRef(false),
			isProviderNotConfigured: vueComputed(() => mocks.providerNotConfigured.value),
			providerStatuses: vueRef([]),
			selectedProviderStatus: vueComputed(() => undefined),
			fetchConversations: mocks.fetchConversations,
			fetchProviderStatuses: vi.fn().mockResolvedValue(undefined),
			fetchTtsProviderStatuses: vi.fn().mockResolvedValue(undefined),
			createConversation: mocks.createConversation,
			selectConversation: mocks.selectConversation,
			closeConversation: mocks.closeConversation,
			deleteConversation: mocks.deleteConversation,
		}),
	};
});

// The list and the provider panel are stubbed so the tests can fire their events directly
vi.mock('../components/buddy-conversation-list.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'BuddyConversationList',
			props: ['conversations', 'activeId', 'spaces', 'loading', 'canCreate'],
			emits: ['select', 'delete', 'create'],
			setup: () => () => h('div'),
		}),
	};
});

vi.mock('../components/buddy-provider-setup.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'BuddyProviderSetup',
			props: ['selectedProvider', 'providerStatuses'],
			setup: () => () => h('div'),
		}),
	};
});

const conversation = (id: string, title: string): IConversation => ({
	id,
	title,
	space_id: null,
	created_at: '2026-11-01T10:00:00.000Z',
	updated_at: '2026-11-01T10:00:00.000Z',
});

// The conversation route's view, as the router would render it into the chat
const ConversationStub = {
	name: 'ViewBuddyConversation',
	props: { loading: Boolean, inPane: Boolean },
	template: '<div />',
};

const RouterViewStub = {
	name: 'RouterView',
	setup(_: unknown, { slots }: { slots: { default?: (scope: { Component: unknown }) => unknown } }) {
		return () => slots.default?.({ Component: mocks.route.name === RouteNames.BUDDY_CONVERSATION ? ConversationStub : undefined });
	},
};

const mountView = async () => {
	const wrapper = mount(ViewBuddyChat, { global: { stubs: { RouterView: RouterViewStub } } });

	await flushPromises();

	return wrapper;
};

const list = (wrapper: Awaited<ReturnType<typeof mountView>>) => wrapper.findComponent({ name: 'BuddyConversationList' });

const toPhone = (): void => {
	mocks.isPhone.value = true;
};

describe('ViewBuddyChat', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.fetchConversations.mockResolvedValue(undefined);
		mocks.selectConversation.mockImplementation((id: string) => {
			mocks.activeConversationId.value = id;
			mocks.messagesLoadedFor.value = id;

			return Promise.resolve();
		});
		mocks.createConversation.mockImplementation(() => {
			const created = conversation('c-new', '');

			mocks.conversations.value = [created, ...mocks.conversations.value];

			return Promise.resolve(created);
		});
		mocks.deleteConversation.mockImplementation((id: string) => {
			mocks.conversations.value = mocks.conversations.value.filter((item) => item.id !== id);

			return Promise.resolve(true);
		});
		mocks.confirm.mockResolvedValue('confirm');

		mocks.conversations.value = [conversation('c-1', 'Heating'), conversation('c-2', 'Lights')];
		mocks.activeConversationId.value = null;
		mocks.messagesLoadedFor.value = null;
		mocks.providerNotConfigured.value = false;
		mocks.isPhone.value = false;
		mocks.isTabletPortrait.value = false;
		mocks.route.name = RouteNames.BUDDY;
		mocks.route.params = {};
	});

	describe('two panes (tablet landscape and up)', () => {
		it('shows the chats beside the conversation and opens the latest conversation', async () => {
			const wrapper = await mountView();

			expect(wrapper.find('[data-test-id="buddy-two-pane"]').exists()).toBe(true);
			expect(mocks.navigate).toHaveBeenCalledWith({ name: RouteNames.BUDDY_CONVERSATION, params: { id: 'c-1' } });
			expect(mocks.selectConversation).toHaveBeenCalledWith('c-1');
			expect(wrapper.findComponent({ name: 'ViewBuddyConversation' }).props('inPane')).toBe(true);
			expect(list(wrapper).props('activeId')).toBe('c-1');
		});

		it('starts a conversation when Buddy opens with none', async () => {
			mocks.conversations.value = [];

			await mountView();

			expect(mocks.createConversation).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ name: RouteNames.BUDDY_CONVERSATION, params: { id: 'c-new' } });
		});

		it('opens the next conversation when the open one is deleted, after confirming', async () => {
			const wrapper = await mountView();

			list(wrapper).vm.$emit('delete', 'c-1');
			await flushPromises();

			expect(mocks.confirm).toHaveBeenCalledTimes(1);
			expect(mocks.confirm.mock.calls[0][2]).toMatchObject({ confirmButtonText: 'buddyModule.buttons.deleteConversation.title' });
			expect(mocks.deleteConversation).toHaveBeenCalledWith('c-1');
			expect(mocks.route.params).toEqual({ id: 'c-2' });
		});

		it('keeps the conversation when the delete is cancelled', async () => {
			mocks.confirm.mockRejectedValue('cancel');

			const wrapper = await mountView();

			list(wrapper).vm.$emit('delete', 'c-1');
			await flushPromises();

			expect(mocks.deleteConversation).not.toHaveBeenCalled();
			expect(mocks.route.params).toEqual({ id: 'c-1' });
		});

		it('leaves the pane empty, without starting a new conversation, once the last one is deleted', async () => {
			mocks.conversations.value = [conversation('c-1', 'Heating')];

			const wrapper = await mountView();

			list(wrapper).vm.$emit('delete', 'c-1');
			await flushPromises();

			expect(mocks.route.name).toBe(RouteNames.BUDDY);
			expect(mocks.createConversation).not.toHaveBeenCalled();
			expect(wrapper.find('[data-test-id="buddy-no-selection"]').exists()).toBe(true);
		});
	});

	describe('one pane (below tablet landscape)', () => {
		it('shows the chats only, and the conversation as its own page once opened', async () => {
			toPhone();

			const wrapper = await mountView();

			expect(wrapper.find('[data-test-id="buddy-two-pane"]').exists()).toBe(false);
			expect(list(wrapper).exists()).toBe(true);
			expect(mocks.navigate).not.toHaveBeenCalled();

			list(wrapper).vm.$emit('select', 'c-2');
			await flushPromises();

			expect(mocks.selectConversation).toHaveBeenCalledWith('c-2');
			expect(list(wrapper).exists()).toBe(false);
			// The conversation page brings its own header with the way back
			expect(wrapper.findComponent({ name: 'ViewHeader' }).exists()).toBe(false);
			expect(wrapper.findComponent({ name: 'ViewBuddyConversation' }).props('inPane')).toBe(false);
		});

		it('closes the conversation when going back to the chats', async () => {
			toPhone();
			mocks.route.name = RouteNames.BUDDY_CONVERSATION;
			mocks.route.params = { id: 'c-2' };

			await mountView();

			mocks.route.name = RouteNames.BUDDY;
			mocks.route.params = {};
			await flushPromises();

			expect(mocks.closeConversation).toHaveBeenCalled();
		});

		it('opens a new chat on its own page', async () => {
			toPhone();

			const wrapper = await mountView();

			await wrapper.get('[data-test-id="buddy-new-chat"]').trigger('click');
			await flushPromises();

			expect(mocks.route).toMatchObject({ name: RouteNames.BUDDY_CONVERSATION, params: { id: 'c-new' } });
		});
	});

	it('offers to read the chats again when they could not be read, and opens the chat once they are', async () => {
		mocks.fetchConversations.mockRejectedValueOnce(new Error('offline'));

		const wrapper = await mountView();

		expect(wrapper.find('[data-test-id="buddy-load-failed"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="buddy-two-pane"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="buddy-load-retry"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchConversations).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="buddy-load-failed"]').exists()).toBe(false);
		expect(mocks.route.params).toEqual({ id: 'c-1' });
	});

	it('leads to setting up a provider instead of the chat while none can answer, and starts no conversation', async () => {
		mocks.providerNotConfigured.value = true;
		mocks.conversations.value = [];

		const wrapper = await mountView();

		expect(wrapper.findComponent({ name: 'BuddyProviderSetup' }).exists()).toBe(true);
		expect(list(wrapper).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="buddy-new-chat"]').exists()).toBe(false);
		expect(mocks.createConversation).not.toHaveBeenCalled();
	});
});
