<template>
	<el-card
		shadow="never"
		data-test-id="dew-point-editor"
	>
		<template #header>{{ t('devicesVirtualPlugin.dewPoint.title') }}</template>
		<el-alert
			:title="t('devicesVirtualPlugin.dewPoint.boundary')"
			type="info"
			:closable="false"
		/>
		<el-alert
			v-if="error"
			:title="t(`devicesVirtualPlugin.dewPoint.errors.${error}`)"
			type="error"
			:closable="false"
		/>
		<el-form
			label-position="top"
			:disabled="busy"
		>
			<el-form-item
				v-if="!outputId"
				:label="t('devicesVirtualPlugin.measurement.name')"
			>
				<el-input v-model="model.name" />
			</el-form-item>
			<el-form-item
				v-for="role in roles"
				:key="role.key"
				:label="t(`devicesVirtualPlugin.dewPoint.${role.key}`)"
			>
				<el-select
					v-model="model[role.field]"
					filterable
				>
					<el-option
						v-for="candidate in candidates(role.key)"
						:key="candidate.id"
						:value="candidate.id"
						:label="candidate.label"
					/>
				</el-select>
				<p v-if="current?.sources.find((s) => s.role === role.key)?.source_property === null">
					{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ current?.sources.find((s) => s.role === role.key)?.source_identity }}
				</p>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.measurement.maximumAge')">
				<el-input-number
					v-model="model.maximumAgeSeconds"
					:min="1"
					:max="86400"
				/>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.dewPoint.skew')">
				<el-input-number
					v-model="model.maximumSkewSeconds"
					:min="0"
					:max="3600"
				/>
			</el-form-item>
		</el-form>
		<p
			v-if="current"
			data-test-id="dew-point-diagnostics"
		>
			{{ current.quantity }} · {{ currentFresh ? current.current_value : '—' }} {{ current.unit }} ·
			{{ currentFresh ? current.quality : 'unavailable' }} · {{ current.errors.join(', ') }}
		</p>
		<div
			v-for="source in current?.sources ?? []"
			:key="source.role"
		>
			{{ t(`devicesVirtualPlugin.dewPoint.${source.role}`) }} · {{ source.source_identity }} · {{ source.age_seconds ?? '—' }} s ·
			{{ source.errors.join(', ') }}
		</div>
		<section
			v-if="preview"
			data-test-id="dew-point-preview"
		>
			<strong>{{ t('devicesVirtualPlugin.measurement.preview') }}</strong>
			<p>{{ preview.quality }} · {{ preview.errors.join(', ') }}</p>
			<p
				v-for="source in preview.sources"
				:key="source.role"
			>
				{{ t(`devicesVirtualPlugin.dewPoint.${source.role}`) }} · {{ source.source_identity }} · {{ source.current_value ?? '—' }} {{ source.unit }} ·
				{{ source.age_seconds ?? '—' }} s · {{ source.errors.join(', ') }}
			</p>
		</section>
		<el-button
			:disabled="busy"
			@click="reload"
		>
			{{ t('devicesVirtualPlugin.measurement.reload') }}
		</el-button>
		<el-button
			:disabled="busy"
			@click="check"
		>
			{{ t('devicesVirtualPlugin.measurement.preview') }}
		</el-button>
		<el-button
			:disabled="!canSave"
			@click="submit"
		>
			{{ t(`devicesVirtualPlugin.measurement.${outputId ? 'save' : 'create'}`) }}
		</el-button>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useDewPointAuthoring } from '../composables/use-dew-point-authoring';

const props = defineProps<{ outputId?: string }>();
const emit = defineEmits<{ created: [id: string]; busy: [value: boolean] }>();
const { t } = useI18n();
const { model, current, preview, busy, error, canSave, reload, check, save } = useDewPointAuthoring(props.outputId);
// Captured response expiry is never renewed by rendering or a wall-clock rollback.
const diagnosticNow = ref(Date.now()),
	diagnosticMonotonic = ref(performance.now());
let monotonicExpiry = 0;
let lastExpiry: number | null = null;
let lastSourceContract: string | null = null;
let clock: ReturnType<typeof setInterval> | undefined;
watch(
	current,
	(state) => {
		const expiry = Date.parse(state?.expires_at ?? '');
		const contract = JSON.stringify([state?.revision, state?.sources.map((source) => [source.source_identity, source.contract_fingerprint])]);
		if (state?.quality !== 'good' || !Number.isFinite(expiry)) monotonicExpiry = 0;
		else if (lastExpiry === null || expiry > lastExpiry) {
			lastExpiry = expiry;
			lastSourceContract = contract;
			monotonicExpiry = performance.now() + Math.max(0, expiry - Date.now());
		} else if (expiry < lastExpiry || contract !== lastSourceContract) monotonicExpiry = 0;
		// An identical cached response retains the first monotonic budget, including after rollback or a source gap.
	},
	{ flush: 'sync' }
);
const currentFresh = computed(
	() =>
		current.value?.quality === 'good' &&
		diagnosticNow.value < Date.parse(current.value.expires_at ?? '') &&
		diagnosticMonotonic.value < monotonicExpiry
);
onMounted(() => {
	clock = setInterval(() => {
		diagnosticNow.value = Date.now();
		diagnosticMonotonic.value = performance.now();
	}, 1000);
});
onUnmounted(() => {
	if (clock) clearInterval(clock);
});
const stores = injectStoresManager(),
	devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const roles = [
	{ key: 'dry_bulb', field: 'dryBulb' },
	{ key: 'relative_humidity', field: 'humidity' },
] as const;
function candidates(role: string) {
	const quantity = role === 'dry_bulb' ? 'temperature' : 'humidity',
		unit = role === 'dry_bulb' ? '°C' : '%';
	return properties.findAll().flatMap((p) => {
		const channel = channels.findById(p.channel),
			device = channel && devices.findById(channel.device);
		if (
			!device ||
			((p as { measurementQuantity?: string }).measurementQuantity != null &&
				(p as { measurementQuantity?: string }).measurementQuantity !== quantity) ||
			channel?.category !== quantity ||
			p.category !== quantity ||
			p.unit !== unit ||
			!p.permissions.some((permission) => ['ro', 'rw'].includes(permission))
		)
			return [];
		return [{ id: p.id, label: `${device.name} / ${channel.name} / ${p.name ?? quantity}` }];
	});
}
async function submit() {
	const id = await save();
	if (id) emit('created', id);
}
watch(busy, (value) => emit('busy', value), { immediate: true });
onMounted(async () => {
	await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
	await channels.fetch({});
	await Promise.all(channels.findAll().map((channel) => properties.fetch({ channelId: channel.id })));
});
</script>
