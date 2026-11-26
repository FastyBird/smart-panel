<template>
	<users-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="users-row-list"
	>
		<!-- Phone (template 1): a list of rows instead of the table; a row opens the user -->
		<li
			v-for="user in props.items"
			:key="user.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
				type="button"
				data-test-id="users-row"
				@click="emit('edit', user.id)"
			>
				<user-avatar
					:email="user.email"
					:size="32"
					class="shrink-0"
				/>
				<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
					<span class="max-w-full text-card-title truncate">{{ userDisplayName(user) }}</span>
					<span class="max-w-full text-help truncate">{{ user.email ?? user.username }}</span>
				</span>
				<status-tag
					:status="roleStatus(user.role)"
					:label="t(`usersModule.role.${user.role}`)"
					class="shrink-0"
				/>
			</button>

			<users-row-actions
				:user="user"
				:removable="canRemoveUser(user, props.currentUserId)"
				@edit="(id: IUser['id']) => emit('edit', id)"
				@remove="(id: IUser['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StatusTag, UserAvatar } from '../../../common';
import type { IUser } from '../store/users.store.types';

import UsersEmpty from './users-empty.vue';
import UsersRowActions from './users-row-actions.vue';
import { canRemoveUser, roleStatus, userDisplayName } from './users.utils';

defineOptions({
	name: 'UsersRowList',
});

const props = defineProps<{
	items: IUser[];
	loading: boolean;
	filtersActive: boolean;
	currentUserId?: IUser['id'] | null;
}>();

const emit = defineEmits<{
	(e: 'edit', id: IUser['id']): void;
	(e: 'remove', id: IUser['id']): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
