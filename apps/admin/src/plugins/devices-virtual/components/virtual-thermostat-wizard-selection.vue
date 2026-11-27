<template>
	<div
		data-test-id="thermostat-selection"
		:aria-busy="loading"
	>
		<el-button
			v-if="loadError"
			class="mb-3"
			:loading="loading"
			@click="load"
		>
			{{ t('devicesVirtualPlugin.thermostat.actions.reload') }}
		</el-button>
		<virtual-wizard-source-picker
			:sources="available"
			:selected="selected"
			:selected-title="kind === 'actuators' ? t('devicesVirtualPlugin.thermostat.summary.members') : undefined"
			:add-title="kind === 'actuators' ? t('devicesVirtualPlugin.thermostat.wizard.addActuator') : undefined"
			:room-id="roomId"
			:zone-ids="zoneIds"
			:disabled="disabled || loading"
			@add="add"
			@remove="remove"
		>
			<template #columns>
				<el-table-column
					:label="t('devicesVirtualPlugin.thermostat.wizard.role')"
					width="160"
				>
					<template #default="{ row }">
						<el-select
							:model-value="roleOf(row.id)"
							:aria-label="`${row.name} · ${t('devicesVirtualPlugin.thermostat.wizard.role')}`"
							:disabled="disabled || loading || rolesFor(row.id).length < 2"
							:data-thermostat-role="row.id"
							@update:model-value="changeRole(row.id, $event)"
						>
							<el-option
								v-for="role in rolesFor(row.id)"
								:key="role"
								:value="role"
								:label="roleLabel(role)"
							/>
						</el-select>
					</template>
				</el-table-column>
			</template>
		</virtual-wizard-source-picker>
		<el-form
			label-position="top"
			status-icon
			@submit.prevent
		>
			<el-form-item
				:error="selectionError"
				class="mb-0!"
				data-test-id="thermostat-selection-error"
			/>
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElOption, ElSelect, ElTableColumn } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { useWizardFieldError } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { usePlacementNames } from '../composables/use-placement-names';
import type { ThermostatDraft } from '../services/thermostat-authoring';
import { formatSourceSampleAge, sourceSampleAge } from '../utils/source-sample-age';
import {
	type ThermostatWizardSourceRole,
	addThermostatWizardActuator,
	addThermostatWizardSource,
	removeThermostatWizardSource,
	setThermostatWizardSourceRole,
	syncThermostatWizardBranches,
	thermostatWizardCandidates,
	thermostatWizardRoleFull,
	thermostatWizardSources,
} from '../utils/thermostat-wizard-selection';

import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';

const props = defineProps<{ kind: 'sources' | 'actuators'; roomId: string | null; zoneIds: string[]; disabled?: boolean }>();
const draft = defineModel<ThermostatDraft>('draft', { required: true });
const emit = defineEmits<{ loading: [value: boolean] }>();
const { t, locale } = useI18n();
const roleLabel = (role: string) => t(`devicesVirtualPlugin.thermostat.wizard.roles.${role}`);
const stores = injectStoresManager();
const devices = stores.getStore(devicesStoreKey);
const channels = stores.getStore(channelsStoreKey);
const properties = stores.getStore(channelsPropertiesStoreKey);
const { roomName } = usePlacementNames();
const fieldError = useWizardFieldError();
const flash = useFlashMessage();
const loading = ref(false);
const loadError = ref(false);
let active = true;
const now = ref(Date.now());
const clock = setInterval(() => {
	now.value = Date.now();
}, 1000);
const load = async () => {
	if (loading.value) return;
	loading.value = true;
	emit('loading', true);
	loadError.value = false;
	try {
		await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
	} catch {
		if (active) {
			loadError.value = true;
			flash.error(t('devicesVirtualPlugin.thermostat.loadFailed'));
		}
	} finally {
		loading.value = false;
		if (active) emit('loading', false);
	}
};
onMounted(() => {
	void load();
});
onBeforeUnmount(() => {
	active = false;
	clearInterval(clock);
	emit('loading', false);
});

const candidates = computed(() => thermostatWizardCandidates(props.kind, devices.findAll(), channels.findAll(), properties.findAll()));
const candidateById = computed(() => new Map(candidates.value.map((candidate) => [candidate.id, candidate])));
const chosen = computed(() => (props.kind === 'sources' ? thermostatWizardSources(draft.value) : draft.value.actuators));
const roleOf = (id: string) => chosen.value.find((entry) => entry.source_property === id)?.role;
const rolesFor = (id: string) => {
	const current = roleOf(id);
	const roles = candidateById.value.get(id)?.roles ?? (current ? [current] : []);
	if (props.kind === 'actuators') return roles;
	return roles.filter((role) => {
		const other = thermostatWizardSources(draft.value).find((source) => source.source_property !== id && source.role === role);
		if (role === 'cooled_surface') return role === current || !thermostatWizardRoleFull(draft.value, role);
		return !other || candidateById.value.get(other.source_property ?? '')?.roles.some((allowed) => allowed === current);
	});
};
const reading = (property: ReturnType<typeof properties.findAll>[number] | undefined, online: boolean | null) => {
	const value = property?.value?.value;
	return online !== false && (typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))
		? `${value} ${property?.unit ?? ''}`.trim()
		: '—';
};
const sourceRow = (id: string, liveAge = true): VirtualWizardSource => {
	const candidate = candidateById.value.get(id);
	const property = candidate?.property;
	const device = candidate?.device;
	const age = sourceSampleAge(property?.value?.lastUpdated, liveAge ? now.value : Date.now());
	const value = reading(property, device?.status?.online ?? null);
	return {
		id,
		name: device?.name ?? t('devicesVirtualPlugin.measurement.missing', { id }),
		detail: [candidate?.channel.name, property?.name ?? property?.category].filter(Boolean).join(' · '),
		roomId: device?.roomId ?? null,
		zoneIds: device?.zoneIds ?? [],
		room: roomName(device?.roomId ?? null),
		online: device?.status?.online ?? null,
		reading: value,
		age: age === null && value !== '—' ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime') : formatSourceSampleAge(age, locale?.value),
		readingHint: age === null && value !== '—' ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint') : undefined,
	};
};
const selected = computed(() => chosen.value.flatMap((entry) => (entry.source_property ? [sourceRow(entry.source_property)] : [])));
const available = computed(() =>
	orderBy(
		candidates.value.map((candidate) => {
			const full =
				props.kind === 'actuators' ? draft.value.actuators.length >= 8 : candidate.roles.every((role) => thermostatWizardRoleFull(draft.value, role));
			return {
				...sourceRow(candidate.id, false),
				disabled: full,
				disabledReason: full
					? t(`devicesVirtualPlugin.thermostat.wizard.${props.kind === 'actuators' ? 'actuatorLimit' : 'sourceLimit'}`)
					: undefined,
			};
		}),
		[(entry) => entry.name, (entry) => entry.detail],
		['asc', 'asc']
	)
);
const selectionError = computed(() =>
	(props.kind === 'sources'
		? [
				'coolingDewPointSource',
				'coolingSurfaceSource',
				'ambientSource',
				'sourceSelect:ambient',
				'sourceSelect:floor',
				'sourceSelect:contact',
				'contactSourceLimit',
				'sourceRole',
				'sourceDistinct',
			]
		: ['actuatorRequired', 'memberLimit', 'memberDistinct', 'actuatorRepair:heating', 'actuatorRepair:cooling']
	)
		.map(fieldError)
		.filter(Boolean)
		.join(' · ')
);
const add = (id: string) => {
	if (props.disabled || loading.value) return;
	const candidate = candidateById.value.get(id);
	if (!candidate) return;
	if (props.kind === 'sources') addThermostatWizardSource(draft.value, candidate);
	else addThermostatWizardActuator(draft.value, candidate);
};
const remove = (id: string) => {
	if (props.disabled) return;
	if (props.kind === 'sources') removeThermostatWizardSource(draft.value, id);
	else {
		draft.value.actuators = draft.value.actuators.filter((member) => member.source_property !== id);
		syncThermostatWizardBranches(draft.value);
	}
};
const changeRole = (id: string, role: string) => {
	if (props.disabled) return;
	const candidate = candidateById.value.get(id);
	if (!candidate || !candidate.roles.some((allowed) => allowed === role)) return;
	if (props.kind === 'sources') setThermostatWizardSourceRole(draft.value, candidate, role as ThermostatWizardSourceRole, candidates.value);
	else {
		const member = draft.value.actuators.find((entry) => entry.source_property === id);
		if (!member || member.role === role) return;
		member.role = role as ThermostatDraft['actuators'][number]['role'];
		delete member.provider_profile;
		delete member.independent_protection_acknowledged;
		member.lease_seconds = null;
		if (role === 'cooling') delete member.protection;
		else delete member.cooling_protection;
		syncThermostatWizardBranches(draft.value);
	}
};
</script>
