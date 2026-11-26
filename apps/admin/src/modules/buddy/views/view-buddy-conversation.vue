<template>
	<!-- On phone the main area scrolls the page; a chat keeps its composer in view instead, so it fills the main area and
	     scrolls its messages inside -->
	<div
		:class="['flex flex-col min-h-0', isPhone && !props.inPane ? 'h-full box-border' : 'flex-1']"
		data-test-id="view-buddy-conversation"
	>
		<!-- One conversation. In the chat's right pane from tablet landscape; below it its own page, with the header leading
		     back to the chats. The chat view, its parent route, owns the data -->
		<view-header
			v-if="!props.inPane"
			:title="title"
			:subtitle="spaceName ?? undefined"
			:back="backRoute"
			icon="mdi:robot-happy"
		/>

		<div :class="props.inPane ? 'flex flex-col flex-1 min-h-0' : 'page-pad flex flex-col flex-1 min-h-0 box-border'">
			<div :class="['flex flex-col flex-1 min-h-0', props.inPane ? '' : 'bg-surface border border-solid border-light rounded-lg overflow-hidden']">
				<template v-if="conversation">
					<div
						v-if="props.inPane"
						class="flex items-baseline gap-2 min-w-0 px-4 py-3 shrink-0 border-b border-b-solid border-light"
					>
						<h2 class="text-card-title m-0 truncate">{{ title }}</h2>
						<span
							v-if="spaceName"
							class="text-caption shrink-0"
						>
							{{ spaceName }}
						</span>
					</div>

					<buddy-chat-area
						:key="conversation.id"
						:messages="messages"
						:is-sending="isSending"
						:loaded="messagesLoadedFor === conversation.id"
						:failed="messagesFailedFor === conversation.id"
						:is-tts-configured="isTtsConfigured"
						:playing-message-id="playingMessageId"
						:audio-loading="audioLoading"
						@send="sendMessage"
						@play-audio="playMessageAudio"
						@stop-audio="stopAudio"
						@retry="selectConversation(conversation.id)"
					/>
				</template>

				<state-view
					v-else-if="props.loading"
					kind="loading"
					icon="mdi:forum-outline"
					:title="t('buddyModule.texts.loadingConversations')"
				/>

				<state-view
					v-else
					kind="not-found"
					icon="mdi:chat-remove-outline"
					:title="t('buddyModule.texts.conversationNotFound')"
					data-test-id="buddy-conversation-not-found"
				>
					<template #action>
						<el-button
							plain
							@click="router.push(backRoute)"
						>
							{{ t('buddyModule.buttons.backToChats.title') }}
						</el-button>
					</template>
				</state-view>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { StateView, ViewHeader, useSizeClass } from '../../../common';
import { useSpaces } from '../../spaces/composables/useSpaces';
import { RouteNames } from '../buddy.constants';
import type { IConversation } from '../buddy.types';
import BuddyChatArea from '../components/buddy-chat-area.vue';
import { injectBuddyChat } from '../composables/useBuddyChatContext';

defineOptions({
	name: 'ViewBuddyConversation',
});

const props = withDefaults(
	defineProps<{
		/** The chats are still being read */
		loading?: boolean;
		inPane?: boolean;
	}>(),
	{
		loading: false,
		inPane: false,
	}
);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { isPhone } = useSizeClass();

const { spaces } = useSpaces();

const {
	conversations,
	messages,
	messagesLoadedFor,
	messagesFailedFor,
	isSending,
	isTtsConfigured,
	playingMessageId,
	audioLoading,
	sendMessage,
	playMessageAudio,
	stopAudio,
	selectConversation,
} = injectBuddyChat();

const backRoute: RouteLocationRaw = { name: RouteNames.BUDDY };

// From the route, not the chat's active id: the conversation shows as soon as the chats are read, while its messages
// are still on their way
const conversation = computed<IConversation | undefined>(() => {
	const id = route.params.id;

	return typeof id === 'string' ? conversations.value.find((c) => c.id === id) : undefined;
});

const title = computed<string>(() => {
	if (conversation.value) {
		return conversation.value.title || t('buddyModule.texts.newConversation');
	}

	return t('buddyModule.headings.chat');
});

const spaceName = computed<string | null>(() => {
	const spaceId = conversation.value?.space_id;

	if (!spaceId) {
		return null;
	}

	return spaces.value.find((s) => s.id === spaceId)?.name ?? null;
});
</script>
