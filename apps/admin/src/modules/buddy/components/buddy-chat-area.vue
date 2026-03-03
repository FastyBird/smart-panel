<template>
	<div class="flex flex-col h-full">
		<template v-if="isProviderNotConfigured">
			<div class="flex items-center justify-center h-full">
				<div class="max-w-md w-full">
					<!-- No provider selected -->
					<el-result
						v-if="!selectedProvider"
						icon="warning"
						:title="t('buddyModule.texts.noProviderSelected')"
						:sub-title="t('buddyModule.texts.noProviderSelectedHint')"
					>
						<template #extra>
							<el-button
								type="primary"
								@click="router.push('/config/modules/buddy-module')"
							>
								{{ t('buddyModule.buttons.configure.title') }}
							</el-button>
						</template>
					</el-result>

					<!-- Provider selected but not enabled -->
					<el-result
						v-else-if="!selectedProvider.enabled"
						icon="warning"
						:title="t('buddyModule.texts.providerNotEnabled', { name: selectedProvider.name })"
						:sub-title="t('buddyModule.texts.providerNotEnabledHint')"
					>
						<template #extra>
							<el-button
								type="primary"
								@click="router.push(`/config/plugins/${selectedProvider.type}`)"
							>
								{{ t('buddyModule.buttons.configure.title') }}
							</el-button>
						</template>
					</el-result>

					<!-- Provider selected & enabled but not configured -->
					<el-result
						v-else
						icon="warning"
						:title="t('buddyModule.texts.providerMissingConfig', { name: selectedProvider.name })"
						:sub-title="t('buddyModule.texts.providerMissingConfigHint')"
					>
						<template #extra>
							<el-button
								type="primary"
								@click="router.push(`/config/plugins/${selectedProvider.type}`)"
							>
								{{ t('buddyModule.buttons.configure.title') }}
							</el-button>
						</template>
					</el-result>

					<!-- Other available providers -->
					<div
						v-if="otherProviders.length > 0"
						class="mt-4 px-4"
					>
						<div class="text-sm text-[var(--el-text-color-secondary)] mb-2">
							{{ t('buddyModule.texts.availableProviders') }}
						</div>

						<div class="flex flex-col gap-1">
							<div
								v-for="provider in otherProviders"
								:key="provider.type"
								class="flex items-center justify-between text-sm py-1"
							>
								<span>{{ provider.name }}</span>
								<el-tag
									:type="provider.configured ? 'success' : 'info'"
									size="small"
								>
									{{ provider.configured ? t('buddyModule.texts.configured') : t('buddyModule.texts.notConfigured') }}
								</el-tag>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>

		<template v-else-if="!hasActiveConversation && !isLoadingMessages">
			<div class="flex items-center justify-center h-full">
				<el-empty :description="t('buddyModule.texts.emptyChat')" />
			</div>
		</template>

		<template v-else>
			<el-scrollbar
				ref="scrollbarRef"
				class="grow-1 p-4"
			>
				<div ref="messagesContainerRef">
					<el-empty
						v-if="messages.length === 0 && !isLoadingMessages && !error"
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
						@close="emit('dismiss-error')"
					/>
				</div>
			</el-scrollbar>

			<div class="flex items-end gap-2 p-3 b-t b-t-solid b-t-[var(--el-border-color-light)]">
				<el-input
					v-model="inputMessage"
					type="textarea"
					:autosize="{ minRows: 1, maxRows: 6 }"
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
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElEmpty, ElIcon, ElInput, ElResult, ElScrollbar, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IProviderStatus } from '../composables/useBuddyProviders';
import BuddyMessageBubble from './buddy-message-bubble.vue';

interface IMessage {
	id: string;
	conversation_id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
}

defineOptions({
	name: 'BuddyChatArea',
});

const props = defineProps<{
	messages: IMessage[];
	isSending: boolean;
	isLoadingMessages: boolean;
	hasActiveConversation: boolean;
	isProviderNotConfigured: boolean;
	error: string | null;
	selectedProvider?: IProviderStatus;
	providerStatuses: IProviderStatus[];
}>();

const emit = defineEmits<{
	(e: 'send', content: string): void;
	(e: 'dismiss-error'): void;
}>();

const { t } = useI18n();
const router = useRouter();

const inputMessage = ref<string>('');
const scrollbarRef = ref<InstanceType<typeof ElScrollbar> | null>(null);
const messagesContainerRef = ref<HTMLDivElement | null>(null);

const otherProviders = computed<IProviderStatus[]>(() => {
	return props.providerStatuses.filter((p) => !p.selected);
});

const scrollToBottom = (): void => {
	nextTick(() => {
		if (scrollbarRef.value) {
			scrollbarRef.value.setScrollTop(messagesContainerRef.value?.scrollHeight ?? 0);
		}
	});
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
	() => props.messages.length,
	() => {
		scrollToBottom();
	}
);

watch(
	() => props.isSending,
	(val: boolean) => {
		if (val) {
			scrollToBottom();
		}
	}
);

watch(
	() => props.error,
	(val: string | null) => {
		if (val) {
			scrollToBottom();
		}
	}
);
</script>
