<template>
	<el-form-item :label="t('devicesModule.fields.devices.room.title')">
		<el-select
			:model-value="roomId"
			:placeholder="t('devicesModule.fields.devices.room.placeholder')"
			:disabled="disabled"
			name="room"
			clearable
			filterable
			class="w-full"
			data-test-id="virtual-placement-room"
			@update:model-value="emit('update:roomId', $event || null)"
		>
			<el-option
				v-for="item in roomOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>
	<el-form-item :label="t('devicesModule.fields.devices.zones.title')">
		<el-select
			:model-value="zoneIds"
			:placeholder="t('devicesModule.fields.devices.zones.placeholder')"
			:disabled="disabled"
			name="zones"
			multiple
			clearable
			filterable
			class="w-full"
			data-test-id="virtual-placement-zones"
			@update:model-value="emit('update:zoneIds', $event ?? [])"
		>
			<el-option
				v-for="item in zoneOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElOption, ElSelect } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { SpaceType, isFloorZoneCategory } from '../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import type { ISpace } from '../../../modules/spaces/store/spaces.store.types';

defineOptions({
	name: 'VirtualPlacementFields',
});

// Where a new virtual device lives: its room and the zones it belongs to. Shared by every kind that
// is authored by a single editor, so they offer the same two inputs the projection wizard's details
// step has. Floor zones follow from the room and cannot be assigned directly, so they are not offered.
defineProps<{ roomId: string | null; zoneIds: string[]; disabled?: boolean }>();
const emit = defineEmits<{ 'update:roomId': [value: string | null]; 'update:zoneIds': [value: string[]] }>();

const { t } = useI18n();
const spacesStore = injectStoresManager().getStore(spacesStoreKey);
const options = (spaces: ISpace[]): { value: string; label: string }[] =>
	orderBy(spaces, [(space) => space.name], ['asc']).map((space) => ({ value: space.id, label: space.name }));
const roomOptions = computed(() => options(spacesStore.findAll().filter((space: ISpace) => space.type === SpaceType.ROOM)));
const zoneOptions = computed(() =>
	options(spacesStore.findAll().filter((space: ISpace) => space.type === SpaceType.ZONE && !isFloorZoneCategory(space.category)))
);

onBeforeMount(() => {
	// Best effort: without the list the device is simply created unplaced, as before.
	void Promise.resolve(spacesStore.fetch()).catch(() => undefined);
});
</script>
