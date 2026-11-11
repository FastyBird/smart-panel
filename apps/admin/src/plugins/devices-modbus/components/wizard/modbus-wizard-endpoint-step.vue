<template>
	<div class="flex flex-col gap-4">
		<el-radio-group
			v-model="wizard.state.endpointMode"
			:disabled="wizard.savingEndpoint.value || (endpoints.length === 0 && wizard.state.endpointMode === 'new')"
			data-test-id="endpoint-mode"
		>
			<el-radio-button
				value="existing"
				:disabled="endpoints.length === 0"
			>
				{{ t('devicesModbusPlugin.wizard.endpoint.mode.existing') }}
			</el-radio-button>
			<el-radio-button value="new">
				{{ t('devicesModbusPlugin.wizard.endpoint.mode.new') }}
			</el-radio-button>
		</el-radio-group>

		<div v-if="wizard.state.endpointMode === 'existing'">
			<el-form label-position="top">
				<el-form-item :label="t('devicesModbusPlugin.wizard.endpoint.select.title')">
					<div class="flex items-center gap-2 w-full">
						<el-select
							v-model="wizard.state.endpointId"
							:disabled="wizard.savingEndpoint.value"
							:placeholder="t('devicesModbusPlugin.wizard.endpoint.select.placeholder')"
							:loading="loading"
							name="endpointId"
							class="grow"
						>
							<el-option
								v-for="endpoint in endpoints"
								:key="endpoint.id"
								:label="`${endpoint.name} (${endpoint.host}:${endpoint.port})`"
								:value="endpoint.id"
							/>
						</el-select>
						<el-button
							link
							:loading="loading"
							@click="onRefresh"
						>
							{{ t('devicesModbusPlugin.wizard.endpoint.select.refresh') }}
						</el-button>
					</div>
					<div class="text-xs mt-1">
						<a
							:href="endpointsHref"
							target="_blank"
							rel="noopener"
						>
							{{ t('devicesModbusPlugin.wizard.endpoint.select.manage') }}
						</a>
					</div>
				</el-form-item>
			</el-form>
		</div>

		<modbus-endpoint-form
			v-else
			:form="wizard.endpointForm"
			:disabled="wizard.savingEndpoint.value"
		/>

		<el-form label-position="top">
			<el-form-item :label="t('devicesModbusPlugin.wizard.endpoint.unitId.title')">
				<el-input-number
					v-model="wizard.state.unitId"
					:min="0"
					:max="255"
					controls-position="right"
				/>
				<div class="text-xs mt-1 w-full">
					{{ t('devicesModbusPlugin.wizard.endpoint.unitId.hint') }}
				</div>
			</el-form-item>
		</el-form>

		<el-alert
			v-if="wizard.state.unitId === 0"
			type="warning"
			:closable="false"
			show-icon
			:title="t('devicesModbusPlugin.wizard.endpoint.unitId.broadcastWarning')"
		/>

		<el-divider class="my-0!" />

		<modbus-wizard-probe-panel :wizard="wizard" />
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDivider, ElForm, ElFormItem, ElInputNumber, ElOption, ElRadioButton, ElRadioGroup, ElSelect } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { RouteNames } from '../../devices-modbus.constants';
import type { IModbusEndpoint } from '../../store/endpoints.types';
import { modbusEndpointsStoreKey } from '../../store/keys';
import ModbusEndpointForm from '../endpoints/modbus-endpoint-form.vue';

import type { IModbusWizardEndpointStepProps } from './modbus-wizard-endpoint-step.types';
import ModbusWizardProbePanel from './modbus-wizard-probe-panel.vue';

defineOptions({
	name: 'ModbusWizardEndpointStep',
});

const props = defineProps<IModbusWizardEndpointStepProps>();

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const endpointsStore = injectStoresManager().getStore(modbusEndpointsStoreKey);

const loading = ref<boolean>(false);

const endpoints = computed<IModbusEndpoint[]>(() => endpointsStore.findAll());

// A new tab, so that managing endpoints never discards the wizard state.
const endpointsHref = computed<string>(() => router.resolve({ name: RouteNames.ENDPOINTS }).href);

const onRefresh = async (): Promise<void> => {
	loading.value = true;

	try {
		await endpointsStore.fetch();
	} catch (error: unknown) {
		flashMessage.error(error instanceof Error ? error.message : t('devicesModbusPlugin.wizard.endpoint.select.loadFailed'));
	} finally {
		loading.value = false;
	}
};

onMounted(async () => {
	if (endpoints.value.length === 0) {
		await onRefresh();
	}

	// With no endpoints yet the only useful choice is a new one.
	if (endpoints.value.length === 0 && props.wizard.state.endpointId === null) {
		props.wizard.setEndpointMode('new');
	}
});
</script>
