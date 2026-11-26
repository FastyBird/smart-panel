<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Edit is an icon, Remove (destructive) lives in the more menu; the row itself opens the editor -->
		<el-tooltip
			:content="t('usersModule.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('usersModule.aria.edit', { user: props.user.username })"
				text
				circle
				data-test-id="edit-user"
				@click="emit('edit', props.user.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('usersModule.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('usersModule.aria.more', { user: props.user.username })"
					text
					circle
					data-test-id="more-user"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<!-- The backend keeps the owner and the operator's own account -->
						<el-dropdown-item
							:disabled="!props.removable"
							command="remove"
							class="text-danger!"
							data-test-id="remove-user"
						>
							{{ t('usersModule.buttons.remove.title') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IUser } from '../store/users.store.types';

defineOptions({
	name: 'UsersRowActions',
});

const props = defineProps<{ user: IUser; removable: boolean }>();

const emit = defineEmits<{
	(e: 'edit', id: IUser['id']): void;
	(e: 'remove', id: IUser['id']): void;
}>();

const { t } = useI18n();

const onCommand = (command: 'remove'): void => {
	if (command === 'remove' && props.removable) {
		emit('remove', props.user.id);
	}
};
</script>
