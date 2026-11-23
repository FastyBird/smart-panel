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
				(ADR 0003, decision 1), so a tap or Enter adds the card to the middle of the canvas. On touch a long press
				(400 ms, spec section 6) picks the card up instead, to be dropped where the finger lifts.
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
				@pointerdown="onPointerDown($event, item)"
				@click="onClick(item.type)"
				@keydown.enter.prevent="onAdd(item.type)"
				@keydown.space.prevent="onAdd(item.type)"
			>
				<el-icon :size="18">
					<icon :icon="item.icon" />
				</el-icon>
				<span class="automation-palette__name">{{ item.title }}</span>
			</div>
		</div>

		<!-- The card being dragged by touch follows the finger -->
		<teleport to="body">
			<div
				v-if="touchDrag !== null && touchDrag.dragging"
				:style="{ left: `${touchDrag.x}px`, top: `${touchDrag.y}px` }"
				class="automation-palette__ghost"
				aria-hidden="true"
				data-test-id="automation-palette-ghost"
			>
				<icon
					:icon="touchDrag.item.icon"
					width="18"
					height="18"
				/>
				<span>{{ touchDrag.item.title }}</span>
			</div>
		</teleport>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
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
	/** A touch long press picked a card up */
	(e: 'drag-start', type: string): void;
	/** The card picked up by touch was let go here (screen coordinates) */
	(e: 'drop', type: string, clientX: number, clientY: number): void;
}>();

// How long a finger rests on a card before it is picked up, and how far it may move before that without it being taken
// for a scroll
const LONG_PRESS_MS = 400;
const LONG_PRESS_SLOP = 10;

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

/*
 * Touch drag: a long press picks the card up, it follows the finger and is dropped where the finger lifts
 */

interface ITouchDrag {
	// The finger that pressed the card: the others are not part of this drag
	pointerId: number;
	item: IPaletteItem;
	startX: number;
	startY: number;
	x: number;
	y: number;
	dragging: boolean;
	timer: number | null;
}

const touchDrag = ref<ITouchDrag | null>(null);

// The click that follows a long press is not a tap: the card was dragged, not added to the middle
let swallowClick = false;

const onClick = (type: string): void => {
	if (swallowClick) {
		swallowClick = false;

		return;
	}

	onAdd(type);
};

// The page must not scroll under a card being dragged
const onTouchMove = (event: TouchEvent): void => {
	if (touchDrag.value?.dragging) {
		event.preventDefault();
	}
};

const stopTouchDrag = (): void => {
	if (touchDrag.value?.timer) {
		window.clearTimeout(touchDrag.value.timer);
	}

	touchDrag.value = null;

	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	window.removeEventListener('pointercancel', onPointerCancel);
	window.removeEventListener('touchmove', onTouchMove);
};

const onPointerCancel = (event: PointerEvent): void => {
	if (touchDrag.value !== null && event.pointerId === touchDrag.value.pointerId) {
		stopTouchDrag();
	}
};

const onPointerMove = (event: PointerEvent): void => {
	const drag = touchDrag.value;

	if (drag === null || event.pointerId !== drag.pointerId) {
		return;
	}

	if (!drag.dragging) {
		// Moved before the press was long enough: it is a scroll, not a drag
		if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > LONG_PRESS_SLOP) {
			stopTouchDrag();
		}

		return;
	}

	drag.x = event.clientX;
	drag.y = event.clientY;
};

const onPointerUp = (event: PointerEvent): void => {
	const drag = touchDrag.value;

	if (drag === null || event.pointerId !== drag.pointerId) {
		return;
	}

	if (drag.dragging) {
		swallowClick = true;

		emit('drop', drag.item.type, event.clientX, event.clientY);
	}

	stopTouchDrag();
};

const onPointerDown = (event: PointerEvent, item: IPaletteItem): void => {
	// A drag that ended away from the card was followed by no click: the next press starts afresh
	swallowClick = false;

	// A second finger does not take over a card already pressed or picked up
	if (props.disabled || event.pointerType !== 'touch' || touchDrag.value !== null) {
		return;
	}

	const drag: ITouchDrag = {
		pointerId: event.pointerId,
		item,
		startX: event.clientX,
		startY: event.clientY,
		x: event.clientX,
		y: event.clientY,
		dragging: false,
		timer: null,
	};

	drag.timer = window.setTimeout((): void => {
		if (touchDrag.value !== null) {
			touchDrag.value.dragging = true;
			touchDrag.value.timer = null;

			emit('drag-start', item.type);
		}
	}, LONG_PRESS_MS);

	touchDrag.value = drag;

	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerCancel);
	window.addEventListener('touchmove', onTouchMove, { passive: false });
};

onBeforeUnmount((): void => {
	stopTouchDrag();
});

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

		// A long press picks the card up: the browser must not open its text or image menu for it
		-webkit-touch-callout: none;

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

.automation-palette__ghost {
	position: fixed;
	z-index: 3000;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border: 1px solid var(--el-color-primary);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color-overlay);
	box-shadow: var(--fb-shadow-overlay);
	color: var(--el-text-color-primary);
	font-size: var(--el-font-size-small);
	pointer-events: none;
	transform: translate(-50%, -120%);
}
</style>
