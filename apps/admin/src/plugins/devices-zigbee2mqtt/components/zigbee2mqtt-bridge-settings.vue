<template>
	<div
		v-if="status !== null && status.online && status.settings !== null"
		class="flex flex-col gap-2"
	>
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

import { ElAlert, ElLink } from 'element-plus';

import { useBridgeStatus } from '../composables/useBridgeStatus';
import { DEVICES_ZIGBEE2MQTT_FRESHNESS_DOCS_URL } from '../devices-zigbee2mqtt.constants';

defineOptions({
	name: 'Zigbee2mqttBridgeSettings',
});

const { t } = useI18n();

const { status, hints, fetchStatus } = useBridgeStatus();

onMounted(() => {
	void fetchStatus();
});
</script>
