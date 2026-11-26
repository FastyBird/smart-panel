import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { BUDDY_MESSAGES_PAGE_SIZE } from '../buddy.constants';
import type { IMessage } from '../buddy.types';

import BuddyChatArea from './buddy-chat-area.vue';

enableAutoUnmount(afterEach);

// jsdom lays nothing out and has no scrolling API
beforeAll(() => {
	Element.prototype.scrollTo = vi.fn();
});

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		StateView: defineVueComponent({ name: 'StateView', props: ['kind', 'title', 'icon'], setup: () => () => h('div') }),
	};
});

vi.mock('./buddy-message-bubble.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'BuddyMessageBubble',
			props: ['message', 'showSpeaker', 'isPlaying', 'isLoadingAudio'],
			setup: (props) => () => h('div', { 'data-message': (props.message as IMessage).id }),
		}),
	};
});

const message = (index: number): IMessage => ({
	id: `m-${index}`,
	conversation_id: 'c-1',
	role: index % 2 === 0 ? 'user' : 'assistant',
	content: `Message ${index}`,
	created_at: '2026-11-01T10:00:00.000Z',
});

const messages = (count: number): IMessage[] => Array.from({ length: count }, (_, index) => message(index));

const mountArea = (props: { messages: IMessage[]; loaded: boolean; isSending?: boolean }) =>
	mount(BuddyChatArea, { props: { isSending: false, ...props } });

const shownIds = (wrapper: ReturnType<typeof mountArea>): string[] =>
	wrapper.findAll('[data-message]').map((item) => item.attributes('data-message') as string);

describe('BuddyChatArea', () => {
	it('waits for the conversation’s messages before showing the chat', () => {
		const wrapper = mountArea({ messages: [], loaded: false });

		expect(wrapper.findComponent({ name: 'StateView' }).props('kind')).toBe('loading');
		expect(wrapper.find('[data-test-id="buddy-chat-composer"]').exists()).toBe(false);
	});

	it('opens on the latest messages and shows earlier ones with Load more', async () => {
		const total = BUDDY_MESSAGES_PAGE_SIZE * 2 + 5;
		const wrapper = mountArea({ messages: messages(total), loaded: true });

		expect(shownIds(wrapper)).toHaveLength(BUDDY_MESSAGES_PAGE_SIZE);
		expect(shownIds(wrapper).at(-1)).toBe(`m-${total - 1}`);

		await wrapper.get('[data-test-id="buddy-chat-load-more"]').trigger('click');
		await flushPromises();

		expect(shownIds(wrapper)).toHaveLength(BUDDY_MESSAGES_PAGE_SIZE * 2);

		await wrapper.get('[data-test-id="buddy-chat-load-more"]').trigger('click');
		await flushPromises();

		expect(shownIds(wrapper)).toHaveLength(total);
		expect(wrapper.find('[data-test-id="buddy-chat-load-more"]').exists()).toBe(false);
	});

	it('keeps new messages in view without hiding the ones already shown', async () => {
		const total = BUDDY_MESSAGES_PAGE_SIZE + 3;
		const wrapper = mountArea({ messages: messages(total), loaded: true });

		await wrapper.setProps({ messages: messages(total + 2) });

		expect(shownIds(wrapper)).toHaveLength(BUDDY_MESSAGES_PAGE_SIZE + 2);
		expect(shownIds(wrapper)[0]).toBe('m-3');
	});

	it('sends the trimmed message from the composer and clears it', async () => {
		const wrapper = mountArea({ messages: messages(2), loaded: true });

		await wrapper.get('textarea').setValue('  Turn on the lights  ');
		await wrapper.get('[data-test-id="buddy-chat-composer"]').trigger('submit');

		expect(wrapper.emitted('send')).toEqual([['Turn on the lights']]);
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
	});

	it('does not send while an answer is on its way', async () => {
		const wrapper = mountArea({ messages: messages(2), loaded: true, isSending: true });

		await wrapper.get('textarea').setValue('Again');
		await wrapper.get('[data-test-id="buddy-chat-composer"]').trigger('submit');

		expect(wrapper.emitted('send')).toBeUndefined();
	});
});
