<template>
	<div
		class="flex flex-col flex-1 min-h-0"
		data-test-id="buddy-chat-area"
	>
		<state-view
			v-if="!props.loaded && props.failed"
			kind="error"
			icon="mdi:chat-alert-outline"
			:title="t('buddyModule.texts.messagesFailed')"
			data-test-id="buddy-chat-failed"
		>
			<template #action>
				<el-button
					plain
					data-test-id="buddy-chat-retry"
					@click="emit('retry')"
				>
					{{ t('buddyModule.buttons.retry.title') }}
				</el-button>
			</template>
		</state-view>

		<state-view
			v-else-if="!props.loaded"
			kind="loading"
			icon="mdi:chat-outline"
			:title="t('buddyModule.texts.loadingMessages')"
		/>

		<template v-else>
			<div
				ref="scrollEl"
				class="flex-1 min-h-0 overflow-y-auto p-4"
				data-test-id="buddy-chat-messages"
			>
				<state-view
					v-if="props.messages.length === 0 && !props.isSending"
					kind="empty"
					icon="mdi:chat-outline"
					:title="t('buddyModule.texts.startConversation')"
				/>

				<template v-else>
					<!-- A chronological feed (spec section 5): the latest messages first, earlier ones with Load more -->
					<div
						v-if="hiddenCount > 0"
						class="flex justify-center mb-3"
					>
						<el-button
							plain
							data-test-id="buddy-chat-load-more"
							@click="onLoadMore"
						>
							{{ t('buddyModule.buttons.loadMore.title') }}
						</el-button>
					</div>

					<div
						role="log"
						:aria-label="t('buddyModule.aria.messages')"
					>
						<buddy-message-bubble
							v-for="message in shownMessages"
							:key="message.id"
							:message="message"
							:show-speaker="props.isTtsConfigured && message.role === 'assistant'"
							:is-playing="props.playingMessageId === message.id && !props.audioLoading"
							:is-loading-audio="props.playingMessageId === message.id && props.audioLoading"
							@play="emit('play-audio', $event)"
							@stop="emit('stop-audio')"
						/>
					</div>

					<div
						v-if="props.isSending"
						class="flex justify-start mb-3"
						role="status"
					>
						<div class="bg-fill-light rounded-lg px-3 py-2">
							<div class="flex items-center gap-2 text-help">
								<el-icon class="is-loading">
									<icon icon="mdi:loading" />
								</el-icon>
								{{ t('buddyModule.texts.thinking') }}
							</div>
						</div>
					</div>
				</template>
			</div>

			<form
				:style="keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined"
				class="flex items-end gap-2 p-3 shrink-0 border-t border-t-solid border-light bg-surface"
				data-test-id="buddy-chat-composer"
				@submit.prevent="onSend"
			>
				<el-input
					v-model="inputMessage"
					type="textarea"
					:autosize="{ minRows: 1, maxRows: 6 }"
					resize="none"
					:placeholder="t('buddyModule.fields.message.placeholder')"
					:aria-label="t('buddyModule.fields.message.title')"
					:disabled="props.isSending"
					@keydown.enter.exact.prevent="onSend"
				/>
				<el-tooltip
					:content="t('buddyModule.buttons.send.title')"
					placement="top"
				>
					<el-button
						:aria-label="t('buddyModule.buttons.send.title')"
						:disabled="!inputMessage.trim() || props.isSending"
						type="primary"
						native-type="submit"
						data-test-id="buddy-chat-send"
					>
						<template #icon>
							<icon icon="mdi:send" />
						</template>
					</el-button>
				</el-tooltip>
			</form>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElInput, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView } from '../../../common';
import { useKeyboardOffset } from '../../../common/composables/useKeyboardOffset';
import { BUDDY_MESSAGES_PAGE_SIZE } from '../buddy.constants';
import type { IMessage } from '../buddy.types';

import BuddyMessageBubble from './buddy-message-bubble.vue';

defineOptions({
	name: 'BuddyChatArea',
});

const props = withDefaults(
	defineProps<{
		messages: IMessage[];
		isSending: boolean;
		/** The conversation's messages have been read once; until then the chat waits */
		loaded: boolean;
		/** Reading the conversation's messages failed; the chat offers to read them again */
		failed?: boolean;
		isTtsConfigured?: boolean;
		playingMessageId?: string | null;
		audioLoading?: boolean;
	}>(),
	{
		failed: false,
		isTtsConfigured: false,
		playingMessageId: null,
		audioLoading: false,
	}
);

const emit = defineEmits<{
	(e: 'send', content: string): void;
	(e: 'play-audio', messageId: string): void;
	(e: 'stop-audio'): void;
	(e: 'retry'): void;
}>();

const { t } = useI18n();

// The composer rides above the on-screen keyboard like the form footer (spec section 6)
const { offset: keyboardOffset } = useKeyboardOffset();

const inputMessage = ref<string>('');
const scrollEl = ref<HTMLElement | null>(null);

// How many of the earliest messages are left out. Set once the conversation's messages are read, so the chat opens on
// its latest page; new messages add to the end and leave it as it is
const hiddenCount = ref<number>(0);

const shownMessages = computed<IMessage[]>(() => props.messages.slice(hiddenCount.value));

const scrollToBottom = (smooth: boolean): void => {
	// Twice: the first tick renders the messages, the second lets the markdown inside them lay out
	nextTick(() => {
		nextTick(() => {
			const el = scrollEl.value;

			if (el) {
				el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
			}
		});
	});
};

const onLoadMore = async (): Promise<void> => {
	const el = scrollEl.value;
	const before = el?.scrollHeight ?? 0;

	hiddenCount.value = Math.max(0, hiddenCount.value - BUDDY_MESSAGES_PAGE_SIZE);

	await nextTick();

	// The messages already read stay where they were; the earlier ones open above them
	if (el) {
		el.scrollTop += el.scrollHeight - before;
	}
};

const onSend = (): void => {
	const content = inputMessage.value.trim();

	if (!content || props.isSending) {
		return;
	}

	inputMessage.value = '';
	emit('send', content);
};

watch(
	() => props.loaded,
	(loaded: boolean): void => {
		if (loaded) {
			hiddenCount.value = Math.max(0, props.messages.length - BUDDY_MESSAGES_PAGE_SIZE);

			scrollToBottom(false);
		}
	},
	{ immediate: true }
);

// A message sent or answered: the chat follows it. Re-reading the messages after a send can shorten the list for a
// moment (the pending message is swapped for the stored one), so the hidden count never passes its end
watch(
	() => props.messages.length,
	(length: number, previous: number | undefined): void => {
		if (hiddenCount.value > length) {
			hiddenCount.value = Math.max(0, length - BUDDY_MESSAGES_PAGE_SIZE);
		}

		if (props.loaded && length > (previous ?? 0)) {
			scrollToBottom(true);
		}
	}
);

watch(
	() => props.isSending,
	(sending: boolean): void => {
		if (sending) {
			scrollToBottom(true);
		}
	}
);
</script>
