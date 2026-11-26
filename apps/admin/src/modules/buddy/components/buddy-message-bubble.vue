<template>
	<div
		class="flex mb-3"
		:class="isUser ? 'justify-end' : 'justify-start'"
	>
		<div
			class="max-w-[80%] rounded-lg px-3 py-2 break-words"
			:class="isUser ? 'bg-primary text-white' : 'bg-fill-light text-default'"
		>
			<markdown-renderer
				v-if="!isUser"
				:content="message.content"
				class="text-sm"
			/>
			<div
				v-else
				class="text-sm whitespace-pre-wrap"
			>
				{{ message.content }}
			</div>
			<div
				class="flex items-center gap-1 text-xs mt-1 opacity-80"
				:class="isUser ? 'justify-end' : 'justify-start'"
			>
				<time :datetime="message.created_at">{{ formattedTime }}</time>
				<button
					v-if="showSpeaker"
					:aria-label="isPlaying || isLoadingAudio ? t('buddyModule.buttons.stopAudio.title') : t('buddyModule.buttons.playAudio.title')"
					:title="isPlaying || isLoadingAudio ? t('buddyModule.buttons.stopAudio.title') : t('buddyModule.buttons.playAudio.title')"
					type="button"
					class="inline-flex items-center justify-center w-6 h-6 p-0 border-none rounded bg-transparent text-inherit cursor-pointer"
					data-test-id="buddy-message-speaker"
					@click="onSpeakerClick"
				>
					<el-icon
						v-if="isLoadingAudio"
						class="is-loading"
						:size="14"
					>
						<icon icon="mdi:loading" />
					</el-icon>
					<el-icon
						v-else
						:size="14"
					>
						<icon :icon="speakerIcon" />
					</el-icon>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { MarkdownRenderer } from '../../../common';
import type { IMessage } from '../buddy.types';

defineOptions({
	name: 'BuddyMessageBubble',
});

const props = withDefaults(
	defineProps<{
		message: IMessage;
		showSpeaker?: boolean;
		isPlaying?: boolean;
		isLoadingAudio?: boolean;
	}>(),
	{
		showSpeaker: false,
		isPlaying: false,
		isLoadingAudio: false,
	}
);

const emit = defineEmits<{
	(e: 'play', messageId: string): void;
	(e: 'stop'): void;
}>();

const { t } = useI18n();

const isUser = computed<boolean>(() => props.message.role === 'user');

const formattedTime = computed<string>(() => {
	const date = new Date(props.message.created_at);

	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const speakerIcon = computed<string>(() => {
	if (props.isPlaying) return 'mdi:stop-circle-outline';

	return 'mdi:volume-high';
});

const onSpeakerClick = (): void => {
	if (props.isPlaying || props.isLoadingAudio) {
		emit('stop');
	} else {
		emit('play', props.message.id);
	}
};
</script>
