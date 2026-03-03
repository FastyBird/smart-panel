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
				class="text-xs mt-1 opacity-60"
				:class="isUser ? 'text-right' : 'text-left'"
			>
				{{ formattedTime }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { MarkdownRenderer } from '../../../common';

interface IMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
}

defineOptions({
	name: 'BuddyMessageBubble',
});

const props = defineProps<{
	message: IMessage;
}>();

const isUser = computed<boolean>(() => props.message.role === 'user');

const formattedTime = computed<string>(() => {
	const date = new Date(props.message.created_at);

	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});
</script>
