<template>
	<el-card
		data-test-id="light-group-detail"
		class="mt-2"
	>
		<template #header>{{ t('devicesVirtualPlugin.lightGroup.reportedState') }}</template>
		<el-alert
			v-if="error || authoring.error.value"
			type="error"
			:title="error ?? authoring.error.value ?? ''"
			:closable="false"
		/>
		<el-button
			:loading="busy"
			@click="load"
		>
			{{ t('devicesVirtualPlugin.lightGroup.reload') }}
		</el-button>
		<template v-if="configuration">
			<p v-if="configuration.reported_state">
				{{
					t('devicesVirtualPlugin.lightGroup.onCount', {
						on: configuration.reported_state.on_count,
						off: configuration.reported_state.off_count,
						unknown: configuration.reported_state.unknown_count,
						total: configuration.reported_state.total,
					})
				}}
			</p>
			<p v-else>{{ t('devicesVirtualPlugin.lightGroup.unknown') }}</p>
			<ul>
				<li
					v-for="member in configuration.members"
					:key="member.id"
				>
					{{ memberNames[member.source_identity] ?? member.source_identity }} —
					{{
						member.source_channel
							? (configuration.reported_state?.members.find((state) => state.source_identity === member.source_identity)?.on ??
								t('devicesVirtualPlugin.lightGroup.unknown'))
							: t('devicesVirtualPlugin.lightGroup.missingMember', { identity: member.source_identity })
					}}
				</li>
			</ul>
			<ul>
				<li
					v-for="property in configuration.reported_state?.properties ?? []"
					:key="property.category"
				>
					{{ t(`devicesModule.categories.channelsProperties.${property.category}`) }}:
					{{ property.mixed ? t('devicesVirtualPlugin.lightGroup.mixed') : (property.value ?? t('devicesVirtualPlugin.lightGroup.unknown')) }}
				</li>
			</ul>
			<el-button
				:disabled="busy"
				@click="command([{ category: 'on', value: true }])"
			>
				{{ t('devicesVirtualPlugin.lightGroup.turnOn') }}
			</el-button>
			<el-button
				:disabled="busy"
				@click="command([{ category: 'on', value: false }])"
			>
				{{ t('devicesVirtualPlugin.lightGroup.turnOff') }}
			</el-button>
			<div
				v-for="controls in numericControls"
				:key="controls[0]!.category"
				class="mt-2"
			>
				<label
					v-for="control in controls"
					:key="control.category"
				>
					{{ t(`devicesModule.categories.channelsProperties.${control.category}`) }} {{ control.unit ?? '' }}
					<el-input-number
						v-model="requestedValues[control.category]"
						:disabled="busy"
						:min="numericBound(control.format, 0)"
						:max="numericBound(control.format, 1)"
						:step="control.step ?? 1"
						:data-test-id="`light-group-control-${control.category}`"
					/>
				</label>
				<el-button
					:disabled="busy || controls.some((control) => numericTarget(control) === null)"
					@click="command(controls.map((control) => ({ category: control.category, value: numericTarget(control)! })))"
				>
					{{ t('devicesVirtualPlugin.lightGroup.apply') }}
				</el-button>
			</div>
			<el-button
				:disabled="busy"
				@click="edit"
			>
				{{ t('devicesVirtualPlugin.lightGroup.editTitle') }}
			</el-button>
			<template v-if="editing">
				<virtual-light-group-members
					v-model="memberIds"
					:disabled="busy"
					:candidates="candidates"
				/>
				<div
					v-for="member in missingMembers"
					:key="member.id"
					class="mt-2"
				>
					<label>{{ t('devicesVirtualPlugin.lightGroup.missingMember', { identity: member.source_identity }) }}</label>
					<el-select
						v-model="replacementIds[member.id]"
						:disabled="busy"
						clearable
						:placeholder="t('devicesVirtualPlugin.lightGroup.selectMembers')"
						:data-test-id="`repair-member-${member.id}`"
					>
						<el-option
							v-for="candidate in candidates"
							:key="candidate.id"
							:value="candidate.id"
							:label="candidate.label"
						/>
					</el-select>
				</div>
				<el-button
					:disabled="busy || memberIds.length < 2"
					@click="previewEdit"
				>
					{{ t('devicesVirtualPlugin.lightGroup.preview') }}
				</el-button>
				<el-button
					:disabled="busy || !previewKey"
					@click="saveEdit"
				>
					{{ t('devicesVirtualPlugin.lightGroup.save') }}
				</el-button>
				<el-button
					:disabled="busy"
					@click="editing = false"
				>
					{{ t('devicesVirtualPlugin.lightGroup.cancel') }}
				</el-button>
			</template>
		</template>
	</el-card>
	<virtual-light-group-outcomes
		:commands="outcomeRows"
		:names="memberNames"
	/>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { injectSockets, injectStoresManager, useBackend } from '../../../common';
import type { IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import type { components } from '../../../openapi';
import { useLightGroupAuthoring } from '../composables/useLightGroupAuthoring';
import { useLightGroupCommandOutcomes } from '../composables/useLightGroupCommandOutcomes';
import { lightGroupChannelCandidates } from '../utils/light-group-candidates.utils';

import VirtualLightGroupMembers from './virtual-light-group-members.vue';
import VirtualLightGroupOutcomes from './virtual-light-group-outcomes.vue';

type GeneratedConfiguration = components['schemas']['DevicesVirtualPluginDataLightGroupConfiguration'];
// The producer deliberately publishes null until the current graph has been validated.
// Swagger's referenced schema loses nullable in the generated client.
type Configuration = Omit<GeneratedConfiguration, 'reported_state'> & {
	reported_state?: GeneratedConfiguration['reported_state'] | null;
};
type Configure = components['schemas']['DevicesVirtualPluginConfigureLightGroup'];
const props = defineProps<{ device: IDevice }>();
const { t } = useI18n();
const backend = useBackend();
const stores = injectStoresManager();
const devices = stores.getStore(devicesStoreKey);
const channels = stores.getStore(channelsStoreKey);
const properties = stores.getStore(channelsPropertiesStoreKey);
const authoring = useLightGroupAuthoring();
const outcomes = useLightGroupCommandOutcomes(props.device.id);
const configuration = ref<Configuration | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const editing = ref(false);
const memberIds = ref<string[]>([]);
const replacementIds = ref<Record<string, string | undefined>>({});
const missingMembers = computed(
	() =>
		configuration.value?.members.filter(
			(member) =>
				(!member.source_channel || member.bindings.some((binding) => !binding.source_property)) && memberIds.value.includes(member.source_identity)
		) ?? []
);
const previewKey = ref<string | null>(null);
const requestedValues = ref<Record<string, number | undefined>>({});
const numericBound = (format: (number[] | string[]) | null, index: number) =>
	typeof format?.[index] === 'number' ? (format[index] as number) : undefined;
const numericTarget = (control: components['schemas']['DevicesVirtualPluginDataLightGroupCapability']): number | null => {
	const value = requestedValues.value[control.category];
	const min = numericBound(control.format, 0);
	const max = numericBound(control.format, 1);
	if (value === undefined || !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) return null;
	const target =
		control.step && control.step > 0 ? Number(((min ?? 0) + Math.round((value - (min ?? 0)) / control.step) * control.step).toFixed(6)) : value;
	return (min !== undefined && target < min) || (max !== undefined && target > max) ? null : target;
};
const numericControls = computed(() => {
	const available = configuration.value?.common_capabilities ?? [];
	const exposed = new Set(configuration.value?.members[0]?.bindings.map((binding) => binding.quantity) ?? []);
	return [['brightness'], ['color_temperature'], ['color_red', 'color_green', 'color_blue'], ['hue', 'saturation']]
		.filter((categories) => categories.every((category) => exposed.has(category) && available.some((control) => control.category === category)))
		.map((categories) => categories.map((category) => available.find((control) => control.category === category)!));
});
const terminal = ref<components['schemas']['DevicesModuleDataCompositeCommandOutcome'][]>([]);
const memberNames = computed(() =>
	Object.fromEntries(
		channels.findAll().map((channel) => [channel.id, `${devices.findById(channel.device)?.name ?? channel.device} / ${channel.name}`])
	)
);
const candidates = computed(() =>
	lightGroupChannelCandidates(devices.findAll(), channels.findAll(), properties.findAll()).map((channel) => ({
		id: channel.id,
		label: memberNames.value[channel.id] ?? channel.id,
	}))
);
const outcomeRows = computed(() => [
	...(outcomes.progress.value.length ? [{ id: 'progress', status: 'accepted', children: outcomes.progress.value }] : []),
	...outcomes.terminal.value,
	...terminal.value.filter((entry) => !outcomes.terminal.value.some((event) => event.id === entry.id)),
]);
watch(
	[memberIds, replacementIds],
	() => {
		previewKey.value = null;
	},
	{ deep: true }
);
const describe = (cause: unknown) => (cause instanceof Error ? cause.message : t('devicesVirtualPlugin.lightGroup.loadFailed'));
const load = async () => {
	busy.value = true;
	error.value = null;
	try {
		await channels.fetch({ deviceId: props.device.id });
		const channel = channels.findForDevice(props.device.id).find((candidate) => candidate.category === 'light');
		if (!channel) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
		await properties.fetch({ channelId: channel.id });
		configuration.value = await authoring.load(channel.id);
	} catch (cause) {
		error.value = describe(cause);
	} finally {
		busy.value = false;
	}
};
const edit = async () => {
	busy.value = true;
	try {
		await devices.fetch();
		await Promise.all(
			devices
				.findAll()
				.filter((device) => device.type !== 'virtual')
				.map(async (device) => {
					await channels.fetch({ deviceId: device.id });
					await Promise.all(channels.findForDevice(device.id).map((channel) => properties.fetch({ channelId: channel.id })));
				})
		);
		replacementIds.value = {};
		memberIds.value = configuration.value?.members.map((member) => member.source_channel ?? member.source_identity) ?? [];
		editing.value = true;
	} catch (cause) {
		error.value = describe(cause);
	} finally {
		busy.value = false;
	}
};
const editDraft = (): Configure => {
	const current = configuration.value;
	if (!current) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
	const controls = current.members[0]?.bindings ?? [];
	return {
		profile: current.profile as Configure['profile'],
		expected_revision: current.revision,
		expected_graph_revision: current.graph_revision,
		members: memberIds.value.map((id) => {
			const previous = current.members.find((member) => member.source_identity === id);
			const replacement = previous ? replacementIds.value[previous.id] : undefined;
			if (previous && !replacement) {
				return {
					id: previous.id,
					source_channel: previous.source_channel,
					bindings: previous.bindings.map((binding) => ({
						id: binding.id,
						output_property: binding.output_property,
						source_property: binding.source_property,
					})),
				};
			}
			const sourceChannel = replacement || id;
			return {
				...(previous ? { id: previous.id } : {}),
				source_channel: sourceChannel,
				bindings: controls.map((control) => {
					const source = properties.findForChannel(sourceChannel).find((property) => property.category === control.quantity);
					if (!source) throw new Error(t('devicesVirtualPlugin.lightGroup.revisionConflict'));
					const previousBinding = previous?.bindings.find((binding) => binding.output_property === control.output_property);
					return {
						...(previousBinding ? { id: previousBinding.id } : {}),
						output_property: control.output_property,
						source_property: source.id,
					};
				}),
			};
		}),
	};
};
const previewEdit = async () => {
	busy.value = true;
	error.value = null;
	previewKey.value = null;
	try {
		const draft = editDraft();
		const result = await backend.client.POST('/plugins/devices-virtual/producers/light-groups/{id}/preview', {
			params: { path: { id: configuration.value!.group_channel } },
			body: draft,
		});
		if (!result.data) throw new Error(t('devicesVirtualPlugin.lightGroup.revisionConflict'));
		previewKey.value = JSON.stringify(draft);
	} catch (cause) {
		error.value = describe(cause);
	} finally {
		busy.value = false;
	}
};
const saveEdit = async () => {
	busy.value = true;
	error.value = null;
	try {
		const draft = editDraft();
		if (JSON.stringify(draft) !== previewKey.value) throw new Error(t('devicesVirtualPlugin.lightGroup.previewRequired'));
		const result = await backend.client.PUT('/plugins/devices-virtual/producers/light-groups/{id}', {
			params: { path: { id: configuration.value!.group_channel } },
			body: draft,
		});
		if (!result.data) throw new Error(t('devicesVirtualPlugin.lightGroup.revisionConflict'));
		configuration.value = result.data.data;
		editing.value = false;
		previewKey.value = null;
	} catch (cause) {
		error.value = describe(cause);
	} finally {
		busy.value = false;
	}
};
const command = async (targets: { category: string; value: number | boolean }[]) => {
	busy.value = true;
	error.value = null;
	try {
		const channelId = configuration.value?.group_channel;
		if (!channelId) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
		const commands = targets.map((target) => {
			const property = properties.findForChannel(channelId).find((candidate) => candidate.category === target.category);
			if (!property) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
			return { device: props.device.id, channel: channelId, property: property.id, value: target.value };
		});
		const result = await backend.client.POST('/modules/devices/property-commands', {
			signal: AbortSignal.timeout(35_000),
			body: {
				request_id: crypto.randomUUID(),
				properties: commands,
			},
		});
		if (!result.data) throw new Error(t('devicesVirtualPlugin.lightGroup.commandUncertain'));
		terminal.value = result.data.data.composites;
		await load();
		if (!result.data.data.success && !result.data.data.composites.length)
			error.value =
				result.data.data.results
					.map((target) => target.reason)
					.filter(Boolean)
					.join('; ') || t('devicesVirtualPlugin.lightGroup.status.failed');
	} catch {
		error.value = t('devicesVirtualPlugin.lightGroup.commandUncertain');
	} finally {
		busy.value = false;
	}
};

const sockets = injectSockets();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const refreshReportedState = async () => {
	const current = configuration.value;
	if (!current || disposed) return;
	try {
		const result = await backend.client.GET('/plugins/devices-virtual/producers/light-groups/{id}', {
			params: { path: { id: current.group_channel } },
		});
		if (disposed || configuration.value?.group_channel !== current.group_channel) return;
		if (!result.data) {
			configuration.value.reported_state = null;
			return;
		}
		if (result.data.data.revision !== current.revision) {
			previewKey.value = null;
			error.value = t('devicesVirtualPlugin.lightGroup.revisionConflict');
			configuration.value = null;
			return;
		}
		configuration.value.reported_state = result.data.data.reported_state;
	} catch {
		if (configuration.value) configuration.value.reported_state = null;
	}
};
const onStateEvent = (event: { event: string; payload: unknown }) => {
	if (
		event.event !== 'DevicesVirtual.LightGroup.ReportedStateChanged' ||
		!event.payload ||
		typeof event.payload !== 'object' ||
		!('groupChannelId' in event.payload) ||
		event.payload.groupChannelId !== configuration.value?.group_channel ||
		refreshTimer
	)
		return;
	refreshTimer = setTimeout(() => {
		refreshTimer = undefined;
		void refreshReportedState();
	}, 250);
};
const disconnected = () => {
	if (configuration.value) configuration.value.reported_state = null;
};
sockets.on('event', onStateEvent);
sockets.on('disconnect', disconnected);
sockets.on('connect', refreshReportedState);
onBeforeUnmount(() => {
	disposed = true;
	clearTimeout(refreshTimer);
	sockets.off('event', onStateEvent);
	sockets.off('disconnect', disconnected);
	sockets.off('connect', refreshReportedState);
});
onBeforeMount(load);
</script>
