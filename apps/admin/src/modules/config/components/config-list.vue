<template>
	<!-- The modules or the plugins of one family, one row each; a row opens its settings -->
	<ul
		class="flex flex-col m-0 -mx-4 tp:-mx-5 -my-4 tp:-my-5 p-0 list-none"
		data-test-id="config-list"
	>
		<li
			v-for="item in props.items"
			:key="item.id"
			class="border-b border-b-solid border-light last:border-b-0"
		>
			<button
				type="button"
				:aria-current="props.activeId === item.id ? 'true' : undefined"
				:class="[
					'flex items-center gap-3 w-full px-4 tp:px-5 py-3 border-0 text-left font-inherit cursor-pointer',
					props.activeId === item.id ? 'bg-primary-soft' : 'bg-transparent hover:bg-fill-light',
				]"
				:data-item-id="item.id"
				data-test-id="config-list-row"
				@click="emit('open', item.id)"
			>
				<span
					class="flex items-center justify-center shrink-0 w-9 h-9 rounded-lg bg-fill-light text-secondary"
					aria-hidden="true"
				>
					<icon
						:icon="item.icon"
						width="20"
						height="20"
					/>
				</span>

				<span class="flex flex-col flex-1 min-w-0">
					<span class="text-card-title truncate">{{ item.name }}</span>
					<span
						v-if="item.description"
						class="text-help truncate"
					>
						{{ item.description }}
					</span>
				</span>

				<status-tag
					v-if="item.tag"
					:status="item.tag.status"
					:label="item.tag.label"
					class="shrink-0"
				/>

				<icon
					icon="mdi:chevron-right"
					width="20"
					height="20"
					class="shrink-0 text-placeholder"
					aria-hidden="true"
				/>
			</button>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';

import type { ConfigListItem, ConfigListProps } from './config-list.types';

defineOptions({
	name: 'ConfigList',
});

const props = withDefaults(defineProps<ConfigListProps>(), {
	activeId: null,
});

const emit = defineEmits<{
	(e: 'open', id: ConfigListItem['id']): void;
}>();
</script>
