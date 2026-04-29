<template>
	<section class="flex flex-col gap-4">
		<el-steps
			:active="activeStepIndex"
			finish-status="success"
			align-center
		>
			<el-step :title="t('devicesShellyNgPlugin.headings.wizard.discovery')" />
			<el-step :title="t('devicesShellyNgPlugin.headings.wizard.categories')" />
			<el-step :title="t('devicesShellyNgPlugin.headings.wizard.results')" />
		</el-steps>

		<template v-if="activeStep === 'discovery'">
			<el-alert
				:title="t('devicesShellyNgPlugin.texts.wizard.discovery')"
				type="info"
				:closable="false"
				show-icon
			/>

			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<el-text>
						{{ t('devicesShellyNgPlugin.texts.wizard.scanStatus', { count: devices.length }) }}
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
					{{ t('devicesShellyNgPlugin.buttons.wizard.restart.title') }}
				</el-button>
			</div>

			<el-form
				:model="manual"
				label-position="top"
				class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
				@submit.prevent="addManualDevice"
			>
				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.hostname.title')"
					class="mb-0!"
				>
					<el-input
						v-model="manual.hostname"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.hostname.placeholder')"
						name="hostname"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.password.title')"
					class="mb-0!"
				>
					<el-input
						v-model="manual.password"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.password.placeholder')"
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
						{{ t('devicesShellyNgPlugin.buttons.wizard.addManual.title') }}
					</el-button>
				</el-form-item>
			</el-form>

			<el-table
				:data="devices"
				class="w-full"
				:empty-text="t('devicesShellyNgPlugin.texts.wizard.noDevices')"
			>
				<el-table-column
					prop="hostname"
					:label="t('devicesShellyNgPlugin.fields.devices.hostname.title')"
					min-width="150"
				/>
				<el-table-column
					:label="t('devicesShellyNgPlugin.headings.device.model')"
					min-width="180"
				>
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<span>{{ row.displayName || row.model || row.hostname }}</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesShellyNgPlugin.headings.wizard.status')"
					width="170"
				>
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<el-tag :type="statusTagType(row.status)">
							{{ t(`devicesShellyNgPlugin.statuses.wizard.${row.status}`) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesShellyNgPlugin.fields.devices.category.title')"
					min-width="220"
				>
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<span v-if="row.status !== 'ready'">-</span>
						<el-select
							v-else
							v-model="categoryByHostname[row.hostname]"
							:placeholder="t('devicesShellyNgPlugin.fields.devices.category.placeholder')"
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

			<div class="flex justify-end">
				<el-button
					type="primary"
					:disabled="!canContinue"
					@click="activeStep = 'categories'"
				>
					{{ t('devicesShellyNgPlugin.buttons.next.title') }}
				</el-button>
			</div>
		</template>

		<template v-else-if="activeStep === 'categories'">
			<el-alert
				:title="t('devicesShellyNgPlugin.texts.wizard.categories')"
				type="info"
				:closable="false"
				show-icon
			/>

			<el-table
				:data="readyDevices"
				class="w-full"
			>
				<el-table-column width="70">
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<el-checkbox v-model="selected[row.hostname]" />
					</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesShellyNgPlugin.fields.devices.name.title')"
					min-width="220"
				>
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<el-input v-model="nameByHostname[row.hostname]" />
					</template>
				</el-table-column>
				<el-table-column
					prop="hostname"
					:label="t('devicesShellyNgPlugin.fields.devices.hostname.title')"
					min-width="150"
				/>
				<el-table-column
					:label="t('devicesShellyNgPlugin.fields.devices.category.title')"
					min-width="240"
				>
					<template #default="{ row }: { row: IShellyNgDiscoveryDevice }">
						<el-select
							v-model="categoryByHostname[row.hostname]"
							:placeholder="t('devicesShellyNgPlugin.fields.devices.category.placeholder')"
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

			<div class="flex justify-between gap-3">
				<el-button @click="activeStep = 'discovery'">
					{{ t('devicesModule.buttons.back.title') }}
				</el-button>
				<el-button
					type="primary"
					:disabled="!canContinue"
					:loading="formResult === FormResult.WORKING"
					@click="onAdopt"
				>
					<template #icon>
						<icon icon="mdi:check" />
					</template>
					{{ t('devicesShellyNgPlugin.buttons.wizard.adopt.title') }}
				</el-button>
			</div>
		</template>

		<template v-else>
			<el-result
				:icon="adoptionResults.some((result) => result.status === 'failed') ? 'warning' : 'success'"
				:title="t('devicesShellyNgPlugin.headings.wizard.results')"
			>
				<template #sub-title>
					<div class="flex flex-col gap-2">
						<div
							v-for="result in adoptionResults"
							:key="result.hostname"
							class="flex items-center justify-center gap-2"
						>
							<el-tag :type="result.status === 'created' ? 'success' : 'danger'">
								{{ t(`devicesShellyNgPlugin.statuses.wizard.${result.status}`) }}
							</el-tag>
							<span>{{ result.name }} ({{ result.hostname }})</span>
						</div>
					</div>
				</template>
				<template #extra>
					<el-button
						type="primary"
						@click="router.push({ name: DevicesRouteNames.DEVICES })"
					>
						{{ t('devicesShellyNgPlugin.buttons.wizard.finish.title') }}
					</el-button>
				</template>
			</el-result>
		</template>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCheckbox,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElProgress,
	ElResult,
	ElSelect,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
	ElText,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { FormResult, RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { useDevicesWizard } from '../composables/composables';
import type { IShellyNgDiscoveryDevice } from '../schemas/devices.types';

defineOptions({
	name: 'ShellyNgDevicesWizard',
});

const { t } = useI18n();
const router = useRouter();
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

const readyDevices = computed<IShellyNgDiscoveryDevice[]>(() => devices.value.filter((device) => device.status === 'ready'));

const scanPercentage = computed<number>(() => {
	if (session.value === null) {
		return 0;
	}

	const startedAt = new Date(session.value.startedAt).getTime();
	const expiresAt = new Date(session.value.expiresAt).getTime();
	const total = Math.max(1, expiresAt - startedAt);
	const remaining = Math.max(0, session.value.remainingSeconds * 1_000);

	return Math.min(100, Math.max(0, Math.round(((total - remaining) / total) * 100)));
});

const statusTagType = (status: IShellyNgDiscoveryDevice['status']): 'success' | 'warning' | 'info' | 'danger' => {
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

const onAdopt = async (): Promise<void> => {
	await adoptSelected();
	activeStep.value = 'results';
};
</script>
