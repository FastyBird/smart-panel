<template>
	<div class="flex w-full">
		<el-form
			ref="filterFormEl"
			:inline="true"
			:model="innerFilters"
			class="grow-1"
		>
			<el-input
				v-model="innerFilters.search"
				:placeholder="t('usersModule.fields.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('usersModule.fields.role.title')"
				class="p-1 m-0! w-[200px]"
			>
				<el-select
					v-model="innerFilters.roles"
					:placeholder="t('usersModule.fields.role.placeholder')"
					clearable
					multiple
				>
					<el-option
						v-for="item in roleOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>
			</el-form-item>
		</el-form>

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, type FormInstance } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { UsersModuleUserRole } from '../../../openapi';
import type { IUsersFilter } from '../composables/types';

import type { IUsersFilterProps } from './users-filter.types';

defineOptions({
	name: 'UsersFilter',
});

const props = defineProps<IUsersFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IUsersFilter): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
}>();

const { t } = useI18n();

const filterFormEl = ref<FormInstance | undefined>(undefined);

const innerFilters = useVModel(props, 'filters', emit);

const roleOptions: { value: UsersModuleUserRole; label: string }[] = [
	{
		value: UsersModuleUserRole.user,
		label: t('usersModule.fields.role.options.user'),
	},
	{
		value: UsersModuleUserRole.admin,
		label: t('usersModule.fields.role.options.admin'),
	},
	{
		value: UsersModuleUserRole.owner,
		label: t('usersModule.fields.role.options.owner'),
	},
];

watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined) => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>
