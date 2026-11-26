import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import type { IConversation, IMessage } from '../buddy.types';

import { type IUseBuddyChat, useBuddyChat } from './useBuddyChat';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	GET: vi.fn(),
	POST: vi.fn(),
	DELETE: vi.fn(),
	flashError: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useBackend: () => ({ client: { GET: mocks.GET, POST: mocks.POST, DELETE: mocks.DELETE } }),
	useFlashMessage: () => ({ error: mocks.flashError, success: vi.fn(), info: vi.fn() }),
}));

vi.mock('./useBuddyProviders', async () => {
	const { ref } = await import('vue');

	return {
		useBuddyProviders: () => ({
			providerStatuses: ref([]),
			providerStatusesFetched: ref(true),
			providerFetchFailed: ref(false),
			fetchProviderStatuses: vi.fn(),
		}),
	};
});

vi.mock('./useBuddyTtsProviders', async () => {
	const { ref } = await import('vue');

	return {
		useBuddyTtsProviders: () => ({
			ttsProviderStatuses: ref([]),
			ttsProviderStatusesFetched: ref(true),
			fetchTtsProviderStatuses: vi.fn(),
		}),
	};
});

interface IDeferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
}

const deferred = <T>(): IDeferred<T> => {
	let resolve!: (value: T) => void;

	const promise = new Promise<T>((done) => {
		resolve = done;
	});

	return { promise, resolve };
};

const message = (id: string, conversationId: string): IMessage => ({
	id,
	conversation_id: conversationId,
	role: 'assistant',
	content: 'Hello',
	created_at: '2026-11-01T10:00:00.000Z',
});

const conversation = (id: string): IConversation => ({
	id,
	title: id,
	space_id: null,
	created_at: '2026-11-01T10:00:00.000Z',
	updated_at: '2026-11-01T10:00:00.000Z',
});

type GetOptions = { params: { path: { id: string; messageId?: string } }; signal?: AbortSignal };

// The composable registers an unmount hook, so it runs inside a component as it does in the chat view
const setup = (): IUseBuddyChat => {
	let chat!: IUseBuddyChat;

	mount(
		defineComponent({
			setup() {
				chat = useBuddyChat();

				return () => null;
			},
		})
	);

	return chat;
};

const audio = { play: vi.fn(), pause: vi.fn(), onended: null as unknown, onerror: null as unknown };
const AudioMock = vi.fn(() => audio);

describe('useBuddyChat', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		audio.play.mockResolvedValue(undefined);

		vi.stubGlobal('Audio', AudioMock);
		URL.createObjectURL = vi.fn(() => 'blob:audio');
		URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('message reads', () => {
		it('marks the open conversation as failed when its messages cannot be read, and clears it on a successful retry', async () => {
			mocks.GET.mockResolvedValueOnce({ data: undefined, error: { message: 'boom' }, response: { status: 500 } });

			const chat = setup();

			await chat.selectConversation('c-1');

			expect(chat.messagesFailedFor.value).toBe('c-1');
			expect(chat.messagesLoadedFor.value).toBeNull();

			mocks.GET.mockResolvedValueOnce({ data: { data: [message('m-1', 'c-1')] }, error: undefined, response: { status: 200 } });

			await chat.selectConversation('c-1');

			expect(chat.messagesFailedFor.value).toBeNull();
			expect(chat.messagesLoadedFor.value).toBe('c-1');
		});

		it('does not mark a conversation that is no longer open when its read fails late', async () => {
			const late = deferred<unknown>();

			mocks.GET.mockReturnValueOnce(late.promise);
			mocks.GET.mockResolvedValueOnce({ data: { data: [message('m-2', 'c-2')] }, error: undefined, response: { status: 200 } });

			const chat = setup();

			const first = chat.selectConversation('c-1');

			await chat.selectConversation('c-2');

			late.resolve({ data: undefined, error: { message: 'boom' }, response: { status: 500 } });
			await first;

			expect(chat.messagesFailedFor.value).toBeNull();
			expect(chat.messagesLoadedFor.value).toBe('c-2');
			expect(chat.messages.value.map((item) => item.id)).toEqual(['m-2']);
		});
	});

	describe('audio', () => {
		const startPendingAudio = async (chat: IUseBuddyChat): Promise<{ answer: IDeferred<unknown>; signal: () => AbortSignal }> => {
			mocks.GET.mockResolvedValueOnce({ data: { data: [message('m-1', 'c-1')] }, error: undefined, response: { status: 200 } });

			await chat.selectConversation('c-1');

			const answer = deferred<unknown>();

			mocks.GET.mockReturnValueOnce(answer.promise);

			void chat.playMessageAudio('m-1');

			expect(chat.playingMessageId.value).toBe('m-1');

			const options = mocks.GET.mock.calls.at(-1)?.[1] as GetOptions;

			return { answer, signal: () => options.signal as AbortSignal };
		};

		it('cancels an audio read on its way when stopped, and ignores its late answer', async () => {
			const chat = setup();
			const { answer, signal } = await startPendingAudio(chat);

			chat.stopAudio();

			expect(signal().aborted).toBe(true);

			answer.resolve({ data: new Blob(['audio']), error: undefined });
			await flushPromises();

			expect(AudioMock).not.toHaveBeenCalled();
			expect(chat.playingMessageId.value).toBeNull();
		});

		it('stops the audio of the conversation before when a new one is started', async () => {
			mocks.POST.mockResolvedValueOnce({ data: { data: conversation('c-new') }, error: undefined, response: { status: 201 } });

			const chat = setup();
			const { answer, signal } = await startPendingAudio(chat);

			await chat.createConversation();

			expect(signal().aborted).toBe(true);
			expect(chat.activeConversationId.value).toBe('c-new');

			answer.resolve({ data: new Blob(['audio']), error: undefined });
			await flushPromises();

			expect(AudioMock).not.toHaveBeenCalled();
			expect(chat.playingMessageId.value).toBeNull();
		});
	});

	it('removes a deleted conversation with its draft, and closes it when it was open', async () => {
		mocks.GET.mockResolvedValueOnce({ data: { data: [message('m-1', 'c-1')] }, error: undefined, response: { status: 200 } });
		mocks.DELETE.mockResolvedValueOnce({ error: undefined });

		const chat = setup();

		chat.conversations.value = [conversation('c-1'), conversation('c-2')];

		await chat.selectConversation('c-1');

		chat.drafts.value['c-1'] = 'Half-written';
		chat.drafts.value['c-2'] = 'Another';

		await expect(chat.deleteConversation('c-1')).resolves.toBe(true);

		expect(chat.conversations.value.map((item) => item.id)).toEqual(['c-2']);
		expect(chat.activeConversationId.value).toBeNull();
		expect(chat.messages.value).toEqual([]);
		expect(chat.drafts.value).toEqual({ 'c-2': 'Another' });
	});

	it('keeps a conversation the backend did not delete', async () => {
		mocks.DELETE.mockResolvedValueOnce({ error: { message: 'boom' } });

		const chat = setup();

		chat.conversations.value = [conversation('c-1')];
		chat.drafts.value['c-1'] = 'Half-written';

		await expect(chat.deleteConversation('c-1')).resolves.toBe(false);

		expect(chat.conversations.value).toHaveLength(1);
		expect(chat.drafts.value).toEqual({ 'c-1': 'Half-written' });
		expect(mocks.flashError).toHaveBeenCalled();
	});
});
