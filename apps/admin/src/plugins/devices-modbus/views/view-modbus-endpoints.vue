<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesModbusPlugin.endpoints.title')"
		:sub-heading="t('devicesModbusPlugin.endpoints.subtitle')"
		icon="mdi:lan-connect"
	>
		<template #extra>
			<el-button
				type="primary"
				:disabled="loading"
				data-test-id="modbus-endpoints-add"
				@click="onAdd"
			>
				{{ t('devicesModbusPlugin.endpoints.actions.add') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-loading="loading"
		class="p-4"
	>
		<el-alert
			v-if="loadError"
			:title="loadError"
			type="error"
			:closable="false"
			show-icon
			class="mb-4"
		>
			<el-button
				size="small"
				data-test-id="modbus-endpoints-retry"
				@click="load"
			>
				{{ t('devicesModbusPlugin.endpoints.actions.retry') }}
			</el-button>
		</el-alert>

		<el-alert
			v-if="!loadError && devicesLoadFailed"
			:title="t('devicesModbusPlugin.endpoints.devicesLoadFailed')"
			type="warning"
			:closable="false"
			show-icon
			class="mb-4"
			data-test-id="modbus-endpoints-devices-failed"
		/>

		<el-empty
			v-if="!loadError && !loading && endpoints.length === 0"
			:description="t('devicesModbusPlugin.endpoints.empty')"
		/>

		<modbus-endpoints-table
			v-else-if="!loadError"
			:endpoints="endpoints"
			:health="endpointsStore.health"
			:devices="modbusDevices"
			@edit="onEdit"
			@remove="onRemove"
			@toggle="onToggle"
		/>
	</div>

	<el-dialog
		v-model="dialogVisible"
		:title="editing ? t('devicesModbusPlugin.endpoints.dialog.edit') : t('devicesModbusPlugin.endpoints.dialog.add')"
		destroy-on-close
		:show-close="!submitting"
		:close-on-press-escape="!submitting"
		:close-on-click-modal="!submitting"
	>
		<modbus-endpoint-form
			ref="formRef"
			:endpoint="editing ?? undefined"
			@saved="onSaved"
			@update:submitting="submitting = $event"
		/>

		<template #footer>
			<el-button
				:disabled="submitting"
				@click="dialogVisible = false"
			>
				{{ t('devicesModbusPlugin.endpoints.actions.cancel') }}
			</el-button>
			<el-button
				type="primary"
				:loading="submitting"
				@click="formRef?.submit()"
			>
				{{ t('devicesModbusPlugin.endpoints.actions.save') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDialog, ElEmpty, ElMessageBox, vLoading } from 'element-plus';

import { AppBreadcrumbs, ViewHeader, injectStoresManager, useFlashMessage } from '../../../common';
import { RouteNames as DevicesRouteNames, type IDevice } from '../../../modules/devices';
import { devicesStoreKey } from '../../../modules/devices/store/keys';
import ModbusEndpointForm from '../components/endpoints/modbus-endpoint-form.vue';
import ModbusEndpointsTable from '../components/endpoints/modbus-endpoints-table.vue';
import { useModbusEndpointsHealth } from '../composables/useModbusEndpointsHealth';
import { DEVICES_MODBUS_TYPE, RouteNames } from '../devices-modbus.constants';
import type { IModbusEndpoint } from '../store/endpoints.types';
import { modbusEndpointsStoreKey } from '../store/keys';

defineOptions({
	name: 'ViewModbusEndpoints',
});

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const endpointsStore = storesManager.getStore(modbusEndpointsStoreKey);
const devicesStore = storesManager.getStore(devicesStoreKey);

useMeta({
	title: t('devicesModbusPlugin.endpoints.title'),
});

const loading = ref<boolean>(true);
const loadError = ref<string | null>(null);
const devicesLoadFailed = ref<boolean>(false);

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const dialogVisible = ref<boolean>(false);
const submitting = ref<boolean>(false);
const editing = ref<IModbusEndpoint | null>(null);
const formRef = ref<InstanceType<typeof ModbusEndpointForm>>();

const endpoints = computed<IModbusEndpoint[]>(() => Object.values(endpointsStore.data));
const modbusDevices = computed<IDevice[]>(() => devicesStore.findAll().filter((device) => device.type === DEVICES_MODBUS_TYPE));

const { refresh: refreshHealth } = useModbusEndpointsHealth();

// Also the Retry action of a failed load. Add stays disabled meanwhile, so a pending list cannot replace a new endpoint.
const load = async (): Promise<void> => {
	loading.value = true;
	loadError.value = null;

	// The device list only feeds the device column: when it fails, the endpoints stay manageable and a warning says
	// the device counts are missing.
	const [endpointsResult, devicesResult] = await Promise.allSettled([endpointsStore.fetch(), devicesStore.fetch()]);

	if (endpointsResult.status === 'rejected') {
		loadError.value = errorText(endpointsResult.reason);
	}

	devicesLoadFailed.value = devicesResult.status === 'rejected';
	loading.value = false;

	void refreshHealth();
};

onMounted((): void => {
	void load();
});

const onAdd = (): void => {
	editing.value = null;
	// A save that finished after the dialog unmounted could not report back; never start with a stuck button.
	submitting.value = false;
	dialogVisible.value = true;
};

const onEdit = (endpoint: IModbusEndpoint): void => {
	editing.value = endpoint;
	submitting.value = false;
	dialogVisible.value = true;
};

const onSaved = (): void => {
	dialogVisible.value = false;
	void refreshHealth();
	flashMessage.success(t('devicesModbusPlugin.endpoints.messages.saved'));
};

const onToggle = async (endpoint: IModbusEndpoint, enabled: boolean): Promise<void> => {
	try {
		await endpointsStore.edit(endpoint.id, { enabled });
	} catch (error: unknown) {
		flashMessage.error(error instanceof Error ? error.message : t('devicesModbusPlugin.endpoints.messages.notSaved'));
	}
};

const onRemove = async (endpoint: IModbusEndpoint): Promise<void> => {
	try {
		await ElMessageBox.confirm(
			t('devicesModbusPlugin.endpoints.confirmRemove', { name: endpoint.name }),
			t('devicesModbusPlugin.endpoints.actions.remove'),
			{
				confirmButtonText: t('devicesModbusPlugin.endpoints.actions.remove'),
				cancelButtonText: t('devicesModbusPlugin.endpoints.actions.cancel'),
				type: 'warning',
			}
		);
	} catch {
		return;
	}

	try {
		await endpointsStore.remove(endpoint.id);
		flashMessage.success(t('devicesModbusPlugin.endpoints.messages.removed'));
	} catch (error: unknown) {
		// A 400/409 carries the backend reason, which lists the devices still using the endpoint.
		flashMessage.error(error instanceof Error ? error.message : t('devicesModbusPlugin.endpoints.messages.notRemoved'), { duration: 0 });
	}
};

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		{
			label: t('devicesModbusPlugin.endpoints.breadcrumb'),
			route: router.resolve({ name: RouteNames.ENDPOINTS }),
		},
	]
);
</script>
