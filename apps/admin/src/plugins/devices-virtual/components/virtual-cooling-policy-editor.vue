<template>
	<virtual-wizard-card
		data-test-id="cooling-policy-editor"
		icon="mdi:snowflake"
		class="mb-4"
	>
		<template #header>
			<div class="flex items-center justify-between gap-3">
				<strong>{{ t('devicesVirtualPlugin.dewPoint.cooling') }}</strong>
				<el-switch
					:model-value="!!draft.policy.cooling"
					:aria-label="t('devicesVirtualPlugin.dewPoint.cooling')"
					:disabled="disabled || retained"
					class="cooling-policy__toggle"
					@change="toggle"
				/>
			</div>
		</template>
		<el-alert
			:title="t('devicesVirtualPlugin.dewPoint.installation')"
			type="warning"
			:closable="false"
		/>
		<el-button
			v-if="guided && draft.policy.cooling"
			class="mt-3"
			size="small"
			@click="emit('selectSources')"
		>
			{{ t('devicesVirtualPlugin.thermostat.wizard.selectCoolingSources') }}
		</el-button>
		<template v-if="draft.policy.cooling">
			<div class="cooling-policy__fields mt-4">
				<el-form-item
					:error="fieldError('coolingPolicy')"
					:label="t('devicesVirtualPlugin.dewPoint.margin')"
					required
				>
					<el-input-number
						v-model="draft.policy.cooling.marginC"
						:disabled="disabled"
						:min="0.01"
						:max="60"
					/>
				</el-form-item>
				<el-form-item
					:error="fieldError('coolingPolicy')"
					:label="t('devicesVirtualPlugin.dewPoint.hysteresis')"
					required
				>
					<el-input-number
						v-model="draft.policy.cooling.recoveryHysteresisC"
						:disabled="disabled"
						:min="0.01"
						:max="60"
					/>
				</el-form-item>
				<el-form-item
					:error="fieldError('coolingMinimum')"
					:label="t('devicesVirtualPlugin.dewPoint.absoluteMinimum')"
				>
					<el-input-number
						v-model="draft.policy.cooling.absoluteMinimumC"
						:disabled="disabled"
						:min="-44.99"
						:max="60"
					/>
				</el-form-item>
			</div>
			<section
				v-for="member in guided ? [] : draft.actuators.filter((m) => m.role === 'cooling')"
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
					<el-form-item
						:error="fieldError('coolingDependencies')"
						:label="t('devicesVirtualPlugin.dewPoint.title')"
						required
					>
						<el-input
							v-model="member.cooling_protection.dew_point_property"
							data-test-id="cooling-dew-point"
							:disabled="disabled"
						/>
					</el-form-item>
					<p v-if="member.retained?.cooling_protection">
						{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ member.retained.cooling_protection.dew_point_identity }}
					</p>
					<el-form-item
						:error="fieldError('coolingDependencies')"
						:label="t('devicesVirtualPlugin.dewPoint.surface')"
						required
					>
						<el-input
							v-model="member.cooling_protection.surface_property"
							data-test-id="cooling-surface"
							:disabled="disabled"
						/>
					</el-form-item>
					<p v-if="member.retained?.cooling_protection">
						{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ member.retained.cooling_protection.surface_identity }}
					</p>
					<el-form-item
						:error="fieldError('coolingDependencies')"
						:label="t('devicesVirtualPlugin.measurement.maximumAge')"
						required
					>
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
	</virtual-wizard-card>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElFormItem, ElInput, ElInputNumber, ElSwitch } from 'element-plus';

import { useWizardFieldError } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { DevicesVirtualPluginConfigureDewPointSchema_version, DevicesVirtualPluginCoolingDependencyPurpose } from '../../../openapi';
import { type ThermostatActuator, type ThermostatDraft, recommendedCoolingPolicy } from '../services/thermostat-authoring';

import VirtualWizardCard from './virtual-wizard-card.vue';

const props = defineProps<{ disabled: boolean; guided?: boolean }>();
const emit = defineEmits<{ selectSources: [] }>();
const draft = defineModel<ThermostatDraft>('draft', { required: true });
const { t } = useI18n();
const fieldError = useWizardFieldError();
const retained = computed(() => draft.value.actuators.some((m) => !!m.retained?.cooling_protection));
function toggle(value: string | number | boolean) {
	if (props.disabled || retained.value) return;
	draft.value.policy.cooling = value === true ? recommendedCoolingPolicy() : null;
	if (value !== true) {
		if (props.guided) draft.value.coolingSources = [];
		for (const member of draft.value.actuators) if (!member.retained) delete member.cooling_protection;
	}
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

<style scoped>
.cooling-policy__toggle {
	margin-block: -6px;
}
.cooling-policy__fields {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
	column-gap: 16px;
}
.cooling-policy__fields :deep(.el-input-number) {
	width: 100%;
}
</style>
