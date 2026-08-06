<template>
	<div class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesVirtualPlugin.wizard.mapping.heading')"
			:description="t('devicesVirtualPlugin.wizard.mapping.description')"
			:closable="false"
			show-icon
		/>

		<el-alert
			v-if="category === null"
			type="warning"
			:title="t('devicesVirtualPlugin.wizard.mapping.noCategory')"
			:closable="false"
			show-icon
		/>

		<template v-else>
			<div
				class="flex items-center gap-3"
				data-test-id="mapping-progress"
			>
				<el-progress
					:percentage="progressPercentage"
					:status="progress.remaining.length === 0 ? 'success' : undefined"
					class="grow"
				/>

				<el-text
					size="small"
					class="whitespace-nowrap"
				>
					{{ t('devicesVirtualPlugin.wizard.mapping.progress', { filled: progress.requiredFilled, total: progress.requiredTotal }) }}
				</el-text>
			</div>

			<div
				v-for="group in groups"
				:key="group.specChannel"
				class="b b-solid b-gray-200 dark:b-gray-700 rounded p-3 space-y-3"
				:data-test-id="`slot-group-${group.specChannel}`"
			>
				<div class="flex items-center gap-2 flex-wrap">
					<strong>{{ t(`devicesModule.categories.channels.${group.specChannel}`) }}</strong>

					<el-tag
						:type="group.required ? 'danger' : 'info'"
						size="small"
					>
						{{ group.required ? t('devicesVirtualPlugin.wizard.mapping.required') : t('devicesVirtualPlugin.wizard.mapping.optional') }}
					</el-tag>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<el-text
						size="small"
						class="basis-full"
					>
						{{ t('devicesVirtualPlugin.wizard.mapping.shortcut.description') }}
					</el-text>

					<el-select
						:model-value="channelPickers[group.specChannel]?.device ?? null"
						:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.devicePlaceholder')"
						:name="`shortcut-device-${group.specChannel}`"
						filterable
						clearable
						class="w-60"
						@update:model-value="onShortcutDevice(group.specChannel, $event)"
					>
						<el-option
							v-for="item in sourceDevicesOptions"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						/>
					</el-select>

					<el-select
						:model-value="channelPickers[group.specChannel]?.channel ?? null"
						:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.channelPlaceholder')"
						:name="`shortcut-channel-${group.specChannel}`"
						:disabled="!channelPickers[group.specChannel]?.device"
						filterable
						clearable
						class="w-60"
						@update:model-value="onShortcutChannel(group.specChannel, $event)"
					>
						<el-option
							v-for="item in channelsOptions(channelPickers[group.specChannel]?.device ?? null)"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						/>
					</el-select>

					<el-button
						:disabled="!channelPickers[group.specChannel]?.channel"
						plain
						@click="onApplyChannel(group.specChannel)"
					>
						{{ t('devicesVirtualPlugin.wizard.mapping.shortcut.apply') }}
					</el-button>
				</div>

				<div
					v-for="slot in visibleSlots(group)"
					:key="slot.key"
					class="space-y-1"
					:data-test-id="`slot-${slot.key}`"
				>
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-sm font-medium">{{ t(`devicesModule.categories.channelsProperties.${slot.specProperty}`) }}</span>

						<el-tag
							v-if="slot.required"
							type="danger"
							size="small"
						>
							{{ t('devicesVirtualPlugin.wizard.mapping.required') }}
						</el-tag>

						<el-text
							size="small"
							type="info"
						>
							{{ slotHint(slot) }}
						</el-text>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<el-select
							:model-value="pickers[slot.key]?.device ?? null"
							:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.devicePlaceholder')"
							:name="`device-${slot.key}`"
							filterable
							clearable
							class="w-60"
							@update:model-value="onPickDevice(slot.key, $event)"
						>
							<el-option
								v-for="item in sourceDevicesOptions"
								:key="item.value"
								:label="item.label"
								:value="item.value"
							/>
						</el-select>

						<el-select
							:model-value="pickers[slot.key]?.channel ?? null"
							:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.channelPlaceholder')"
							:name="`channel-${slot.key}`"
							:disabled="!pickers[slot.key]?.device"
							filterable
							clearable
							class="w-60"
							@update:model-value="onPickChannel(slot.key, $event)"
						>
							<el-option
								v-for="item in channelsOptions(pickers[slot.key]?.device ?? null)"
								:key="item.value"
								:label="item.label"
								:value="item.value"
							/>
						</el-select>

						<el-select
							:model-value="selections[slot.key] ?? null"
							:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.propertyPlaceholder')"
							:name="`property-${slot.key}`"
							:disabled="!pickers[slot.key]?.channel"
							:loading="checking[slot.key] === true"
							filterable
							clearable
							class="w-60"
							@update:model-value="onPickProperty(slot.key, $event)"
						>
							<el-option
								v-for="item in propertiesOptions(pickers[slot.key]?.channel ?? null)"
								:key="item.value"
								:label="item.label"
								:value="item.value"
							/>
						</el-select>
					</div>

					<el-text
						v-if="errors[slot.key]"
						size="small"
						type="danger"
						class="block"
						:data-test-id="`slot-error-${slot.key}`"
					>
						{{ errors[slot.key] }}
					</el-text>
				</div>

				<el-button
					v-if="hiddenSlotsCount(group) > 0"
					link
					type="primary"
					@click="expanded[group.specChannel] = true"
				>
					{{ t('devicesVirtualPlugin.wizard.mapping.showOptional', { count: hiddenSlotsCount(group) }) }}
				</el-button>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElOption, ElProgress, ElSelect, ElTag, ElText } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../../modules/devices';
import {
	channelChannelsPropertiesSpecificationMappers,
	deviceChannelsSpecificationMappers,
	deviceChannelsSpecificationOrder,
	getChannelPropertySpecification,
} from '../../../../modules/devices/devices.mapping';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../../modules/devices/store/keys';
import {
	DevicesModuleChannelCategory,
	type DevicesVirtualPluginCheckCompatibilityOperation,
	type DevicesVirtualPluginCompatibilityReportSchema,
} from '../../../../openapi.constants';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX, DEVICES_VIRTUAL_TYPE } from '../../devices-virtual.constants';

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
}>();

const { t } = useI18n();
const backend = useBackend();
const logger = useLogger();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const devicesStore = storesManager.getStore(devicesStoreKey);
const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

// slot key -> the source property chosen for it. The single source of truth for what is mapped;
// `mappings`, `progress` and `isValid` are all derived from it rather than maintained alongside it,
// which is what keeps the progress indicator honest when a mapping is cleared.
const selections = reactive<Record<string, string>>({});
// slot key -> why this slot's source was refused. Holds the backend's own reason verbatim: it is the
// only thing that tells the user *why*, and a friendlier substitute would throw that away.
const errors = reactive<Record<string, string>>({});
// slot key -> a compatibility check is in flight for it.
const checking = reactive<Record<string, boolean>>({});
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
const slotTokens = new Map<string, number>();

const groups = computed<IVirtualMappingSlotGroup[]>((): IVirtualMappingSlotGroup[] => {
	if (props.category === null) {
		return [];
	}

	const channelSpec = deviceChannelsSpecificationMappers[props.category];

	if (!channelSpec) {
		return [];
	}

	const ordered = deviceChannelsSpecificationOrder[props.category] ?? [...channelSpec.required, ...channelSpec.optional];

	// `device_information` is declared required by essentially every device category, so a plain
	// expansion of the spec *would* offer it. The backend synthesizes those properties as owned by the
	// virtual device itself (they describe the virtual device, not a borrowed source), so there is
	// nothing legitimate to map them to and offering them would only invite a mapping that cannot be
	// created.
	const channels = ordered.filter((channel: DevicesModuleChannelCategory): boolean => channel !== DevicesModuleChannelCategory.device_information);

	// Required first, at both levels: required channels ahead of optional ones here, and required
	// properties ahead of optional ones inside each channel (which is the order the property mappers
	// already produce). Grouping by channel rather than flattening required slots to the very top
	// keeps a channel's properties together, which is how the user thinks about a source channel.
	return [
		...channels.filter((channel: DevicesModuleChannelCategory): boolean => channelSpec.required.includes(channel)),
		...channels.filter((channel: DevicesModuleChannelCategory): boolean => !channelSpec.required.includes(channel)),
	].map((specChannel: DevicesModuleChannelCategory): IVirtualMappingSlotGroup => {
		const channelRequired = channelSpec.required.includes(specChannel);

		const propertySpec = channelChannelsPropertiesSpecificationMappers[specChannel] ?? { required: [], optional: [] };

		return {
			specChannel,
			required: channelRequired,
			slots: [...propertySpec.required, ...propertySpec.optional].map((specProperty): IVirtualMappingSlot => {
				const metadata = getChannelPropertySpecification(specChannel, specProperty);

				const propertyRequired = propertySpec.required.includes(specProperty);

				return {
					key: `${specChannel}.${specProperty}`,
					specChannel,
					specProperty,
					// `required` is the conjunction because the two levels are independent: a required
					// property of an optional channel (illuminance.illuminance under lighting) does not
					// have to be filled at all, since the channel it belongs to need not exist.
					required: channelRequired && propertyRequired,
					channelRequired,
					propertyRequired,
					permissions: metadata?.permissions ?? [],
					dataType: metadata?.data_type ?? null,
					unit: metadata?.unit ?? null,
				};
			}),
		};
	});
});

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
	const required = slots.value.filter((slot: IVirtualMappingSlot): boolean => slot.required);

	const remaining = required.filter((slot: IVirtualMappingSlot): boolean => typeof selections[slot.key] !== 'string');

	return {
		requiredTotal: required.length,
		requiredFilled: required.length - remaining.length,
		remaining,
	};
});

const progressPercentage = computed<number>((): number =>
	progress.value.requiredTotal === 0 ? 100 : Math.round((progress.value.requiredFilled / progress.value.requiredTotal) * 100)
);

const isChecking = computed<boolean>((): boolean => Object.values(checking).some((value: boolean): boolean => value));

// Hard block, not a warning: an incompatible mapping is one whose writes would die at the source
// platform, so the wizard must not be able to move past it. An unfinished check counts as not-yet-
// proven and blocks too, so the user cannot outrun the verdict by clicking straight through.
const isValid = computed<boolean>(
	(): boolean => props.category !== null && progress.value.remaining.length === 0 && Object.keys(errors).length === 0 && !isChecking.value
);

const sourceDevicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] =>
	orderBy<IDevice>(
		devicesStore
			.findAll()
			// Hidden devices are filtered here rather than requested away, because this reads an
			// already-loaded store collection that the device list's "Show hidden" toggle also reads —
			// narrowing the fetch would break that toggle for everyone.
			//
			// Virtual devices are excluded because nesting one virtual device inside another is refused
			// at creation (VirtualDevicesService.assertSourceNotVirtual) and the compatibility endpoint
			// does *not* check for it, so such a source would preview clean and then fail on create.
			.filter((device: IDevice): boolean => !device.draft && !device.hidden && device.type !== DEVICES_VIRTUAL_TYPE),
		[(device: IDevice): string => device.name],
		['asc']
	).map((device: IDevice): { value: IDevice['id']; label: string } => ({ value: device.id, label: device.name }))
);

const channelsOptions = (deviceId: string | null): { value: IChannel['id']; label: string }[] => {
	if (deviceId === null) {
		return [];
	}

	return orderBy<IChannel>(channelsStore.findForDevice(deviceId), [(channel: IChannel): string => channel.name], ['asc']).map(
		(channel: IChannel): { value: IChannel['id']; label: string } => ({
			value: channel.id,
			label: channel.name,
		})
	);
};

const propertiesOptions = (channelId: string | null): { value: IChannelProperty['id']; label: string }[] => {
	if (channelId === null) {
		return [];
	}

	return orderBy<IChannelProperty>(
		propertiesStore.findForChannel(channelId),
		[(property: IChannelProperty): string => property.name ?? property.category],
		['asc']
	).map((property: IChannelProperty): { value: IChannelProperty['id']; label: string } => ({
		value: property.id,
		label: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
	}));
};

const slotHint = (slot: IVirtualMappingSlot): string =>
	[slot.dataType, slot.unit, slot.permissions.join('/')].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ');

// An optional slot is only worth the screen space once the user asks for it — or once it already
// carries something (a mapping or an error), which must never be hidden from them.
const isSlotVisible = (group: IVirtualMappingSlotGroup, slot: IVirtualMappingSlot): boolean =>
	slot.required || expanded[group.specChannel] === true || typeof selections[slot.key] === 'string' || typeof errors[slot.key] === 'string';

const visibleSlots = (group: IVirtualMappingSlotGroup): IVirtualMappingSlot[] =>
	group.slots.filter((slot: IVirtualMappingSlot): boolean => isSlotVisible(group, slot));

const hiddenSlotsCount = (group: IVirtualMappingSlotGroup): number => group.slots.length - visibleSlots(group).length;

const loadChannels = async (deviceId: string): Promise<IChannel[]> => {
	try {
		return await channelsStore.fetch({ deviceId });
	} catch (error: unknown) {
		logger.error('Failed to load source channels', error);

		return channelsStore.findForDevice(deviceId);
	}
};

const loadProperties = async (channelId: string): Promise<IChannelProperty[]> => {
	try {
		return await propertiesStore.fetch({ channelId });
	} catch (error: unknown) {
		logger.error('Failed to load source properties', error);

		return propertiesStore.findForChannel(channelId);
	}
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
			delete errors[slotKey];
		} else {
			errors[slotKey] = reason;
		}
	};

	try {
		const { data: responseData, error } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/devices/compatibility`, {
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
		logger.error('Virtual device compatibility check failed', err);

		const reason = t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');

		for (const candidate of candidates) {
			settle(candidate.slot.key, reason);
		}

		flashMessage.error(reason);
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

	const sourceProperties = await loadProperties(sourceChannelId);

	const sourceChannel = channelsStore.findById(sourceChannelId);

	const candidates: { slot: IVirtualMappingSlot; sourceProperty: string }[] = [];

	for (const slot of group.slots) {
		const match = sourceProperties.find((property: IChannelProperty): boolean => property.category === slot.specProperty);

		if (!match) {
			continue;
		}

		slotTokens.set(slot.key, ++requestCounter);

		delete errors[slot.key];

		selections[slot.key] = match.id;

		pickers[slot.key] = { device: sourceChannel?.device ?? null, channel: sourceChannelId };

		candidates.push({ slot, sourceProperty: match.id });
	}

	if (candidates.length === 0) {
		flashMessage.info(t('devicesVirtualPlugin.wizard.mapping.shortcut.nothingApplied'));

		return;
	}

	// Everything the shortcut touched has to be visible, including the optional slots it filled.
	expanded[specChannel] = true;

	flashMessage.info(t('devicesVirtualPlugin.wizard.mapping.shortcut.applied', { filled: candidates.length, total: group.slots.length }));

	await runCompatibility(candidates);
};

const onPickDevice = (slotKey: string, deviceId: string | null): void => {
	pickers[slotKey] = { device: deviceId, channel: null };

	selectSource(slotKey, null).catch((error: unknown): void => logger.error('Failed to clear source property', error));

	if (deviceId !== null) {
		loadChannels(deviceId).catch((error: unknown): void => logger.error('Failed to load source channels', error));
	}
};

const onPickChannel = (slotKey: string, channelId: string | null): void => {
	pickers[slotKey] = { device: pickers[slotKey]?.device ?? null, channel: channelId };

	selectSource(slotKey, null).catch((error: unknown): void => logger.error('Failed to clear source property', error));

	if (channelId !== null) {
		loadProperties(channelId).catch((error: unknown): void => logger.error('Failed to load source properties', error));
	}
};

const onPickProperty = (slotKey: string, propertyId: string | null): void => {
	selectSource(slotKey, propertyId).catch((error: unknown): void => logger.error('Failed to select source property', error));
};

const onShortcutDevice = (specChannel: DevicesModuleChannelCategory, deviceId: string | null): void => {
	channelPickers[specChannel] = { device: deviceId, channel: null };

	if (deviceId !== null) {
		loadChannels(deviceId).catch((error: unknown): void => logger.error('Failed to load source channels', error));
	}
};

const onShortcutChannel = (specChannel: DevicesModuleChannelCategory, channelId: string | null): void => {
	channelPickers[specChannel] = { device: channelPickers[specChannel]?.device ?? null, channel: channelId };

	if (channelId !== null) {
		loadProperties(channelId).catch((error: unknown): void => logger.error('Failed to load source properties', error));
	}
};

const onApplyChannel = (specChannel: DevicesModuleChannelCategory): void => {
	applyChannel(specChannel, channelPickers[specChannel]?.channel ?? null).catch((error: unknown): void =>
		logger.error('Failed to apply source channel', error)
	);
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

		for (const slotKey of Object.keys(selections)) {
			delete selections[slotKey];
		}

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

		// Everything still in flight belongs to the previous category's slots.
		slotTokens.clear();

		requestCounter++;
	}
);

watch(mappings, (value: IVirtualSlotMapping[]): void => emit('update:modelValue', value), { deep: true, immediate: true });

watch(isValid, (value: boolean): void => emit('update:valid', value), { immediate: true });

onBeforeMount((): void => {
	// No `hidden` filter on the fetch: this store is shared with the device list, whose "Show hidden"
	// toggle must keep working. Hidden devices are excluded from the picker in `sourceDevicesOptions`.
	devicesStore.fetch().catch((error: unknown): void => logger.error('Failed to load source devices', error));
});

defineExpose({
	slots,
	groups,
	errors,
	checking,
	progress,
	isValid,
	sourceDevicesOptions,
	selectSource,
	applyChannel,
});
</script>
