<template>
	<el-tag
		v-if="isLoading"
		size="small"
		type="info"
	>
		<icon
			icon="mdi:loading"
			class="animate-spin"
		/>
	</el-tag>
	<el-tag
		v-else-if="isValid === true"
		size="small"
		type="success"
	>
		{{ t('devicesModule.validation.status.valid') }}
	</el-tag>
	<el-popover
		v-else-if="isValid === false"
		placement="bottom"
		:width="400"
		trigger="click"
		@show="popoverVisible = true"
		@hide="popoverVisible = false"
	>
		<template #reference>
			<el-tag
				size="small"
				type="danger"
				class="cursor-pointer"
				@click.stop
			>
				{{ t('devicesModule.validation.status.invalid') }}
				<template v-if="issueCount > 0">
					({{ issueCount }})
				</template>
				<el-icon class="ml-1 inline-block!">
					<icon :icon="popoverVisible ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
				</el-icon>
			</el-tag>
		</template>

		<div class="text-sm">
			<div class="font-semibold mb-2 flex items-center gap-2">
				<el-icon><icon icon="mdi:alert-circle-outline" /></el-icon>
				{{ t('devicesModule.validation.issuesTitle') }}
			</div>
			<el-table
				:data="issues"
				size="small"
				:show-header="false"
			>
				<el-table-column
					prop="severity"
					:width="70"
				>
					<template #default="scope">
						<el-tag
							:type="scope.row.severity === 'error' ? 'danger' : 'warning'"
							size="small"
						>
							{{ scope.row.severity === 'error' ? t('devicesModule.validation.severity.error') : t('devicesModule.validation.severity.warning') }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="message">
					<template #default="scope">
						<div class="text-xs text-gray-500">
							{{ t(`devicesModule.validation.issueTypes.${scope.row.type}`, scope.row.type) }}
						</div>
						<div>{{ scope.row.message }}</div>
					</template>
				</el-table-column>
			</el-table>
		</div>
	</el-popover>
	<el-tag
		v-else
		size="small"
		type="info"
	>
		{{ t('devicesModule.validation.status.unknown') }}
	</el-tag>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElPopover, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../../common';
import { devicesValidationStoreKey } from '../../store/keys';

import type { IDevicesTableColumnValidationProps } from './devices-table-column-validation.types';

defineOptions({
	name: 'DevicesTableColumnValidation',
});

const props = defineProps<IDevicesTableColumnValidationProps>();

const { t } = useI18n();

const storesManager = injectStoresManager();
const validationStore = storesManager.getStore(devicesValidationStoreKey);

const popoverVisible = ref(false);

// Use findById getter which accesses data.value.devices
const validationResult = computed(() => validationStore.findById(props.device.id));

const isValid = computed<boolean | null>(() => validationResult.value?.isValid ?? null);

const issues = computed(() => validationResult.value?.issues ?? []);

const issueCount = computed<number>(() => issues.value.length);

const isLoading = computed<boolean>(() => validationStore.fetching() || validationStore.getting(props.device.id));
</script>
