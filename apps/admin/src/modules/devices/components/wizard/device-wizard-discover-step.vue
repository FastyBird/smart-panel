<template>
	<div
		v-loading="!ready"
		:element-loading-text="t('devicesModule.wizard.texts.loading')"
		element-loading-background="var(--el-bg-color-overlay)"
		class="flex flex-col gap-3 h-full overflow-hidden min-h-[200px]"
	>
		<el-alert
			v-for="control in banners"
			:key="control.id"
			:data-test-id="`wizard-control-${control.id}`"
			:type="control.severity"
			:closable="false"
			show-icon
			class="shrink-0"
		>
			<template #title>
				{{ control.title }}
			</template>
			<template
				v-if="control.message || control.link"
				#default
			>
				<div class="flex flex-col gap-2">
					<el-text v-if="control.message">
						{{ control.message }}
					</el-text>
					<router-link
						v-if="control.link"
						:to="control.link.to"
						class="text-primary"
					>
						{{ control.link.label }}
					</router-link>
				</div>
			</template>
		</el-alert>

		<!-- `action` controls are deliberately absent: the shell promotes them into the wizard
		     action bar so the step's primary verb sits beside Cancel and Next. Progress bars
		     therefore span the full width they used to share with those buttons. -->
		<div
			v-if="progressBars.length > 0"
			class="flex min-w-0 flex-col gap-3 shrink-0"
		>
			<div
				v-for="control in progressBars"
				:key="control.id"
				:data-test-id="`wizard-control-${control.id}`"
				class="flex min-w-0 flex-col gap-1"
				:class="{ invisible: !control.visible }"
				aria-live="polite"
			>
				<el-text>{{ control.label }}</el-text>
				<el-progress
					:percentage="control.percentage"
					:status="control.state"
				/>
			</div>
		</div>

		<div
			v-for="control in forms"
			:key="control.id"
			:data-test-id="`wizard-control-${control.id}`"
			class="shrink-0"
		>
			<el-form
				label-position="top"
				class="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))_auto]"
				@submit.prevent="onSubmitForm(control)"
			>
				<el-form-item
					v-for="field in control.fields"
					:key="field.key"
					:label="field.label"
					class="mb-0!"
				>
					<el-input
						v-model="formValues[control.id][field.key]"
						:placeholder="field.placeholder"
						:name="field.key"
						:show-password="field.secret"
					/>
				</el-form-item>

				<el-form-item class="mb-0! md:self-end">
					<el-button
						type="primary"
						native-type="submit"
						:disabled="control.submitDisabled"
						:loading="control.loading"
					>
						<template
							v-if="control.submitIcon"
							#icon
						>
							<icon :icon="control.submitIcon" />
						</template>
						{{ control.submitLabel }}
					</el-button>
				</el-form-item>
			</el-form>
		</div>

		<div
			data-test-id="wizard-discover-search"
			class="shrink-0"
		>
			<el-input
				v-model="search"
				:placeholder="t('devicesModule.fields.devices.search.placeholder')"
				clearable
			/>
		</div>

		<device-wizard-inventory-summary
			:rows="rows"
			:visible-count="filteredRows.length"
		/>

		<div
			data-test-id="wizard-discover-table-scroll"
			class="min-h-0 flex-1 overflow-x-auto overscroll-x-contain"
		>
			<el-table
				:data="pageRows"
				class="h-full w-full"
				:style="{ minWidth: `${tableMinWidth}px` }"
				table-layout="fixed"
				:empty-text="t('devicesModule.wizard.texts.empty')"
			>
				<el-table-column
					:label="t('devicesModule.wizard.columns.name')"
					min-width="200"
					sortable
					:sort-method="sortByLabel"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<div class="flex flex-col">
							<span class="font-medium">{{ row.label }}</span>
							<span
								v-if="row.subLabel"
								class="text-xs text-gray-500"
							>
								{{ row.subLabel }}
							</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column
					prop="identifier"
					:label="identifierLabel"
					min-width="150"
					sortable
					:sort-method="sortByIdentifier"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<code class="text-sm">{{ row.identifier }}</code>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('devicesModule.wizard.columns.status')"
					width="180"
					sortable
					:sort-method="sortByStatus"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<el-tag :type="wizardStatusTagType(row.status)">
							{{ row.statusLabel ?? t(`devicesModule.wizard.statuses.${row.status}`) }}
						</el-tag>
					</template>
				</el-table-column>

				<el-table-column
					v-for="column in extraColumns"
					:key="column.key"
					:label="column.label"
					:width="column.width"
					:min-width="column.minWidth"
					:sortable="column.sortable"
					:sort-method="(a: IWizardRow, b: IWizardRow) => sortByCell(column.key, a, b)"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<device-wizard-cell :cell="row.cells?.[column.key]" />
					</template>
				</el-table-column>
			</el-table>
		</div>

		<el-pagination
			v-if="filteredRows.length > PAGE_SIZE"
			v-model:current-page="currentPage"
			data-test-id="wizard-discover-pagination"
			class="shrink-0 justify-center"
			layout="prev, pager, next"
			:page-size="PAGE_SIZE"
			:pager-count="5"
			:total="filteredRows.length"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElForm,
	ElFormItem,
	ElInput,
	ElPagination,
	ElProgress,
	ElTable,
	ElTableColumn,
	ElTag,
	ElText,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import DeviceWizardCell from './device-wizard-cell.vue';
import DeviceWizardInventorySummary from './device-wizard-inventory-summary.vue';
import { compareLocale } from './device-wizard.sort';
import {
	type IWizardBannerControl,
	type IWizardColumn,
	type IWizardControl,
	type IWizardFormControl,
	type IWizardProgressControl,
	type IWizardRow,
	wizardStatusTagType,
} from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardDiscoverStep',
});

interface IProps {
	rows: IWizardRow[];
	columns: IWizardColumn[];
	controls: IWizardControl[];
	identifierLabel: string;
	ready: boolean;
}

const props = defineProps<IProps>();

const { t } = useI18n();

const PAGE_SIZE = 25;

const search = ref<string>('');
const currentPage = ref<number>(1);

const filteredRows = computed<IWizardRow[]>(() => {
	const query = search.value.trim().toLocaleLowerCase();

	if (query.length === 0) {
		return props.rows;
	}

	return props.rows.filter((row) => {
		const values = [
			row.label,
			row.subLabel,
			row.identifier,
			row.statusLabel ?? t(`devicesModule.wizard.statuses.${row.status}`),
			...Object.values(row.cells ?? {}).map((cell) => cell.value),
		];

		return values.some((value) => value?.toLocaleLowerCase().includes(query));
	});
});

const pageRows = computed<IWizardRow[]>(() => {
	const start = (currentPage.value - 1) * PAGE_SIZE;

	return filteredRows.value.slice(start, start + PAGE_SIZE);
});

watch([search, () => props.rows.length], () => {
	currentPage.value = 1;
});

const banners = computed<IWizardBannerControl[]>(() => props.controls.filter((item): item is IWizardBannerControl => item.type === 'banner'));

const progressBars = computed<IWizardProgressControl[]>(() =>
	props.controls.filter((item): item is IWizardProgressControl => item.type === 'progress')
);

const forms = computed<IWizardFormControl[]>(() => props.controls.filter((item): item is IWizardFormControl => item.type === 'form'));

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('discover')));

const tableMinWidth = computed<number>(() => extraColumns.value.reduce((width, column) => width + (column.width ?? column.minWidth ?? 150), 680));

// Field values are keyed by control id so several forms can coexist. Rebuilt whenever the
// set of form controls changes so a newly-declared form always has a backing record.
const formValues = reactive<Record<string, Record<string, string>>>({});

watch(
	forms,
	(next: IWizardFormControl[]): void => {
		for (const control of next) {
			if (formValues[control.id] === undefined) {
				formValues[control.id] = Object.fromEntries(control.fields.map((field) => [field.key, '']));
			}
		}
	},
	{ immediate: true }
);

// Clear the inputs only when the handler resolves — a rejection leaves what the user typed
// in place so they can correct it and retry.
const onSubmitForm = async (control: IWizardFormControl): Promise<void> => {
	try {
		await control.handler({ ...formValues[control.id] });

		formValues[control.id] = Object.fromEntries(control.fields.map((field) => [field.key, '']));
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}
};

const sortByLabel = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.label, b.label);

const sortByIdentifier = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.identifier, b.identifier);

// Group adoptable rows ahead of unsupported / failed ones, then by identifier inside each
// bucket, so freshly-discovered devices stay at the top.
const sortByStatus = (a: IWizardRow, b: IWizardRow): number => {
	const diff = (a.adoptable ? 0 : 1) - (b.adoptable ? 0 : 1);

	return diff !== 0 ? diff : compareLocale(a.identifier, b.identifier);
};

const sortByCell = (key: string, a: IWizardRow, b: IWizardRow): number => compareLocale(a.cells?.[key]?.value, b.cells?.[key]?.value);
</script>
