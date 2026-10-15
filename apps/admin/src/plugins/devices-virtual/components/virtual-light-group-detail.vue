<template>
	<el-card
		data-test-id="light-group-detail"
		class="mt-2"
	>
		<template #header>{{ t('devicesVirtualPlugin.lightGroup.reportedState') }}</template>
		<el-alert
			v-if="error || authoring.error.value || catalog.error.value"
			type="error"
			:title="error ?? authoring.error.value ?? catalog.error.value ?? ''"
			:closable="false"
		/>
		<el-button
			:loading="busy"
			@click="load"
		>
			{{ t('devicesVirtualPlugin.lightGroup.reload') }}
		</el-button>
		<template v-if="configuration">
			<p v-if="configuration.reported_state && configuration.profile !== 'cover'">
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
					<span>
						{{ configuration.reported_state?.members.find((state) => state.source_identity === member.source_identity)?.reasons?.join('; ') }}
					</span>
				</li>
			</ul>
			<ul>
				<li
					v-for="property in configuration.reported_state?.properties ?? []"
					:key="property.category"
				>
					{{ t(`devicesModule.categories.channelsProperties.${property.category}`) }}:
					{{
						property.expires_at && new Date(property.expires_at).getTime() <= now
							? t('devicesVirtualPlugin.lightGroup.unknown')
							: property.mixed
								? t('devicesVirtualPlugin.lightGroup.mixed')
								: (property.value ?? t('devicesVirtualPlugin.lightGroup.unknown'))
					}}
					<small>
						{{
							t('devicesVirtualPlugin.lightGroup.contributors', {
								count: property.contributors?.length ?? 0,
								total: configuration.reported_state?.total ?? 0,
							})
						}}
					</small>
					<small v-if="property.provenance === 'configured'">{{ t('devicesVirtualPlugin.lightGroup.configured') }}</small>
				</li>
			</ul>
			<el-button
				v-if="writable.some((category) => category === 'on')"
				:disabled="busy || !connected"
				@click="command([{ category: 'on', value: true }])"
			>
				{{ t('devicesVirtualPlugin.lightGroup.turnOn') }}
			</el-button>
			<el-button
				v-if="writable.some((category) => category === 'on')"
				:disabled="busy || !connected"
				@click="command([{ category: 'on', value: false }])"
			>
				{{ t('devicesVirtualPlugin.lightGroup.turnOff') }}
			</el-button>
			<template
				v-for="control in scalarControls"
				:key="control.category"
			>
				<label>{{ t(`devicesModule.categories.channelsProperties.${control.category}`) }} {{ control.unit ?? '' }}</label>
				<template v-if="control.data_type === 'bool'">
					<el-button
						v-for="value in [true, false]"
						:key="String(value)"
						:disabled="busy || !connected"
						@click="command([{ category: control.category, value }])"
					>
						{{ t(`devicesVirtualPlugin.lightGroup.${value ? 'turnOn' : 'turnOff'}`) }}
					</el-button>
				</template>
				<template v-else>
					<el-select
						v-model="requestedEnums[control.category]"
						:disabled="busy || !connected"
						:data-test-id="`group-enum-${control.category}`"
					>
						<el-option
							v-for="value in enumValues(control.format)"
							:key="value"
							:value="value"
							:label="value"
						/>
					</el-select>
					<el-button
						:disabled="busy || !connected || !enumValues(control.format).includes(requestedEnums[control.category] ?? '')"
						@click="command([{ category: control.category, value: requestedEnums[control.category]! }])"
					>
						{{ t('devicesVirtualPlugin.lightGroup.apply') }}
					</el-button>
				</template>
			</template>
			<template v-if="configuration.profile === 'cover'">
				<el-alert
					:title="t('devicesVirtualPlugin.lightGroup.coverCommandMeaning')"
					type="info"
					:closable="false"
				/>
				<div
					v-for="operation in coverOperations"
					:key="operation.operation"
				>
					<el-button
						v-if="['open', 'close', 'stop'].includes(operation.operation)"
						:disabled="busy || !connected || !operation.commandable"
						:data-test-id="`group-command-${operation.operation}`"
						@click="command([{ category: 'command', value: operation.operation }])"
					>
						{{ t(`devicesVirtualPlugin.lightGroup.${operation.operation}`) }}
					</el-button>
					<span v-if="!operation.commandable">
						{{ operation.operation }}:
						{{
							operation.members.flatMap((member) => member.reasons.map((reason) => `${member.source_identity}: ${reason}`)).join('; ') ||
							t('devicesVirtualPlugin.lightGroup.readinessUnavailable')
						}}
					</span>
				</div>
			</template>

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
						:disabled="busy || !connected"
						:min="numericBound(control.format, 0)"
						:max="numericBound(control.format, 1)"
						:step="control.step ?? 1"
						:data-test-id="`light-group-control-${control.category}`"
					/>
				</label>
				<el-button
					:disabled="busy || !connected || controls.some((control) => numericTarget(control) === null)"
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
import { type GroupProfile, useGroupCatalog } from '../composables/useGroupCatalog';
import { useLightGroupAuthoring } from '../composables/useLightGroupAuthoring';
import { useLightGroupCommandOutcomes } from '../composables/useLightGroupCommandOutcomes';

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
const catalog = useGroupCatalog();
const connected = ref(true);
let requestGeneration = 0;
const outcomes = useLightGroupCommandOutcomes(props.device.id);
const configuration = ref<Configuration | null>(null);
const busy = ref(false);
const now = ref(Date.now());
const clock = setInterval(() => {
	now.value = Date.now();
}, 1000);
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
const writable = computed(() =>
	(configuration.value?.common_capabilities ?? [])
		.filter((field) => field.access === 'rw' || field.access === 'wo' || ((configuration.value?.profile ?? 'light') === 'light' && !field.access))
		.map((field) => field.category)
);
const requestedEnums = ref<Record<string, string | undefined>>({});
const enumValues = (format: string[] | number[] | null) => format?.filter((value): value is string => typeof value === 'string') ?? [];
const scalarControls = computed(() =>
	(configuration.value?.common_capabilities ?? []).filter(
		(field) =>
			writable.value.includes(field.category) && field.category !== 'on' && field.category !== 'command' && ['bool', 'enum'].includes(field.data_type)
	)
);
const coverOperations = computed(
	() =>
		configuration.value?.operations ??
		['open', 'close', 'stop', 'position', 'tilt'].map((operation) => ({ operation, commandable: false, members: [] }))
);
const controlReady = (category: string) =>
	configuration.value?.profile !== 'cover' || coverOperations.value.some((operation) => operation.operation === category && operation.commandable);
const requestedValues = ref<Record<string, number | undefined>>({});
watch(
	() => JSON.stringify([configuration.value?.revision, configuration.value?.common_capabilities]),
	() => {
		requestedEnums.value = {};
		requestedValues.value = {};
		previewKey.value = null;
	}
);
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
	return [['brightness'], ['color_temperature'], ['color_red', 'color_green', 'color_blue'], ['hue', 'saturation'], ['speed'], ['position'], ['tilt']]
		.filter((categories) =>
			categories.every(
				(category) =>
					exposed.has(category) &&
					controlReady(category) &&
					available.some(
						(control) => control.category === category && !['bool', 'enum'].includes(control.data_type) && writable.value.includes(control.category)
					)
			)
		)
		.map((categories) => categories.map((category) => available.find((control) => control.category === category)!));
});
const terminal = ref<components['schemas']['DevicesModuleDataCompositeCommandOutcome'][]>([]);
const memberNames = computed(() =>
	Object.fromEntries(
		channels.findAll().map((channel) => [channel.id, `${devices.findById(channel.device)?.name ?? channel.device} / ${channel.name}`])
	)
);
const candidates = computed(() =>
	(catalog.catalog.value?.candidates ?? []).map((candidate) => ({
		id: candidate.channel,
		label: `${candidate.name}${candidate.reasons.length ? ` — ${candidate.reasons.join('; ')}` : ''}`,
		eligible: candidate.eligible,
	}))
);
const refreshCandidates = () => {
	if (editing.value && configuration.value)
		void catalog.load({
			profile: configuration.value.profile as GroupProfile,
			selected_channels: memberIds.value.map((id) => {
				const member = configuration.value?.members.find((member) => member.source_identity === id);
				return member ? replacementIds.value[member.id] || member.source_channel || id : id;
			}),
			exposed_group: configuration.value.group_channel,
		});
};

const outcomeRows = computed(() => [
	...(outcomes.progress.value.length ? [{ id: 'progress', status: 'accepted', children: outcomes.progress.value }] : []),
	...outcomes.terminal.value,
	...terminal.value.filter((entry) => !outcomes.terminal.value.some((event) => event.id === entry.id)),
]);
watch(
	[memberIds, replacementIds],
	() => {
		previewKey.value = null;
		refreshCandidates();
	},
	{ deep: true }
);
watch(
	() =>
		JSON.stringify(
			properties.findAll().map(({ id, channel, category, dataType, format, step, permissions, unit }) => ({
				id,
				channel,
				category,
				dataType,
				format,
				step,
				permissions,
				unit,
			}))
		),
	() => {
		if (editing.value) {
			previewKey.value = null;
			refreshCandidates();
		}
	}
);
const describe = (cause: unknown) => (cause instanceof Error ? cause.message : t('devicesVirtualPlugin.lightGroup.loadFailed'));
const load = async () => {
	const generation = ++requestGeneration;
	busy.value = true;
	error.value = null;
	try {
		await channels.fetch({ deviceId: props.device.id });
		const channel = channels
			.findForDevice(props.device.id)
			.find((candidate) => ['light', 'switcher', 'outlet', 'fan', 'window_covering'].includes(candidate.category));
		if (!channel) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
		await properties.fetch({ channelId: channel.id });
		const next = await authoring.load(channel.id);
		if (disposed || generation !== requestGeneration || !connected.value) return;
		configuration.value = next;
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
		refreshCandidates();
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
	const generation = requestGeneration;
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
		if (disposed || generation !== requestGeneration || !connected.value || JSON.stringify(editDraft()) !== JSON.stringify(draft)) return;
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
const command = async (targets: { category: string; value: number | boolean | string }[]) => {
	busy.value = true;
	error.value = null;
	try {
		const channelId = configuration.value?.group_channel;
		if (!connected.value || !channelId) throw new Error(t('devicesVirtualPlugin.lightGroup.loadFailed'));
		if (targets.some((target) => !controlReady(target.category === 'command' ? String(target.value) : target.category)))
			throw new Error(t('devicesVirtualPlugin.lightGroup.readinessUnavailable'));
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
	const generation = ++requestGeneration;
	const current = configuration.value;
	if (!current || disposed) return;
	try {
		const result = await backend.client.GET('/plugins/devices-virtual/producers/light-groups/{id}', {
			params: { path: { id: current.group_channel } },
		});
		if (disposed || generation !== requestGeneration || !connected.value || configuration.value?.group_channel !== current.group_channel) return;
		if (!result.data) {
			configuration.value.reported_state = null;
			configuration.value.operations = undefined;
			return;
		}
		if (
			result.data.data.revision !== current.revision ||
			JSON.stringify(result.data.data.common_capabilities) !== JSON.stringify(current.common_capabilities)
		) {
			previewKey.value = null;
			error.value = t('devicesVirtualPlugin.lightGroup.revisionConflict');
			configuration.value = null;
			return;
		}
		configuration.value = result.data.data;
	} catch {
		if (configuration.value) {
			configuration.value.reported_state = null;
			configuration.value.operations = undefined;
		}
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
	++requestGeneration;
	if (configuration.value?.profile === 'cover') configuration.value.operations = undefined;
	refreshTimer = setTimeout(() => {
		refreshTimer = undefined;
		void refreshReportedState();
	}, 250);
};
const disconnected = () => {
	++requestGeneration;
	authoring.invalidatePreview();
	connected.value = false;
	previewKey.value = null;
	if (configuration.value) configuration.value.reported_state = null;
};
sockets.on('event', onStateEvent);
sockets.on('disconnect', disconnected);
const reconnected = () => {
	connected.value = true;
	void refreshReportedState();
};
sockets.on('connect', reconnected);
onBeforeUnmount(() => {
	disposed = true;
	++requestGeneration;
	clearInterval(clock);
	clearTimeout(refreshTimer);
	sockets.off('event', onStateEvent);
	sockets.off('disconnect', disconnected);
	sockets.off('connect', reconnected);
});
onBeforeMount(load);
</script>
