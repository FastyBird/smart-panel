import { RunRecord, RunStep } from '../engine/run-walker';

import {
	AUTOMATION_RUN_TRACE_VALUE_OMITTED,
	createAutomationRunStepModel,
	createAutomationRunTraceModel,
} from './automation-run-trace.model';

describe('automation run trace model', () => {
	const AT = Date.UTC(2026, 10, 11, 7, 30);

	const step = (seq: number, overrides: Partial<RunStep> = {}): RunStep => ({
		seq,
		at: AT + seq,
		elapsedMs: seq,
		nodeId: `n${seq}`,
		type: 'test.action',
		kind: 'action',
		via: `e${seq}`,
		state: 'done',
		...overrides,
	});

	const record = (steps: RunStep[], data: Record<string, unknown> = {}): Pick<RunRecord, 'trigger' | 'steps'> => ({
		trigger: { nodeId: 't', data, manual: true },
		steps,
	});

	describe('a step', () => {
		it('records what a condition observed and the output it took', () => {
			expect(
				createAutomationRunStepModel(
					step(1, {
						kind: 'condition',
						type: 'device.property.compare',
						output: 'no',
						observed: { value: 3, online: false },
						reason: 'The device is offline.',
					}),
				),
			).toEqual({
				seq: 1,
				at: new Date(AT + 1).toISOString(),
				elapsed_ms: 1,
				node_id: 'n1',
				type: 'device.property.compare',
				kind: 'condition',
				via: 'e1',
				state: 'done',
				output: 'no',
				observed: { value: 3, online: false },
				reason: 'The device is offline.',
			});
		});

		it('keeps an observed value that is null or false: unknown is recorded, not left out', () => {
			expect(createAutomationRunStepModel(step(1, { observed: null }))).toHaveProperty('observed', null);
			expect(createAutomationRunStepModel(step(1, { observed: false }))).toHaveProperty('observed', false);
			expect(createAutomationRunStepModel(step(1))).not.toHaveProperty('observed');
		});

		it('records what an action answered, and that it was refused or timed out', () => {
			expect(
				createAutomationRunStepModel(
					step(2, {
						output: 'error',
						result: { success: false, reason: 'An automation can not unlock.', refused: true },
						reason: 'An automation can not unlock.',
						refused: true,
					}),
				),
			).toMatchObject({
				output: 'error',
				result: { success: false, reason: 'An automation can not unlock.', refused: true },
				refused: true,
			});

			const timedOut = createAutomationRunStepModel(
				step(3, { output: 'error', result: { success: false }, timedOut: true, afterCancel: true }),
			);

			expect(timedOut).toMatchObject({ result: { success: false }, timed_out: true, after_cancel: true });
			expect(timedOut.result).toEqual({ success: false });
			expect(timedOut).not.toHaveProperty('refused');
		});

		it('records how long a Delay parks the run for', () => {
			expect(
				createAutomationRunStepModel(step(1, { kind: 'flow', type: 'flow.delay', state: 'parked', delayMs: 60_000 })),
			).toEqual({
				seq: 1,
				at: new Date(AT + 1).toISOString(),
				elapsed_ms: 1,
				node_id: 'n1',
				type: 'flow.delay',
				kind: 'flow',
				via: 'e1',
				state: 'parked',
				delay_ms: 60_000,
			});
		});
	});

	describe('a trace', () => {
		it('holds the trigger and the steps in the order of the run', () => {
			const trace = createAutomationRunTraceModel(
				record([step(1, { output: 'done' }), step(2, { output: 'error' })], { property_id: 'p', value: true }),
			);

			expect(trace).toMatchObject({
				trigger: { node_id: 't', manual: true, data: { property_id: 'p', value: true } },
				steps: [
					{ seq: 1, node_id: 'n1', output: 'done' },
					{ seq: 2, node_id: 'n2', output: 'error' },
				],
				truncated: false,
			});
		});

		it('does not share anything with the record, so a later change of the run does not reach it', () => {
			const steps = [step(1, { state: 'parked' })];
			const trace = createAutomationRunTraceModel(record(steps));

			steps[0].state = 'done';
			steps.push(step(2));

			expect(trace.steps).toEqual([expect.objectContaining({ state: 'parked' })]);
		});

		it('replaces a value that is too large by a note and says so', () => {
			const trace = createAutomationRunTraceModel(
				record([step(1, { observed: 'x'.repeat(100) }), step(2, { observed: 'short' })], { blob: 'y'.repeat(100) }),
				{ valueMaxLength: 50 },
			);

			expect(trace.trigger.data).toEqual({ note: AUTOMATION_RUN_TRACE_VALUE_OMITTED });
			expect(trace.steps.map((item) => item.observed)).toEqual([AUTOMATION_RUN_TRACE_VALUE_OMITTED, 'short']);
			expect(trace.truncated).toBe(true);
		});

		it('leaves out the last steps of a trace that is too long, and never stores more than the limit', () => {
			const steps = Array.from({ length: 200 }, (_, index) => step(index + 1, { reason: 'r'.repeat(40) }));
			const trace = createAutomationRunTraceModel(record(steps), { maxLength: 4000 });

			expect(trace.truncated).toBe(true);
			expect(trace.steps.length).toBeGreaterThan(0);
			expect(trace.steps.length).toBeLessThan(200);
			expect(trace.steps.map((item) => item.seq)).toEqual(trace.steps.map((_, index) => index + 1));
			expect(JSON.stringify(trace).length).toBeLessThanOrEqual(4000);
		});

		it('keeps the longest run a walker can produce within the default limit or marks it', () => {
			const steps = Array.from({ length: 1000 }, (_, index) =>
				step(index + 1, { output: 'done', result: { success: true } }),
			);
			const trace = createAutomationRunTraceModel(record(steps));

			expect(JSON.stringify(trace).length).toBeLessThanOrEqual(128 * 1024);
			expect(trace.truncated).toBe(trace.steps.length < 1000);
		});

		it('survives a value that can not be serialised', () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;

			const trace = createAutomationRunTraceModel(record([step(1, { observed: circular })]));

			expect(trace.steps[0].observed).toBe(AUTOMATION_RUN_TRACE_VALUE_OMITTED);
			expect(trace.truncated).toBe(true);
		});
	});
});
