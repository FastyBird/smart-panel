<template>
	<div
		class="flex flex-col"
		data-test-id="buddy-conversation-list"
	>
		<!-- The list side of the chat (template 7): the latest conversation first, the open one highlighted -->
		<state-view
			v-if="props.conversations.length === 0 && props.loading"
			kind="loading"
			icon="mdi:forum-outline"
			:title="t('buddyModule.texts.loadingConversations')"
		/>

		<state-view
			v-else-if="props.conversations.length === 0"
			kind="empty"
			icon="mdi:forum-outline"
			:title="t('buddyModule.texts.noConversations')"
			:description="t('buddyModule.texts.noConversationsHint')"
		>
			<template
				v-if="props.canCreate"
				#action
			>
				<el-button
					type="primary"
					data-test-id="buddy-conversation-list-new"
					@click="emit('create')"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('buddyModule.buttons.newChat.title') }}
				</el-button>
			</template>
		</state-view>

		<ul
			v-else
			:aria-label="t('buddyModule.headings.chats')"
			class="m-0 p-0 list-none"
		>
			<li
				v-for="conversation in props.conversations"
				:key="conversation.id"
				:class="[
					'flex items-center gap-2 pl-4 pr-2 py-2 border-b border-b-solid border-light',
					conversation.id === props.activeId ? 'bg-primary-soft' : '',
				]"
				data-test-id="buddy-conversation-row"
			>
				<button
					:aria-current="conversation.id === props.activeId ? 'true' : undefined"
					class="flex flex-col gap-0.5 flex-1 min-w-0 px-0 py-1 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
					type="button"
					data-test-id="buddy-conversation-open"
					@click="emit('select', conversation.id)"
				>
					<span :class="['truncate', conversation.id === props.activeId ? 'text-card-title' : 'text-body']">
						{{ titleOf(conversation) }}
					</span>
					<span class="flex items-center gap-1 min-w-0 text-caption">
						<span class="shrink-0">{{ formatRelativeTime(conversation.updated_at) }}</span>
						<template v-if="conversation.space_id">
							<span aria-hidden="true">·</span>
							<span class="truncate">{{ getSpaceName(conversation.space_id) || t('buddyModule.texts.noSpace') }}</span>
						</template>
					</span>
				</button>

				<!-- Spec section 4: removing a conversation is destructive, so it lives in the more menu and confirms -->
				<el-tooltip
					:content="t('buddyModule.buttons.more.title')"
					placement="top"
				>
					<el-dropdown
						trigger="click"
						placement="bottom-end"
						@command="(command: string) => onCommand(command, conversation.id)"
					>
						<el-button
							:aria-label="t('buddyModule.aria.more', { title: titleOf(conversation) })"
							text
							circle
							data-test-id="buddy-conversation-more"
						>
							<template #icon>
								<icon icon="mdi:dots-horizontal" />
							</template>
						</el-button>

						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item
									command="delete"
									class="text-danger!"
									data-test-id="buddy-conversation-delete"
								>
									{{ t('buddyModule.buttons.delete.title') }}
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</el-tooltip>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView } from '../../../common';
import type { IConversation } from '../buddy.types';

interface ISpace {
	id: string;
	name: string;
}

defineOptions({
	name: 'BuddyConversationList',
});

const props = withDefaults(
	defineProps<{
		conversations: IConversation[];
		activeId: string | null;
		spaces: ISpace[];
		loading?: boolean;
		/** false while no AI provider is ready: a new chat would have nothing to answer it */
		canCreate?: boolean;
	}>(),
	{
		loading: false,
		canCreate: true,
	}
);

const emit = defineEmits<{
	(e: 'select', id: string): void;
	(e: 'delete', id: string): void;
	(e: 'create'): void;
}>();

const { t } = useI18n();

const titleOf = (conversation: IConversation): string => conversation.title || t('buddyModule.texts.newConversation');

const getSpaceName = (spaceId: string | null): string | null => {
	if (!spaceId) return null;

	const space = props.spaces.find((s) => s.id === spaceId);

	return space?.name ?? null;
};

const onCommand = (command: string, id: string): void => {
	if (command === 'delete') {
		emit('delete', id);
	}
};

const now = ref(Date.now());
const timer = setInterval(() => {
	now.value = Date.now();
}, 60_000);
onUnmounted(() => clearInterval(timer));

const formatRelativeTime = (dateStr: string): string => {
	const date = new Date(dateStr);
	const diffMs = now.value - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return t('buddyModule.texts.justNow');
	}

	if (diffMins < 60) {
		return t('buddyModule.texts.minutesAgo', { n: diffMins });
	}

	if (diffHours < 24) {
		return t('buddyModule.texts.hoursAgo', { n: diffHours });
	}

	return t('buddyModule.texts.daysAgo', { n: diffDays });
};
</script>
