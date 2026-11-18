<template>
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between gap-2">
			<strong>{{ t('devicesZigbee2mqttPlugin.bridgeSettings.title') }}</strong>
			<el-button
				:loading="loading"
				link
				type="primary"
				@click="fetchStatus"
			>
				{{ t('devicesZigbee2mqttPlugin.bridgeSettings.refresh') }}
			</el-button>
		</div>

		<el-alert
			v-if="status === null || !status.online || status.settings === null"
			type="info"
			:title="t('devicesZigbee2mqttPlugin.bridgeSettings.unavailable.title')"
			:description="t('devicesZigbee2mqttPlugin.bridgeSettings.unavailable.message')"
			:closable="false"
			show-icon
		/>

		<template v-else>
			<el-alert
				v-for="hint in hints"
				:key="hint.id"
				:type="hint.severity"
				:title="t(`devicesZigbee2mqttPlugin.bridgeSettings.hints.${hint.id}.title`)"
				:closable="false"
				show-icon
			>
				<p>{{ t(`devicesZigbee2mqttPlugin.bridgeSettings.hints.${hint.id}.message`) }}</p>
				<pre class="mt-1 mb-0">{{ t(`devicesZigbee2mqttPlugin.bridgeSettings.hints.${hint.id}.config`) }}</pre>
			</el-alert>

			<el-alert
				v-if="hints.length === 0"
				type="success"
				:title="t('devicesZigbee2mqttPlugin.bridgeSettings.ready.title')"
				:description="t('devicesZigbee2mqttPlugin.bridgeSettings.ready.message')"
				:closable="false"
				show-icon
			/>
		</template>

		<el-link
			:href="DEVICES_ZIGBEE2MQTT_FRESHNESS_DOCS_URL"
			target="_blank"
			type="primary"
			class="self-start"
		>
			{{ t('devicesZigbee2mqttPlugin.bridgeSettings.learnMore') }}
		</el-link>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElLink } from 'element-plus';

import { useIntervalFn } from '@vueuse/core';

import { useBridgeStatus } from '../composables/useBridgeStatus';
import { DEVICES_ZIGBEE2MQTT_FRESHNESS_DOCS_URL } from '../devices-zigbee2mqtt.constants';

defineOptions({
	name: 'Zigbee2mqttBridgeSettings',
});

// The bridge may come online, or its settings change, while the form stays open.
const REFRESH_INTERVAL_MS = 30_000;

const { t } = useI18n();

const { status, hints, loading, fetchStatus } = useBridgeStatus();

useIntervalFn(() => {
	if (!loading.value) {
		void fetchStatus();
	}
}, REFRESH_INTERVAL_MS);

onMounted(() => {
	void fetchStatus();
});
</script>
