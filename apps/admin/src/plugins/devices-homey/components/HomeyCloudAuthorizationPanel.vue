<template>
	<el-card
		shadow="never"
		class="mt-6"
		data-test-id="homey-cloud-authorization-panel"
	>
		<template #header>
			<div class="font-medium">{{ t('devicesHomeyPlugin.cloudAuthorization.title') }}</div>
			<div class="text-xs text-gray-500 mt-1">{{ t('devicesHomeyPlugin.cloudAuthorization.description') }}</div>
		</template>

		<el-alert
			v-if="!cloudConfigurationSaved"
			type="info"
			:closable="false"
			:title="t('devicesHomeyPlugin.cloudAuthorization.saveConfigurationFirst')"
			class="mb-4"
		/>
		<div
			v-if="requestFailed"
			class="mb-4"
			data-test-id="homey-cloud-request-error"
		>
			<el-alert
				type="error"
				:closable="false"
				:title="t('devicesHomeyPlugin.cloudAuthorization.requestFailed')"
			/>
		</div>

		<div
			v-if="authorizationStore.homeys.length > 0"
			data-test-id="homey-cloud-selection"
		>
			<p class="text-sm mb-3">{{ t('devicesHomeyPlugin.cloudAuthorization.selectDescription') }}</p>
			<el-select
				v-model="selectedHomeyId"
				:placeholder="t('devicesHomeyPlugin.cloudAuthorization.selectPlaceholder')"
				class="w-full"
			>
				<el-option
					v-for="homey in authorizationStore.homeys"
					:key="homey.id"
					:label="homey.name"
					:value="homey.id"
				/>
			</el-select>
			<div class="flex flex-wrap gap-2 mt-3">
				<el-button
					type="primary"
					:loading="authorizationStore.mutating"
					:disabled="selectedHomeyId === null"
					data-test-id="homey-cloud-select"
					@click="selectHomey"
				>
					{{ t('devicesHomeyPlugin.cloudAuthorization.select') }}
				</el-button>
				<el-button
					:disabled="authorizationStore.mutating"
					data-test-id="homey-cloud-cancel"
					@click="cancelAuthorization"
				>
					{{ t('devicesHomeyPlugin.cloudAuthorization.cancel') }}
				</el-button>
			</div>
		</div>

		<div v-else>
			<div class="flex items-center gap-2 mb-4">
				<span>{{ t('devicesHomeyPlugin.cloudAuthorization.status') }}</span>
				<el-tag :type="authorizationStore.status === null ? 'warning' : authorizationStore.status.connected ? 'success' : 'info'">
					{{
						authorizationStore.status === null
							? t('devicesHomeyPlugin.cloudAuthorization.unknown')
							: authorizationStore.status.connected
								? t('devicesHomeyPlugin.cloudAuthorization.connected')
								: t('devicesHomeyPlugin.cloudAuthorization.disconnected')
					}}
				</el-tag>
				<span
					v-if="authorizationStore.status?.selectedHomeyId"
					class="text-xs text-gray-500"
				>
					{{ authorizationStore.status.selectedHomeyId }}
				</span>
			</div>

			<div class="flex flex-wrap gap-2">
				<el-button
					v-if="authorizationStore.status !== null && !authorizationStore.status.connected"
					type="primary"
					:loading="authorizationStore.authorizing"
					:disabled="!cloudConfigurationSaved || authorizationStore.fetching"
					data-test-id="homey-cloud-connect"
					@click="startAuthorization(false)"
				>
					{{ t('devicesHomeyPlugin.cloudAuthorization.connect') }}
				</el-button>
				<template v-else-if="authorizationStore.status?.connected">
					<el-button
						:loading="authorizationStore.authorizing"
						:disabled="!cloudConfigurationSaved || authorizationStore.mutating"
						data-test-id="homey-cloud-reconnect"
						@click="startAuthorization(true)"
					>
						{{ t('devicesHomeyPlugin.cloudAuthorization.reconnect') }}
					</el-button>
					<el-button
						type="danger"
						plain
						:loading="authorizationStore.mutating"
						:disabled="authorizationStore.authorizing || authorizationStore.mutating"
						data-test-id="homey-cloud-disconnect"
						@click="disconnect"
					>
						{{ t('devicesHomeyPlugin.cloudAuthorization.disconnect') }}
					</el-button>
				</template>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus';

import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import { useHomeyCloudAuthorization } from '../store/homey-cloud-authorization.store';

defineOptions({ name: 'HomeyCloudAuthorizationPanel' });

const props = withDefaults(
	defineProps<{
		savedMode?: DevicesHomeyPluginConnectionMode;
		configurationSaved?: boolean;
		navigateToAuthorization?: (url: string) => void;
	}>(),
	{
		savedMode: DevicesHomeyPluginConnectionMode.local,
		configurationSaved: true,
		navigateToAuthorization: (url: string) => window.location.assign(url),
	}
);

const { t } = useI18n();
const authorizationStore = useHomeyCloudAuthorization();
const requestFailed = ref(false);
const selectedHomeyId = ref<string | null>(null);
const cloudModeSaved = computed<boolean>(() => props.savedMode === DevicesHomeyPluginConnectionMode.cloud);
const cloudConfigurationSaved = computed<boolean>(() => cloudModeSaved.value && props.configurationSaved);

const run = async (action: () => Promise<unknown>): Promise<void> => {
	requestFailed.value = false;
	try {
		await action();
	} catch {
		requestFailed.value = true;
	}
};

const startAuthorization = async (reconnect: boolean): Promise<void> => {
	if (!cloudConfigurationSaved.value) return;

	await run(async () => {
		const result = await authorizationStore.start(reconnect);
		props.navigateToAuthorization(result.authorizeUrl);
	});
};

const selectHomey = async (): Promise<void> => {
	if (selectedHomeyId.value === null) return;
	const homeyId = selectedHomeyId.value;

	await run(() => authorizationStore.select(homeyId));

	if (!authorizationStore.homeys.some((homey) => homey.id === homeyId)) selectedHomeyId.value = null;
};

const cancelAuthorization = async (): Promise<void> => {
	await run(async () => {
		await authorizationStore.cancel();
		selectedHomeyId.value = null;
	});
};

const disconnect = async (): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('devicesHomeyPlugin.cloudAuthorization.disconnectConfirm'), t('devicesHomeyPlugin.cloudAuthorization.disconnect'), {
			type: 'warning',
		});
	} catch {
		return;
	}

	await run(() => authorizationStore.disconnect());
};

const load = async (): Promise<void> => {
	requestFailed.value = false;
	const [statusResult, resumeResult] = await Promise.allSettled([authorizationStore.fetchStatus(), authorizationStore.resume()]);
	const resumed = resumeResult.status === 'fulfilled' && resumeResult.value !== null;

	requestFailed.value = resumeResult.status === 'rejected' || (statusResult.status === 'rejected' && !resumed);
};

onMounted(() => {
	void load();
});
</script>
