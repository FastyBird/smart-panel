<template>
	<section
		:aria-labelledby="headingId"
		class="plugin-form-section flex flex-col gap-3.5"
		data-test-id="plugin-form-section"
	>
		<!-- An advanced section keeps its heading: the toggle is a button inside the h3 (disclosure pattern) -->
		<div
			v-if="props.advanced"
			class="flex flex-col"
		>
			<h3
				:id="headingId"
				class="m-0"
			>
				<button
					:aria-expanded="isExpanded ? 'true' : 'false'"
					:aria-controls="bodyId"
					class="flex items-start gap-2 p-0 border-0 bg-transparent text-left font-inherit cursor-pointer"
					type="button"
					data-test-id="plugin-form-section-toggle"
					@click="toggle"
				>
					<icon
						:icon="isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'"
						width="20"
						height="20"
						class="shrink-0 mt-0.5 text-secondary"
						aria-hidden="true"
					/>
					<span class="text-[15px] leading-[24px] font-600 text-default">{{ props.title }}</span>
				</button>
			</h3>
			<span
				v-if="props.description"
				class="pl-7 text-help"
			>
				{{ props.description }}
			</span>
		</div>

		<div
			v-else
			class="flex flex-col"
		>
			<h3
				:id="headingId"
				class="m-0 text-[15px] leading-[24px] font-600 text-default"
			>
				{{ props.title }}
			</h3>
			<span
				v-if="props.description"
				class="text-help"
			>
				{{ props.description }}
			</span>
		</div>

		<div
			v-show="!props.advanced || isExpanded"
			:id="bodyId"
			class="flex flex-col gap-3.5"
			data-test-id="plugin-form-section-body"
		>
			<slot />
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';

import { Icon } from '@iconify/vue';

import type { PluginFormSectionProps } from './plugin-form-section.types';

defineOptions({
	name: 'PluginFormSection',
});

const props = withDefaults(defineProps<PluginFormSectionProps>(), {
	description: undefined,
	advanced: false,
	expanded: undefined,
});

const emit = defineEmits<{
	(e: 'update:expanded', expanded: boolean): void;
}>();

const id = useId();

const headingId = `plugin-form-section-${id}-heading`;
const bodyId = `plugin-form-section-${id}-body`;

// Advanced options start collapsed (spec section 7). A parent that passes `expanded` owns the state: a click only asks
// it to change through `update:expanded`. Without it the section keeps its own
const localExpanded = ref<boolean>(false);

const isExpanded = computed<boolean>((): boolean => props.expanded ?? localExpanded.value);

const toggle = (): void => {
	const next = !isExpanded.value;

	if (props.expanded === undefined) {
		localExpanded.value = next;
	}

	emit('update:expanded', next);
};
</script>

<style scoped>
/* Sections of one form are divided by a rule, so a plugin never draws cards of its own */
.plugin-form-section + .plugin-form-section {
	padding-top: 16px;
	border-top: 1px solid var(--el-border-color-light);
}
</style>
