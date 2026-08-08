<template>
	<div class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesVirtualPlugin.wizard.review.heading')"
			:description="t('devicesVirtualPlugin.wizard.review.description')"
			:closable="false"
			show-icon
		/>

		<el-descriptions
			:column="1"
			border
			data-test-id="review-summary"
		>
			<el-descriptions-item :label="t('devicesVirtualPlugin.fields.devices.category.title')">
				{{ categoryLabel }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesVirtualPlugin.fields.devices.name.title')">
				{{ name }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">
				{{ roomLabel }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModule.fields.devices.zones.title')">
				{{ zonesLabel }}
			</el-descriptions-item>
		</el-descriptions>

		<el-alert
			v-if="rows.length === 0"
			type="warning"
			:title="t('devicesVirtualPlugin.wizard.review.noMappings')"
			:closable="false"
			show-icon
			data-test-id="review-no-mappings"
		/>

		<el-table
			v-else
			:data="rows"
			data-test-id="review-rows"
		>
			<el-table-column :label="t('devicesVirtualPlugin.wizard.review.columns.property')">
				<template #default="{ row }: { row: IVirtualReviewRow }">
					<strong>{{ t(`devicesModule.categories.channels.${row.specChannel}`) }}</strong>
					·
					{{ t(`devicesModule.categories.channelsProperties.${row.specProperty}`) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesVirtualPlugin.wizard.review.columns.sourceDevice')"
				prop="sourceDevice"
			/>
			<el-table-column
				:label="t('devicesVirtualPlugin.wizard.review.columns.sourceChannel')"
				prop="sourceChannel"
			/>
			<el-table-column
				:label="t('devicesVirtualPlugin.wizard.review.columns.sourceProperty')"
				prop="sourceProperty"
			/>
		</el-table>

		<template v-if="canHideSource && submitState !== 'created'">
			<el-checkbox
				v-model="hideRequested"
				data-test-id="hide-source-checkbox"
			>
				{{ t('devicesVirtualPlugin.wizard.review.hideSource.label', { device: sourceDevice?.name ?? '' }) }}
			</el-checkbox>

			<div class="text-xs text-gray-500">
				{{ t('devicesVirtualPlugin.wizard.review.hideSource.hint') }}
			</div>
		</template>

		<el-alert
			v-if="submitState === 'error'"
			type="error"
			:title="createError ?? ''"
			:closable="false"
			show-icon
			data-test-id="create-error"
		/>

		<template v-if="submitState === 'created'">
			<el-alert
				type="success"
				:title="t('devicesVirtualPlugin.wizard.review.created', { name })"
				:closable="false"
				show-icon
				data-test-id="create-success"
			/>

			<el-alert
				v-if="hideState === 'failed'"
				type="warning"
				:title="hideError ?? ''"
				:closable="false"
				show-icon
				data-test-id="hide-error"
			>
				<el-button
					size="small"
					data-test-id="retry-hide"
					@click="onRetryHide"
				>
					{{ t('devicesVirtualPlugin.wizard.review.hideSource.retry') }}
				</el-button>
			</el-alert>

			<el-alert
				v-else-if="hideState === 'hidden'"
				type="success"
				:title="t('devicesVirtualPlugin.wizard.review.hideSource.success', { device: sourceDevice?.name ?? '' })"
				:closable="false"
				show-icon
				data-test-id="hide-success"
			/>
		</template>

		<el-button
			v-else
			type="primary"
			:disabled="!canCreate"
			:loading="submitState === 'submitting'"
			data-test-id="create-device"
			@click="onCreate"
		>
			{{ t('devicesVirtualPlugin.wizard.review.create') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElDescriptions, ElDescriptionsItem, ElTable, ElTableColumn } from 'element-plus';

import { MODULES_PREFIX } from '../../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../../common';
import { DEVICES_MODULE_PREFIX } from '../../../../modules/devices/devices.constants';
import { getChannelPropertySpecification } from '../../../../modules/devices/devices.mapping';
import type { IDevice } from '../../../../modules/devices/store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import type { ISpace } from '../../../../modules/spaces/store/spaces.store.types';
import {
	type DevicesModuleChannelCategory,
	type DevicesModuleChannelPropertyDataType,
	type DevicesModuleCreateDeviceOperation,
	DevicesModuleDeviceHiddenBy,
	type DevicesVirtualPluginCreateChannelPropertySchema,
	type DevicesVirtualPluginCreateDeviceSchema,
	DevicesVirtualPluginValueOrigin,
} from '../../../../openapi.constants';
import { channelsSchema } from '../../../../spec/channels';
import { DEVICES_VIRTUAL_TYPE } from '../../devices-virtual.constants';

import type { IVirtualReviewRow, IVirtualWizardReviewCreatedPayload, IVirtualWizardReviewStepProps } from './virtual-wizard-review-step.types';
import type { IVirtualSlotMapping } from './virtual-wizard.types';

defineOptions({
	name: 'VirtualWizardReviewStep',
});

const props = defineProps<IVirtualWizardReviewStepProps>();

const emit = defineEmits<{
	(e: 'created', payload: IVirtualWizardReviewCreatedPayload): void;
	// Announced so the shell can hold the wizard still while a create is in flight. This component is
	// unmounted the moment the user goes Back — the shell renders steps with `v-if` — and its request
	// carries on regardless, so nothing it knows about its own state survives to stop a second one.
	(e: 'submitting', value: boolean): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const logger = useLogger();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const devicesStore = storesManager.getStore(devicesStoreKey);
const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

type SubmitState = 'idle' | 'submitting' | 'created' | 'error';
type HideState = 'idle' | 'hiding' | 'hidden' | 'failed';

const submitState = ref<SubmitState>('idle');
const createError = ref<string | null>(null);

const hideRequested = ref<boolean>(false);
const hideState = ref<HideState>('idle');
const hideError = ref<string | null>(null);

const zoneAssignmentFailures = ref<number>(0);

// Step 2's `modelValue` carries one entry per spec slot, `sourceProperty: null` for the ones the user
// left unfilled. Those never get a property created for them and have nothing to summarise here.
const filledMappings = computed<(IVirtualSlotMapping & { sourceProperty: string })[]>(() =>
	props.mappings.filter((mapping): mapping is IVirtualSlotMapping & { sourceProperty: string } => mapping.sourceProperty !== null)
);

interface IResolvedMappingSource {
	deviceId: string | null;
	deviceName: string;
	channelName: string;
	propertyName: string;
}

const unknownSourceLabel = (): string => t('devicesVirtualPlugin.wizard.review.unknownSource');

// Walks a mapping's borrowed property id back to the channel and device that own it, through the
// already-loaded stores the mapping step warmed. `deviceId` is kept separate from the display name
// specifically so `canHideSource` can tell "resolved to device X" apart from "could not resolve" —
// collapsing both into a display string would make the two indistinguishable.
const resolveMappingSource = (sourcePropertyId: string): IResolvedMappingSource => {
	const property = propertiesStore.findById(sourcePropertyId);
	const channel = property ? channelsStore.findById(property.channel) : null;
	const device = channel ? devicesStore.findById(channel.device) : null;

	return {
		deviceId: channel?.device ?? null,
		deviceName: device?.name ?? unknownSourceLabel(),
		channelName: channel?.name ?? unknownSourceLabel(),
		propertyName: property ? (property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`)) : unknownSourceLabel(),
	};
};

const resolvedSources = computed<IResolvedMappingSource[]>(() =>
	filledMappings.value.map((mapping): IResolvedMappingSource => resolveMappingSource(mapping.sourceProperty))
);

const rows = computed<IVirtualReviewRow[]>(() =>
	filledMappings.value.map((mapping, index): IVirtualReviewRow => {
		const resolved = resolvedSources.value[index];

		return {
			key: `${mapping.specChannel}.${mapping.specProperty}`,
			specChannel: mapping.specChannel,
			specProperty: mapping.specProperty,
			sourceDevice: resolved.deviceName,
			sourceChannel: resolved.channelName,
			sourceProperty: resolved.propertyName,
		};
	})
);

// True only when every borrowed property resolves to the *same* device — the split case, where
// hiding the parent makes sense because this new device is what replaces it. `null` (a mapping whose
// property, channel or device could not be found) always blocks the offer rather than being treated
// as "does not disagree": an unresolvable mapping is not evidence the split is clean, and hiding a
// guess would be worse than not offering to hide at all.
const canHideSource = computed<boolean>((): boolean => {
	const deviceIds = resolvedSources.value.map((source): string | null => source.deviceId);

	if (deviceIds.length === 0 || deviceIds.some((id): boolean => id === null)) {
		return false;
	}

	return new Set(deviceIds).size === 1;
});

const sourceDevice = computed<IDevice | null>((): IDevice | null => {
	if (!canHideSource.value) {
		return null;
	}

	const id = resolvedSources.value[0]?.deviceId ?? null;

	return id !== null ? devicesStore.findById(id) : null;
});

const categoryLabel = computed<string>((): string => (props.category !== null ? t(`devicesModule.categories.devices.${props.category}`) : ''));

const roomLabel = computed<string>((): string => {
	if (props.roomId === null) {
		return t('devicesVirtualPlugin.wizard.review.noRoom');
	}

	const room = spacesStore.findById(props.roomId);

	return room ? room.name : unknownSourceLabel();
});

const zonesLabel = computed<string>((): string => {
	if (props.zoneIds.length === 0) {
		return t('devicesVirtualPlugin.wizard.review.noZones');
	}

	return props.zoneIds
		.map((zoneId): string => {
			const zone: ISpace | null = spacesStore.findById(zoneId);

			return zone ? zone.name : unknownSourceLabel();
		})
		.join(', ');
});

const canCreate = computed<boolean>(
	(): boolean =>
		submitState.value !== 'submitting' &&
		submitState.value !== 'created' &&
		props.category !== null &&
		props.name.trim().length > 0 &&
		rows.value.length > 0
);

// The spec, not the source: a virtual device's property has to match what *its own* category
// declares (permissions, data type, format), which is what the backend's structural validation
// checks. The source is already proven compatible with that shape by the mapping step's compatibility
// check — copying its own attributes instead would risk building a property the spec does not expect.
interface IDataTypeVariant {
	data_type: DevicesModuleChannelPropertyDataType;
	format?: (string | number | null)[] | null;
	step?: number | null;
}

// Reads the raw spec rather than `getChannelPropertySpecification`, which deliberately collapses a
// multi-variant property to its first entry. Falls back to that collapsed shape when the property has
// one variant, or when the source's data type is not among them — the latter cannot normally happen,
// since the compatibility check would have refused the pairing, but a stale preview is exactly the
// case this whole guard family exists for.
const matchingDataTypeVariant = (mapping: IVirtualSlotMapping & { sourceProperty: string }, collapsed: IDataTypeVariant): IDataTypeVariant => {
	const sourceDataType = propertiesStore.findById(mapping.sourceProperty)?.dataType ?? null;

	const channelSpec = (
		channelsSchema as unknown as Record<string, { properties?: Record<string, { category: string; data_types?: IDataTypeVariant[] }> }>
	)[mapping.specChannel];

	const rawProperty = Object.values(channelSpec?.properties ?? {}).find((candidate) => candidate.category === mapping.specProperty);

	const matched = sourceDataType === null ? undefined : rawProperty?.data_types?.find((candidate) => candidate.data_type === sourceDataType);

	// Falls back to the *whole* collapsed specification, not just its data type. Most slots declare a
	// single `data_type` and no `data_types` array at all, so this branch is the common one — dropping
	// the format and step here sent them as null for every such property, and a constrained slot like
	// `electrical_power.power` is then refused at creation for declaring no range.
	return matched ?? collapsed;
};

const buildPropertyPayload = (mapping: IVirtualSlotMapping & { sourceProperty: string }): DevicesVirtualPluginCreateChannelPropertySchema | null => {
	const specification = getChannelPropertySpecification(mapping.specChannel, mapping.specProperty);

	if (!specification) {
		logger.error(`No specification found for ${mapping.specChannel}.${mapping.specProperty}; leaving it out of the create payload`);

		return null;
	}

	// When a spec property declares several data-type variants (`brightness` is both a `uchar`
	// percentage and an `enum`), the helper above collapses them to the first one — but the
	// compatibility check accepts *any* variant, so an enum-valued source passes and would then be
	// stored as the numeric variant, format and step included. The projected strings would be exposed
	// through a property declaring itself numeric. Pick the variant the source actually speaks.
	const variant = matchingDataTypeVariant(mapping, {
		data_type: specification.data_type,
		format: specification.format ?? undefined,
		step: specification.step ?? undefined,
	});

	return {
		type: DEVICES_VIRTUAL_TYPE,
		category: mapping.specProperty,
		identifier: mapping.specProperty,
		// Left null rather than a translated label baked in at creation time: `property.name` is
		// optional precisely so display can fall back to a *live* translation (`t(category)`, the same
		// convention the mapping step's own property picker uses) instead of freezing today's locale
		// into stored data that will not follow the user if they switch languages later.
		name: null,
		permissions: specification.permissions,
		data_type: variant.data_type,
		format: variant.format ?? null,
		// The source's sentinel, not the slot's — no channel specification declares one, because "999
		// means no reading" is a fact about a particular device. A projection forwards its source's
		// value unchanged and is the property a command is validated against, so one that does not
		// reserve what its source reserves would present the sentinel as a real measurement and accept a
		// command carrying it. The backend refuses that pairing; adopting it here is what makes a source
		// with a sentinel usable at all.
		invalid: propertiesStore.findById(mapping.sourceProperty)?.invalid ?? specification.invalid ?? null,
		step: variant.step ?? null,
		value: null,
		value_origin: DevicesVirtualPluginValueOrigin.source,
		source_property: mapping.sourceProperty,
	};
};

type VirtualCreateChannelPayload = NonNullable<DevicesVirtualPluginCreateDeviceSchema['channels']>[number];

// Groups the filled slots by spec channel — one create-payload channel per group, carrying every
// property mapped under it. A category's `multiple: true` channel is still expanded once by the
// mapping step, so this never has to merge two instances of the same channel category.
const channelsPayload = computed<VirtualCreateChannelPayload[]>((): VirtualCreateChannelPayload[] => {
	const groups = new Map<DevicesModuleChannelCategory, DevicesVirtualPluginCreateChannelPropertySchema[]>();

	for (const mapping of filledMappings.value) {
		const property = buildPropertyPayload(mapping);

		if (!property) {
			continue;
		}

		const existing = groups.get(mapping.specChannel) ?? [];

		existing.push(property);

		groups.set(mapping.specChannel, existing);
	}

	return Array.from(groups.entries()).map(
		([specChannel, properties]): VirtualCreateChannelPayload => ({
			type: DEVICES_VIRTUAL_TYPE,
			category: specChannel,
			identifier: specChannel,
			// Channel name is mandatory on create (unlike a property's), so — same locale caveat as
			// above, accepted here because there is no null escape hatch — it is seeded from today's
			// translation. The channel stays freely renameable afterwards from the device edit screens.
			name: t(`devicesModule.categories.channels.${specChannel}`),
			properties,
		})
	);
});

const assignZones = async (deviceId: string): Promise<void> => {
	zoneAssignmentFailures.value = 0;

	for (const zoneId of props.zoneIds) {
		try {
			await devicesStore.addZone({ id: deviceId, zoneId });
		} catch (error: unknown) {
			logger.error(`Failed to assign the created device id=${deviceId} to zone id=${zoneId}`, error);

			zoneAssignmentFailures.value += 1;
		}
	}

	if (zoneAssignmentFailures.value > 0) {
		flashMessage.warning(t('devicesVirtualPlugin.wizard.review.errors.zonesFailed', { count: zoneAssignmentFailures.value }));
	}
};

// Sends only `type`, `hidden` and `hidden_by` — never the whole device model. Routed through the
// store's normal `edit()` action rather than a raw PATCH: `edit()` is what runs the payload through
// `transformDeviceUpdateRequest`/`DeviceUpdateReqSchema`, which is the exact place `hidden`/`hidden_by`
// would silently be stripped if that schema ever regressed (see devices.transformers.spec.ts).
const attemptHide = async (): Promise<void> => {
	const device = sourceDevice.value;

	if (!device) {
		return;
	}

	hideState.value = 'hiding';
	hideError.value = null;

	try {
		await devicesStore.edit({
			id: device.id,
			data: {
				type: device.type,
				hidden: true,
				hiddenBy: DevicesModuleDeviceHiddenBy.system,
			},
		});

		hideState.value = 'hidden';
	} catch (error: unknown) {
		logger.error(`Failed to hide the source device id=${device.id}`, error);

		hideState.value = 'failed';
		hideError.value = error instanceof Error ? error.message : t('devicesVirtualPlugin.wizard.review.errors.hideFailed');

		flashMessage.error(t('devicesVirtualPlugin.wizard.review.errors.hideFailedFlash', { device: device.name }));
	}
};

const onRetryHide = (): void => {
	attemptHide().catch((error: unknown): void => logger.error('Failed to retry hiding the source device', error));
};

const onCreate = async (): Promise<void> => {
	if (!canCreate.value) {
		return;
	}

	// Snapshotted rather than read through `props` again after the awaits below: this is what the
	// user asked for at the moment they clicked Create, and it must not shift under an in-flight
	// submit if the wizard shell were ever to mutate its state while this is pending.
	const category = props.category;
	const name = props.name.trim();
	const roomId = props.roomId;
	const zoneIds = props.zoneIds;
	const channels = channelsPayload.value;

	if (category === null) {
		return;
	}

	submitState.value = 'submitting';

	emit('submitting', true);
	createError.value = null;

	const payload: DevicesVirtualPluginCreateDeviceSchema = {
		type: DEVICES_VIRTUAL_TYPE,
		category,
		name,
		room_id: roomId,
		channels,
	};

	// Posted directly through the backend client rather than `devicesStore.add()` — deliberate, not an
	// oversight (see the shell's `onCreated` handler in view-virtual-device-wizard.vue, which points back
	// here). `devicesStore.add()` validates its payload against `element.schemas.deviceCreateReqSchema`,
	// which for this plugin is `VirtualDeviceCreateReqSchema` (store/devices.store.schemas.ts) —
	// `DeviceCreateReqSchema.and(z.object({ type }))`. That `.and()` only adds a top-level `type` literal;
	// it does not touch the base schema's `channels: z.array(ChannelCreateReqSchema)` field, which is a
	// *static* reference resolved once at module load, not looked up per plugin the way
	// `element.schemas.*` is elsewhere in these stores. The devices-virtual plugin's own
	// `VirtualChannelCreateReqSchema` (store/channels.store.schemas.ts) has the identical shape one level
	// down — `ChannelCreateReqSchema.and(z.object({ type }))` — and is never consulted here either, so
	// even a channel-level override would not help. The base `ChannelCreateReqSchema.properties` field is,
	// in turn, `z.array(ChannelPropertyCreateReqSchema)` — the base property schema, which has no
	// `source_property` field at all. A nested create routed through `devicesStore.add()` would therefore
	// have `source_property` silently stripped from every property in `channels` by Zod's default
	// unknown-key stripping — the same silent-drop failure mode this branch has already fixed twice
	// elsewhere (`DeviceUpdateReqSchema`'s `hidden`/`hidden_by`; registering `channelPropertyUpdateReqSchema`
	// in devices-virtual.plugin.ts for the remap dialog, see virtual-device-remap-dialog.spec.ts). Posting
	// the raw payload here is what avoids a third instance of the same bug.
	try {
		const { data: responseData, error } = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
			body: { data: payload },
		});

		if (!responseData) {
			createError.value = error
				? getErrorReason<DevicesModuleCreateDeviceOperation>(error, t('devicesVirtualPlugin.wizard.review.errors.createFailed'))
				: t('devicesVirtualPlugin.wizard.review.errors.createFailed');
			submitState.value = 'error';

			emit('submitting', false);

			flashMessage.error(createError.value);

			return;
		}

		const created = responseData.data;

		submitState.value = 'created';

		emit('submitting', false);

		// Warms the cache so the device list / detail views do not need a manual refresh to see the new
		// device and its channels. Failure does not affect the wizard's own success state — the device
		// exists on the server regardless of whether this local refresh works.
		//
		// Awaited rather than fire-and-forget, and awaited *before* the zones: `devicesStore.addZone()`
		// rejects outright when the device is not already in its local cache, so racing this against
		// `assignZones` made zone assignment depend on a websocket update arriving first and commonly
		// reported every selected zone as failed on a creation that had actually succeeded.
		try {
			await devicesStore.get({ id: created.id });
		} catch (hydrateError: unknown) {
			logger.error('Failed to refresh the created device', hydrateError);
		}

		if (zoneIds.length > 0) {
			await assignZones(created.id);
		}

		if (hideRequested.value && canHideSource.value) {
			await attemptHide();
		}

		// Emitted last, once creation and every best-effort follow-up (zones, hide) have settled, so a
		// shell that navigates away the instant it hears `created` does so only after any hide-failure
		// warning is already on screen — and after the toast for it has already fired.
		emit('created', { id: created.id, name: created.name });
	} catch (err: unknown) {
		logger.error('Failed to create the virtual device', err);

		createError.value = t('devicesVirtualPlugin.wizard.review.errors.createFailed');
		submitState.value = 'error';

		emit('submitting', false);

		flashMessage.error(createError.value);
	}
};

defineExpose({
	rows,
	canHideSource,
	sourceDevice,
	submitState,
	hideState,
	hideError,
	createError,
	canCreate,
	onCreate,
	onRetryHide,
});
</script>
