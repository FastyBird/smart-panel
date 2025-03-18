<template>
	<div class="flex w-full">
		<el-form
			ref="filterFormEl"
			:inline="true"
			:model="filterForm"
			:class="[ns.b()]"
			class="grow-1"
		>
			<el-input
				v-model="filterForm.search"
				:placeholder="t('usersModule.fields.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
				@input="onFilterSearch"
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('usersModule.fields.role.label')"
				:class="[ns.e('user-role')]"
				class="p-1"
			>
				<el-select
					v-model="filterForm.role"
					:placeholder="t('usersModule.fields.role.placeholder')"
					clearable
					@change="onFilterRole"
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
			v-if="activeFilter"
			class="px-2!"
			@click="onResetFilters"
		>
			<icon icon="mdi:filter-off" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, type FormInstance, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { UserRole } from '../users.constants';

import type { IUsersFilterFields, IUsersFilterProps } from './users-filter.types';

defineOptions({
	name: 'UsersFilter',
});

const props = withDefaults(defineProps<IUsersFilterProps>(), {
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:filters', filters: IUsersFilterFields): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
}>();

const ns = useNamespace('users-filter');
const { t } = useI18n();

const filterFormEl = ref<FormInstance | undefined>(undefined);

const filterForm = reactive<IUsersFilterFields>({ ...props.filters });

const activeFilter = computed<boolean>((): boolean => {
	if (filterForm.search !== '') {
		return true;
	} else if (filterForm.role !== '') {
		return true;
	}

	return false;
});

const roleOptions: { value: UserRole; label: string }[] = [
	{
		value: UserRole.USER,
		label: t('usersModule.fields.role.options.user'),
	},
	{
		value: UserRole.ADMIN,
		label: t('usersModule.fields.role.options.admin'),
	},
	{
		value: UserRole.OWNER,
		label: t('usersModule.fields.role.options.owner'),
	},
];

const onFilterSearch = (): void => {
	emit('update:filters', { ...props.filters, search: filterForm.search });
};

const onFilterRole = (): void => {
	emit('update:filters', { ...props.filters, role: filterForm.role });
};

const onResetFilters = (): void => {
	if (!filterFormEl.value) return;

	filterFormEl.value.resetFields();

	filterForm.search = '';
	filterForm.role = '';

	emit('update:filters', { ...props.filters, ...filterForm });
};

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!filterFormEl.value) return;

			filterFormEl.value.resetFields();

			filterForm.search = '';
			filterForm.role = '';

			emit('update:filters', { ...props.filters, ...filterForm });
		}
	}
);

watch(
	(): IUsersFilterFields => props.filters,
	(val: IUsersFilterFields): void => {
		filterForm.search = val.search;
		filterForm.role = val.role;
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'users-filter.scss';
</style>
