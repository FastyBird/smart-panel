<template>
	<!-- Template 3, the Overview tab: one card per group, side by side where the page is wide enough -->
	<div
		class="grid grid-cols-1 tl:grid-cols-2 wd:grid-cols-3 gap-4 items-start"
		data-test-id="display-overview"
	>
		<el-card
			v-for="section in sections"
			:key="section.id"
			shadow="never"
			body-class="flex flex-col gap-3 p-4!"
			:data-test-id="`display-overview-${section.id}`"
		>
			<div class="flex items-center gap-2">
				<icon
					:icon="section.icon"
					width="20"
					height="20"
					class="text-secondary"
					aria-hidden="true"
				/>
				<span class="text-card-title">{{ section.title }}</span>
			</div>

			<kv-grid
				:items="section.items"
				:cols="2"
			/>

			<span
				v-if="section.hint"
				class="text-help"
			>
				{{ section.hint }}
			</span>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem } from '../../../common';
import { usePages } from '../../dashboard/composables/composables';
import { useSpaces } from '../../spaces/composables';
import { SCREEN_LOCK_DURATION_OPTIONS } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'DisplayOverview',
});

const props = defineProps<{ display: IDisplay }>();

const { t } = useI18n();

const { findById: findSpaceById } = useSpaces();
const { pages } = usePages();

type Section = { id: string; icon: string; title: string; items: KvGridItem[]; hint?: string };

const onOff = (value: boolean): string => (value ? t('displaysModule.detail.values.enabled') : t('displaysModule.detail.values.disabled'));

const screenLockDuration = (seconds: number): string => {
	const match = SCREEN_LOCK_DURATION_OPTIONS.find((option) => option.value === seconds);

	return match ? t(`displaysModule.fields.displays.screenLockDuration.options.${match.labelKey}`) : `${seconds} s`;
};

const assignedSpaceName = computed<string | null>((): string | null =>
	props.display.spaceId ? (findSpaceById(props.display.spaceId)?.name ?? null) : null
);

// An explicit home page names it; otherwise the panel opens the default view for the space's type
const initialView = computed<string>((): string => {
	if (props.display.homeMode === 'explicit' && props.display.homePageId) {
		return pages.value.find((page) => page.id === props.display.homePageId)?.title ?? t('displaysModule.detail.spaceContext.selectedPage');
	}

	return t('displaysModule.detail.spaceContext.initialViews.spaceOverview');
});

const sections = computed<Section[]>((): Section[] => {
	const display = props.display;

	const result: Section[] = [
		{
			id: 'settings',
			icon: 'mdi:cog',
			title: t('displaysModule.detail.settings.title'),
			items: [
				{ label: t('displaysModule.detail.settings.gridSize'), value: `${display.cols}×${display.rows}` },
				{ label: t('displaysModule.detail.settings.brightness'), value: `${display.brightness} %` },
				{ label: t('displaysModule.detail.settings.darkMode'), value: onOff(display.darkMode) },
				{ label: t('displaysModule.detail.settings.screenLockDuration'), value: screenLockDuration(display.screenLockDuration) },
				{ label: t('displaysModule.detail.settings.screenSaver'), value: onOff(display.screenSaver) },
				{ label: t('displaysModule.detail.settings.screenPowerOff'), value: onOff(display.screenPowerOff) },
			],
		},
	];

	// Only the peripherals the display has
	if (display.audioOutputSupported || display.audioInputSupported) {
		result.push({
			id: 'peripherals',
			icon: 'mdi:usb',
			title: t('displaysModule.detail.peripherals.title'),
			items: [
				...(display.audioOutputSupported
					? [
							{ label: t('displaysModule.detail.peripherals.audioOutput'), value: onOff(display.speaker) },
							{ label: t('displaysModule.detail.peripherals.audioOutputVolume'), value: `${display.speakerVolume} %` },
						]
					: []),
				...(display.audioInputSupported
					? [
							{ label: t('displaysModule.detail.peripherals.audioInput'), value: onOff(display.microphone) },
							{ label: t('displaysModule.detail.peripherals.audioInputVolume'), value: `${display.microphoneVolume} %` },
						]
					: []),
			],
		});
	}

	result.push({
		id: 'space',
		icon: 'mdi:home-map-marker',
		title: t('displaysModule.detail.spaceContext.title'),
		items: [
			{ label: t('displaysModule.detail.spaceContext.homeMode'), value: t(`displaysModule.detail.spaceContext.homeModes.${display.homeMode}`) },
			{
				label: t('displaysModule.detail.spaceContext.assignedSpace'),
				value: assignedSpaceName.value ?? t('displaysModule.detail.spaceContext.notAssigned'),
			},
			{ label: t('displaysModule.detail.spaceContext.initialView'), value: initialView.value },
		],
		hint: t('displaysModule.detail.spaceContext.hint'),
	});

	return result;
});
</script>
