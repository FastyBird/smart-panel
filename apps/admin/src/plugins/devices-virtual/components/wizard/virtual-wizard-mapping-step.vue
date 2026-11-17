<template>
	<div
		v-loading="loading"
		class="projection-mapping"
		:aria-busy="loading"
	>
		<el-alert
			v-if="category === null"
			type="warning"
			:title="t('devicesVirtualPlugin.wizard.mapping.noCategory')"
			:closable="false"
		/>
		<template v-else>
			<aside class="projection-mapping__channels">
				<strong class="block mb-3">{{ text('channelsTitle') }}</strong>
				<button
					v-for="group in includedGroups"
					:key="group.specChannel"
					type="button"
					class="projection-mapping__channel"
					:class="{ 'is-active': activeGroup?.specChannel === group.specChannel }"
					:data-channel="group.specChannel"
					@click="activeChannel = group.specChannel"
				>
					<div class="flex items-center justify-between gap-2">
						<strong>{{ channelLabel(group.specChannel) }}</strong>
						<el-tag
							v-if="issuesFor(group)"
							type="warning"
							size="small"
						>
							{{ text('toFix', { count: issuesFor(group) }) }}
						</el-tag>
					</div>
					<el-text
						size="small"
						class="block mt-2"
					>
						{{ t(`devicesVirtualPlugin.wizard.mapping.${group.required ? 'channelRequired' : 'channelOptional'}`) }} ·
						{{ text('mappedCount', { mapped: mappedCount(group), total: group.slots.length }) }}
					</el-text>
				</button>
				<template v-if="optionalGroups.length">
					<strong class="block mt-5 mb-3">{{ text('optionalChannels') }}</strong>
					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<div
							v-for="group in optionalGroups"
							:key="group.specChannel"
							class="projection-mapping__optional-channel"
						>
							<span>{{ channelLabel(group.specChannel) }}</span>
							<el-button
								size="small"
								:data-add-channel="group.specChannel"
								@click="addChannel(group.specChannel)"
							>
								{{ t('devicesVirtualPlugin.wizard.layout.add') }}
							</el-button>
						</div>
					</el-card>
				</template>
				<el-text
					size="small"
					class="projection-mapping__channel-help"
				>
					{{ text('optionalChannelHelp') }}
				</el-text>
			</aside>
			<main class="projection-mapping__content">
				<template v-if="activeGroup">
					<div class="flex items-center justify-between gap-3 mb-2">
						<h3 class="m-0 text-base">{{ channelLabel(activeGroup.specChannel) }}</h3>
						<virtual-wizard-remove-button
							v-if="!activeGroup.required"
							:data-remove-channel="activeGroup.specChannel"
							:label="t('devicesVirtualPlugin.measurement.remove')"
							@click="removeChannel(activeGroup.specChannel)"
						/>
					</div>
					<el-text class="projection-mapping__description">{{ text('mappingDescription') }}</el-text>
					<el-form
						class="projection-mapping__shortcut"
						label-position="top"
						@submit.prevent
					>
						<el-form-item
							:label="text('fillDescription')"
							:for="`shortcut-channel-${activeGroup.specChannel}`"
							class="mb-0!"
						>
							<div class="projection-mapping__shortcut-controls">
								<el-select-v2
									:id="`shortcut-channel-${activeGroup.specChannel}`"
									:model-value="channelPickers[activeGroup.specChannel]?.channel ?? null"
									:options="channelOptions"
									:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.channelPlaceholder')"
									:aria-label="t('devicesVirtualPlugin.wizard.mapping.source.channelPlaceholder')"
									filterable
									clearable
									class="projection-mapping__shortcut-select"
									:name="`shortcut-channel-${activeGroup.specChannel}`"
									@update:model-value="onShortcutChannel(activeGroup.specChannel, $event || null)"
								/>
								<el-button
									class="projection-mapping__shortcut-button"
									:disabled="!channelPickers[activeGroup.specChannel]?.channel"
									:loading="applying > 0"
									@click="onApplyChannel(activeGroup.specChannel)"
								>
									{{ text('fillEmpty') }}
								</el-button>
							</div>
						</el-form-item>
					</el-form>

					<virtual-wizard-card flush>
						<el-form
							label-position="top"
							@submit.prevent
						>
							<el-table
								:data="activeSlots"
								row-key="key"
								:data-test-id="`slot-group-${activeGroup.specChannel}`"
								class="projection-mapping__table"
							>
								<el-table-column
									:label="t('devicesVirtualPlugin.wizard.review.columns.property')"
									:min-width="160"
								>
									<template #default="{ row }">
										<div :data-test-id="`slot-${row.key}`">
											<strong>{{ propertyLabel(row.specProperty) }}</strong>
											<el-text
												size="small"
												class="block"
											>
												{{ t(`devicesVirtualPlugin.wizard.mapping.${row.propertyRequired ? 'propertyRequired' : 'propertyOptional'}`) }} ·
												{{ slotHint(row) }}
											</el-text>
										</div>
									</template>
								</el-table-column>
								<el-table-column
									:label="text('sourceColumn')"
									:min-width="330"
								>
									<template #default="{ row }">
										<el-form-item
											:error="
												errors[row.key] ||
												(fieldError('mappings') && row.propertyRequired && !selections[row.key]
													? t('devicesModule.wizard.validation.required')
													: '') ||
												(validationAttempted
													? constraintViolations
															.filter((violation) => violation.specChannel === row.specChannel)
															.map((violation) => violation.message)
															.join(' · ')
													: '')
											"
											class="mb-0!"
											:data-test-id="errors[row.key] ? `slot-error-${row.key}` : undefined"
										>
											<el-select-v2
												:model-value="selections[row.key] ?? null"
												:options="sourceOptions(row)"
												:loading="checking[row.key] || (optionLoading[row.key] && !optionsReady(row))"
												:aria-label="propertyLabel(row.specProperty)"
												:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.propertyPlaceholder')"
												filterable
												clearable
												class="w-full"
												:name="`property-${row.key}`"
												@visible-change="onOptionsOpen(row, $event)"
												@update:model-value="onPickProperty(row.key, $event || null)"
											>
												<template
													v-if="optionLoading[row.key] && optionsReady(row)"
													#footer
												>
													<el-text size="small">{{ text('loadingSources') }}</el-text>
												</template>
											</el-select-v2>
										</el-form-item>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('devicesVirtualPlugin.wizard.layout.currentValue')"
									:width="90"
								>
									<template #default="{ row }"><virtual-projection-source-value :property-id="selections[row.key]" /></template>
								</el-table-column>
								<el-table-column
									:label="text('statusColumn')"
									:width="145"
								>
									<template #default="{ row }">
										<el-tag
											:type="
												errors[row.key]
													? 'danger'
													: checking[row.key]
														? 'info'
														: selections[row.key]
															? 'success'
															: row.propertyRequired
																? 'warning'
																: 'info'
											"
											size="small"
										>
											{{
												text(
													errors[row.key]
														? 'needsAttention'
														: checking[row.key]
															? 'checking'
															: selections[row.key]
																? 'mapped'
																: row.propertyRequired
																	? 'notMapped'
																	: 'optional'
												)
											}}
										</el-tag>
									</template>
								</el-table-column>
							</el-table>
						</el-form>
					</virtual-wizard-card>
					<div
						v-if="hiddenSlotsCount(activeGroup) > 0 || expanded[activeGroup.specChannel]"
						class="flex items-center gap-3 mt-3 flex-wrap"
					>
						<el-text
							v-if="hiddenSlotsCount(activeGroup) > 0"
							size="small"
						>
							{{ text('unmappedOptional', { count: hiddenSlotsCount(activeGroup) }) }}
						</el-text>
						<el-button
							link
							type="primary"
							:data-test-id="`optional-slots-${activeGroup.specChannel}`"
							@click="expanded[activeGroup.specChannel] = !expanded[activeGroup.specChannel]"
						>
							{{
								expanded[activeGroup.specChannel]
									? t('devicesVirtualPlugin.wizard.mapping.hideOptional')
									: t('devicesVirtualPlugin.wizard.mapping.showOptional', { count: hiddenSlotsCount(activeGroup) })
							}}
						</el-button>
					</div>
				</template>
				<el-text v-else>{{ text('chooseChannel') }}</el-text>
			</main>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElForm, ElFormItem, ElSelectV2, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../../common';
import type { IChannelProperty, IDevice } from '../../../../modules/devices';
import { useWizardFieldError } from '../../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../../modules/devices/store/keys';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyPermissions,
	type DevicesModuleDeviceCategory,
	DevicesModuleDeviceHiddenBy,
	DevicesModuleDevicesHiddenFilter,
	type DevicesVirtualPluginCheckCompatibilityOperation,
	type DevicesVirtualPluginCompatibilityReportSchema,
} from '../../../../openapi.constants';
import { channelsSchema } from '../../../../spec/channels';
import { devicesSchema } from '../../../../spec/devices';
import { useProjectionSourceMetadata } from '../../composables/use-projection-source-metadata';
import { useVirtualWizardSourceGroups } from '../../composables/use-virtual-wizard-placement';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../../devices-virtual.constants';
import { projectionSlotGroups } from '../../utils/projection-specification';
import { isVirtualSourceDeviceCandidate, isVirtualSourcePropertyCandidate } from '../../utils/source-candidates.utils';
import VirtualWizardCard from '../virtual-wizard-card.vue';
import VirtualWizardRemoveButton from '../virtual-wizard-remove-button.vue';

import VirtualProjectionSourceValue from './virtual-projection-source-value.vue';
import type {
	IVirtualMappingProgress,
	IVirtualMappingSlot,
	IVirtualMappingSlotGroup,
	IVirtualWizardMappingStepProps,
} from './virtual-wizard-mapping-step.types';
import type { IVirtualSlotMapping } from './virtual-wizard.types';

defineOptions({
	name: 'VirtualWizardMappingStep',
});

const props = defineProps<IVirtualWizardMappingStepProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: IVirtualSlotMapping[]): void;
	(e: 'update:valid', value: boolean): void;
	(e: 'update:optionalChannels', value: DevicesModuleChannelCategory[]): void;
	(e: 'update:busy', value: boolean): void;
}>();

const { t } = useI18n();
const fieldError = useWizardFieldError();
const text = (key: string, params = {}) => t(`devicesVirtualPlugin.wizard.projection.${key}`, params);
const channelLabel = (value: string) => t(`devicesModule.categories.channels.${value}`);
const propertyLabel = (value: string) => t(`devicesModule.categories.channelsProperties.${value}`);
const loading = ref(true);
const applying = ref(0);
const activeChannel = ref<DevicesModuleChannelCategory | null>(null);
const optionalChannels = ref<DevicesModuleChannelCategory[]>([...(props.optionalChannels ?? [])]);
const backend = useBackend();
const logger = useLogger();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const devicesStore = storesManager.getStore(devicesStoreKey);
const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);
const sourceMetadata = useProjectionSourceMetadata(devicesStore, channelsStore, propertiesStore);

// slot key -> the source property chosen for it. The single source of truth for what is mapped;
// `mappings`, `progress` and `isValid` are all derived from it rather than maintained alongside it,
// which is what keeps the progress indicator honest when a mapping is cleared.
const selections = reactive<Record<string, string>>({});
// slot key -> why this slot's source was refused. Holds the backend's own reason verbatim: it is the
// only thing that tells the user *why*, and a friendlier substitute would throw that away.
const errors = reactive<Record<string, string>>({});
// slot key -> a compatibility check is in flight for it.
const checking = reactive<Record<string, boolean>>({});
const unverified = reactive<Record<string, boolean>>({});
// slot key -> which device/channel that slot's property list is narrowed to. Purely presentational:
// clearing it never clears the mapping, and the mapping is what the wizard carries forward.
const pickers = reactive<Record<string, { device: string | null; channel: string | null }>>({});
// spec channel -> the source channel the "take this whole channel" shortcut works from.
const channelPickers = reactive<Record<string, { device: string | null; channel: string | null }>>({});
// spec channel -> whether its optional, still-unmapped slots are shown.
const expanded = reactive<Record<string, boolean>>({});

// Monotonic per-slot request token. A slot's entry is bumped whenever its selection changes, so a
// response that arrives after the user has moved on can be recognised as stale and dropped.
let requestCounter = 0;
let disposed = false;
const compatibilityRequests = new Set<AbortController>();
const slotTokens = new Map<string, number>();

// The generated channel spec carries these alongside `properties`, but the admin's mapping layer only
// projects the property lists, so they are read from the schema directly. Narrowed locally rather than
// widening the shared spec types: this is the only consumer.
interface IChannelConstraints {
	oneOf?: DevicesModuleChannelPropertyCategory[][];
	oneOrMoreOf?: DevicesModuleChannelPropertyCategory[][];
	mutuallyExclusiveGroups?: DevicesModuleChannelPropertyCategory[][][];
}

const channelConstraints = (specChannel: DevicesModuleChannelCategory): IChannelConstraints => {
	const spec = (channelsSchema as unknown as Record<string, { constraints?: IChannelConstraints }>)[specChannel];

	return spec?.constraints ?? {};
};

// The device spec constrains which *channels* may appear together, independently of what each channel
// requires internally — `switcher` needs at least one of `outlet`/`switcher` and refuses both at once.
// Same three kinds, one level up, and the backend enforces them the same way.
interface IDeviceConstraints {
	oneOf?: DevicesModuleChannelCategory[][];
	oneOrMoreOf?: DevicesModuleChannelCategory[][];
	mutuallyExclusiveGroups?: DevicesModuleChannelCategory[][][];
}

const deviceConstraints = (category: DevicesModuleDeviceCategory): IDeviceConstraints => {
	const spec = (devicesSchema as unknown as Record<string, { constraints?: IDeviceConstraints }>)[category];

	return spec?.constraints ?? {};
};

const groups = computed(() => projectionSlotGroups(props.category));

const slots = computed<IVirtualMappingSlot[]>((): IVirtualMappingSlot[] =>
	groups.value.flatMap((group: IVirtualMappingSlotGroup): IVirtualMappingSlot[] => group.slots)
);

// One entry per slot, unfilled ones carried as `sourceProperty: null` — the shape IVirtualSlotMapping
// documents. The later steps get the whole picture (including which optional slots were deliberately
// left empty) rather than having to re-expand the spec to find out what is missing.
const mappings = computed<IVirtualSlotMapping[]>((): IVirtualSlotMapping[] =>
	slots.value.map(
		(slot: IVirtualMappingSlot): IVirtualSlotMapping => ({
			specChannel: slot.specChannel,
			specProperty: slot.specProperty,
			sourceProperty: selections[slot.key] ?? null,
		})
	)
);

const progress = computed<IVirtualMappingProgress>((): IVirtualMappingProgress => {
	// A channel the user has put something in is a channel that will be created, and a created channel
	// owes its own required properties — `slot.required` alone is the conjunction of both levels, which
	// is right for an untouched optional channel (it will not exist, so nothing in it is owed) and wrong
	// for a populated one. Mapping `electrical_power.voltage` and nothing else would otherwise pass:
	// `power` is required *within* that channel, and the backend rejects the channel without it.
	const usedChannels = new Set(
		slots.value
			.filter((slot: IVirtualMappingSlot): boolean => typeof selections[slot.key] === 'string')
			.map((slot: IVirtualMappingSlot): DevicesModuleChannelCategory => slot.specChannel)
	);

	const required = slots.value.filter(
		(slot: IVirtualMappingSlot): boolean =>
			slot.required || (slot.propertyRequired && (usedChannels.has(slot.specChannel) || optionalChannels.value.includes(slot.specChannel)))
	);

	const remaining = required.filter((slot: IVirtualMappingSlot): boolean => typeof selections[slot.key] !== 'string');

	return {
		requiredTotal: required.length,
		requiredFilled: required.length - remaining.length,
		remaining,
	};
});

// A virtual device that borrows nothing is not a virtual device, whatever its category's required set
// happens to look like. That is not a hypothetical: `device_information` is filtered out of the
// expansion above (rightly — the backend owns those properties), and it is the *only* required channel
// of five of the 32 categories — `switcher`, `generic`, `sensor`, `terminal` and `game_console`. Their
// required set is therefore empty, so without this the step would report itself complete on arrival,
// before the user had mapped anything. `switcher` is exactly the flagship case: splitting a four-relay
// device into per-room switches.
const hasMapping = computed<boolean>((): boolean => Object.keys(selections).length > 0);

const isComplete = computed<boolean>((): boolean => hasMapping.value && progress.value.remaining.length === 0);

// The spec constrains a channel beyond each property's own `required` flag, and DeviceValidationService
// enforces those constraints server-side. Without repeating them here the wizard happily builds devices
// the backend then reports as structurally invalid: a `sensor` whose only mapping is
// `air_quality.active` passes the required-slot check (every non-information channel of a sensor is
// optional) while `air_quality` demands at least one of `aqi` or `level`; a `light` can be given both
// the RGB and the HSV group, which are mutually exclusive.
//
// A constraint only applies to a channel the user has actually put something in — an untouched optional
// channel is not half-built, it is absent, and the backend will not receive it at all.
const constraintViolations = computed<{ specChannel: DevicesModuleChannelCategory; message: string }[]>(
	(): { specChannel: DevicesModuleChannelCategory; message: string }[] => {
		const violations: { specChannel: DevicesModuleChannelCategory; message: string }[] = [];

		// Which channels the user has actually put something in. A channel with no mapping is absent
		// from the create payload entirely, so the device-level rules below judge exactly this set.
		const usedChannels = groups.value
			.filter((group): boolean => group.slots.some((slot): boolean => typeof selections[slot.key] === 'string'))
			.map((group): DevicesModuleChannelCategory => group.specChannel);

		if (props.category !== null && usedChannels.length > 0) {
			const constraints = deviceConstraints(props.category);

			for (const oneOrMore of constraints.oneOrMoreOf ?? []) {
				if (!oneOrMore.some((channel): boolean => usedChannels.includes(channel))) {
					violations.push({
						specChannel: oneOrMore[0],
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.deviceOneOrMoreOf', {
							channels: oneOrMore.map((channel): string => t(`devicesModule.categories.channels.${channel}`)).join(', '),
						}),
					});
				}
			}

			for (const exclusive of constraints.oneOf ?? []) {
				if (exclusive.filter((channel): boolean => usedChannels.includes(channel)).length > 1) {
					violations.push({
						specChannel: exclusive[0],
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.deviceOneOf', {
							channels: exclusive.map((channel): string => t(`devicesModule.categories.channels.${channel}`)).join(', '),
						}),
					});
				}
			}

			for (const exclusiveGroups of constraints.mutuallyExclusiveGroups ?? []) {
				const used = exclusiveGroups.filter((members): boolean => members.some((channel): boolean => usedChannels.includes(channel)));

				if (used.length > 1) {
					violations.push({
						specChannel: used[0][0],
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.deviceMutuallyExclusive', {
							groups: used
								.map((members): string => members.map((channel): string => t(`devicesModule.categories.channels.${channel}`)).join(' + '))
								.join(' / '),
						}),
					});
				}
			}
		}

		for (const group of groups.value) {
			const filled = group.slots
				.filter((slot): boolean => typeof selections[slot.key] === 'string')
				.map((slot): DevicesModuleChannelPropertyCategory => slot.specProperty);

			if (filled.length === 0) {
				continue;
			}

			const constraints = channelConstraints(group.specChannel);

			for (const oneOrMore of constraints.oneOrMoreOf ?? []) {
				if (!oneOrMore.some((property): boolean => filled.includes(property))) {
					violations.push({
						specChannel: group.specChannel,
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.oneOrMoreOf', {
							properties: oneOrMore.map((property): string => t(`devicesModule.categories.channelsProperties.${property}`)).join(', '),
						}),
					});
				}
			}

			for (const exclusive of constraints.oneOf ?? []) {
				if (exclusive.filter((property): boolean => filled.includes(property)).length > 1) {
					violations.push({
						specChannel: group.specChannel,
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.oneOf', {
							properties: exclusive.map((property): string => t(`devicesModule.categories.channelsProperties.${property}`)).join(', '),
						}),
					});
				}
			}

			for (const exclusiveGroups of constraints.mutuallyExclusiveGroups ?? []) {
				const used = exclusiveGroups.filter((members): boolean => members.some((property): boolean => filled.includes(property)));

				if (used.length > 1) {
					violations.push({
						specChannel: group.specChannel,
						message: t('devicesVirtualPlugin.wizard.mapping.constraints.mutuallyExclusive', {
							groups: used
								.map((members): string => members.map((property): string => t(`devicesModule.categories.channelsProperties.${property}`)).join(' + '))
								.join(' / '),
						}),
					});
				}
			}
		}

		return violations;
	}
);

const isChecking = computed<boolean>((): boolean => Object.values(checking).some((value: boolean): boolean => value));

// Hard block, not a warning: an incompatible mapping is one whose writes would die at the source
// platform, so the wizard must not be able to move past it. An unfinished check counts as not-yet-
// proven and blocks too, so the user cannot outrun the verdict by clicking straight through.
const isValid = computed<boolean>(
	(): boolean =>
		props.category !== null &&
		isComplete.value &&
		optionalChannels.value.every((channel) =>
			groups.value.find((group) => group.specChannel === channel)?.slots.some((slot) => !!selections[slot.key])
		) &&
		Object.keys(unverified).length === 0 &&
		Object.keys(errors).length === 0 &&
		constraintViolations.value.length === 0 &&
		!isChecking.value
);

const sourceDevicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] =>
	orderBy(
		sourceMetadata.snapshot.value.devices
			// Hidden devices are filtered here rather than requested away, because this reads an
			// already-loaded store collection that the device list's "Show hidden" toggle also reads —
			// narrowing the fetch would break that toggle for everyone.
			//
			// System-hidden devices are the exception, and deliberately so. Splitting a four-relay device
			// is four passes through this wizard, and the first pass offers to hide the parent as soon as
			// every mapping in *that* device came from it. Excluding it then would make relays two, three
			// and four unreachable — the flow would lock itself out halfway through the job it exists to
			// do. A `system` hide means "a virtual device has taken this over", which is precisely the
			// device a further split draws from. A `user` hide is a deliberate "stop showing me this" and
			// stays excluded.
			//
			// Virtual devices are excluded because nesting one virtual device inside another is refused
			// at creation (VirtualDevicesService.assertSourceNotVirtual) and the compatibility endpoint
			// does *not* check for it, so such a source would preview clean and then fail on create.
			.filter(
				(device): boolean =>
					!device.draft && (!device.hidden || device.hiddenBy === DevicesModuleDeviceHiddenBy.system) && isVirtualSourceDeviceCandidate(device)
			),
		[(device): string => device.name],
		['asc']
	).map((device): { value: IDevice['id']; label: string } => ({ value: device.id, label: device.name }))
);

const groupSources = useVirtualWizardSourceGroups();
const slotHint = (slot: IVirtualMappingSlot): string =>
	[slot.dataType, slot.unit, slot.permissions.join('/')].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ');

// An optional slot is only worth the screen space once the user asks for it — or once it already
// carries something (a mapping or an error), which must never be hidden from them.
const isSlotVisible = (group: IVirtualMappingSlotGroup, slot: IVirtualMappingSlot): boolean =>
	slot.propertyRequired ||
	group.slots.every((entry) => !entry.propertyRequired) ||
	expanded[group.specChannel] === true ||
	typeof selections[slot.key] === 'string' ||
	typeof errors[slot.key] === 'string';

const visibleSlots = (group: IVirtualMappingSlotGroup): IVirtualMappingSlot[] =>
	group.slots.filter((slot: IVirtualMappingSlot): boolean => isSlotVisible(group, slot));

const hiddenSlotsCount = (group: IVirtualMappingSlotGroup): number => group.slots.length - visibleSlots(group).length;

// Always narrowed by `findForChannel`, never by what `fetch` happens to return. A successful fetch
// resolves to the whole shared property cache rather than just the requested channel's rows, so a
// caller that matched on category alone could pick a property belonging to an entirely different
// device — the channel shortcut would then quietly build a cross-channel mapping. The fetch is still
// what guarantees the channel's own rows are present; the filter is what decides which ones count.
const loadProperties = async (channelId: string): Promise<IChannelProperty[]> => {
	try {
		await propertiesStore.fetch({ channelId });
	} catch (error: unknown) {
		logger.error('Failed to load source properties', error);
	}

	return propertiesStore.findForChannel(channelId);
};

// The response is documented as one report per candidate in request order, and each report echoes the
// triple it was evaluated for. Index is trusted first and the echo verifies it, so a response that
// ever came back out of order is caught rather than silently attributed to the wrong slot.
const matchReport = (
	reports: DevicesVirtualPluginCompatibilityReportSchema[],
	candidate: { slot: IVirtualMappingSlot; sourceProperty: string },
	index: number
): DevicesVirtualPluginCompatibilityReportSchema | null => {
	const echoes = (report: DevicesVirtualPluginCompatibilityReportSchema): boolean =>
		report.spec_channel === candidate.slot.specChannel &&
		report.spec_property === candidate.slot.specProperty &&
		report.source_property === candidate.sourceProperty;

	const positional = reports[index];

	if (positional && echoes(positional)) {
		return positional;
	}

	return reports.find(echoes) ?? null;
};

/**
 * Checks a batch of slot/source pairings and writes each verdict back onto its slot.
 *
 * One call per user action: a single selection sends one candidate, the "take this whole channel"
 * shortcut sends every slot it just filled in one request. The endpoint evaluates candidates
 * independently, so batching costs nothing in fidelity and saves a request per property on the
 * shortcut path.
 */
const runCompatibility = async (candidates: { slot: IVirtualMappingSlot; sourceProperty: string }[]): Promise<void> => {
	// The request DTO declares `candidates` as @ArrayNotEmpty, so an empty batch is a 400 rather than a
	// harmless no-op. The shortcut can legitimately match nothing, so the guard lives here.
	if (props.category === null || candidates.length === 0) {
		return;
	}

	const token = ++requestCounter;

	for (const candidate of candidates) {
		slotTokens.set(candidate.slot.key, token);

		checking[candidate.slot.key] = true;
		unverified[candidate.slot.key] = true;

		delete errors[candidate.slot.key];
	}

	// A slot whose token has moved on was re-selected or cleared while this request was in flight. Its
	// verdict describes a source the user has already replaced, so writing it back would pin an error
	// on a mapping that no longer exists.
	const settle = (slotKey: string, reason: string | null): void => {
		if (slotTokens.get(slotKey) !== token) {
			return;
		}

		delete checking[slotKey];

		if (reason === null) {
			delete unverified[slotKey];
			delete errors[slotKey];
		} else {
			errors[slotKey] = reason;
		}
	};

	const controller = new AbortController();
	compatibilityRequests.add(controller);
	const timeout = setTimeout(() => controller.abort(), 10000);
	try {
		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/devices/compatibility`, {
			signal: controller.signal,
			body: {
				data: {
					category: props.category,
					candidates: candidates.map((candidate) => ({
						spec_channel: candidate.slot.specChannel,
						spec_property: candidate.slot.specProperty,
						source_property: candidate.sourceProperty,
					})),
				},
			},
		});

		if (response?.status === 401) {
			for (const candidate of candidates) if (slotTokens.get(candidate.slot.key) === token) delete checking[candidate.slot.key];
			return;
		}
		const reports = responseData?.data;

		if (!reports) {
			// An unverified pairing is not a verified-good one, so the failure blocks the step exactly as
			// a refusal would. The backend's own detail is preferred over the generic wording, since a 422
			// here names the offending source property.
			const reason = error
				? getErrorReason<DevicesVirtualPluginCheckCompatibilityOperation>(error, t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed'))
				: t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');

			for (const candidate of candidates) {
				settle(candidate.slot.key, reason);
			}

			flashMessage.error(reason);

			return;
		}

		candidates.forEach((candidate, index): void => {
			const report = matchReport(reports, candidate, index);

			if (!report) {
				settle(candidate.slot.key, t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed'));

				return;
			}

			// The reason is passed through untouched — it is the whole explanation of why this source was
			// refused, and it names the source property, its permissions and what the slot needed.
			settle(candidate.slot.key, report.compatible ? null : (report.reason ?? t('devicesVirtualPlugin.wizard.mapping.errors.incompatible')));
		});
	} catch (err: unknown) {
		if (disposed) return;
		logger.error('Virtual device compatibility check failed', err);

		const reason = t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');

		for (const candidate of candidates) {
			settle(candidate.slot.key, reason);
		}

		if (candidates.some((candidate) => slotTokens.get(candidate.slot.key) === token)) flashMessage.error(reason);
	} finally {
		clearTimeout(timeout);
		compatibilityRequests.delete(controller);
	}
};

const selectSource = async (slotKey: string, sourcePropertyId: string | null): Promise<void> => {
	const slot = slots.value.find((entry: IVirtualMappingSlot): boolean => entry.key === slotKey);

	if (!slot) {
		return;
	}

	// Bumped before anything else so a check already in flight for this slot can no longer land: its
	// verdict belongs to the source being replaced, not to the one arriving.
	slotTokens.set(slotKey, ++requestCounter);

	delete errors[slotKey];
	delete checking[slotKey];

	if (sourcePropertyId === null) {
		delete selections[slotKey];
		delete unverified[slotKey];

		return;
	}

	selections[slotKey] = sourcePropertyId;

	await runCompatibility([{ slot, sourceProperty: sourcePropertyId }]);
};

/**
 * Fills every slot of one spec channel that the chosen source channel can cover, then checks them all
 * in one request. This is the split flow: a four-relay device's second switcher channel becomes a
 * whole virtual light in one action.
 *
 * Matching is by *property* category, not channel category, which is what makes the split work at all
 * — a `switcher` channel's `on` is exactly what a `light` channel's `on` slot needs. Slots the source
 * channel does not carry are left exactly as they were: not cleared, not half-filled, and still
 * counted as outstanding by the progress indicator if they are required.
 */
const applyChannel = async (specChannel: DevicesModuleChannelCategory, sourceChannelId: string | null): Promise<void> => {
	const group = groups.value.find((entry: IVirtualMappingSlotGroup): boolean => entry.specChannel === specChannel);

	if (!group || sourceChannelId === null) {
		return;
	}

	// Claim the slots this shortcut is about to fill *before* awaiting anything. Loading the source
	// channel's properties is a network round-trip, and until now nothing was staked during it: a user
	// who changed one of these slots by hand in that window, or applied a second source channel, would
	// see the older shortcut resume afterwards, overwrite `selections` and `pickers`, and re-stamp
	// itself with fresh compatibility tokens — leaving the superseded action as the final mapping.
	const intent = ++requestCounter;

	for (const slot of group.slots) {
		slotTokens.set(slot.key, intent);

		// The claim orphans any request already in flight for this slot: `settle` checks the token
		// before it writes, so that request will return without ever clearing the flag it set. Whether
		// anything takes the slot over from here is not decided yet — the source channel may carry no
		// matching property, or this whole shortcut may turn out to be the stale one — and in both of
		// those cases nobody would clear it, leaving the picker spinning for good. Clearing it as part
		// of taking the claim is what makes the flag belong to whoever holds the token.
		delete checking[slot.key];
	}

	const sourceProperties = await loadProperties(sourceChannelId);

	// Anything that touched one of these slots while the properties were loading has taken the claim,
	// and this shortcut is now the stale one.
	if (group.slots.some((slot: IVirtualMappingSlot): boolean => slotTokens.get(slot.key) !== intent)) {
		return;
	}

	const sourceChannel = channelsStore.findById(sourceChannelId);

	const candidates: { slot: IVirtualMappingSlot; sourceProperty: string }[] = [];
	let filled = 0;

	for (const slot of group.slots) {
		if (selections[slot.key]) {
			candidates.push({ slot, sourceProperty: selections[slot.key] });
			continue;
		}
		const match = sourceProperties.find((property: IChannelProperty): boolean => property.category === slot.specProperty);

		if (!match) {
			// The claim above invalidated whatever compatibility request was in flight for this slot, and
			// this shortcut has nothing to put in it. A selection the user made by hand would then be left
			// standing with neither an error nor a pending flag — which is all `isValid` looks at, so the
			// step could advance carrying a mapping that never received a verdict. Re-checked rather than
			// cleared: the choice is still theirs, it just has to be answered for again.
			const retained = selections[slot.key];

			if (retained) {
				candidates.push({ slot, sourceProperty: retained });
			}

			continue;
		}

		// No token bump here: this loop is synchronous and `runCompatibility` below re-stamps every
		// candidate with one fresh token before it awaits anything, so nothing can interleave and there
		// is no window for a stale verdict to land in.
		delete errors[slot.key];

		selections[slot.key] = match.id;
		filled++;

		pickers[slot.key] = { device: sourceChannel?.device ?? null, channel: sourceChannelId };

		candidates.push({ slot, sourceProperty: match.id });
	}

	if (candidates.length === 0) {
		flashMessage.info(t('devicesVirtualPlugin.wizard.mapping.shortcut.nothingApplied'));

		return;
	}

	// Everything the shortcut touched has to be visible, including the optional slots it filled.
	expanded[specChannel] = true;

	flashMessage.info(
		filled
			? t('devicesVirtualPlugin.wizard.mapping.shortcut.applied', { filled, total: group.slots.length })
			: t('devicesVirtualPlugin.wizard.mapping.shortcut.nothingApplied')
	);

	await runCompatibility(candidates);
};

const onPickProperty = (slotKey: string, propertyId: string | null): void => {
	const property = propertyId ? propertiesStore.findById(propertyId) : null;
	const channel = property ? channelsStore.findById(property.channel) : null;
	pickers[slotKey] = { device: channel?.device ?? null, channel: channel?.id ?? null };
	selectSource(slotKey, propertyId).catch((error: unknown): void => logger.error('Failed to select source property', error));
};

const onShortcutChannel = (specChannel: DevicesModuleChannelCategory, channelId: string | null): void => {
	channelPickers[specChannel] = { device: channelId ? (channelsStore.findById(channelId)?.device ?? null) : null, channel: channelId };

	if (channelId !== null) {
		loadProperties(channelId).catch((error: unknown): void => logger.error('Failed to load source properties', error));
	}
};

const onApplyChannel = (specChannel: DevicesModuleChannelCategory): void => {
	applying.value++;
	applyChannel(specChannel, channelPickers[specChannel]?.channel ?? null)
		.catch((error: unknown): void => logger.error('Failed to apply source channel', error))
		.finally(() => applying.value--);
};

const includedGroups = computed(() =>
	groups.value.filter(
		(group) => group.required || optionalChannels.value.includes(group.specChannel) || group.slots.some((slot) => !!selections[slot.key])
	)
);
const optionalGroups = computed(() => groups.value.filter((group) => !includedGroups.value.includes(group)));
const activeGroup = computed(
	() => includedGroups.value.find((group) => group.specChannel === activeChannel.value) ?? includedGroups.value[0] ?? null
);
const activeSlots = computed<IVirtualMappingSlot[]>((previous) => {
	const next = activeGroup.value ? visibleSlots(activeGroup.value) : [];
	return previous?.length === next.length && next.every((slot, index) => slot === previous[index]) ? previous : next;
});
const mappedCount = (group: IVirtualMappingSlotGroup) => group.slots.filter((slot) => !!selections[slot.key]).length;
const issuesFor = (group: IVirtualMappingSlotGroup) =>
	Math.max(
		group.slots.filter((slot) => !!errors[slot.key] || !!unverified[slot.key] || (slot.propertyRequired && !selections[slot.key])).length +
			constraintViolations.value.filter((violation) => violation.specChannel === group.specChannel).length,
		mappedCount(group) ? 0 : 1
	);

const addChannel = (channel: DevicesModuleChannelCategory) => {
	if (!groups.value.some((group) => group.specChannel === channel && !group.required)) return;
	if (!optionalChannels.value.includes(channel)) optionalChannels.value = [...optionalChannels.value, channel];
	activeChannel.value = channel;
};
const removeChannel = (channel: DevicesModuleChannelCategory) => {
	if (groups.value.some((group) => group.specChannel === channel && group.required)) return;
	for (const slot of groups.value.find((group) => group.specChannel === channel)?.slots ?? []) {
		slotTokens.set(slot.key, ++requestCounter);
		delete selections[slot.key];
		delete unverified[slot.key];
		delete errors[slot.key];
		delete checking[slot.key];
	}
	optionalChannels.value = optionalChannels.value.filter((value) => value !== channel);
};
const sourceIndex = computed(() => {
	const devices = new Map(sourceMetadata.snapshot.value.devices.map((device) => [device.id, device]));
	const allowed = new Set(sourceDevicesOptions.value.map((option) => option.value));
	const channels = new Map(sourceMetadata.snapshot.value.channels.map((channel) => [channel.id, channel]));
	const rows = sourceMetadata.snapshot.value.properties.flatMap((property) => {
		const channel = channels.get(property.channel),
			device = channel ? devices.get(channel.device) : undefined;
		if (!device || !channel || !allowed.has(device.id) || !isVirtualSourcePropertyCandidate(device, channel, property)) return [];
		return [
			{
				value: property.id,
				label: `${device.name} › ${channel.name} › ${property.name ?? propertyLabel(property.category)}`,
				property,
				device,
				channel,
			},
		];
	});
	return {
		devices,
		channels,
		allowed,
		rows: orderBy(rows, [(row) => row.device.name, (row) => row.channel.name, (row) => row.label], ['asc', 'asc', 'asc']),
	};
});
const channelOptions = computed(() => {
	const categories = new Set(activeGroup.value?.slots.map((slot) => slot.specProperty) ?? []);
	const usable = new Set(sourceIndex.value.rows.filter((row) => categories.has(row.property.category)).map((row) => row.channel.id));
	return groupSources(
		[...sourceIndex.value.channels.values()].flatMap((channel) => {
			const device = sourceIndex.value.devices.get(channel.device);
			return device && sourceIndex.value.allowed.has(device.id) && usable.has(channel.id)
				? [{ value: channel.id, label: `${device.name} › ${channel.name}`, device, channel }]
				: [];
		}),
		(option) => option.device
	).map((group) => ({
		value: `channel-group:${group.id}`,
		label: group.label,
		options: orderBy(group.items, [(option) => option.device.name, (option) => option.channel.name], ['asc', 'asc']).map(({ value, label }) => ({
			value,
			label,
		})),
	}));
});

const optionLoading = reactive<Record<string, boolean>>({});
const optionCache = shallowRef<Record<string, { signature: string; ids: Set<string>; checked: Set<string>; complete: boolean }>>({});
const optionRequests = new Map<string, AbortController>();
const metadataVersion = computed<{ signature: string; revision: number }>((previous) => {
	const signature = sourceMetadata.signature.value;
	return previous?.signature === signature ? previous : { signature, revision: (previous?.revision ?? 0) + 1 };
});
const optionSignature = (slot: IVirtualMappingSlot) => `${props.category}|${slot.key}|${metadataVersion.value.revision}`;
interface SourceOptionGroup {
	value: string;
	label: string;
	options: { value: string; label: string }[];
}
const optionSets = computed<Record<string, SourceOptionGroup[]>>(() =>
	Object.fromEntries(
		(activeGroup.value?.slots ?? []).map((slot) => {
			const entry = optionCache.value[slot.key];
			const rows = entry?.signature === optionSignature(slot) ? sourceIndex.value.rows.filter((row) => entry.ids.has(row.value)) : [];
			const options = groupSources(rows, (row) => row.device).map((group) => ({
				value: `source-group:${group.id}`,
				label: group.label,
				options: group.items.map(({ value, label }) => ({ value, label })),
			}));
			const selected = selections[slot.key];
			if (selected && !rows.some((row) => row.value === selected)) {
				const row = sourceIndex.value.rows.find((row) => row.value === selected);
				options.unshift({
					value: 'source-group:selected',
					label: text('selectedSource'),
					options: [{ value: selected, label: row?.label ?? t('devicesVirtualPlugin.wizard.review.unknownSource') }],
				});
			}
			return [slot.key, options];
		})
	)
);
const sourceOptions = (slot: IVirtualMappingSlot) => optionSets.value[slot.key] ?? [];
const optionsReady = (slot: IVirtualMappingSlot) => {
	const entry = optionCache.value[slot.key];
	return entry?.signature === optionSignature(slot) && entry.ids.size > 0;
};
const onOptionsOpen = async (slot: IVirtualMappingSlot, visible: boolean) => {
	if (!visible) {
		optionRequests.get(slot.key)?.abort();
		return;
	}
	const signature = optionSignature(slot);
	const previous = optionCache.value[slot.key];
	if ((previous?.signature === signature && previous.complete) || props.category === null) return;
	optionRequests.get(slot.key)?.abort();
	const controller = new AbortController();
	optionRequests.set(slot.key, controller);
	optionLoading[slot.key] = true;
	let timedOut = false;
	try {
		// Skip obvious type/permission mismatches before source lookups; the server still approves every offered option.
		const raw = (
			channelsSchema as unknown as Record<
				string,
				{ properties: Record<string, { category: string; data_type?: string; data_types?: { data_type: string }[] }> }
			>
		)[slot.specChannel];
		const propertySpec = Object.values(raw?.properties ?? {}).find((property) => property.category === slot.specProperty);
		const types = propertySpec?.data_types?.map((variant) => variant.data_type) ?? [propertySpec?.data_type];
		const ids = new Set(previous?.signature === signature ? previous.ids : []);
		const checked = new Set(previous?.signature === signature ? previous.checked : []);
		const candidates = sourceIndex.value.rows.filter(
			(row) =>
				types.includes(row.property.dataType) &&
				!checked.has(row.value) &&
				slot.permissions.every(
					(permission) =>
						row.property.permissions.includes(permission) ||
						((permission === 'ro' || permission === 'wo') && row.property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw))
				)
		);
		const publish = (complete: boolean) => {
			optionCache.value = { ...optionCache.value, [slot.key]: { signature, ids: new Set(ids), checked: new Set(checked), complete } };
		};
		for (let start = 0; start < candidates.length; start += 32) {
			const batch = candidates.slice(start, start + 32);
			const timeout = setTimeout(() => {
				timedOut = true;
				controller.abort();
			}, 10000);
			const result = await backend.client
				.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/devices/compatibility`, {
					signal: controller.signal,
					body: {
						data: {
							category: props.category,
							candidates: batch.map((row) => ({ spec_channel: slot.specChannel, spec_property: slot.specProperty, source_property: row.value })),
						},
					},
				})
				.finally(() => clearTimeout(timeout));
			if (controller.signal.aborted || optionRequests.get(slot.key) !== controller) return;
			if (!result.data) {
				if (result.response?.status !== 401) flashMessage.error(t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed'));
				return;
			}
			batch.forEach((row, index) => {
				const report = matchReport(result.data.data, { slot, sourceProperty: row.value }, index);
				if (!report) throw new Error('Incomplete compatibility response');
				checked.add(row.value);
				if (report.compatible) ids.add(row.value);
			});
			if (optionSignature(slot) !== signature) return;
			publish(false);
		}
		if (controller.signal.aborted || optionSignature(slot) !== signature) return;
		publish(true);
	} catch {
		if (!controller.signal.aborted || timedOut) flashMessage.error(t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed'));
	} finally {
		if (optionRequests.get(slot.key) === controller) {
			optionRequests.delete(slot.key);
			delete optionLoading[slot.key];
		}
	}
};
onScopeDispose(() => {
	disposed = true;
	compatibilityRequests.forEach((controller) => controller.abort());
	optionRequests.forEach((controller) => controller.abort());
	slotTokens.clear();
});
const busy = computed(() => loading.value || applying.value > 0 || Object.values(checking).some(Boolean));
watch(busy, (value) => emit('update:busy', value), { immediate: true });
const validationAttempted = ref(false);
const validate = async () => {
	validationAttempted.value = true;
	const candidates = slots.value.flatMap((slot) => (selections[slot.key] ? [{ slot, sourceProperty: selections[slot.key] }] : []));
	for (let start = 0; start < candidates.length; start += 256) {
		await runCompatibility(candidates.slice(start, start + 256).filter((candidate) => selections[candidate.slot.key] === candidate.sourceProperty));
	}
	if (!isValid.value) {
		const constraint = constraintViolations.value[0];
		if (constraint) flashMessage.error(constraint.message);
		else if (!Object.values(errors).some(Boolean)) flashMessage.error(t('devicesModule.wizard.validation.invalidValue'));
		const firstInvalid = includedGroups.value.find((group) => issuesFor(group) > 0);
		if (firstInvalid) activeChannel.value = firstInvalid.specChannel;
	}
	return isValid.value;
};

// Order-independent identity of a set of mappings, used to tell an echo of our own emit apart from a
// genuine external change to the wizard state.
const signature = (value: IVirtualSlotMapping[]): string =>
	value
		.filter((mapping: IVirtualSlotMapping): boolean => mapping.sourceProperty !== null)
		.map((mapping: IVirtualSlotMapping): string => `${mapping.specChannel}.${mapping.specProperty}=${mapping.sourceProperty}`)
		.sort()
		.join('|');

// Re-derives each filled slot's device/channel from whatever the stores already hold, so returning to
// this step shows the pickers where the user left them. Best effort by design: a source whose channel
// is no longer loaded keeps its mapping and simply shows an empty device/channel pair.
const syncPickers = (): void => {
	for (const [slotKey, propertyId] of Object.entries(selections)) {
		if (pickers[slotKey]?.channel) {
			continue;
		}

		const property = propertiesStore.findById(propertyId);
		const channel = property ? channelsStore.findById(property.channel) : null;

		pickers[slotKey] = { device: channel?.device ?? null, channel: channel?.id ?? null };
	}
};

watch(
	(): IVirtualSlotMapping[] => props.modelValue,
	(value: IVirtualSlotMapping[]): void => {
		// Ignores the echo of our own emit; adopts anything else, so the wizard shell stays the owner of
		// the state even though this step is the one writing it.
		if (signature(value) === signature(mappings.value)) {
			return;
		}

		for (const slotKey of Object.keys(unverified)) delete unverified[slotKey];

		for (const slotKey of Object.keys(selections)) {
			delete selections[slotKey];
		}

		// The errors and the in-flight flags describe the selections that were just discarded, so they go
		// with them. Left behind, an error would keep `isValid` false against a mapping that no longer
		// exists — and permanently: its slot is still rendered (an error keeps a slot visible) but its
		// property select now holds nothing, and Element Plus only draws the clear affordance when there
		// is a value, so there would be no on-screen action that clears the error.
		for (const slotKey of Object.keys(errors)) {
			delete errors[slotKey];
		}

		for (const slotKey of Object.keys(checking)) {
			delete checking[slotKey];
		}

		// Presentational only, but re-derived from the adopted mappings rather than kept: a picker still
		// pointing at the replaced source's channel would offer a property list not containing the
		// mapping it is supposed to be showing.
		for (const slotKey of Object.keys(pickers)) {
			delete pickers[slotKey];
		}

		// Everything still in flight was checking a selection that has just been replaced.
		slotTokens.clear();

		// Mappings adopted here are taken as given — they are not re-checked against the compatibility
		// endpoint. That is right for in-session back-navigation, where every one of them was verified on
		// the way in, and it is why the wizard shell must never hand this step a mapping that did not
		// come from it.
		for (const mapping of value) {
			if (mapping.sourceProperty === null) {
				continue;
			}

			selections[`${mapping.specChannel}.${mapping.specProperty}`] = mapping.sourceProperty;
		}

		syncPickers();
	},
	{ deep: true, immediate: true }
);

watch(
	(): IVirtualWizardMappingStepProps['category'] => props.category,
	(value, previous): void => {
		// Only a genuine change of an already-chosen category invalidates the work: the slots are
		// different ones now. Deliberately not `immediate`, so mounting with a category and a set of
		// mappings restored from the wizard state does not wipe them.
		if (previous === null || previous === undefined || previous === value) {
			return;
		}

		for (const slotKey of Object.keys(unverified)) delete unverified[slotKey];

		for (const slotKey of Object.keys(selections)) {
			delete selections[slotKey];
		}

		for (const slotKey of Object.keys(errors)) {
			delete errors[slotKey];
		}

		for (const slotKey of Object.keys(checking)) {
			delete checking[slotKey];
		}

		for (const slotKey of Object.keys(pickers)) {
			delete pickers[slotKey];
		}

		for (const specChannel of Object.keys(channelPickers)) {
			delete channelPickers[specChannel];
		}

		optionalChannels.value = [];
		activeChannel.value = null;
		optionCache.value = {};
		optionRequests.forEach((controller) => controller.abort());
		// Everything still in flight belongs to the previous category's slots.
		slotTokens.clear();

		requestCounter++;
	}
);

watch(
	() => props.optionalChannels,
	(value) => {
		if ((value ?? []).join('|') !== optionalChannels.value.join('|')) optionalChannels.value = [...(value ?? [])];
	}
);
watch(optionalChannels, (value) => emit('update:optionalChannels', value));
watch(mappings, (value: IVirtualSlotMapping[]): void => emit('update:modelValue', value), { deep: true, immediate: true });

watch(isValid, (value: boolean): void => emit('update:valid', value), { immediate: true });

onBeforeMount(async () => {
	try {
		await devicesStore.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
	} catch (error) {
		logger.error('Failed to load source devices', error);
	} finally {
		loading.value = false;
	}
});

defineExpose({
	validate,
	onOptionsOpen,
	sourceOptions,
	addChannel,
	removeChannel,
	activeGroup,
	includedGroups,
	slots,
	groups,
	errors,
	checking,
	// Presentational state, exposed for the same reason `errors` and `checking` are: the resets that
	// keep it consistent with `selections` are the part worth pinning down in a test.
	pickers,
	progress,
	constraintViolations,
	isValid,
	sourceDevicesOptions,
	selectSource,
	applyChannel,
});
</script>

<style scoped>
.projection-mapping {
	display: grid;
	grid-template-columns: 250px minmax(0, 1fr);
	gap: 24px;
	min-height: 300px;
}
.projection-mapping__channels,
.projection-mapping__content {
	min-width: 0;
}
.projection-mapping__channel {
	display: block;
	width: 100%;
	padding: 12px;
	text-align: left;
	color: var(--el-text-color-regular);
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background: var(--el-bg-color);
	cursor: pointer;
}
.projection-mapping__channel + .projection-mapping__channel {
	margin-top: 8px;
}
.projection-mapping__channel.is-active {
	border-color: var(--el-color-primary);
}
.projection-mapping__optional-channel {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
}
.projection-mapping__optional-channel + .projection-mapping__optional-channel {
	border-top: 1px solid var(--el-border-color-lighter);
}
.projection-mapping__channel-help {
	display: block;
	margin-top: 12px;
}
.projection-mapping__description {
	display: block;
	margin-bottom: 16px;
}
.projection-mapping__shortcut {
	padding: 12px;
	border-radius: var(--el-border-radius-base);
	background: var(--el-fill-color-light);
	margin-bottom: 16px;
}
.projection-mapping__shortcut-controls {
	display: flex;
	gap: 12px;
	align-items: center;
	width: 100%;
}
.projection-mapping__shortcut-select {
	flex: 1;
	min-width: 0;
	width: 0;
}
.projection-mapping__shortcut-button {
	flex-shrink: 0;
}
.projection-mapping__table :deep(.el-form-item__error) {
	position: static;
	line-height: 1.5;
}
.projection-mapping__table :deep(td.el-table__cell) {
	padding: 12px 0;
}
@container (max-width: 850px) {
	.projection-mapping {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
