<template>
	<!-- The filters drawer of the list's filter bar: its heading and Reset are the bar's -->
	<fieldset class="flex flex-col gap-2 m-0 p-4 border-0">
		<legend class="text-card-title p-0 mb-2">{{ t('usersModule.fields.role.title') }}</legend>

		<el-checkbox-group
			v-model="innerFilters.roles"
			class="flex flex-col"
			data-test-id="users-filter-roles"
		>
			<el-checkbox
				v-for="option in roleOptions"
				:key="option.value"
				:label="option.label"
				:value="option.value"
			/>
		</el-checkbox-group>
	</fieldset>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElCheckboxGroup } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { UsersModuleUserRole } from '../../../openapi.constants';
import type { IUsersFilter } from '../composables/types';

defineOptions({
	name: 'ListUsersAdjust',
});

const props = defineProps<{ filters: IUsersFilter }>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IUsersFilter): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const roleOptions: { value: UsersModuleUserRole; label: string }[] = [
	{ value: UsersModuleUserRole.user, label: t('usersModule.fields.role.options.user') },
	{ value: UsersModuleUserRole.admin, label: t('usersModule.fields.role.options.admin') },
	{ value: UsersModuleUserRole.owner, label: t('usersModule.fields.role.options.owner') },
];
</script>
