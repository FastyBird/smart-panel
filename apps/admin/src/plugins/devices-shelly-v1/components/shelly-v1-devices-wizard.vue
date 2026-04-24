<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesShellyV1Plugin.headings.wizard.title') }}
		</template>

		<template #subtitle>
			{{ t('devicesShellyV1Plugin.subHeadings.wizard') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="handleCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesShellyV1Plugin.headings.wizard.title')"
		:sub-heading="t('devicesShellyV1Plugin.subHeadings.wizard')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					link
					class="px-4!"
					@click="handleCancel"
				>
					{{ t('devicesModule.buttons.cancel.title') }}
				</el-button>

				<template v-if="activeStep === 'discovery'">
					<el-button
						type="primary"
						class="px-4!"
						:disabled="adoptableDevices.length === 0"
						@click="activeStep = 'categories'"
					>
						{{ t('devicesShellyV1Plugin.buttons.next.title') }}
					</el-button>
				</template>

				<template v-else-if="activeStep === 'categories'">
					<el-button
						class="px-4!"
						@click="activeStep = 'discovery'"
					>
						{{ t('devicesModule.buttons.back.title') }}
					</el-button>
					<el-button
						type="primary"
						class="px-4!"
						:disabled="!canContinue"
						:loading="formResult === FormResult.WORKING"
						@click="onAdopt"
					>
						{{ t('devicesShellyV1Plugin.buttons.wizard.adopt.title') }}
					</el-button>
				</template>

				<template v-else>
					<el-button
						type="primary"
						class="px-4!"
						@click="handleFinish"
					>
						{{ t('devicesShellyV1Plugin.buttons.wizard.finish.title') }}
					</el-button>
				</template>
			</div>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="activeStepIndex"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesShellyV1Plugin.headings.wizard.discovery')" />
					<el-step :title="t('devicesShellyV1Plugin.headings.wizard.categories')" />
					<el-step :title="t('devicesShellyV1Plugin.headings.wizard.results')" />
				</el-steps>
			</template>

			<div class="p-4 max-h-full box-border flex flex-col gap-3 overflow-hidden">
				<template v-if="activeStep === 'discovery'">
					<el-alert
						:title="t('devicesShellyV1Plugin.texts.wizard.discovery')"
						type="info"
						:closable="false"
						show-icon
						class="shrink-0"
					/>

					<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<el-text>
								{{ t('devicesShellyV1Plugin.texts.wizard.scanStatus', { count: devices.length }) }}
							</el-text>
							<el-progress
								:percentage="scanPercentage"
								:status="session?.status === 'finished' ? 'success' : undefined"
							/>
						</div>

						<el-button
							:loading="formResult === FormResult.WORKING"
							@click="startDiscovery"
						>
							<template #icon>
								<icon icon="mdi:radar" />
							</template>
							{{ t('devicesShellyV1Plugin.buttons.wizard.restart.title') }}
						</el-button>
					</div>

					<el-form
						:model="manual"
						label-position="top"
						class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] shrink-0"
						@submit.prevent="addManualDevice"
					>
						<el-form-item
							:label="t('devicesShellyV1Plugin.fields.devices.hostname.title')"
							class="mb-0!"
						>
							<el-input
								v-model="manual.hostname"
								:placeholder="t('devicesShellyV1Plugin.fields.devices.hostname.placeholder')"
								name="hostname"
							/>
						</el-form-item>

						<el-form-item
							:label="t('devicesShellyV1Plugin.fields.devices.password.title')"
							class="mb-0!"
						>
							<el-input
								v-model="manual.password"
								:placeholder="t('devicesShellyV1Plugin.fields.devices.password.placeholder')"
								name="password"
								show-password
							/>
						</el-form-item>

						<el-form-item class="mb-0! md:self-end">
							<el-button
								type="primary"
								native-type="submit"
								:disabled="manual.hostname.trim().length === 0"
								:loading="formResult === FormResult.WORKING"
							>
								<template #icon>
									<icon icon="mdi:plus" />
								</template>
								{{ t('devicesShellyV1Plugin.buttons.wizard.addManual.title') }}
							</el-button>
						</el-form-item>
					</el-form>

					<el-table
						:data="devices"
						class="h-full w-full flex-grow"
						table-layout="fixed"
						:empty-text="t('devicesShellyV1Plugin.texts.wizard.noDevices')"
					>
						<el-table-column
							:label="t('devicesShellyV1Plugin.fields.devices.name.title')"
							min-width="200"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<div class="flex flex-col">
									<span class="font-medium">
										{{ row.registeredDeviceName || row.name || row.displayName || row.model || row.hostname }}
									</span>
									<span
										v-if="row.displayName || row.model"
										class="text-xs text-gray-500"
									>
										{{ row.displayName || row.model }}
									</span>
								</div>
							</template>
						</el-table-column>
						<el-table-column
							prop="hostname"
							:label="t('devicesShellyV1Plugin.fields.devices.hostname.title')"
							min-width="150"
						/>
						<el-table-column
							:label="t('devicesShellyV1Plugin.headings.wizard.status')"
							width="170"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<el-tag :type="statusTagType(row.status)">
									{{ t(`devicesShellyV1Plugin.statuses.wizard.${row.status}`) }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							:label="t('devicesShellyV1Plugin.fields.devices.category.title')"
							min-width="220"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<span v-if="!isAdoptableStatus(row.status)">-</span>
								<el-select
									v-else
									v-model="categoryByHostname[row.hostname]"
									:placeholder="t('devicesShellyV1Plugin.fields.devices.category.placeholder')"
									filterable
								>
									<el-option
										v-for="item in categoryOptions(row)"
										:key="item.value"
										:label="item.label"
										:value="item.value"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</template>

				<template v-else-if="activeStep === 'categories'">
					<el-alert
						:title="t('devicesShellyV1Plugin.texts.wizard.categories')"
						type="info"
						:closable="false"
						show-icon
						class="shrink-0"
					/>

					<el-table
						:data="adoptableDevices"
						class="h-full w-full flex-grow"
						table-layout="fixed"
						:default-sort="{ prop: 'name', order: 'ascending' }"
					>
						<el-table-column width="60">
							<template #header>
								<el-checkbox
									:model-value="allAdoptableSelected"
									:indeterminate="someAdoptableSelected && !allAdoptableSelected"
									:disabled="adoptableDevices.length === 0"
									@change="onToggleSelectAll"
								/>
							</template>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<el-checkbox v-model="selected[row.hostname]" />
							</template>
						</el-table-column>
						<el-table-column
							prop="name"
							:label="t('devicesShellyV1Plugin.fields.devices.name.title')"
							min-width="220"
							sortable
							:sort-method="sortByName"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<el-input v-model="nameByHostname[row.hostname]" />
							</template>
						</el-table-column>
						<el-table-column
							prop="hostname"
							:label="t('devicesShellyV1Plugin.fields.devices.hostname.title')"
							min-width="150"
							sortable
							:sort-method="sortByHostname"
						/>
						<el-table-column
							prop="status"
							:label="t('devicesShellyV1Plugin.headings.wizard.status')"
							width="170"
							sortable
							:sort-method="sortByStatus"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<el-tag
									v-if="row.status === 'already_registered'"
									size="small"
									type="warning"
								>
									{{ t('devicesShellyV1Plugin.statuses.wizard.willUpdate') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="success"
								>
									{{ t('devicesShellyV1Plugin.statuses.wizard.willCreate') }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							prop="category"
							:label="t('devicesShellyV1Plugin.fields.devices.category.title')"
							min-width="240"
							sortable
							:sort-method="sortByCategory"
						>
							<template #default="{ row }: { row: IShellyV1DiscoveryDevice }">
								<el-select
									v-model="categoryByHostname[row.hostname]"
									:placeholder="t('devicesShellyV1Plugin.fields.devices.category.placeholder')"
									filterable
								>
									<el-option
										v-for="item in categoryOptions(row)"
										:key="item.value"
										:label="item.label"
										:value="item.value"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</template>

				<template v-else>
					<el-alert
						:title="t(`devicesShellyV1Plugin.texts.wizard.results.${adoptionResultSummary}`)"
						:type="adoptionResultSummary === 'failed' ? 'warning' : 'success'"
						:closable="false"
						show-icon
						class="shrink-0"
					/>

					<el-table
						:data="adoptionResults"
						class="h-full w-full flex-grow"
						table-layout="fixed"
					>
						<el-table-column
							:label="t('devicesShellyV1Plugin.headings.wizard.status')"
							width="140"
						>
							<template #default="{ row }: { row: IShellyV1WizardAdoptionResult }">
								<el-tag :type="resultTagType(row.status)">
									{{ t(`devicesShellyV1Plugin.statuses.wizard.${row.status}`) }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							:label="t('devicesShellyV1Plugin.fields.devices.name.title')"
							min-width="200"
						>
							<template #default="{ row }: { row: IShellyV1WizardAdoptionResult }">
								<span class="font-medium">{{ row.name }}</span>
							</template>
						</el-table-column>
						<el-table-column
							prop="hostname"
							:label="t('devicesShellyV1Plugin.fields.devices.hostname.title')"
							min-width="150"
						/>
						<el-table-column
							:label="t('devicesShellyV1Plugin.fields.devices.error.title')"
							min-width="200"
						>
							<template #default="{ row }: { row: IShellyV1WizardAdoptionResult }">
								<span
									v-if="row.error"
									class="text-red-500"
								>
									{{ row.error }}
								</span>
								<span
									v-else
									class="text-gray-400"
								>
									—
								</span>
							</template>
						</el-table-column>
					</el-table>
				</template>
			</div>

			<div
				v-if="!isMDDevice"
				class="flex justify-between gap-2 p-4 border-t border-t-solid"
			>
				<template v-if="activeStep === 'discovery'">
					<el-button @click="handleCancel">
						{{ t('devicesModule.buttons.cancel.title') }}
					</el-button>
					<el-button
						type="primary"
						:disabled="adoptableDevices.length === 0"
						@click="activeStep = 'categories'"
					>
						{{ t('devicesShellyV1Plugin.buttons.next.title') }}
					</el-button>
				</template>

				<template v-else-if="activeStep === 'categories'">
					<el-button @click="activeStep = 'discovery'">
						{{ t('devicesModule.buttons.back.title') }}
					</el-button>
					<div class="flex gap-2">
						<el-button @click="handleCancel">
							{{ t('devicesModule.buttons.cancel.title') }}
						</el-button>
						<el-button
							type="primary"
							:disabled="!canContinue"
							:loading="formResult === FormResult.WORKING"
							@click="onAdopt"
						>
							{{ t('devicesShellyV1Plugin.buttons.wizard.adopt.title') }}
						</el-button>
					</div>
				</template>

				<template v-else>
					<div></div>
					<el-button
						type="primary"
						@click="handleFinish"
					>
						{{ t('devicesShellyV1Plugin.buttons.wizard.finish.title') }}
					</el-button>
				</template>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElOption,
	ElProgress,
	ElSelect,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
	ElText,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames as DevicesRouteNames, FormResult } from '../../../modules/devices';
import { useDevicesWizard } from '../composables/composables';
import { type IShellyV1WizardAdoptionResult, isAdoptableStatus } from '../composables/useDevicesWizard';
import type { IShellyV1DiscoveryDevice } from '../schemas/devices.types';

defineOptions({
	name: 'ShellyV1DevicesWizard',
});

const { t } = useI18n();
const router = useRouter();
const { isMDDevice, isLGDevice } = useBreakpoints();
const {
	session,
	devices,
	manual,
	selected,
	categoryByHostname,
	nameByHostname,
	adoptionResults,
	canContinue,
	formResult,
	scanPercentage,
	startDiscovery,
	addManualDevice,
	adoptSelected,
	categoryOptions,
} = useDevicesWizard();

const activeStep = ref<'discovery' | 'categories' | 'results'>('discovery');

const activeStepIndex = computed<number>(() => {
	if (activeStep.value === 'categories') {
		return 1;
	}

	if (activeStep.value === 'results') {
		return 2;
	}

	return 0;
});

const adoptableDevices = computed<IShellyV1DiscoveryDevice[]>(() => devices.value.filter((device) => isAdoptableStatus(device.status)));

const allAdoptableSelected = computed<boolean>(
	() => adoptableDevices.value.length > 0 && adoptableDevices.value.every((device) => selected[device.hostname] === true)
);

const someAdoptableSelected = computed<boolean>(() => adoptableDevices.value.some((device) => selected[device.hostname] === true));

const onToggleSelectAll = (value: boolean | string | number): void => {
	const next = value === true;

	for (const device of adoptableDevices.value) {
		selected[device.hostname] = next;
	}
};

// Sort comparators for the categories table — `prop`-based sorting can't read our reactive
// per-hostname maps, so each column gets a custom comparator that reaches into the right
// source of truth (user-edited name, current category selection, …).
const compareLocale = (a: string | null | undefined, b: string | null | undefined): number => {
	const left = (a ?? '').toString();
	const right = (b ?? '').toString();
	return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};

const sortByName = (a: IShellyV1DiscoveryDevice, b: IShellyV1DiscoveryDevice): number => {
	const aName = nameByHostname[a.hostname] ?? a.registeredDeviceName ?? a.name ?? a.displayName ?? a.hostname;
	const bName = nameByHostname[b.hostname] ?? b.registeredDeviceName ?? b.name ?? b.displayName ?? b.hostname;
	return compareLocale(aName, bName);
};

const sortByHostname = (a: IShellyV1DiscoveryDevice, b: IShellyV1DiscoveryDevice): number => compareLocale(a.hostname, b.hostname);

// Group "will create" devices before "will update" ones, then by hostname inside each bucket.
const sortByStatus = (a: IShellyV1DiscoveryDevice, b: IShellyV1DiscoveryDevice): number => {
	const order = (status: IShellyV1DiscoveryDevice['status']): number => (status === 'already_registered' ? 1 : 0);
	const diff = order(a.status) - order(b.status);
	return diff !== 0 ? diff : compareLocale(a.hostname, b.hostname);
};

const sortByCategory = (a: IShellyV1DiscoveryDevice, b: IShellyV1DiscoveryDevice): number => {
	const aLabel = categoryByHostname[a.hostname] ? t(`devicesModule.categories.devices.${categoryByHostname[a.hostname]}`) : '';
	const bLabel = categoryByHostname[b.hostname] ? t(`devicesModule.categories.devices.${categoryByHostname[b.hostname]}`) : '';
	return compareLocale(aLabel, bLabel);
};

const adoptionResultSummary = computed<'success' | 'failed'>(() =>
	adoptionResults.value.some((result) => result.status === 'failed') ? 'failed' : 'success'
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(() => [
	{
		label: t('devicesModule.breadcrumbs.devices.list'),
		route: router.resolve({ name: DevicesRouteNames.DEVICES }),
	},
	{
		label: t('devicesShellyV1Plugin.breadcrumbs.wizard'),
		route: router.resolve({
			name: DevicesRouteNames.DEVICES_WIZARD,
			params: { type: 'devices-shelly-v1-plugin' },
		}),
	},
]);

const statusTagType = (status: IShellyV1DiscoveryDevice['status']): 'success' | 'warning' | 'info' | 'danger' => {
	if (status === 'ready') {
		return 'success';
	}

	if (status === 'checking') {
		return 'info';
	}

	if (status === 'needs_password' || status === 'already_registered') {
		return 'warning';
	}

	return 'danger';
};

const resultTagType = (status: IShellyV1WizardAdoptionResult['status']): 'success' | 'warning' | 'danger' => {
	if (status === 'created') {
		return 'success';
	}

	if (status === 'updated') {
		return 'warning';
	}

	return 'danger';
};

const handleCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};

const handleFinish = (): void => {
	handleCancel();
};

const onAdopt = async (): Promise<void> => {
	await adoptSelected();
	activeStep.value = 'results';
};
</script>
