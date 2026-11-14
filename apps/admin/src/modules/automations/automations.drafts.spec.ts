import { describe, expect, it } from 'vitest';

import { AutomationMode } from './automations.constants';
import { discardAutomationDraft, peekAutomationDraft, stashAutomationDraft, takeAutomationDraft } from './automations.drafts';

const id = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';

const draft = () => ({
	name: 'Leak alarm',
	mode: AutomationMode.restart,
	graph: { version: 1, nodes: [{ id: 'n1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} }], edges: [] },
});

describe('automation drafts', () => {
	it('hands a draft over once and keeps copies, so changing one changes nothing held', () => {
		const stashed = draft();

		stashAutomationDraft(id, stashed);

		stashed.graph.nodes = [];

		const peeked = peekAutomationDraft(id);

		expect(peeked).toEqual(draft());

		peeked!.graph.nodes = [];

		expect(takeAutomationDraft(id)).toEqual(draft());
		expect(takeAutomationDraft(id)).toBeNull();
		expect(peekAutomationDraft(id)).toBeNull();
	});

	it('forgets a discarded draft', () => {
		stashAutomationDraft(id, draft());

		discardAutomationDraft(id);

		expect(takeAutomationDraft(id)).toBeNull();
	});
});
