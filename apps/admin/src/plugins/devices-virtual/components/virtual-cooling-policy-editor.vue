<template>
	<section data-test-id="cooling-policy-editor">
		<h3>{{ t('devicesVirtualPlugin.dewPoint.cooling') }}</h3>
		<el-alert
			:title="t('devicesVirtualPlugin.dewPoint.installation')"
			type="warning"
			:closable="false"
		/>
		<el-switch
			:model-value="!!draft.policy.cooling"
			:disabled="disabled || retained"
			@change="toggle"
		/>
		<template v-if="draft.policy.cooling">
			<el-form-item :label="t('devicesVirtualPlugin.dewPoint.margin')">
				<el-input-number
					v-model="draft.policy.cooling.marginC"
					:disabled="disabled"
					:min="0.01"
					:max="60"
				/>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.dewPoint.hysteresis')">
				<el-input-number
					v-model="draft.policy.cooling.recoveryHysteresisC"
					:disabled="disabled"
					:min="0.01"
					:max="60"
				/>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.dewPoint.absoluteMinimum')">
				<el-input-number
					v-model="draft.policy.cooling.absoluteMinimumC"
					:disabled="disabled"
					:min="-44.99"
					:max="60"
				/>
			</el-form-item>
			<section
				v-for="member in draft.actuators.filter((m) => m.role === 'cooling')"
				:key="member.retained?.id ?? member.source_property ?? ''"
			>
				<strong>{{ member.retained?.physical_identity ?? member.source_property }}</strong>
				<p
					v-for="reason in member.retained?.cooling_diagnostics?.reasons ?? []"
					:key="reason"
				>
					{{ reason }}
				</p>
				<template v-if="member.cooling_protection">
					<el-form-item :label="t('devicesVirtualPlugin.dewPoint.title')">
						<el-input
							v-model="member.cooling_protection.dew_point_property"
							data-test-id="cooling-dew-point"
							:disabled="disabled"
						/>
					</el-form-item>
					<p v-if="member.retained?.cooling_protection">
						{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ member.retained.cooling_protection.dew_point_identity }}
					</p>
					<el-form-item :label="t('devicesVirtualPlugin.dewPoint.surface')">
						<el-input
							v-model="member.cooling_protection.surface_property"
							data-test-id="cooling-surface"
							:disabled="disabled"
						/>
					</el-form-item>
					<p v-if="member.retained?.cooling_protection">
						{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ member.retained.cooling_protection.surface_identity }}
					</p>
					<el-form-item :label="t('devicesVirtualPlugin.measurement.maximumAge')">
						<el-input-number
							v-model="member.cooling_protection.maximum_age_seconds"
							:min="1"
							:max="86400"
							:disabled="disabled"
						/>
					</el-form-item>
				</template>
			</section>
		</template>
	</section>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElInput, ElInputNumber, ElSwitch } from 'element-plus';

import { DevicesVirtualPluginConfigureDewPointSchema_version, DevicesVirtualPluginCoolingDependencyPurpose } from '../../../openapi';
import type { ThermostatActuator, ThermostatDraft } from '../services/thermostat-authoring';

const props = defineProps<{ disabled: boolean }>();
const draft = defineModel<ThermostatDraft>('draft', { required: true });
const { t } = useI18n();
const retained = computed(() => draft.value.actuators.some((m) => !!m.retained?.cooling_protection));
function toggle(value: string | number | boolean) {
	if (props.disabled || retained.value) return;
	draft.value.policy.cooling = value === true ? { schemaVersion: 1, marginC: null, recoveryHysteresisC: null, absoluteMinimumC: null } : null;
}
watch(
	() => [!!draft.value.policy.cooling, draft.value.actuators.map((member) => [member.role, member.source_property])],
	() => {
		if (!draft.value.policy.cooling) return;
		for (const member of draft.value.actuators.filter((m) => m.role === 'cooling'))
			member.cooling_protection ??= {
				schemaVersion: DevicesVirtualPluginConfigureDewPointSchema_version.Value1,
				purpose: DevicesVirtualPluginCoolingDependencyPurpose.cooled_surface,
				dew_point_property: null,
				surface_property: null,
				maximum_age_seconds: 60,
			} as ThermostatActuator['cooling_protection'];
	},
	{ immediate: true }
);
</script>
