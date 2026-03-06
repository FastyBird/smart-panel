<template>
	<el-collapse
		v-model="activeSection"
		class="mt-4"
	>
		<el-collapse-item
			:title="t('buddyModule.headings.testChat')"
			name="testChat"
		>
			<template #title>
				<div class="flex items-center gap-2">
					<el-icon>
						<icon icon="mdi:chat-outline" />
					</el-icon>
					<span class="font-bold">{{ t('buddyModule.headings.testChat') }}</span>
				</div>
			</template>

			<div
				v-if="isProviderNotConfigured"
				class="py-4 text-center"
			>
				<el-result
					icon="info"
					:title="t('buddyModule.texts.testChatNoProvider')"
					:sub-title="t('buddyModule.texts.testChatNoProviderHint')"
				/>
			</div>

			<div
				v-else
				v-loading="isLoadingConversations"
				:element-loading-text="t('buddyModule.texts.loadingConversations')"
				class="flex gap-3 min-h-[400px]"
			>
				<!-- Conversation sidebar -->
				<div class="w-[200px] shrink-0 flex flex-col b-r b-r-solid b-r-[var(--el-border-color-light)]">
					<div class="flex items-center justify-between px-2 py-2 b-b b-b-solid b-b-[var(--el-border-color-light)]">
						<span class="text-sm font-bold">{{ t('buddyModule.headings.chats') }}</span>
						<el-button
							type="primary"
							size="small"
							text
							@click="onCreateConversation"
						>
							<el-icon>
								<icon icon="mdi:plus" />
							</el-icon>
						</el-button>
					</div>

					<el-scrollbar class="flex-1">
						<div
							v-for="conversation in conversations"
							:key="conversation.id"
							class="group flex items-center gap-1 px-2 py-2 cursor-pointer hover:bg-[var(--el-fill-color-light)]"
							:class="{ 'bg-[var(--el-fill-color)]': conversation.id === activeConversationId }"
							@click="selectConversation(conversation.id)"
						>
							<div class="grow-1 min-w-0">
								<div class="text-xs truncate">
									{{ conversation.title || t('buddyModule.texts.newConversation') }}
								</div>
							</div>

							<el-popconfirm
								:title="t('buddyModule.texts.confirmDelete')"
								:confirm-button-text="t('buddyModule.buttons.delete.title')"
								:cancel-button-text="t('buddyModule.buttons.cancel.title')"
								@confirm="onDeleteConversation(conversation.id)"
							>
								<template #reference>
									<el-button
										class="opacity-0 group-hover:opacity-100"
										size="small"
										text
										@click.stop
									>
										<el-icon :size="14">
											<icon icon="mdi:delete-outline" />
										</el-icon>
									</el-button>
								</template>
							</el-popconfirm>
						</div>

						<div
							v-if="conversations.length === 0 && !isLoadingConversations"
							class="px-2 py-4 text-xs text-center text-[var(--el-text-color-placeholder)]"
						>
							{{ t('buddyModule.texts.testChatNoConversations') }}
						</div>
					</el-scrollbar>
				</div>

				<!-- Chat area -->
				<div class="flex-1 flex flex-col min-h-0">
					<template v-if="!hasActiveConversation && !isLoadingMessages">
						<div class="flex items-center justify-center h-full">
							<el-empty
								:image-size="60"
								:description="t('buddyModule.texts.testChatSelectOrCreate')"
							/>
						</div>
					</template>

					<template v-else>
						<el-scrollbar
							ref="scrollbarRef"
							class="grow-1 px-3 py-2"
						>
							<div ref="messagesContainerRef">
								<el-empty
									v-if="messages.length === 0 && !isLoadingMessages && !error"
									:image-size="60"
									:description="t('buddyModule.texts.startConversation')"
								/>

								<buddy-message-bubble
									v-for="message in messages"
									:key="message.id"
									:message="message"
								/>

								<div
									v-if="isSending"
									class="flex justify-start mb-3"
								>
									<div class="bg-[var(--el-fill-color-light)] rounded-lg px-3 py-2">
										<div class="flex items-center gap-2 text-sm text-[var(--el-text-color-secondary)]">
											<el-icon class="is-loading">
												<icon icon="mdi:loading" />
											</el-icon>
											{{ t('buddyModule.texts.thinking') }}
										</div>
									</div>
								</div>

								<el-alert
									v-if="error"
									type="error"
									:title="error"
									show-icon
									closable
									class="mt-2"
									@close="error = null"
								/>
							</div>
						</el-scrollbar>

						<div class="flex items-end gap-2 px-3 py-2 b-t b-t-solid b-t-[var(--el-border-color-light)]">
							<el-input
								v-model="inputMessage"
								type="textarea"
								:autosize="{ minRows: 1, maxRows: 4 }"
								resize="none"
								:placeholder="t('buddyModule.fields.message.placeholder')"
								:disabled="isSending"
								@keydown.enter.exact.prevent="onSend"
							/>
							<el-button
								type="primary"
								:disabled="!inputMessage.trim() || isSending"
								@click="onSend"
							>
								<el-icon>
									<icon icon="mdi:send" />
								</el-icon>
							</el-button>
						</div>
					</template>
				</div>
			</div>
		</el-collapse-item>
	</el-collapse>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCollapse, ElCollapseItem, ElEmpty, ElIcon, ElInput, ElPopconfirm, ElResult, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBuddyChat } from '../composables/useBuddyChat';
import BuddyMessageBubble from './buddy-message-bubble.vue';

defineOptions({
	name: 'BuddyTestChat',
});

const POLL_INTERVAL_MS = 3000;

const { t } = useI18n();

const activeSection = ref<string[]>([]);
const inputMessage = ref<string>('');
const scrollbarRef = ref<InstanceType<typeof ElScrollbar> | null>(null);
const messagesContainerRef = ref<HTMLDivElement | null>(null);

let pollTimer: ReturnType<typeof setTimeout> | null = null;

const {
	conversations,
	activeConversationId,
	messages,
	hasActiveConversation,
	isLoadingConversations,
	isLoadingMessages,
	isSending,
	error,
	isProviderNotConfigured,
	fetchConversations,
	fetchProviderStatuses,
	createConversation,
	selectConversation,
	refreshMessages,
	sendMessage,
	deleteConversation,
} = useBuddyChat();

const scrollToBottom = (): void => {
	nextTick(() => {
		if (scrollbarRef.value) {
			scrollbarRef.value.setScrollTop(messagesContainerRef.value?.scrollHeight ?? 0);
		}
	});
};

const onSend = async (): Promise<void> => {
	const content = inputMessage.value.trim();

	if (!content || isSending.value) {
		return;
	}

	inputMessage.value = '';
	await sendMessage(content);
};

const onCreateConversation = async (): Promise<void> => {
	await createConversation();
};

const onDeleteConversation = async (id: string): Promise<void> => {
	await deleteConversation(id);
};

// --- Polling ---

let pollingActive = false;

const schedulePoll = async (): Promise<void> => {
	if (!pollingActive || !activeConversationId.value) {
		return;
	}

	if (!isSending.value) {
		// Use refreshMessages instead of selectConversation to avoid clearing
		// any error currently displayed to the user
		await refreshMessages(activeConversationId.value);
	}

	// Schedule the next poll only if polling wasn't stopped during the await
	if (pollingActive) {
		pollTimer = setTimeout(() => {
			void schedulePoll();
		}, POLL_INTERVAL_MS);
	}
};

const startPolling = (): void => {
	stopPolling();
	pollingActive = true;

	pollTimer = setTimeout(() => {
		void schedulePoll();
	}, POLL_INTERVAL_MS);
};

const stopPolling = (): void => {
	pollingActive = false;

	if (pollTimer !== null) {
		clearTimeout(pollTimer);
		pollTimer = null;
	}
};

// Start/stop polling based on active conversation
watch(activeConversationId, (id) => {
	if (id) {
		startPolling();
	} else {
		stopPolling();
	}
});

// Stop polling when section is collapsed
watch(activeSection, (val) => {
	if (!val.includes('testChat')) {
		stopPolling();
	} else if (activeConversationId.value) {
		startPolling();
	}
});

// Load data when section is expanded
watch(
	activeSection,
	async (val) => {
		if (val.includes('testChat') && conversations.value.length === 0) {
			await Promise.all([fetchProviderStatuses(), fetchConversations()]);

			// Re-check the section is still expanded after the async gap
			if (!activeSection.value.includes('testChat')) {
				return;
			}

			const first = conversations.value[0];

			if (first) {
				await selectConversation(first.id);
			}
		}
	},
	{ immediate: false }
);

// Scroll on new messages
watch(
	() => messages.value.length,
	() => {
		scrollToBottom();
	}
);

watch(
	() => isSending.value,
	(val: boolean) => {
		if (val) {
			scrollToBottom();
		}
	}
);

onBeforeUnmount(() => {
	stopPolling();
});
</script>
