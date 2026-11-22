<template>
	<!-- Mounted only while open: with a single wizard the picker chooses it at once instead of opening -->
	<type-picker
		v-if="props.visible"
		:options="options"
		:model-value="null"
		:visible="props.visible"
		:title="t('devicesModule.wizard.selection.title')"
		@update:model-value="onChoose"
		@update:visible="onVisible"
	/>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';

import { TypePicker } from '../../../../common';
import { useDevicesPlugins } from '../../composables/useDevicesPlugins';
import { RouteNames } from '../../devices.constants';

import type { IDeviceWizardPickerOption } from './device-wizard-picker.types';

defineOptions({
	name: 'DeviceWizardPicker',
});

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: false });

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	/** A wizard was chosen: the host opens it */
	(e: 'choose', to: RouteLocationRaw): void;
}>();

const { t } = useI18n();
const { getByPluginType, getWizard, wizardOptions } = useDevicesPlugins();

type SortableOption = { option: IDeviceWizardPickerOption; rank: number; order: number; group: string; index: number };

// One tile per wizard, built from its `{icon, name, description, order, badge}`. A plugin with several wizards (the
// virtual devices) gets a tile per wizard, badged with the plugin's name so they read as one family
const options = computed<IDeviceWizardPickerOption[]>(() => {
	const list: SortableOption[] = [];

	for (const option of wizardOptions.value.filter((item) => !item.disabled)) {
		const wizard = getWizard(option.value);

		if (!wizard) {
			continue;
		}

		const selection = wizard.selection;
		const order = selection?.order ?? 100;
		const rank = selection?.kind === 'section' ? 1 : 0;
		const badge = selection?.badge ? t(selection.badge) : undefined;

		if (wizard.variants?.length) {
			wizard.variants.forEach((variant, index) => {
				list.push({
					option: {
						id: `${option.value}:${variant.id}`,
						icon: variant.icon,
						name: t(variant.label),
						description: t(variant.description),
						badge: badge ?? option.label,
						to: { name: RouteNames.DEVICES_WIZARD, params: { type: option.value }, query: { variant: variant.id } },
					},
					rank,
					order,
					group: option.label,
					index,
				});
			});

			continue;
		}

		list.push({
			option: {
				id: option.value,
				icon: selection?.icon ?? getByPluginType(option.value)?.icon?.small ?? 'mdi:devices',
				name: selection?.label ? t(selection.label) : option.label,
				description: selection?.description ? t(selection.description) : option.description,
				badge,
				to: { name: RouteNames.DEVICES_WIZARD, params: { type: option.value } },
			},
			rank,
			order,
			group: option.label,
			index: 0,
		});
	}

	// Integrations first, then the plugin sections; each by its order, then by name
	return list
		.sort(
			(left, right) =>
				left.rank - right.rank ||
				left.order - right.order ||
				left.group.localeCompare(right.group) ||
				left.index - right.index ||
				left.option.name.localeCompare(right.option.name)
		)
		.map((item) => item.option);
});

// The picker closes after a choice too; that close belongs to the choice, it is not a dismissal
let chosen = false;

watch(
	(): boolean => props.visible,
	(visible): void => {
		if (visible) {
			chosen = false;
		}
	}
);

const onChoose = (id: string): void => {
	const option = options.value.find((item) => item.id === id);

	if (!option) {
		return;
	}

	chosen = true;

	emit('choose', option.to);
};

const onVisible = (visible: boolean): void => {
	if (!visible && chosen) {
		return;
	}

	emit('update:visible', visible);
};
</script>
