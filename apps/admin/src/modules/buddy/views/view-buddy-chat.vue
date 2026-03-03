<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:robot-happy"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('buddyModule.headings.chat') }}
		</template>

		<template #subtitle>
			{{ t('buddyModule.subHeadings.chat') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('buddyModule.buttons.back.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('buddyModule.headings.chat')"
		:sub-heading="t('buddyModule.subHeadings.chat')"
		:icon="'mdi:robot-happy'"
	/>

	<template v-if="isModuleEnabled">
		<div
			v-loading="isLoadingConversations"
			:element-loading-text="t('buddyModule.texts.loadingConversations')"
			class="flex overflow-hidden grow-1 min-h-0 lt-sm:mx-1 sm:mx-2 lt-sm:my-1 sm:my-2 gap-4"
		>
			<el-card
				shadow="never"
				class="w-[250px] shrink-0 flex flex-col"
				body-class="p-0! flex-1 min-h-0 overflow-hidden"
			>
				<template #header>
					<div class="flex items-center justify-between">
						<span class="font-bold">{{ t('buddyModule.headings.chats') }}</span>
						<el-button
							type="primary"
							size="small"
							@click="onCreateConversation"
						>
							<el-icon class="mr-1">
								<icon icon="mdi:plus" />
							</el-icon>
							{{ t('buddyModule.buttons.newChat.title') }}
						</el-button>
					</div>
				</template>

				<buddy-conversation-list
					:conversations="conversations"
					:active-id="activeConversationId"
					:spaces="spacesForList"
					@select="selectConversation"
					@delete="deleteConversation"
				/>
			</el-card>

			<el-card
				shadow="never"
				class="flex-1 min-h-0 flex flex-col"
				body-class="p-0! flex-1 min-h-0 flex flex-col"
			>
				<template #header>
					<div class="flex items-center gap-2">
						<span class="font-bold">{{ activeConversationTitle }}</span>
						<span
							v-if="activeConversationSpace"
							class="text-sm text-[var(--el-text-color-secondary)]"
						>
							&middot; {{ activeConversationSpace }}
						</span>
					</div>
				</template>

				<buddy-chat-area
					:messages="messages"
					:is-sending="isSending"
					:is-loading-messages="isLoadingMessages"
					:has-active-conversation="hasActiveConversation"
					:is-provider-not-configured="isProviderNotConfigured"
					:error="error"
					:selected-provider="selectedProviderStatus"
					:provider-statuses="providerStatuses"
					@send="sendMessage"
					@dismiss-error="error = null"
				/>
			</el-card>
		</div>
	</template>

	<div
		v-else
		class="flex items-center justify-center grow-1 min-h-0 lt-sm:mx-1 sm:mx-2 lt-sm:my-1 sm:my-2"
	>
		<el-card
			shadow="never"
			class="max-w-md text-center"
		>
			<div class="flex flex-col items-center gap-4 py-4">
				<el-icon
					:size="48"
					color="var(--el-text-color-secondary)"
				>
					<icon icon="mdi:robot-off" />
				</el-icon>

				<h3 class="text-lg font-semibold m-0">
					{{ t('buddyModule.texts.moduleDisabled') }}
				</h3>

				<p class="text-[var(--el-text-color-secondary)] m-0">
					{{ t('buddyModule.texts.moduleDisabledHint') }}
				</p>

				<el-button
					type="primary"
					@click="router.push({ name: configRouteName })"
				>
					<el-icon class="mr-1">
						<icon icon="mdi:cog" />
					</el-icon>
					{{ t('buddyModule.buttons.goToSettings.title') }}
				</el-button>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { useConfigModules } from '../../config/composables/useConfigModules';
import { useSpaces } from '../../spaces/composables/useSpaces';
import BuddyConversationList from '../components/buddy-conversation-list.vue';
import BuddyChatArea from '../components/buddy-chat-area.vue';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { useBuddyChat } from '../composables/useBuddyChat';

defineOptions({
	name: 'ViewBuddyChat',
});

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('buddyModule.meta.chat.title'),
});

const { isMDDevice } = useBreakpoints();

const { enabled } = useConfigModules();
const isModuleEnabled = computed(() => enabled(BUDDY_MODULE_NAME));
const configRouteName = ConfigRouteNames.CONFIG;

const { spaces, fetchSpaces } = useSpaces();

const spacesForList = computed(() => spaces.value.map((s) => ({ id: s.id, name: s.name })));

const {
	conversations,
	activeConversationId,
	activeConversation,
	messages,
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
} = useBuddyChat();

const activeConversationTitle = computed(() => {
	if (!activeConversation.value) {
		return t('buddyModule.texts.noActiveConversation');
	}

	return activeConversation.value.title || t('buddyModule.texts.newConversation');
});

const activeConversationSpace = computed<string | null>(() => {
	const spaceId = activeConversation.value?.space_id;

	if (!spaceId) {
		return null;
	}

	const space = spacesForList.value.find((s) => s.id === spaceId);

	return space?.name ?? null;
});

const onCreateConversation = async (): Promise<void> => {
	await createConversation();
};

onBeforeMount(async (): Promise<void> => {
	await fetchSpaces();
	await fetchProviderStatuses();
	await fetchConversations();

	if (conversations.value.length > 0) {
		await selectConversation(conversations.value[0].id);
	} else {
		await createConversation();
	}
});
</script>
