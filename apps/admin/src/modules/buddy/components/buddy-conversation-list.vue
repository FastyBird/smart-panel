<template>
	<el-scrollbar class="h-full">
		<div
			v-for="conversation in conversations"
			:key="conversation.id"
			class="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--el-fill-color-light)]"
			:class="{ 'bg-[var(--el-fill-color)]': conversation.id === activeId }"
			@click="emit('select', conversation.id)"
		>
			<div class="grow-1 min-w-0">
				<div class="text-sm truncate">
					{{ conversation.title || t('buddyModule.texts.newConversation') }}
				</div>
				<div class="text-xs text-[var(--el-text-color-secondary)] mt-0.5">
					{{ formatRelativeTime(conversation.created_at) }}
				</div>
				<div
					v-if="conversation.space_id"
					class="text-xs text-[var(--el-text-color-placeholder)] mt-0.5 truncate"
				>
					{{ getSpaceName(conversation.space_id) || t('buddyModule.texts.noSpace') }}
				</div>
			</div>

			<el-popconfirm
				:title="t('buddyModule.texts.confirmDelete')"
				:confirm-button-text="t('buddyModule.buttons.delete.title')"
				:cancel-button-text="t('buddyModule.buttons.cancel.title')"
				@confirm="emit('delete', conversation.id)"
			>
				<template #reference>
					<el-button
						class="opacity-0 group-hover:opacity-100"
						size="small"
						text
						@click.stop
					>
						<el-icon>
							<icon icon="mdi:delete-outline" />
						</el-icon>
					</el-button>
				</template>
			</el-popconfirm>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElPopconfirm, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

interface IConversation {
	id: string;
	title: string | null;
	space_id: string | null;
	created_at: string;
}

interface ISpace {
	id: string;
	name: string;
}

defineOptions({
	name: 'BuddyConversationList',
});

const props = defineProps<{
	conversations: IConversation[];
	activeId: string | null;
	spaces: ISpace[];
}>();

const getSpaceName = (spaceId: string | null): string | null => {
	if (!spaceId) return null;

	const space = props.spaces.find((s) => s.id === spaceId);

	return space?.name ?? null;
};

const emit = defineEmits<{
	(e: 'select', id: string): void;
	(e: 'delete', id: string): void;
}>();

const { t } = useI18n();

const formatRelativeTime = (dateStr: string): string => {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
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
