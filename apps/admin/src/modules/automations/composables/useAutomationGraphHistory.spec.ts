import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOMATION_EDITOR_HISTORY_LIMIT } from '../automations.constants';
import type { IAutomationGraph } from '../store/automations.store.types';

import { useAutomationGraphHistory } from './useAutomationGraphHistory';

const graphWith = (...ids: string[]): IAutomationGraph => ({
	version: 1,
	nodes: ids.map((id) => ({ id, type: 'manual.start', position: { x: 0, y: 0 }, config: {} })),
	edges: [],
});

const withTitle = (title: string): IAutomationGraph => ({
	version: 1,
	nodes: [{ id: 'n1', type: 'notification.send', position: { x: 0, y: 0 }, config: { title } }],
	edges: [],
});

describe('useAutomationGraphHistory', (): void => {
	beforeEach((): void => {
		vi.useFakeTimers();
	});

	afterEach((): void => {
		vi.useRealTimers();
	});

	it('starts from the given graph with nothing to undo or redo', (): void => {
		const history = useAutomationGraphHistory(graphWith('a'));

		expect(history.graph.value).toEqual(graphWith('a'));
		expect(history.canUndo.value).toBe(false);
		expect(history.canRedo.value).toBe(false);
		expect(history.undo()).toBe(false);
		expect(history.redo()).toBe(false);
	});

	it('undoes and redoes step by step', (): void => {
		const history = useAutomationGraphHistory(graphWith());

		expect(history.commit(graphWith('a'))).toBe(true);
		expect(history.commit(graphWith('a', 'b'))).toBe(true);

		expect(history.undo()).toBe(true);
		expect(history.graph.value).toEqual(graphWith('a'));
		expect(history.canRedo.value).toBe(true);

		expect(history.undo()).toBe(true);
		expect(history.graph.value).toEqual(graphWith());
		expect(history.canUndo.value).toBe(false);

		expect(history.redo()).toBe(true);
		expect(history.redo()).toBe(true);
		expect(history.graph.value).toEqual(graphWith('a', 'b'));
		expect(history.canRedo.value).toBe(false);
	});

	it('ignores a commit that changes nothing', (): void => {
		const history = useAutomationGraphHistory(graphWith('a'));

		expect(history.commit(graphWith('a'))).toBe(false);
		expect(history.canUndo.value).toBe(false);
	});

	it('forgets what was undone once something new is done', (): void => {
		const history = useAutomationGraphHistory(graphWith());

		history.commit(graphWith('a'));
		history.commit(graphWith('a', 'b'));
		history.undo();
		history.commit(graphWith('a', 'c'));

		expect(history.canRedo.value).toBe(false);

		history.undo();

		expect(history.graph.value).toEqual(graphWith('a'));
	});

	it('hands out a copy, so a later change of the committed graph does not rewrite history', (): void => {
		const history = useAutomationGraphHistory(graphWith());
		const committed = graphWith('a');

		history.commit(committed);

		committed.nodes[0]!.position.x = 500;

		expect(history.graph.value.nodes[0]!.position.x).toBe(0);
	});

	it('takes quick edits of one field as one step', (): void => {
		const history = useAutomationGraphHistory(withTitle(''));

		history.commit(withTitle('H'), 'config:n1:title');
		vi.advanceTimersByTime(200);
		history.commit(withTitle('He'), 'config:n1:title');
		vi.advanceTimersByTime(200);
		history.commit(withTitle('Hello'), 'config:n1:title');

		expect(history.graph.value).toEqual(withTitle('Hello'));

		history.undo();

		expect(history.graph.value).toEqual(withTitle(''));
		expect(history.canUndo.value).toBe(false);
	});

	it('starts a new step after a pause, for another field, or after an undo', (): void => {
		const history = useAutomationGraphHistory(withTitle(''));

		history.commit(withTitle('a'), 'config:n1:title');
		vi.advanceTimersByTime(1500);
		history.commit(withTitle('ab'), 'config:n1:title');
		history.commit(withTitle('abc'), 'config:n1:message');

		history.undo();
		expect(history.graph.value).toEqual(withTitle('ab'));

		// The step restored by the undo is not the one being typed any more
		history.commit(withTitle('abx'), 'config:n1:title');
		history.undo();
		expect(history.graph.value).toEqual(withTitle('ab'));

		history.undo();
		expect(history.graph.value).toEqual(withTitle('a'));

		history.undo();
		expect(history.graph.value).toEqual(withTitle(''));
	});

	it('never folds an edit into the starting point', (): void => {
		const history = useAutomationGraphHistory(withTitle(''));

		history.commit(withTitle('a'), 'config:n1:title');
		history.undo();
		history.redo();
		history.undo();

		expect(history.graph.value).toEqual(withTitle(''));
	});

	it('keeps a limited number of steps', (): void => {
		const history = useAutomationGraphHistory(graphWith());

		for (let index = 0; index < AUTOMATION_EDITOR_HISTORY_LIMIT + 20; index += 1) {
			history.commit(graphWith(`n${index}`));
		}

		let steps = 0;

		while (history.undo()) {
			steps += 1;
		}

		expect(steps).toBe(AUTOMATION_EDITOR_HISTORY_LIMIT - 1);
	});

	it('starts over on reset', (): void => {
		const history = useAutomationGraphHistory(graphWith());

		history.commit(graphWith('a'));
		history.reset(graphWith('x', 'y'));

		expect(history.graph.value).toEqual(graphWith('x', 'y'));
		expect(history.canUndo.value).toBe(false);
		expect(history.canRedo.value).toBe(false);
	});
});
