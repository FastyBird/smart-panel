<template>
	<el-select
		:model-value="modelValue"
		:placeholder="placeholder"
		:clearable="clearable"
		:filterable="filterable"
		:disabled="disabled"
		:loading="fetching"
		class="w-full"
		@update:model-value="$emit('update:modelValue', $event)"
	>
		<template #prefix>
			<icon
				v-if="selectedSpaceIcon"
				:icon="selectedSpaceIcon"
				class="text-lg"
			/>
		</template>

		<template v-if="grouped">
			<el-option-group
				v-for="group in groupedOptions"
				:key="group.type"
				:label="group.label"
			>
				<el-option
					v-for="item in group.options"
					:key="item.id"
					:label="item.name"
					:value="item.id"
				>
					<div class="flex items-center gap-2">
						<icon
							:icon="getSpaceIcon(item)"
							class="text-lg"
						/>
						<span>{{ item.name }}</span>
					</div>
				</el-option>
			</el-option-group>
		</template>

		<template v-else>
			<el-option
				v-for="space in flatOptions"
				:key="space.id"
				:label="space.name"
				:value="space.id"
			>
				<div class="flex items-center gap-2">
					<icon
						:icon="getSpaceIcon(space)"
						class="text-lg"
					/>
					<span>{{ space.name }}</span>
				</div>
			</el-option>
		</template>
	</el-select>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElOptionGroup, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';

import { SpaceType, getSpaceIcon } from '../spaces.constants';
import type { ISpace } from '../store';
import { useSpaces } from '../composables/useSpaces';

import type { ISpaceSelectProps } from './space-select.types';

defineOptions({
	name: 'SpaceSelect',
});

const props = withDefaults(defineProps<ISpaceSelectProps>(), {
	filter: 'all',
	clearable: true,
	filterable: true,
	disabled: false,
});

defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();

const { spaces, roomSpaces, zoneSpaces, fetching, findById } = useSpaces();

const grouped = computed<boolean>(() => props.filter === 'all');

const flatOptions = computed<ISpace[]>(() => {
	if (props.filter === 'room') {
		return roomSpaces.value;
	}
	if (props.filter === 'zone') {
		return zoneSpaces.value;
	}
	return spaces.value;
});

const groupedOptions = computed(() => {
	const groups: { type: SpaceType | 'other'; label: string; options: ISpace[] }[] = [];

	const rooms = roomSpaces.value.slice().sort((a, b) => a.name.localeCompare(b.name));
	const zones = zoneSpaces.value.slice().sort((a, b) => a.name.localeCompare(b.name));
	// Any space that isn't a room or zone — today that's the synthetic
	// master / entry singletons and plugin-contributed types like signage.
	// Before this change the `filter="all"` path only rendered rooms and
	// zones because `groupedOptions` had no bucket for the other types,
	// silently hiding them from pickers (e.g. the display assignment form).
	const others = spaces.value
		.filter((s) => s.type !== SpaceType.ROOM && s.type !== SpaceType.ZONE)
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name));

	if (rooms.length > 0) {
		groups.push({
			type: SpaceType.ROOM,
			label: t('spacesModule.labels.rooms'),
			options: rooms,
		});
	}

	if (zones.length > 0) {
		groups.push({
			type: SpaceType.ZONE,
			label: t('spacesModule.labels.zones'),
			options: zones,
		});
	}

	if (others.length > 0) {
		groups.push({
			type: 'other',
			label: t('spacesModule.labels.others'),
			options: others,
		});
	}

	return groups;
});

const selectedSpaceIcon = computed<string | null>(() => {
	if (!props.modelValue) {
		return null;
	}

	const space = findById(props.modelValue);

	return space ? getSpaceIcon(space) : null;
});
</script>
