<template>
	<div class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesVirtualPlugin.wizard.details.heading')"
			:description="t('devicesVirtualPlugin.wizard.details.description')"
			:closable="false"
			show-icon
		/>

		<el-form label-position="top">
			<el-form-item :label="t('devicesVirtualPlugin.fields.devices.name.title')">
				<el-input
					:model-value="name"
					:placeholder="t('devicesVirtualPlugin.fields.devices.name.placeholder')"
					name="name"
					@update:model-value="onNameInput"
				/>
			</el-form-item>

			<el-form-item :label="t('devicesModule.fields.devices.room.title')">
				<el-select
					:model-value="roomId"
					:placeholder="t('devicesModule.fields.devices.room.placeholder')"
					name="room"
					filterable
					clearable
					class="w-full"
					@update:model-value="onRoomChange"
				>
					<el-option
						v-for="item in roomOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>

				<div class="text-xs text-gray-500 mt-1">
					{{ t('devicesModule.fields.devices.room.hint') }}
				</div>
			</el-form-item>

			<el-form-item :label="t('devicesModule.fields.devices.zones.title')">
				<el-select
					:model-value="zoneIds"
					:placeholder="t('devicesModule.fields.devices.zones.placeholder')"
					name="zones"
					filterable
					clearable
					multiple
					class="w-full"
					@update:model-value="onZonesChange"
				>
					<el-option
						v-for="item in zoneOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>

				<div class="text-xs text-gray-500 mt-1">
					{{ t('devicesModule.fields.devices.zones.hint') }}
				</div>
			</el-form-item>
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { injectStoresManager, useLogger } from '../../../../common';
import { SpaceType, isFloorZoneCategory } from '../../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import type { ISpace } from '../../../../modules/spaces/store/spaces.store.types';

import type { IVirtualWizardDetailsStepProps } from './virtual-wizard-details-step.types';

defineOptions({
	name: 'VirtualWizardDetailsStep',
});

const props = defineProps<IVirtualWizardDetailsStepProps>();

const emit = defineEmits<{
	(e: 'update:name', value: string): void;
	(e: 'update:roomId', value: string | null): void;
	(e: 'update:zoneIds', value: string[]): void;
}>();

const { t } = useI18n();
const logger = useLogger();
const storesManager = injectStoresManager();

const spacesStore = storesManager.getStore(spacesStoreKey);

// Local alias so the template does not repeat `props.name` — `name` is otherwise entirely
// prop-driven, never copied into local state, so the wizard shell (the sole owner of
// `IVirtualWizardState`) stays the single source of truth.
const name = computed<string>(() => props.name);
const roomId = computed<string | null>(() => props.roomId);
const zoneIds = computed<string[]>(() => props.zoneIds);

const roomOptions = computed<{ value: string; label: string }[]>(() =>
	orderBy<ISpace>(
		spacesStore.findAll().filter((space: ISpace): boolean => space.type === SpaceType.ROOM),
		[(space: ISpace): string => space.name],
		['asc']
	).map((space: ISpace): { value: string; label: string } => ({ value: space.id, label: space.name }))
);

// Floor zones are derived from room assignment and can never be assigned directly (the backend
// refuses it — `DeviceZonesService.addDeviceToZone`), so they are excluded here rather than offered
// and then rejected on create.
const zoneOptions = computed<{ value: string; label: string }[]>(() =>
	orderBy<ISpace>(
		spacesStore.findAll().filter((space: ISpace): boolean => space.type === SpaceType.ZONE && !isFloorZoneCategory(space.category)),
		[(space: ISpace): string => space.name],
		['asc']
	).map((space: ISpace): { value: string; label: string } => ({ value: space.id, label: space.name }))
);

// The name this step last generated on the user's behalf. As long as the incoming `name` prop still
// equals it, the name is considered "untouched" and stays auto-generated from category + room; the
// instant the user (or anything else) sets `name` to something else, generation stops for good. This
// mount-scoped tracking is deliberately simple rather than perfect: a component remount (leaving this
// step and coming back) resets it, so a name that happens to already match what generation would
// produce is — best effort, same tradeoff the mapping step's picker re-hydration makes — treated as
// untouched only when this ref's initial value already agrees with it.
const lastAutoName = ref<string>(props.name);

const generatedName = computed<string>((): string => {
	if (props.category === null) {
		return '';
	}

	const categoryLabel = t(`devicesModule.categories.devices.${props.category}`);

	if (props.roomId === null) {
		return categoryLabel;
	}

	const room = spacesStore.findById(props.roomId);

	return room ? `${categoryLabel} — ${room.name}` : categoryLabel;
});

watch(
	generatedName,
	(value: string): void => {
		if (props.name !== lastAutoName.value) {
			return;
		}

		if (value === props.name) {
			return;
		}

		lastAutoName.value = value;

		emit('update:name', value);
	},
	{ immediate: true }
);

const onNameInput = (value: string): void => {
	emit('update:name', value);
};

const onRoomChange = (value: string | null): void => {
	emit('update:roomId', value);
};

const onZonesChange = (value: string[]): void => {
	emit('update:zoneIds', value);
};

onBeforeMount((): void => {
	spacesStore.fetch().catch((error: unknown): void => logger.error('Failed to load rooms and zones', error));
});

defineExpose({
	roomOptions,
	zoneOptions,
	generatedName,
});
</script>
