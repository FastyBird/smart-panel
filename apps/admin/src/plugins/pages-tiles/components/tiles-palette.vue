<template>
	<!-- Template 8: the palette, the tile types this page can take -->
	<div
		class="flex flex-col gap-2 p-3"
		data-test-id="tiles-palette"
	>
		<div class="flex flex-col gap-0.5">
			<span class="text-label">{{ t('pagesTilesPlugin.editor.palette.title') }}</span>
			<span class="text-help">{{ t('pagesTilesPlugin.editor.palette.description') }}</span>
		</div>

		<button
			v-for="option in options"
			:key="option.value"
			type="button"
			class="tiles-palette__item flex items-start gap-2 w-full p-2 text-left rounded-lg border border-solid border-light bg-transparent cursor-pointer"
			:data-test-id="`tiles-palette-${option.value}`"
			@click="emit('add', option.value)"
		>
			<icon
				icon="mdi:plus"
				width="18"
				height="18"
				class="shrink-0 mt-0.5 text-secondary"
				aria-hidden="true"
			/>
			<span class="flex flex-col gap-0.5 min-w-0">
				<span class="text-body">{{ option.label }}</span>
				<span
					v-if="option.description"
					class="text-help line-clamp-2"
				>
					{{ option.description }}
				</span>
			</span>
		</button>

		<span
			v-if="options.length === 0"
			class="text-help"
		>
			{{ t('pagesTilesPlugin.editor.palette.empty') }}
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { useTilesPlugins } from '../../../modules/dashboard';

defineOptions({
	name: 'TilesPalette',
});

const emit = defineEmits<{
	(e: 'add', type: string): void;
}>();

const { t } = useI18n();

const { options: tileOptions, getElement } = useTilesPlugins();

const options = computed<{ value: string; label: string; description: string | null }[]>(
	(): { value: string; label: string; description: string | null }[] =>
		tileOptions.value
			.filter((option) => !option.disabled)
			.map((option) => ({ value: option.value, label: option.label, description: getElement(option.value)?.description?.trim() || null }))
);
</script>

<style scoped lang="scss">
.tiles-palette__item {
	color: inherit;
	font: inherit;
	transition: border-color 0.2s;

	&:hover,
	&:focus-visible {
		border-color: var(--el-color-primary);
		outline: none;
	}
}
</style>
