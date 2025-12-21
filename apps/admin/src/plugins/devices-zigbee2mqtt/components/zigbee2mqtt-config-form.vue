<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.aboutPluginStatus')"
			:description="t('devicesZigbee2mqttPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.aboutMqtt')"
			:description="t('devicesZigbee2mqttPlugin.texts.aboutMqtt')"
			:closable="false"
		/>

		<el-row
			:gutter="20"
			class="mt-3"
		>
			<el-col
				:xs="24"
				:sm="16"
			>
				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.host.title')"
					prop="mqtt.host"
				>
					<el-input
						v-model="model.mqtt.host"
						:placeholder="t('devicesZigbee2mqttPlugin.fields.config.mqtt.host.placeholder')"
						name="mqttHost"
					/>
				</el-form-item>
			</el-col>
			<el-col
				:xs="24"
				:sm="8"
			>
				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.port.title')"
					prop="mqtt.port"
				>
					<el-input-number
						v-model="model.mqtt.port"
						:min="1"
						:max="65535"
						name="mqttPort"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<el-row :gutter="20">
			<el-col
				:xs="24"
				:sm="12"
			>
				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.username.title')"
					prop="mqtt.username"
				>
					<el-input
						v-model="model.mqtt.username"
						:placeholder="t('devicesZigbee2mqttPlugin.fields.config.mqtt.username.placeholder')"
						name="mqttUsername"
					/>
				</el-form-item>
			</el-col>
			<el-col
				:xs="24"
				:sm="12"
			>
				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.password.title')"
					prop="mqtt.password"
				>
					<el-input
						v-model="model.mqtt.password"
						type="password"
						:placeholder="t('devicesZigbee2mqttPlugin.fields.config.mqtt.password.placeholder')"
						name="mqttPassword"
						show-password
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.baseTopic.title')"
			prop="mqtt.baseTopic"
		>
			<el-input
				v-model="model.mqtt.baseTopic"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.config.mqtt.baseTopic.placeholder')"
				name="mqttBaseTopic"
			/>
		</el-form-item>

		<el-collapse class="mt-3">
			<el-collapse-item :title="t('devicesZigbee2mqttPlugin.headings.advancedMqttSettings')">
				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.clientId.title')"
					prop="mqtt.clientId"
				>
					<el-input
						v-model="model.mqtt.clientId"
						:placeholder="t('devicesZigbee2mqttPlugin.fields.config.mqtt.clientId.placeholder')"
						name="mqttClientId"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.cleanSession.title')"
					prop="mqtt.cleanSession"
					label-position="left"
				>
					<el-switch
						v-model="model.mqtt.cleanSession"
						name="mqttCleanSession"
					/>
				</el-form-item>

				<el-row :gutter="20">
					<el-col
						:xs="24"
						:sm="8"
					>
						<el-form-item
							:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.keepalive.title')"
							prop="mqtt.keepalive"
						>
							<el-input-number
								v-model="model.mqtt.keepalive"
								:min="10"
								:step="10"
								name="mqttKeepalive"
								class="w-full!"
							/>
						</el-form-item>
					</el-col>
					<el-col
						:xs="24"
						:sm="8"
					>
						<el-form-item
							:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.connectTimeout.title')"
							prop="mqtt.connectTimeout"
						>
							<el-input-number
								v-model="model.mqtt.connectTimeout"
								:min="1000"
								:step="1000"
								name="mqttConnectTimeout"
								class="w-full!"
							/>
						</el-form-item>
					</el-col>
					<el-col
						:xs="24"
						:sm="8"
					>
						<el-form-item
							:label="t('devicesZigbee2mqttPlugin.fields.config.mqtt.reconnectInterval.title')"
							prop="mqtt.reconnectInterval"
						>
							<el-input-number
								v-model="model.mqtt.reconnectInterval"
								:min="1000"
								:step="1000"
								name="mqttReconnectInterval"
								class="w-full!"
							/>
						</el-form-item>
					</el-col>
				</el-row>
			</el-collapse-item>
		</el-collapse>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.aboutTls')"
			:description="t('devicesZigbee2mqttPlugin.texts.aboutTls')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.config.tls.enabled.title')"
			prop="tls.enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.tls.enabled"
				name="tlsEnabled"
			/>
		</el-form-item>

		<template v-if="model.tls.enabled">
			<el-form-item
				:label="t('devicesZigbee2mqttPlugin.fields.config.tls.rejectUnauthorized.title')"
				prop="tls.rejectUnauthorized"
				label-position="left"
			>
				<el-switch
					v-model="model.tls.rejectUnauthorized"
					name="tlsRejectUnauthorized"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesZigbee2mqttPlugin.fields.config.tls.ca.title')"
				prop="tls.ca"
			>
				<el-input
					v-model="model.tls.ca"
					type="textarea"
					:rows="3"
					:placeholder="t('devicesZigbee2mqttPlugin.fields.config.tls.ca.placeholder')"
					name="tlsCa"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesZigbee2mqttPlugin.fields.config.tls.cert.title')"
				prop="tls.cert"
			>
				<el-input
					v-model="model.tls.cert"
					type="textarea"
					:rows="3"
					:placeholder="t('devicesZigbee2mqttPlugin.fields.config.tls.cert.placeholder')"
					name="tlsCert"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesZigbee2mqttPlugin.fields.config.tls.key.title')"
				prop="tls.key"
			>
				<el-input
					v-model="model.tls.key"
					type="textarea"
					:rows="3"
					:placeholder="t('devicesZigbee2mqttPlugin.fields.config.tls.key.placeholder')"
					name="tlsKey"
				/>
			</el-form-item>
		</template>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.aboutDiscovery')"
			:description="t('devicesZigbee2mqttPlugin.texts.aboutDiscovery')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.config.discovery.autoAdd.title')"
			prop="discovery.autoAdd"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.discovery.autoAdd"
				name="discoveryAutoAdd"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.config.discovery.syncOnStartup.title')"
			prop="discovery.syncOnStartup"
			label-position="left"
		>
			<el-switch
				v-model="model.discovery.syncOnStartup"
				name="discoverySyncOnStartup"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElCol,
	ElCollapse,
	ElCollapseItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElRow,
	ElSwitch,
	type FormRules,
} from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IZigbee2mqttConfigEditForm } from '../schemas/config.types';

import type { IZigbee2mqttConfigFormProps } from './zigbee2mqtt-config-form.types';

defineOptions({
	name: 'Zigbee2mqttConfigForm',
});

const props = withDefaults(defineProps<IZigbee2mqttConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IZigbee2mqttConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesZigbee2mqttPlugin.messages.config.edited'),
		error: t('devicesZigbee2mqttPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IZigbee2mqttConfigEditForm>>({
	'mqtt.host': [{ required: true, message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.host.validation.required'), trigger: 'blur' }],
	'mqtt.port': [
		{ required: true, message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.port.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.port.validation.range'),
			validator: (_rule, value) => value >= 1 && value <= 65535,
			trigger: 'change',
		},
	],
	'mqtt.baseTopic': [
		{ required: true, message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.baseTopic.validation.required'), trigger: 'blur' },
	],
	'mqtt.keepalive': [
		{
			type: 'integer',
			message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.keepalive.validation.number'),
			validator: (_rule, value) => value >= 10,
			trigger: 'change',
		},
	],
	'mqtt.connectTimeout': [
		{
			type: 'integer',
			message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.connectTimeout.validation.number'),
			validator: (_rule, value) => value >= 1000,
			trigger: 'change',
		},
	],
	'mqtt.reconnectInterval': [
		{
			type: 'integer',
			message: t('devicesZigbee2mqttPlugin.fields.config.mqtt.reconnectInterval.validation.number'),
			validator: (_rule, value) => value >= 1000,
			trigger: 'change',
		},
	],
});

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
