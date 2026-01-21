<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.dialogs.mediaRoles.title')"
		class="max-w-[700px]"
		@close="onClose"
	>
		<space-media-roles :space="props.space" hide-header />

		<template #footer>
			<el-button type="primary" @click="onClose">
				{{ t('spacesModule.buttons.done.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog } from 'element-plus';

import SpaceMediaRoles from './space-media-roles.vue';

import type { ISpaceMediaRolesDialogProps } from './space-media-roles-dialog.types';

defineOptions({
	name: 'SpaceMediaRolesDialog',
});

const props = defineProps<ISpaceMediaRolesDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'roles-changed'): void;
}>();

const { t } = useI18n();

const visible = computed({
	get: () => props.visible,
	set: (val) => emit('update:visible', val),
});

const onClose = (): void => {
	emit('roles-changed');
	visible.value = false;
};
</script>
