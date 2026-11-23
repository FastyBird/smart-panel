<template>
	<section
		class="flex flex-col gap-4 p-4 tp:p-5 bg-surface border border-solid border-light rounded-lg"
		data-test-id="space-detail"
	>
		<!-- The summary card of template 3: the space at a glance, with rows a space plugin adds (its parent zone) -->
		<div class="flex items-center gap-3 min-w-0">
			<span
				class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-primary-soft text-primary"
				aria-hidden="true"
			>
				<icon
					:icon="space.icon || 'mdi:home-group'"
					width="22"
					height="22"
				/>
			</span>
			<div class="flex flex-col min-w-0">
				<h2 class="m-0 text-section truncate">{{ space.name }}</h2>
				<spaces-table-column-plugin
					:space="space"
					class="text-help!"
				/>
			</div>
		</div>

		<p
			v-if="space.description"
			class="m-0 text-body"
			data-test-id="space-detail-description"
		>
			{{ space.description }}
		</p>

		<dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 m-0 empty:hidden">
			<slot />
		</dl>
	</section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import type { ISpaceDetailProps } from './space-detail.types';
import SpacesTableColumnPlugin from './spaces-table-column-plugin.vue';

defineOptions({
	name: 'SpaceDetail',
});

defineProps<ISpaceDetailProps>();
</script>
