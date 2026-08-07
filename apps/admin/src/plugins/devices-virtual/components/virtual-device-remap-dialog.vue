<template>
	<el-dialog
		v-model="visible"
		:title="dialogTitle"
		class="max-w-[600px]"
		data-test-id="remap-dialog"
	>
		<template v-if="!property">
			<el-alert
				type="error"
				:title="t('devicesVirtualPlugin.remap.errors.propertyGone')"
				:closable="false"
				show-icon
				data-test-id="remap-property-gone"
			/>
		</template>

		<template v-else>
			<el-text
				size="small"
				type="info"
				class="block mb-3"
			>
				{{ t('devicesVirtualPlugin.remap.description') }}
			</el-text>

			<div class="flex flex-wrap items-center gap-2">
				<el-select
					v-model="pickedDevice"
					:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.devicePlaceholder')"
					name="remap-device"
					filterable
					clearable
					class="w-60"
					@update:model-value="onPickDevice"
				>
					<el-option
						v-for="item in sourceDevicesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>

				<el-select
					v-model="pickedChannel"
					:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.channelPlaceholder')"
					name="remap-channel"
					:disabled="!pickedDevice"
					filterable
					clearable
					class="w-60"
					@update:model-value="onPickChannel"
				>
					<el-option
						v-for="item in channelsOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>

				<el-select
					v-model="selection"
					:placeholder="t('devicesVirtualPlugin.wizard.mapping.source.propertyPlaceholder')"
					name="remap-property"
					:disabled="!pickedChannel"
					:loading="checking"
					filterable
					clearable
					class="w-60"
					@update:model-value="onPickProperty"
				>
					<el-option
						v-for="item in propertiesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>
			</div>

			<!-- The backend's reason is shown untouched — same as the wizard mapping step, and for the same
				reason: it names the source property, its permissions and what the slot needed, and a
				friendlier substitute would throw that explanation away. -->
			<el-text
				v-if="error"
				size="small"
				type="danger"
				class="block mt-2"
				data-test-id="remap-error"
			>
				{{ error }}
			</el-text>

			<el-alert
				v-if="confirmError"
				type="error"
				:title="confirmError"
				:closable="false"
				show-icon
				class="mt-2"
				data-test-id="remap-confirm-error"
			/>
		</template>

		<template #footer>
			<el-button
				data-test-id="remap-cancel"
				@click="onClose"
			>
				{{ t('devicesModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				:disabled="!canConfirm"
				:loading="confirming"
				data-test-id="remap-confirm"
				@click="confirm"
			>
				{{ t('devicesVirtualPlugin.remap.confirm') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElOption, ElSelect, ElText } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import type { IChannel, IChannelProperty, IChannelsPropertiesEditActionPayload, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesModuleDeviceHiddenBy,
	DevicesModuleDevicesHiddenFilter,
	type DevicesVirtualPluginCheckCompatibilityOperation,
	type DevicesVirtualPluginCompatibilityReportSchema,
} from '../../../openapi.constants';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

import type { IVirtualDeviceRemapDialogProps } from './virtual-device-remap-dialog.types';

defineOptions({
	name: 'VirtualDeviceRemapDialog',
});

const props = defineProps<IVirtualDeviceRemapDialogProps>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'remapped', payload: { propertyId: string; sourceProperty: string }): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const logger = useLogger();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const devicesStore = storesManager.getStore(devicesStoreKey);
const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

// Always true while this component is mounted — the parent (the sources panel) owns *whether* the
// dialog exists via `v-if`; this only owns the open/close transition and the "clicked the X, hit Esc,
// clicked the overlay" paths element-plus drives through `v-model`.
const visible = ref<boolean>(true);

const pickedDevice = ref<string | null>(null);
const pickedChannel = ref<string | null>(null);
const selection = ref<string | null>(null);
const error = ref<string | null>(null);
const checking = ref<boolean>(false);
const confirming = ref<boolean>(false);
const confirmError = ref<string | null>(null);

// Monotonic request token, mirroring the wizard mapping step's per-slot tokens but for the single slot
// this dialog owns: a compatibility verdict that arrives after the user picked a different candidate
// (or cleared the picker) belongs to a selection that no longer exists and must not be written back.
let requestToken = 0;

// Read live off the stores rather than snapshotted at open, so a source property (or its channel, or
// its device) deleted while this dialog is open is reflected here rather than silently ignored: the
// template falls back to the "this property no longer exists" state instead of operating on stale data.
const property = computed<IChannelProperty | undefined>(() => propertiesStore.findById(props.propertyId) ?? undefined);
const channel = computed<IChannel | undefined>(() => (property.value ? (channelsStore.findById(property.value.channel) ?? undefined) : undefined));
const device = computed<IDevice | undefined>(() => (channel.value ? (devicesStore.findById(channel.value.device) ?? undefined) : undefined));

const propertyLabel = computed<string>(() =>
	property.value ? (property.value.name ?? t(`devicesModule.categories.channelsProperties.${property.value.category}`)) : ''
);

const dialogTitle = computed<string>(() => t('devicesVirtualPlugin.remap.title', { property: propertyLabel.value }));

const sourceDevicesOptions = computed<{ value: string; label: string }[]>(() =>
	orderBy<IDevice>(
		devicesStore
			.findAll()
			// Same exclusions as the wizard's mapping step, and for the same reasons. A `user` hide is a
			// deliberate "stop showing me this" and is excluded. A `system` hide is not: it means a
			// virtual device has taken the device over, and that is exactly the device an orphaned
			// projection needs to be repointed at — a source property deleted and recreated on a
			// part-split board leaves its projection orphaned, and with no admin unhide path, excluding
			// system-hidden devices here would leave the virtual device permanently offline with no way
			// to repair it.
			//
			// Virtual devices are excluded because nesting one inside another is refused at create time
			// (VirtualDevicesService.assertSourceNotVirtual) but the compatibility endpoint does not
			// check for it, so such a source would preview clean here and then fail when saved.
			.filter(
				(candidate: IDevice): boolean =>
					!candidate.draft &&
					(!candidate.hidden || candidate.hiddenBy === DevicesModuleDeviceHiddenBy.system) &&
					candidate.type !== DEVICES_VIRTUAL_TYPE
			),
		[(candidate: IDevice): string => candidate.name],
		['asc']
	).map((candidate: IDevice): { value: string; label: string } => ({ value: candidate.id, label: candidate.name }))
);

const channelsOptions = computed<{ value: string; label: string }[]>((): { value: string; label: string }[] => {
	if (pickedDevice.value === null) {
		return [];
	}

	return orderBy<IChannel>(channelsStore.findForDevice(pickedDevice.value), [(entry: IChannel): string => entry.name], ['asc']).map(
		(entry: IChannel): { value: string; label: string } => ({ value: entry.id, label: entry.name })
	);
});

const propertiesOptions = computed<{ value: string; label: string }[]>((): { value: string; label: string }[] => {
	if (pickedChannel.value === null) {
		return [];
	}

	return orderBy<IChannelProperty>(
		propertiesStore.findForChannel(pickedChannel.value),
		[(entry: IChannelProperty): string => entry.name ?? entry.category],
		['asc']
	).map((entry: IChannelProperty): { value: string; label: string } => ({
		value: entry.id,
		label: entry.name ?? t(`devicesModule.categories.channelsProperties.${entry.category}`),
	}));
});

const canConfirm = computed<boolean>(
	(): boolean => property.value !== undefined && selection.value !== null && error.value === null && !checking.value && !confirming.value
);

// `sourceProperty` is a virtual-plugin extension of the base edit payload — the store's `edit()`
// action has one fixed signature shared by every device/property type, so it cannot declare a
// plugin-specific field. The intersection documents exactly what is being sent without resorting to
// `any`: TypeScript only excess-property-checks fresh object literals, not a value already carrying
// this type, so building it here and passing the variable through satisfies both the compiler and the
// store's declared signature.
type VirtualPropertyEditPayload = IChannelsPropertiesEditActionPayload['data'] & { sourceProperty: string };

const loadChannels = async (deviceId: string): Promise<void> => {
	try {
		await channelsStore.fetch({ deviceId });
	} catch (err: unknown) {
		logger.error('Failed to load remap source channels', err);
	}
};

const loadProperties = async (channelId: string): Promise<void> => {
	try {
		await propertiesStore.fetch({ channelId });
	} catch (err: unknown) {
		logger.error('Failed to load remap source properties', err);
	}
};

/**
 * Checks a single candidate pairing — this dialog only ever has one slot open — and writes the
 * verdict back. Hard block, not a warning: an incompatible source would die at the source platform,
 * so `canConfirm` refuses it exactly as the wizard's mapping step refuses one, and an unfinished check
 * counts as not-yet-proven so the user cannot outrun the verdict by clicking confirm immediately.
 */
const runCompatibility = async (sourcePropertyId: string): Promise<void> => {
	if (!property.value || !channel.value || !device.value) {
		// The target property, its channel or its device could not be resolved from the stores (e.g. a
		// concurrent delete while this dialog is open, per the `property`/`channel`/`device` comment
		// above). No verdict can be obtained for this pairing — the same principle the wizard's mapping
		// step applies to a failed compatibility request ("an unverified pairing is not a verified-good
		// one") — so this must block Confirm exactly as an incompatible verdict would, not leave `error`
		// at the `null` `selectSource` just set before calling here.
		error.value = t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');

		return;
	}

	const token = ++requestToken;

	checking.value = true;
	error.value = null;

	try {
		const { data: responseData, error: responseError } = await backend.client.POST(
			`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/devices/compatibility`,
			{
				body: {
					data: {
						category: device.value.category,
						candidates: [
							{
								spec_channel: channel.value.category,
								spec_property: property.value.category,
								source_property: sourcePropertyId,
							},
						],
					},
				},
			}
		);

		if (token !== requestToken) {
			return;
		}

		const report: DevicesVirtualPluginCompatibilityReportSchema | undefined = responseData?.data?.[0];

		if (!report) {
			error.value = responseError
				? getErrorReason<DevicesVirtualPluginCheckCompatibilityOperation>(responseError, t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed'))
				: t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');

			return;
		}

		error.value = report.compatible ? null : (report.reason ?? t('devicesVirtualPlugin.wizard.mapping.errors.incompatible'));
	} catch (err: unknown) {
		if (token !== requestToken) {
			return;
		}

		logger.error('Virtual device remap compatibility check failed', err);

		error.value = t('devicesVirtualPlugin.wizard.mapping.errors.checkFailed');
	} finally {
		if (token === requestToken) {
			checking.value = false;
		}
	}
};

const selectSource = async (sourcePropertyId: string | null): Promise<void> => {
	selection.value = sourcePropertyId;
	error.value = null;

	if (sourcePropertyId === null) {
		// Bumped so a check already in flight for the source just cleared can no longer land.
		requestToken++;
		checking.value = false;

		return;
	}

	await runCompatibility(sourcePropertyId);
};

const onPickDevice = (deviceId: string | null): void => {
	pickedChannel.value = null;
	selection.value = null;
	error.value = null;
	requestToken++;
	checking.value = false;

	if (deviceId !== null) {
		loadChannels(deviceId).catch((err: unknown): void => logger.error('Failed to load remap source channels', err));
	}
};

const onPickChannel = (channelId: string | null): void => {
	selection.value = null;
	error.value = null;
	requestToken++;
	checking.value = false;

	if (channelId !== null) {
		loadProperties(channelId).catch((err: unknown): void => logger.error('Failed to load remap source properties', err));
	}
};

const onPickProperty = (sourcePropertyId: string | null): void => {
	selectSource(sourcePropertyId).catch((err: unknown): void => logger.error('Failed to select remap source property', err));
};

const confirm = async (): Promise<void> => {
	if (!canConfirm.value || !property.value || selection.value === null) {
		return;
	}

	confirming.value = true;
	confirmError.value = null;

	const target = property.value;
	const newSourceProperty = selection.value;

	// `ChannelsPropertiesEditActionPayloadSchema.data.step` is the one field in that schema not marked
	// `.optional()`, so an edit payload that omits it fails the store's own shape gate before a request
	// is ever built. Passing the property's current, unchanged value satisfies that without altering it.
	//
	// `sourceProperty` (camelCase — the store's own `transformChannelPropertyUpdateRequest` runs this
	// payload through `camelToSnake` before handing it to the wire schema, see channels.properties.
	// store.ts's `edit()`) is the field this whole dialog exists to send, and the reason
	// `channelPropertyUpdateReqSchema` must be registered in devices-virtual.plugin.ts — see
	// virtual-device-remap-dialog.spec.ts's wire-shape test.
	const editData: VirtualPropertyEditPayload = {
		type: target.type,
		step: target.step,
		sourceProperty: newSourceProperty,
	};

	try {
		await propertiesStore.edit({
			id: target.id,
			channelId: target.channel,
			data: editData,
		});

		flashMessage.success(t('devicesVirtualPlugin.remap.success', { property: propertyLabel.value }));

		emit('remapped', { propertyId: target.id, sourceProperty: newSourceProperty });
	} catch (err: unknown) {
		logger.error('Failed to remap virtual device property', err);

		confirmError.value = err instanceof Error ? err.message : t('devicesVirtualPlugin.remap.errors.updateFailed');

		flashMessage.error(confirmError.value);
	} finally {
		confirming.value = false;
	}
};

const onClose = (): void => {
	emit('close');
};

watch(visible, (value: boolean): void => {
	if (!value) {
		onClose();
	}
});

onBeforeMount((): void => {
	// No `hidden` filter on the fetch: this store is shared with the device list, whose "Show hidden"
	// toggle must keep working. Hidden devices are excluded from the picker in `sourceDevicesOptions`.
	// `all`, for the same reason the wizard asks for it: the endpoint treats an omitted filter as
	// "visible only", so a bare fetch would drop the system-hidden sources this dialog must offer.
	devicesStore
		.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all })
		.catch((err: unknown): void => logger.error('Failed to load remap source devices', err));
});

defineExpose({
	property,
	sourceDevicesOptions,
	channelsOptions,
	propertiesOptions,
	selection,
	error,
	checking,
	canConfirm,
	confirming,
	confirmError,
	selectSource,
	onPickDevice,
	onPickChannel,
	onPickProperty,
	confirm,
	onClose,
});
</script>
