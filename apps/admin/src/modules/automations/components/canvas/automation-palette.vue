<template>
	<div
		class="automation-palette"
		data-test-id="automation-palette"
	>
		<el-text
			v-if="groups.length === 0"
			tag="div"
			size="small"
			type="info"
		>
			{{ t('automations.editor.texts.noNodeTypes') }}
		</el-text>

		<div
			v-for="group in groups"
			:key="group.kind"
			class="automation-palette__group"
			:data-test-group="group.kind"
		>
			<div class="automation-palette__heading">
				<span class="automation-palette__label">{{ group.label }}</span>
				<el-text
					size="small"
					type="info"
				>
					{{ group.title }}
				</el-text>
			</div>

			<!--
				Draggable for a mouse, and a button for everything else: HTML5 drag does not start from a touch
				(ADR 0003, decision 1), so a tap or Enter adds the card to the middle of the canvas.
			-->
			<div
				v-for="item in group.items"
				:key="item.type"
				class="automation-palette__item"
				:class="[`automation-palette__item--${group.kind}`, { 'automation-palette__item--disabled': props.disabled }]"
				:draggable="!props.disabled"
				:aria-disabled="props.disabled"
				:title="item.description"
				role="button"
				tabindex="0"
				:data-test-palette="item.type"
				@dragstart="onDragStart($event, item.type)"
				@click="onAdd(item.type)"
				@keydown.enter.prevent="onAdd(item.type)"
				@keydown.space.prevent="onAdd(item.type)"
			>
				<el-icon :size="18">
					<icon :icon="item.icon" />
				</el-icon>
				<span class="automation-palette__name">{{ item.title }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AUTOMATION_NODE_DRAG_MIME, AUTOMATION_NODE_KIND_ORDER, type AutomationNodeKind } from '../../automations.constants';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';

import type { IAutomationPaletteProps } from './automation-palette.types';

defineOptions({
	name: 'AutomationPalette',
});

interface IPaletteItem {
	type: string;
	title: string;
	description: string;
	icon: string;
}

interface IPaletteGroup {
	kind: AutomationNodeKind;
	label: string;
	title: string;
	items: IPaletteItem[];
}

const props = withDefaults(defineProps<IAutomationPaletteProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'add', type: string): void;
}>();

const { t } = useI18n();

const { kindLabel, kindTitle, nodeTitle, nodeDescription, nodeIcon } = useAutomationNodePresentation();

// When / And / Then / Flow, each with the cards of that kind the backend offers
const groups = computed<IPaletteGroup[]>((): IPaletteGroup[] =>
	AUTOMATION_NODE_KIND_ORDER.map(
		(kind): IPaletteGroup => ({
			kind,
			label: kindLabel(kind),
			title: kindTitle(kind),
			items: props.nodeTypes
				.filter((nodeType) => nodeType.kind === kind)
				.map(
					(nodeType): IPaletteItem => ({
						type: nodeType.type,
						title: nodeTitle(nodeType.type, nodeType),
						description: nodeDescription(nodeType.type, nodeType),
						icon: nodeIcon(nodeType.type, nodeType),
					})
				)
				.sort((a, b) => a.title.localeCompare(b.title)),
		})
	).filter((group) => group.items.length > 0)
);

const onAdd = (type: string): void => {
	if (!props.disabled) {
		emit('add', type);
	}
};

const onDragStart = (event: DragEvent, type: string): void => {
	if (props.disabled || !event.dataTransfer) {
		event.preventDefault();

		return;
	}

	event.dataTransfer.setData(AUTOMATION_NODE_DRAG_MIME, type);
	event.dataTransfer.effectAllowed = 'copy';
};
</script>

<style scoped lang="scss">
.automation-palette {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 12px;

	&__heading {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 6px;
	}

	&__label {
		color: var(--el-text-color-primary);
		font-size: var(--el-font-size-small);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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

		&--disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}

		.el-icon {
			flex: none;
			color: var(--automation-palette-accent);
		}
	}

	&__name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>
