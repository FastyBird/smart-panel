<template>
	<div
		class="automation-palette"
		data-test="automation-palette"
	>
		<div
			v-for="group in groups"
			:key="group.kind"
			class="automation-palette__group"
		>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="automation-palette__title"
			>
				{{ group.label }}
			</el-text>
			<div
				v-for="item in group.items"
				:key="item.type"
				class="automation-palette__item"
				:class="`automation-palette__item--${group.kind}`"
				:draggable="!props.disabled"
				role="button"
				tabindex="0"
				:data-test-palette="item.type"
				@dragstart="onDragStart($event, item.type)"
				@click="emit('add', item.type)"
				@keydown.enter="emit('add', item.type)"
			>
				<el-icon :size="18">
					<icon :icon="item.icon" />
				</el-icon>
				<span>{{ item.label }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KIND_LABELS, KIND_ORDER, NODE_TYPES } from '../automations-spike.catalogue';
import type { AutomationNodeKind, IAutomationNodeTypeDefinition } from '../automations-spike.types';

defineOptions({
	name: 'AutomationPalette',
});

const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });

const emit = defineEmits<{
	(e: 'add', type: string): void;
}>();

const NODE_DRAG_MIME = 'application/x-automation-node-type';

const groups: { kind: AutomationNodeKind; label: string; items: IAutomationNodeTypeDefinition[] }[] = KIND_ORDER.map((kind) => ({
	kind,
	label: KIND_LABELS[kind],
	items: NODE_TYPES.filter((definition) => definition.kind === kind),
}));

const onDragStart = (event: DragEvent, type: string): void => {
	event.dataTransfer?.setData(NODE_DRAG_MIME, type);

	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'copy';
	}
};
</script>

<style scoped lang="scss">
.automation-palette {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 12px;

	&__title {
		margin-bottom: 6px;
		font-weight: 600;
		text-transform: uppercase;
	}

	&__item {
		--automation-palette-accent: var(--el-color-info);

		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		padding: 8px 10px;
		border: 1px solid var(--el-border-color);
		border-left: 4px solid var(--automation-palette-accent);
		border-radius: var(--el-border-radius-base);
		background-color: var(--el-bg-color-overlay);
		color: var(--el-text-color-primary);
		font-size: var(--el-font-size-small);
		cursor: grab;
		user-select: none;

		&--trigger {
			--automation-palette-accent: var(--el-color-primary);
		}

		&--condition {
			--automation-palette-accent: var(--el-color-warning);
		}

		&--action {
			--automation-palette-accent: var(--el-color-success);
		}

		&:hover,
		&:focus-visible {
			border-color: var(--automation-palette-accent);
			outline: none;
		}
	}
}
</style>
