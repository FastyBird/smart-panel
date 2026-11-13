import { AutomationsGraphValidationException, AutomationsRevisionConflictException } from '../automations.exceptions';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { abortedSignal, runContext } from '../testing/node-fixtures';

import {
	AUTOMATION_DISABLE_NODE_TYPE,
	AUTOMATION_ENABLED_SET_ATTEMPTS,
	AUTOMATION_ENABLE_NODE_TYPE,
	AutomationStore,
	createAutomationDisableNodeType,
	createAutomationEnableNodeType,
} from './automation-enabled-set.node-type';

const SELF = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0e000001';
const OTHER = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0e000002';

describe('automation.enable and automation.disable', () => {
	let findOne: jest.Mock<ReturnType<AutomationStore['findOne']>, [string]>;
	let update: jest.Mock<Promise<unknown>, [string, { revision: number; enabled: boolean }]>;

	const store = (): AutomationStore => ({ findOne, update });
	const context = (overrides = {}) => runContext({ automationId: SELF, ...overrides });

	beforeEach(() => {
		findOne = jest.fn<ReturnType<AutomationStore['findOne']>, [string]>(() =>
			Promise.resolve({ enabled: false, revision: 3 }),
		);
		update = jest.fn<Promise<unknown>, [string, { revision: number; enabled: boolean }]>(() => Promise.resolve({}));
	});

	it.each([
		[AUTOMATION_ENABLE_NODE_TYPE, createAutomationEnableNodeType],
		[AUTOMATION_DISABLE_NODE_TYPE, createAutomationDisableNodeType],
	])('%s is an action that refers to the other automation', async (type, create) => {
		const registered = normalizeAutomationNodeType(create(store()));

		expect(registered).toMatchObject({ type, kind: 'action', ports: { inputs: ['in'], outputs: ['done', 'error'] } });
		expect(registered.references({ automation_id: OTHER })).toEqual([{ kind: 'automation', id: OTHER }]);
		expect(registered.references({})).toEqual([]);
		expect(await registered.validateConfig({ automation_id: OTHER })).toEqual([]);
		expect(await registered.validateConfig({})).toEqual([
			{ field: 'automation_id', reason: 'An automation must be chosen.' },
		]);
		expect(await registered.validateConfig({ automation_id: OTHER, revision: 1 })).toEqual([
			{ field: 'revision', reason: 'This property is not allowed.' },
		]);
	});

	it('enables the other automation at the revision it was read at', async () => {
		expect(await createAutomationEnableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: true,
		});
		expect(findOne).toHaveBeenCalledWith(OTHER);
		expect(update).toHaveBeenCalledWith(OTHER, { revision: 3, enabled: true });
	});

	it('disables the other automation', async () => {
		findOne.mockResolvedValue({ enabled: true, revision: 8 });

		expect(await createAutomationDisableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: true,
		});
		expect(update).toHaveBeenCalledWith(OTHER, { revision: 8, enabled: false });
	});

	it('leaves an automation that is already as asked alone, so its runs are not cancelled for nothing', async () => {
		expect(await createAutomationDisableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: true,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it.each([
		['enable', createAutomationEnableNodeType],
		['disable', createAutomationDisableNodeType],
	])('does not %s the automation it belongs to', async (verb, create) => {
		expect(await create(store()).execute({ automation_id: SELF }, context())).toEqual({
			success: false,
			reason: `An automation can not ${verb} itself.`,
			refused: true,
		});
		expect(findOne).not.toHaveBeenCalled();
	});

	it('takes the error output for an automation that no longer exists', async () => {
		findOne.mockResolvedValue(null);

		expect(await createAutomationEnableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: false,
			reason: 'The automation no longer exists.',
		});
	});

	it('takes the error output for an automation whose graph can not be enabled', async () => {
		update.mockRejectedValue(
			new AutomationsGraphValidationException('The automation graph cannot be saved: it has 1 problem(s).', []),
		);

		expect(await createAutomationEnableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: false,
			reason: 'The automation graph cannot be saved: it has 1 problem(s).',
		});
	});

	it('reads the automation again when it was saved by somebody else in between', async () => {
		findOne
			.mockResolvedValueOnce({ enabled: false, revision: 3 })
			.mockResolvedValueOnce({ enabled: false, revision: 4 });
		update.mockRejectedValueOnce(new AutomationsRevisionConflictException('changed'));

		expect(await createAutomationEnableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: true,
		});
		expect(update).toHaveBeenLastCalledWith(OTHER, { revision: 4, enabled: true });
	});

	it('gives up on an automation that keeps changing', async () => {
		update.mockRejectedValue(new AutomationsRevisionConflictException('changed'));

		expect(await createAutomationEnableNodeType(store()).execute({ automation_id: OTHER }, context())).toEqual({
			success: false,
			reason: 'The automation kept changing and was not enabled.',
		});
		expect(update).toHaveBeenCalledTimes(AUTOMATION_ENABLED_SET_ATTEMPTS);
	});

	it('does not change the automation when the run is cancelled while it is being read', async () => {
		const controller = new AbortController();
		let answer: (value: { enabled: boolean; revision: number }) => void = () => undefined;

		findOne.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

		const result = createAutomationDisableNodeType(store()).execute(
			{ automation_id: OTHER },
			context({ signal: controller.signal }),
		);

		await Promise.resolve();
		controller.abort();
		answer({ enabled: true, revision: 3 });

		expect(await result).toEqual({
			success: false,
			reason: 'The run was cancelled before the automation was disabled.',
		});
		expect(update).not.toHaveBeenCalled();
	});

	it('does not try again after a conflict when the run was cancelled meanwhile', async () => {
		const controller = new AbortController();

		update.mockImplementationOnce(() => {
			controller.abort();

			return Promise.reject(new AutomationsRevisionConflictException('changed'));
		});

		expect(
			await createAutomationEnableNodeType(store()).execute(
				{ automation_id: OTHER },
				context({ signal: controller.signal }),
			),
		).toEqual({ success: false, reason: 'The run was cancelled before the automation was enabled.' });
		expect(findOne).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('does nothing for a run that was cancelled before it got here', async () => {
		expect(
			await createAutomationEnableNodeType(store()).execute(
				{ automation_id: OTHER },
				context({ signal: abortedSignal() }),
			),
		).toMatchObject({ success: false });
		expect(findOne).not.toHaveBeenCalled();
	});
});
