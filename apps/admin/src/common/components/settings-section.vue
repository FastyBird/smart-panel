<template>
	<section
		:id="props.id"
		:aria-labelledby="`${props.id}-title`"
		class="scroll-mt-4 bg-surface border border-solid border-light rounded-lg"
		data-test-id="settings-section"
	>
		<!-- One section card of a settings page; the layout's anchor nav scrolls to its id -->
		<header class="flex flex-wrap items-center gap-3 px-4 tp:px-5 py-3 border-b border-b-solid border-light">
			<icon
				v-if="props.icon"
				:icon="props.icon"
				width="20"
				height="20"
				class="shrink-0 text-secondary"
			/>
			<div class="flex flex-col flex-1 min-w-0">
				<h2
					:id="`${props.id}-title`"
					class="m-0 text-section"
				>
					{{ props.title }}
				</h2>
				<p
					v-if="props.description"
					class="m-0 text-help"
				>
					{{ props.description }}
				</p>
			</div>
			<slot name="actions" />
		</header>

		<div class="p-4 tp:p-5">
			<slot />
		</div>
	</section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import type { SettingsSectionProps } from './settings-layout.types';

defineOptions({
	name: 'SettingsSection',
});

const props = withDefaults(defineProps<SettingsSectionProps>(), {
	description: undefined,
	icon: undefined,
});
</script>
