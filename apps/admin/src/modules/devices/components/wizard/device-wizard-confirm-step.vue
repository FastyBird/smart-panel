<template>
	<!-- The selected devices only: name and category per device before they are added -->
	<el-form
		class="flex flex-col gap-3"
		status-icon
		@submit.prevent
	>
		<p class="m-0 text-help">{{ t('devicesModule.wizard.texts.confirmHint') }}</p>

		<!-- Tablet portrait and phone: one card per device -->
		<ul
			v-if="asCards"
			class="flex flex-col gap-3 m-0 p-0 list-none"
			data-test-id="wizard-confirm-cards"
		>
			<li
				v-for="row in sortedRows"
				:key="row.key"
				class="flex flex-col gap-3 p-3 rounded-lg border border-solid border-light"
				data-test-id="wizard-confirm-card"
			>
				<div class="flex items-start gap-2">
					<div class="flex flex-col flex-1 min-w-0">
						<span class="text-card-title truncate">{{ nameFor(row) }}</span>
						<span class="text-help truncate">
							{{ props.identifierLabel }}:
							<code>{{ row.identifier }}</code>
						</span>
					</div>
					<status-tag
						:status="row.willUpdate ? 'warn' : 'ok'"
						:label="changeLabel(row)"
					/>
				</div>

				<template v-if="props.confirmationMode === 'editable'">
					<el-form-item
						:label="t('devicesModule.wizard.columns.name')"
						:error="fieldError(`name:${row.key}`)"
						class="mb-0!"
						label-position="top"
					>
						<el-input
							:model-value="props.nameByKey[row.key] ?? ''"
							:placeholder="t('devicesModule.fields.devices.name.placeholder')"
							@update:model-value="(value: string) => emit('update-name', row.key, value)"
						/>
					</el-form-item>
					<el-form-item
						:label="t('devicesModule.wizard.columns.category')"
						:error="fieldError(`category:${row.key}`)"
						class="mb-0!"
						label-position="top"
					>
						<el-select
							:model-value="props.categoryByKey[row.key] ?? null"
							:placeholder="t('devicesModule.fields.devices.category.placeholder')"
							filterable
							@update:model-value="(value: DevicesModuleDeviceCategory | null) => emit('update-category', row.key, value)"
						>
							<el-option
								v-for="option in row.categoryOptions"
								:key="option.value"
								:label="option.label"
								:value="option.value"
							/>
						</el-select>
					</el-form-item>
				</template>
				<span
					v-else
					class="text-body"
				>
					{{ categoryLabel(row) }}
				</span>
			</li>
		</ul>

		<!-- Tablet landscape and up: a table -->
		<div
			v-else
			class="overflow-x-auto overscroll-x-contain"
			data-test-id="wizard-confirm-table-scroll"
		>
			<el-table
				:data="sortedRows"
				:style="{ minWidth: '720px' }"
				table-layout="fixed"
				class="w-full"
				data-test-id="wizard-confirm-table"
			>
				<el-table-column
					:label="t('devicesModule.wizard.columns.name')"
					min-width="220"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<el-form-item
							v-if="props.confirmationMode === 'editable'"
							:error="fieldError(`name:${row.key}`)"
							class="mb-0!"
						>
							<el-input
								:model-value="props.nameByKey[row.key] ?? ''"
								:placeholder="t('devicesModule.fields.devices.name.placeholder')"
								:aria-label="t('devicesModule.wizard.columns.name')"
								@update:model-value="(value: string) => emit('update-name', row.key, value)"
							/>
						</el-form-item>
						<span
							v-else
							class="font-medium"
						>
							{{ nameFor(row) }}
						</span>
					</template>
				</el-table-column>

				<el-table-column
					:label="props.identifierLabel"
					min-width="150"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<code class="text-sm">{{ row.identifier }}</code>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('devicesModule.wizard.columns.change')"
					width="150"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<status-tag
							:status="row.willUpdate ? 'warn' : 'ok'"
							:label="changeLabel(row)"
						/>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('devicesModule.wizard.columns.category')"
					min-width="220"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<el-form-item
							v-if="props.confirmationMode === 'editable'"
							:error="fieldError(`category:${row.key}`)"
							class="mb-0!"
						>
							<el-select
								:model-value="props.categoryByKey[row.key] ?? null"
								:placeholder="t('devicesModule.fields.devices.category.placeholder')"
								:aria-label="t('devicesModule.wizard.columns.category')"
								filterable
								@update:model-value="(value: DevicesModuleDeviceCategory | null) => emit('update-category', row.key, value)"
							>
								<el-option
									v-for="option in row.categoryOptions"
									:key="option.value"
									:label="option.label"
									:value="option.value"
								/>
							</el-select>
						</el-form-item>
						<span v-else>{{ categoryLabel(row) }}</span>
					</template>
				</el-table-column>
			</el-table>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus';

import { StatusTag, useSizeClass } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import { compareLocale } from './device-wizard.sort';
import type { IWizardRow } from './device-wizard.types';
import { useWizardFieldError } from './use-wizard-validation';

defineOptions({
	name: 'DeviceWizardConfirmStep',
});

interface IProps {
	/** The selected devices */
	rows: IWizardRow[];
	nameByKey: Record<string, string>;
	categoryByKey: Record<string, DevicesModuleDeviceCategory | null>;
	identifierLabel: string;
	confirmationMode: 'editable' | 'selection-only';
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'update-name', key: string, value: string): void;
	(e: 'update-category', key: string, value: DevicesModuleDeviceCategory | null): void;
}>();

const { t } = useI18n();
const fieldError = useWizardFieldError();
const { isPhone, isTabletPortrait } = useSizeClass();

// Spec section 6: the Confirm table becomes one card per device on tablet portrait (and on phone)
const asCards = computed<boolean>(() => isPhone.value || isTabletPortrait.value);

const nameFor = (row: IWizardRow): string => props.nameByKey[row.key] || row.suggestedName;

const categoryLabel = (row: IWizardRow): string => {
	const category = props.categoryByKey[row.key] ?? row.suggestedCategory;

	return row.categoryOptions.find((option) => option.value === category)?.label ?? '';
};

const changeLabel = (row: IWizardRow): string =>
	row.willUpdate ? t('devicesModule.wizard.statuses.willUpdate') : t('devicesModule.wizard.statuses.willCreate');

// The order is fixed for the step, so a row does not jump while its name is typed
const sortedRows = computed<IWizardRow[]>(() => [...props.rows].sort((a, b) => compareLocale(a.suggestedName, b.suggestedName)));
</script>
