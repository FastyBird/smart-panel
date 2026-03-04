import { type ComputedRef, type Ref, computed, nextTick, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';
import type { IConversation, IMessage } from '../buddy.types';

import { type IProviderStatus, useBuddyProviders } from './useBuddyProviders';

interface IUseBuddyChat {
	conversations: Ref<IConversation[]>;
	activeConversationId: Ref<string | null>;
	messages: Ref<IMessage[]>;
	activeConversation: ComputedRef<IConversation | undefined>;
	hasActiveConversation: ComputedRef<boolean>;
	isLoadingConversations: Ref<boolean>;
	isLoadingMessages: Ref<boolean>;
	isSending: Ref<boolean>;
	error: Ref<string | null>;
	isProviderNotConfigured: ComputedRef<boolean>;
	providerStatuses: Ref<IProviderStatus[]>;
	selectedProviderStatus: ComputedRef<IProviderStatus | undefined>;
	fetchConversations: () => Promise<void>;
	fetchProviderStatuses: () => Promise<void>;
	createConversation: (title?: string) => Promise<IConversation | undefined>;
	selectConversation: (id: string) => Promise<void>;
	sendMessage: (content: string) => Promise<void>;
	deleteConversation: (id: string) => Promise<void>;
}

export const useBuddyChat = (): IUseBuddyChat => {
	const backend = useBackend();
	const { providerStatuses, providerStatusesFetched, fetchProviderStatuses } = useBuddyProviders();

	const conversations = ref<IConversation[]>([]);
	const activeConversationId = ref<string | null>(null);
	const messages = ref<IMessage[]>([]);

	const isLoadingConversations = ref<boolean>(false);
	const isLoadingMessages = ref<boolean>(false);
	const isSending = ref<boolean>(false);
	const error = ref<string | null>(null);

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

	const extractApiError = (response: unknown): { status: number; message: string } | null => {
		const res = response as {
			response?: { status?: number };
			error?: { error?: { message?: string }; status?: number };
		};

		const status = res.response?.status ?? res.error?.status;
		const message = res.error?.error?.message;

		if (typeof status === 'number' && status >= 400) {
			return { status, message: message ?? 'An unexpected error occurred' };
		}

		return null;
	};

	const fetchConversations = async (): Promise<void> => {
		isLoadingConversations.value = true;
		error.value = null;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations` as never);

			const apiError = extractApiError(response);

			if (apiError) {
				if (apiError.status !== 503) {
					error.value = apiError.message;
				}

				return;
			}

			const responseData = (response as { data?: { data: IConversation[] } }).data;

			if (typeof responseData !== 'undefined') {
				conversations.value = responseData.data;
			}
		} catch (err: unknown) {
			error.value = err instanceof Error ? err.message : 'Failed to load conversations';
		} finally {
			isLoadingConversations.value = false;
		}
	};

	const createConversation = async (title?: string): Promise<IConversation | undefined> => {
		error.value = null;

		try {
			const response = await backend.client.POST(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations` as never, {
				body: { data: { title: title ?? null } },
			} as never);

			const apiError = extractApiError(response);

			if (apiError) {
				if (apiError.status !== 503) {
					error.value = apiError.message;
				}

				return undefined;
			}

			const responseData = (response as { data?: { data: IConversation } }).data;

			if (typeof responseData !== 'undefined') {
				conversations.value.unshift(responseData.data);
				activeConversationId.value = responseData.data.id;
				messages.value = [];

				return responseData.data;
			}
		} catch (err: unknown) {
			error.value = err instanceof Error ? err.message : 'Failed to create conversation';
		}

		return undefined;
	};

	const fetchMessages = async (conversationId: string): Promise<void> => {
		isLoadingMessages.value = true;

		try {
			const response = await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}/messages` as never,
				{
					params: {
						path: { id: conversationId },
					},
				} as never
			);

			const apiError = extractApiError(response);

			if (apiError) {
				if (apiError.status !== 503) {
					error.value = apiError.message;
				}

				return;
			}

			const responseData = (response as { data?: { data: IMessage[] } }).data;

			if (typeof responseData !== 'undefined' && activeConversationId.value === conversationId) {
				messages.value = responseData.data;
			}
		} catch (err: unknown) {
			error.value = err instanceof Error ? err.message : 'Failed to load messages';
		} finally {
			isLoadingMessages.value = false;
		}
	};

	const selectConversation = async (id: string): Promise<void> => {
		activeConversationId.value = id;
		error.value = null;

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
		error.value = null;

		await nextTick();

		try {
			const response = await backend.client.POST(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}/messages` as never,
				{
					params: {
						path: { id: conversationId },
					},
					body: { data: { content: content.trim() } },
				} as never
			);

			const apiError = extractApiError(response);

			if (apiError) {
				// Remove optimistic message on error
				messages.value = messages.value.filter((m) => m.id !== pendingId);

				error.value = apiError.status === 503 ? 'The AI provider is temporarily unavailable. Please try again later.' : apiError.message;

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
			}
		} catch (err: unknown) {
			// Remove optimistic message on error
			messages.value = messages.value.filter((m) => m.id !== pendingId);

			error.value = err instanceof Error ? err.message : 'Failed to send message';
		} finally {
			isSending.value = false;
		}
	};

	const deleteConversation = async (id: string): Promise<void> => {
		error.value = null;

		try {
			const response = await backend.client.DELETE(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/conversations/{id}` as never, {
				params: {
					path: { id },
				},
			} as never);

			const apiError = extractApiError(response);

			if (apiError) {
				error.value = apiError.message;

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
			error.value = err instanceof Error ? err.message : 'Failed to delete conversation';
		}
	};

	return {
		conversations,
		activeConversationId,
		messages,
		activeConversation,
		hasActiveConversation,
		isLoadingConversations,
		isLoadingMessages,
		isSending,
		error,
		isProviderNotConfigured,
		providerStatuses,
		selectedProviderStatus,
		fetchConversations,
		fetchProviderStatuses,
		createConversation,
		selectConversation,
		sendMessage,
		deleteConversation,
	};
};
