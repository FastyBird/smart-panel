<template>
	<div
		class="flex mb-3"
		:class="isUser ? 'justify-end' : 'justify-start'"
	>
		<div
			class="max-w-[80%] rounded-lg px-3 py-2"
			:class="isUser ? 'bg-[var(--el-color-primary)] text-white' : 'bg-[var(--el-fill-color-light)]'"
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
				class="flex items-center gap-1 text-xs mt-1 opacity-60"
				:class="isUser ? 'justify-end' : 'justify-start'"
			>
				<span>{{ formattedTime }}</span>
				<button
					v-if="showSpeaker"
					class="inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-none bg-transparent cursor-pointer opacity-70 hover:opacity-100"
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
