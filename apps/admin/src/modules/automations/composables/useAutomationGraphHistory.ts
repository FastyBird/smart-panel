import { computed, ref } from 'vue';

import { AUTOMATION_EDITOR_HISTORY_LIMIT } from '../automations.constants';
import { createEmptyGraph } from '../automations.graph';
import type { IAutomationGraph } from '../store/automations.store.types';

import type { IUseAutomationGraphHistory } from './types';

// Edits of one field that follow each other this closely are one step: nobody undoes a word letter by letter
const COALESCE_WINDOW_MS = 1000;

/**
 * Undo and redo for the session of the editor. The canvas is driven by plain graph JSON, so history is a
 * list of snapshots of it and nothing in the canvas library takes part.
 */
export const useAutomationGraphHistory = (initial: IAutomationGraph = createEmptyGraph()): IUseAutomationGraphHistory => {
	const entries = ref<string[]>([JSON.stringify(initial)]);
	const index = ref<number>(0);

	const graph = ref<IAutomationGraph>(JSON.parse(entries.value[0] as string) as IAutomationGraph);

	let coalescing: { key: string; at: number } | null = null;

	const canUndo = computed<boolean>((): boolean => index.value > 0);
	const canRedo = computed<boolean>((): boolean => index.value < entries.value.length - 1);

	const show = (): void => {
		graph.value = JSON.parse(entries.value[index.value] as string) as IAutomationGraph;
	};

	const commit = (next: IAutomationGraph, coalesceKey?: string): boolean => {
		const serialised = JSON.stringify(next);

		if (serialised === entries.value[index.value]) {
			return false;
		}

		const now = Date.now();

		const continues =
			typeof coalesceKey === 'string' && coalescing !== null && coalescing.key === coalesceKey && now - coalescing.at < COALESCE_WINDOW_MS;

		if (continues && index.value > 0 && entries.value[index.value - 1] === serialised) {
			// Typed back to where the step began: that is no step at all, and what is typed next starts one anew
			// rather than folding into the step before it
			entries.value = entries.value.slice(0, index.value);
			index.value = entries.value.length - 1;
			coalescing = null;

			show();

			return true;
		}

		if (continues && index.value > 0) {
			// Replace the step being typed instead of adding one
			entries.value = [...entries.value.slice(0, index.value), serialised];
		} else {
			// Whatever was undone is gone once something new is done
			entries.value = [...entries.value.slice(0, index.value + 1), serialised].slice(-AUTOMATION_EDITOR_HISTORY_LIMIT);
		}

		index.value = entries.value.length - 1;

		coalescing = typeof coalesceKey === 'string' ? { key: coalesceKey, at: now } : null;

		show();

		return true;
	};

	const undo = (): boolean => {
		if (!canUndo.value) {
			return false;
		}

		index.value -= 1;
		coalescing = null;

		show();

		return true;
	};

	const redo = (): boolean => {
		if (!canRedo.value) {
			return false;
		}

		index.value += 1;
		coalescing = null;

		show();

		return true;
	};

	const reset = (next: IAutomationGraph): void => {
		entries.value = [JSON.stringify(next)];
		index.value = 0;
		coalescing = null;

		show();
	};

	return {
		graph,
		canUndo,
		canRedo,
		commit,
		undo,
		redo,
		reset,
	};
};
