import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { abortedSignal, runContext } from '../testing/node-fixtures';

import {
	AUTOMATION_RUN_NODE_TYPE,
	AutomationRunOutcome,
	createAutomationRunNodeType,
} from './automation-run.node-type';

const SELF = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0e000001';
const OTHER = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0e000002';

describe('automation.run', () => {
	let triggerOrThrow: jest.Mock<Promise<AutomationRunOutcome>, [string]>;

	const card = () => createAutomationRunNodeType({ triggerOrThrow });
	const execute = (automationId = OTHER, context = runContext({ automationId: SELF })) =>
		card().execute({ automation_id: automationId }, context);

	beforeEach(() => {
		triggerOrThrow = jest.fn<Promise<AutomationRunOutcome>, [string]>(() =>
			Promise.resolve({ outcome: 'started', runId: 'run-2' } as AutomationRunOutcome),
		);
	});

	it('is an action that refers to the other automation', async () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({ type: AUTOMATION_RUN_NODE_TYPE, kind: 'action' });
		expect(registered.references({ automation_id: OTHER })).toEqual([{ kind: 'automation', id: OTHER }]);
		expect(await registered.validateConfig({ automation_id: 'evening' })).toEqual([
			{ field: 'automation_id', reason: 'An automation must be chosen.' },
		]);
	});

	it('starts a run of the other automation the way a manual run does', async () => {
		expect(await execute()).toEqual({ success: true });
		expect(triggerOrThrow).toHaveBeenCalledWith(OTHER);
	});

	it('does not run the automation it belongs to', async () => {
		expect(await execute(SELF)).toEqual({ success: false, reason: 'An automation can not run itself.', refused: true });
		expect(triggerOrThrow).not.toHaveBeenCalled();
	});

	it('takes the error output when no run was started', async () => {
		triggerOrThrow.mockResolvedValueOnce({ outcome: 'ignored', reason: 'A run is already active.' });

		expect(await execute()).toEqual({ success: false, reason: 'A run is already active.' });

		triggerOrThrow.mockRejectedValueOnce(
			new AutomationsNotTriggerableException('The automation is disabled.', 'disabled'),
		);

		expect(await execute()).toEqual({ success: false, reason: 'The automation is disabled.' });

		triggerOrThrow.mockRejectedValueOnce(
			new AutomationsNotFoundException(`Automation with id=${OTHER} was not found.`),
		);

		expect(await execute()).toEqual({ success: false, reason: `Automation with id=${OTHER} was not found.` });
	});

	it('does not start anything for a run that was cancelled before it got here', async () => {
		expect(await execute(OTHER, runContext({ automationId: SELF, signal: abortedSignal() }))).toMatchObject({
			success: false,
		});
		expect(triggerOrThrow).not.toHaveBeenCalled();
	});
});
