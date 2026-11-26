<template>
	<view-header
		v-if="!conversationPage"
		:title="t('buddyModule.headings.chat')"
		:subtitle="t('buddyModule.subHeadings.chat')"
		:actions="chatAvailable ? [{ icon: 'mdi:plus', label: t('buddyModule.buttons.newChat.title'), handler: onCreateConversation }] : []"
		icon="mdi:robot-happy"
	>
		<template
			v-if="chatAvailable"
			#actions
		>
			<el-button
				:loading="isCreating"
				type="primary"
				data-test-id="buddy-new-chat"
				@click="onCreateConversation"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('buddyModule.buttons.newChat.title') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-if="!isModuleEnabled"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<section class="bg-surface border border-solid border-light rounded-lg">
			<state-view
				kind="empty"
				icon="mdi:robot-off"
				:title="t('buddyModule.texts.moduleDisabled')"
				:description="t('buddyModule.texts.moduleDisabledHint')"
				data-test-id="buddy-module-disabled"
			>
				<template #action>
					<el-button
						type="primary"
						@click="router.push(moduleEditRoute)"
					>
						<template #icon>
							<icon icon="mdi:cog" />
						</template>
						{{ t('buddyModule.buttons.goToSettings.title') }}
					</el-button>
				</template>
			</state-view>
		</section>
	</div>

	<!-- Buddy cannot answer without a provider: the whole screen leads to setting one up -->
	<div
		v-else-if="isProviderNotConfigured"
		class="page-pad flex flex-col flex-1 min-h-0 box-border overflow-y-auto"
	>
		<section class="bg-surface border border-solid border-light rounded-lg">
			<buddy-provider-setup
				:selected-provider="selectedProviderStatus"
				:provider-statuses="providerStatuses"
			/>
		</section>
	</div>

	<!-- Template 7 from tablet landscape: the chats in a 320 px pane and the open conversation beside it, each scrolling
	     on its own. Below it the chats, and the conversation as a page of its own -->
	<div
		v-else-if="twoPane"
		class="page-pad flex gap-4 flex-1 min-h-0 box-border"
		data-test-id="buddy-two-pane"
	>
		<section
			:aria-label="t('buddyModule.headings.chats')"
			class="flex flex-col w-[320px] shrink-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden"
		>
			<div class="flex-1 min-h-0 overflow-y-auto">
				<buddy-conversation-list
					:conversations="conversations"
					:active-id="detailId"
					:spaces="spacesForList"
					:loading="!chatDataLoaded || isLoadingConversations"
					@select="onOpen"
					@delete="onDelete"
					@create="onCreateConversation"
				/>
			</div>
		</section>

		<section class="flex flex-col flex-1 min-w-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden">
			<router-view v-slot="{ Component }">
				<component
					:is="Component"
					v-if="Component"
					:loading="!chatDataLoaded"
					in-pane
				/>
				<state-view
					v-else-if="!chatDataLoaded"
					kind="loading"
					icon="mdi:forum-outline"
					:title="t('buddyModule.texts.loadingConversations')"
				/>
				<state-view
					v-else
					kind="empty"
					icon="mdi:chat-outline"
					:title="t('buddyModule.texts.emptyChat')"
					data-test-id="buddy-no-selection"
				/>
			</router-view>
		</section>
	</div>

	<router-view
		v-else-if="detailId"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			:loading="!chatDataLoaded"
		/>
	</router-view>

	<div
		v-else
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<section
			:aria-label="t('buddyModule.headings.chats')"
			class="flex flex-col flex-1 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden"
		>
			<div class="flex-1 min-h-0 overflow-y-auto">
				<buddy-conversation-list
					:conversations="conversations"
					:active-id="null"
					:spaces="spacesForList"
					:loading="!chatDataLoaded || isLoadingConversations"
					@select="onOpen"
					@delete="onDelete"
					@create="onCreateConversation"
				/>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView, ViewHeader, useSizeClass } from '../../../common';
import { useConfigModules } from '../../config/composables/useConfigModules';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { useSpaces } from '../../spaces/composables/useSpaces';
import { BUDDY_MODULE_NAME, RouteNames } from '../buddy.constants';
import BuddyConversationList from '../components/buddy-conversation-list.vue';
import BuddyProviderSetup from '../components/buddy-provider-setup.vue';
import { useBuddyChat } from '../composables/useBuddyChat';
import { provideBuddyChat } from '../composables/useBuddyChatContext';

defineOptions({
	name: 'ViewBuddyChat',
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('buddyModule.meta.chat.title'),
});

const { isPhone, isTabletPortrait } = useSizeClass();

// Template 7: two panes from tablet landscape; below it the chats, then the conversation as a page of its own
const twoPane = computed<boolean>((): boolean => !isPhone.value && !isTabletPortrait.value);

const { enabled, loaded: modulesLoaded, fetchConfigModules } = useConfigModules();
// Optimistic for template — prevents flashing the "disabled" card before config loads
const isModuleEnabled = computed(() => !modulesLoaded.value || enabled(BUDDY_MODULE_NAME));
// Strict for data loading — only load data when we know the module is enabled
const isModuleConfirmedEnabled = computed(() => modulesLoaded.value && enabled(BUDDY_MODULE_NAME));
const moduleEditRoute = { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: BUDDY_MODULE_NAME } };

const { spaces, fetchSpaces } = useSpaces();

const spacesForList = computed(() => spaces.value.map((s) => ({ id: s.id, name: s.name })));

const chat = useBuddyChat();

provideBuddyChat(chat);

const {
	conversations,
	activeConversationId,
	messagesLoadedFor,
	isLoadingConversations,
	isProviderNotConfigured,
	providerStatuses,
	selectedProviderStatus,
	fetchConversations,
	fetchProviderStatuses,
	fetchTtsProviderStatuses,
	createConversation,
	selectConversation,
	closeConversation,
	deleteConversation,
} = chat;

const chatDataLoaded = ref(false);

const isCreating = ref(false);

// The module is on and a provider can answer
const chatAvailable = computed<boolean>(() => isModuleEnabled.value && !isProviderNotConfigured.value);

// The open conversation is the conversation route's: the list, a shared link and New chat all open the same route
const detailId = computed<string | null>((): string | null =>
	route.name === RouteNames.BUDDY_CONVERSATION && typeof route.params.id === 'string' ? route.params.id : null
);

// Below tablet landscape the open conversation is a page of its own, with its own header
const conversationPage = computed<boolean>(() => !twoPane.value && detailId.value !== null && chatAvailable.value);

const onOpen = (id: string): void => {
	void router.push({ name: RouteNames.BUDDY_CONVERSATION, params: { id } });
};

const onCreateConversation = async (): Promise<void> => {
	if (isCreating.value) {
		return;
	}

	isCreating.value = true;

	try {
		const created = await createConversation();

		if (created) {
			onOpen(created.id);
		}
	} finally {
		isCreating.value = false;
	}
};

const titleOf = (id: string): string => conversations.value.find((c) => c.id === id)?.title || t('buddyModule.texts.newConversation');

const onDelete = async (id: string): Promise<void> => {
	const title = titleOf(id);

	try {
		await ElMessageBox.confirm(t('buddyModule.messages.confirmDeleteConversation', { title }), t('buddyModule.headings.deleteConversation'), {
			confirmButtonText: t('buddyModule.buttons.deleteConversation.title'),
			cancelButtonText: t('buddyModule.buttons.cancel.title'),
			confirmButtonType: 'danger',
			type: 'warning',
		});
	} catch {
		return;
	}

	const deleted = await deleteConversation(id);

	// The open conversation going away leaves nothing to show: two panes open the latest one, a single pane the list
	if (deleted && detailId.value === id) {
		const next = conversations.value[0];

		if (twoPane.value && next) {
			void router.replace({ name: RouteNames.BUDDY_CONVERSATION, params: { id: next.id } });
		} else {
			void router.replace({ name: RouteNames.BUDDY });
		}
	}
};

// Two panes open on the latest conversation. Opening Buddy with no conversations at all starts one, so there is
// something to type into; a conversation removed later leaves the pane empty instead
const openDefaultConversation = async (startNew: boolean): Promise<void> => {
	const first = conversations.value[0];

	if (first) {
		await router.replace({ name: RouteNames.BUDDY_CONVERSATION, params: { id: first.id } });
	} else if (startNew && !isProviderNotConfigured.value) {
		await onCreateConversation();
	}
};

// The route says which conversation is open; its messages are read when it changes
const syncConversation = async (initial = false): Promise<void> => {
	if (!chatDataLoaded.value) {
		return;
	}

	const id = detailId.value;

	if (id === null) {
		closeConversation();

		if (twoPane.value && chatAvailable.value) {
			await openDefaultConversation(initial);
		}

		return;
	}

	if (!conversations.value.some((c) => c.id === id)) {
		// The conversation view shows "not found"
		closeConversation();

		return;
	}

	if (activeConversationId.value !== id || messagesLoadedFor.value !== id) {
		await selectConversation(id);
	}
};

const loadChatData = async (): Promise<void> => {
	await Promise.all([fetchSpaces(), fetchProviderStatuses(), fetchTtsProviderStatuses(), fetchConversations()]);

	chatDataLoaded.value = true;

	await syncConversation(true);
};

// Read once, whether the module was known to be on at mount or turned out to be on later
let chatDataRequest: Promise<void> | null = null;

const ensureChatData = (): Promise<void> => {
	chatDataRequest ??= loadChatData();

	return chatDataRequest;
};

watch(detailId, (): void => {
	void syncConversation();
});

// Widening the window to two panes on the list opens a conversation beside it
watch(twoPane, (value: boolean): void => {
	if (value && detailId.value === null) {
		void syncConversation();
	}
});

onBeforeMount(async (): Promise<void> => {
	if (!modulesLoaded.value) {
		await fetchConfigModules();
	}

	if (!isModuleConfirmedEnabled.value) {
		return;
	}

	await ensureChatData();
});

watch(isModuleConfirmedEnabled, async (confirmed): Promise<void> => {
	if (confirmed) {
		await ensureChatData();
	}
});
</script>
