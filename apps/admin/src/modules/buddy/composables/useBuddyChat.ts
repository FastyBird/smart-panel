import { type ComputedRef, type Ref, computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useBackend, useFlashMessage } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';
import type { IConversation, IMessage } from '../buddy.types';

import { type IProviderStatus, useBuddyProviders } from './useBuddyProviders';
import { useBuddyTtsProviders } from './useBuddyTtsProviders';

interface IUseBuddyChat {
	conversations: Ref<IConversation[]>;
	activeConversationId: Ref<string | null>;
	messages: Ref<IMessage[]>;
	activeConversation: ComputedRef<IConversation | undefined>;
	hasActiveConversation: ComputedRef<boolean>;
	isLoadingConversations: Ref<boolean>;
	isLoadingMessages: Ref<boolean>;
	isSending: Ref<boolean>;
	isProviderNotConfigured: ComputedRef<boolean>;
	providerStatuses: Ref<IProviderStatus[]>;
	selectedProviderStatus: ComputedRef<IProviderStatus | undefined>;
	isTtsConfigured: ComputedRef<boolean>;
	playingMessageId: Ref<string | null>;
	audioLoading: Ref<boolean>;
	fetchConversations: () => Promise<void>;
	fetchProviderStatuses: () => Promise<void>;
	fetchTtsProviderStatuses: () => Promise<void>;
	createConversation: (title?: string) => Promise<IConversation | undefined>;
	selectConversation: (id: string) => Promise<void>;
	refreshMessages: (conversationId: string) => Promise<void>;
	sendMessage: (content: string) => Promise<void>;
	deleteConversation: (id: string) => Promise<void>;
	playMessageAudio: (messageId: string) => Promise<void>;
	stopAudio: () => void;
}

export const useBuddyChat = (): IUseBuddyChat => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const { providerStatuses, providerStatusesFetched, fetchProviderStatuses } = useBuddyProviders();
	const { ttsProviderStatuses, ttsProviderStatusesFetched, fetchTtsProviderStatuses } = useBuddyTtsProviders();

	const conversations = ref<IConversation[]>([]);
	const activeConversationId = ref<string | null>(null);
	const messages = ref<IMessage[]>([]);

	const isLoadingConversations = ref<boolean>(false);
	const isLoadingMessages = ref<boolean>(false);
	const isSending = ref<boolean>(false);

	const selectedProviderStatus = computed<IProviderStatus | undefined>(() => {
		return providerStatuses.value.find((p) => p.selected);
	});

	const isProviderNotConfigured = computed<boolean>(() => {
		if (!providerStatusesFetched.value) {
			return false;
		}

		if (providerStatuses.value.length === 0) {
			return true;
		}

		const selected = selectedProviderStatus.value;

		if (!selected) {
			return true;
		}

		return !selected.enabled || !selected.configured;
	});

	const activeConversation = computed<IConversation | undefined>(() => {
		return conversations.value.find((c) => c.id === activeConversationId.value);
	});

	const hasActiveConversation = computed<boolean>(() => {
		return activeConversationId.value !== null;
	});

	const fetchConversations = async (): Promise<void> => {
		isLoadingConversations.value = true;

		try {
			const { data: responseData, error: apiError, response: res } = await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations`,
			);

			if (apiError || !responseData) {
				if (res?.status !== 503) {
					flashMessage.error(t('buddyModule.messages.errors.loadConversations'));
				}

				return;
			}

			conversations.value = responseData.data as IConversation[];
		} catch (err: unknown) {
			flashMessage.error(err instanceof Error ? err.message : t('buddyModule.messages.errors.loadConversations'));
		} finally {
			isLoadingConversations.value = false;
		}
	};

	const createConversation = async (title?: string): Promise<IConversation | undefined> => {
		try {
			const { data: responseData, error: apiError, response: res } = await backend.client.POST(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations`,
				{
					body: { data: { title: title ?? undefined } },
				},
			);

			if (apiError || !responseData) {
				if (res?.status !== 503) {
					flashMessage.error(t('buddyModule.messages.errors.createConversation'));
				}

				return undefined;
			}

			const created = responseData.data as IConversation;

			conversations.value.unshift(created);
			activeConversationId.value = created.id;
			messages.value = [];

			return created;
		} catch (err: unknown) {
			flashMessage.error(err instanceof Error ? err.message : t('buddyModule.messages.errors.createConversation'));
		}

		return undefined;
	};

	const fetchMessagesInternal = async (conversationId: string, quiet: boolean): Promise<void> => {
		if (!quiet) {
			isLoadingMessages.value = true;
		}

		try {
			const { data: responseData, error: apiError, response: res } = await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}/messages`,
				{
					params: {
						path: { id: conversationId },
					},
				},
			);

			if (apiError || !responseData) {
				if (!quiet && res?.status !== 503) {
					flashMessage.error(t('buddyModule.messages.errors.loadMessages'));
				}

				return;
			}

			if (activeConversationId.value === conversationId) {
				messages.value = responseData.data as IMessage[];
			}
		} catch (err: unknown) {
			if (!quiet) {
				flashMessage.error(err instanceof Error ? err.message : t('buddyModule.messages.errors.loadMessages'));
			}
		} finally {
			if (!quiet) {
				isLoadingMessages.value = false;
			}
		}
	};

	const fetchMessages = (conversationId: string): Promise<void> => fetchMessagesInternal(conversationId, false);

	// Lightweight message refresh that skips the isLoadingMessages flag,
	// suitable for background polling without UI flicker.
	// Errors are silently ignored to avoid toast spam during transient network issues.
	const fetchMessagesQuiet = (conversationId: string): Promise<void> => fetchMessagesInternal(conversationId, true);

	const selectConversation = async (id: string): Promise<void> => {
		activeConversationId.value = id;

		await fetchMessages(id);
	};

	const sendMessage = async (content: string): Promise<void> => {
		if (!activeConversationId.value || !content.trim()) {
			return;
		}

		const conversationId = activeConversationId.value;
		const pendingId = `pending_${Date.now()}`;

		// Optimistic: add user message immediately
		const userMessage: IMessage = {
			id: pendingId,
			conversation_id: conversationId,
			role: 'user',
			content: content.trim(),
			created_at: new Date().toISOString(),
		};

		messages.value.push(userMessage);
		isSending.value = true;

		await nextTick();

		try {
			const { error: apiError, response: res } = await backend.client.POST(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}/messages`,
				{
					params: {
						path: { id: conversationId },
					},
					body: { data: { content: content.trim() } },
				},
			);

			if (apiError) {
				// Remove optimistic message on error
				messages.value = messages.value.filter((m) => m.id !== pendingId);

				flashMessage.error(
					res?.status === 503 ? t('buddyModule.messages.errors.providerUnavailable') : t('buddyModule.messages.errors.sendMessage'),
				);

				return;
			}

			// Re-fetch messages to get the real IDs and assistant response.
			// If fetchMessages fails silently, clean up the pending placeholder.
			if (activeConversationId.value === conversationId) {
				await fetchMessages(conversationId);
				messages.value = messages.value.filter((m) => m.id !== pendingId);
			}

			// Update conversation's updated_at locally so the sidebar reflects latest activity
			const conv = conversations.value.find((c) => c.id === conversationId);

			if (conv) {
				conv.updated_at = new Date().toISOString();
				conversations.value.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
			}
		} catch (err: unknown) {
			// Remove optimistic message on error
			messages.value = messages.value.filter((m) => m.id !== pendingId);

			flashMessage.error(err instanceof Error ? err.message : t('buddyModule.messages.errors.sendMessage'));
		} finally {
			isSending.value = false;
		}
	};

	const deleteConversation = async (id: string): Promise<void> => {
		try {
			const { error: apiError } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}`,
				{
					params: {
						path: { id },
					},
				},
			);

			if (apiError) {
				flashMessage.error(t('buddyModule.messages.errors.deleteConversation'));

				return;
			}

			conversations.value = conversations.value.filter((c) => c.id !== id);

			if (activeConversationId.value === id) {
				activeConversationId.value = null;
				messages.value = [];

				// Select the next available conversation — errors here are
				// unrelated to the (already successful) deletion.
				const next = conversations.value[0];

				if (next) {
					try {
						await selectConversation(next.id);
					} catch {
						// selectConversation failure doesn't affect the delete outcome
					}
				}
			}
		} catch (err: unknown) {
			flashMessage.error(err instanceof Error ? err.message : t('buddyModule.messages.errors.deleteConversation'));
		}
	};

	// ============================================
	// TTS / AUDIO PLAYBACK
	// ============================================

	const isTtsConfigured = computed<boolean>(() => {
		if (!ttsProviderStatusesFetched.value) return false;

		return ttsProviderStatuses.value.some((p) => p.selected && p.configured);
	});

	const playingMessageId = ref<string | null>(null);
	const audioLoading = ref<boolean>(false);
	let currentAudio: HTMLAudioElement | null = null;
	let currentBlobUrl: string | null = null;

	const stopAudio = (): void => {
		if (currentAudio) {
			currentAudio.onended = null;
			currentAudio.onerror = null;
			currentAudio.pause();
			currentAudio = null;
		}

		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}

		playingMessageId.value = null;
		audioLoading.value = false;
	};

	let currentAbortController: AbortController | null = null;
	let audioRequestId = 0;

	const playMessageAudio = async (messageId: string): Promise<void> => {
		stopAudio();

		// Abort any in-flight fetch from a previous playMessageAudio call
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}

		const conversationId = activeConversationId.value;

		if (!conversationId) return;

		audioLoading.value = true;
		playingMessageId.value = messageId;

		const requestId = ++audioRequestId;
		const abortController = new AbortController();
		currentAbortController = abortController;

		try {
			const { data: blob, error: apiError } = (await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}/messages/{messageId}/audio`,
				{
					params: { path: { id: conversationId, messageId } },
					signal: abortController.signal,
					parseAs: 'blob',
				} as never,
			)) as { data?: Blob; error?: unknown };

			// Discard if a newer request has been started
			if (requestId !== audioRequestId) return;

			if (apiError || !blob) {
				throw new Error('Failed to fetch audio');
			}

			currentBlobUrl = URL.createObjectURL(blob);

			currentAudio = new Audio(currentBlobUrl);

			currentAudio.onended = () => stopAudio();
			currentAudio.onerror = () => {
				flashMessage.error(t('buddyModule.messages.errors.audioPlayback'));
				stopAudio();
			};

			audioLoading.value = false;
			currentAbortController = null;

			await currentAudio.play();
		} catch (err) {
			// Swallow abort errors — they're expected when switching tracks
			if (err instanceof DOMException && err.name === 'AbortError') return;

			if (requestId === audioRequestId) {
				flashMessage.error(t('buddyModule.messages.errors.audioPlayback'));
				stopAudio();
			}
		}
	};

	onBeforeUnmount(() => {
		stopAudio();
	});

	return {
		conversations,
		activeConversationId,
		messages,
		activeConversation,
		hasActiveConversation,
		isLoadingConversations,
		isLoadingMessages,
		isSending,
		isProviderNotConfigured,
		providerStatuses,
		selectedProviderStatus,
		isTtsConfigured,
		playingMessageId,
		audioLoading,
		fetchConversations,
		fetchProviderStatuses,
		fetchTtsProviderStatuses,
		createConversation,
		selectConversation,
		refreshMessages: fetchMessagesQuiet,
		sendMessage,
		deleteConversation,
		playMessageAudio,
		stopAudio,
	};
};
