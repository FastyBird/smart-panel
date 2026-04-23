<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.dialogs.lightingRoles.title')"
		class="max-w-[700px]"
		@close="onClose"
	>
		<space-lighting-roles :space="props.space" hide-header />

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

import SpaceLightingRoles from './space-lighting-roles.vue';

import type { ISpaceLightingRolesDialogProps } from './space-lighting-roles-dialog.types';

defineOptions({
	name: 'SpaceLightingRolesDialog',
});

const props = defineProps<ISpaceLightingRolesDialogProps>();

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
