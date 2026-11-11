import { NotificationSeverity } from '../../notifications/notifications.constants';
import { CreateNotificationInput } from '../../notifications/services/notifications.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { abortedSignal, runContext } from '../testing/node-fixtures';

import {
	NOTIFICATION_SEND_NODE_TYPE,
	NotificationSendConfigDto,
	createNotificationSendNodeType,
} from './notification-send.node-type';

describe('notification.send', () => {
	let notify: jest.Mock<Promise<unknown>, [CreateNotificationInput]>;

	const card = () => createNotificationSendNodeType({ notify });

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	const execute = (config: Record<string, unknown>, context = runContext()) =>
		card().execute(config as unknown as NotificationSendConfigDto, context);

	beforeEach(() => {
		notify = jest.fn<Promise<unknown>, [CreateNotificationInput]>(() => Promise.resolve({ id: 'notification-1' }));
	});

	it('is an action with a done and an error output', () => {
		expect(normalizeAutomationNodeType(card())).toMatchObject({
			type: NOTIFICATION_SEND_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
		});
	});

	it('accepts a severity and a title, with or without a message', async () => {
		expect(await problems({ severity: 'info', title: 'Somebody is at the door' })).toEqual([]);
		expect(await problems({ severity: 'critical', title: 'Water leak', message: 'Under the sink.\nNow.' })).toEqual([]);
	});

	it.each([
		['no severity', { title: 'Hello' }, 'severity'],
		['an unknown severity', { severity: 'fatal', title: 'Hello' }, 'severity'],
		['no title', { severity: 'info' }, 'title'],
		['an empty title', { severity: 'info', title: '' }, 'title'],
		['a title that is too long', { severity: 'info', title: 'x'.repeat(121) }, 'title'],
		['a message that is too long', { severity: 'info', title: 'Hello', message: 'x'.repeat(1001) }, 'message'],
		['a message that is not a text', { severity: 'info', title: 'Hello', message: { text: 'Hi' } }, 'message'],
		['a link of its own', { severity: 'info', title: 'Hello', url: 'https://example.com' }, 'url'],
	])('refuses %s', async (_name, config, field) => {
		expect((await problems(config)).map((problem) => problem.field)).toContain(field);
	});

	it('describes its configuration for a form', () => {
		expect(card().configSchema).toMatchObject({
			type: 'object',
			required: ['severity', 'title'],
			additionalProperties: false,
			properties: {
				severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
				title: { type: 'string', minLength: 1, maxLength: 120 },
				message: { type: 'string', maxLength: 1000 },
			},
		});
	});

	it('raises an event of the automations module that leads back to the automation', async () => {
		const result = await execute(
			{ severity: 'warning', title: 'Garage is open', message: 'For more than ten minutes.' },
			runContext({ automationId: 'automation-7' }),
		);

		expect(result).toEqual({ success: true });
		expect(notify).toHaveBeenCalledWith({
			source: AUTOMATIONS_MODULE_NAME,
			kind: 'event',
			severity: NotificationSeverity.WARNING,
			title: 'Garage is open',
			message: 'For more than ten minutes.',
			actions: [{ type: 'link', label: 'Open automation', url: '/automations/automation-7' }],
			data: { automation_id: 'automation-7' },
		});
	});

	it('sends the text as it is written: nothing in it is evaluated', async () => {
		await execute({ severity: 'info', title: 'Value is {{ trigger.to }}', message: '${process.env.SECRET}' });

		expect(notify.mock.calls[0][0]).toMatchObject({
			title: 'Value is {{ trigger.to }}',
			message: '${process.env.SECRET}',
		});
	});

	it('leaves the message out when there is none, and never uses a key', async () => {
		await execute({ severity: 'info', title: 'Hello' });

		expect(notify.mock.calls[0][0]).not.toHaveProperty('message');
		expect(notify.mock.calls[0][0]).not.toHaveProperty('key');
	});

	it('takes the error output when the notification is not accepted', async () => {
		notify.mockResolvedValue(null);

		expect(await execute({ severity: 'info', title: 'Hello' })).toEqual({
			success: false,
			reason: 'The notification was not accepted.',
		});
	});

	it('sends nothing for a run that was cancelled before it got here', async () => {
		expect(await execute({ severity: 'info', title: 'Hello' }, runContext({ signal: abortedSignal() }))).toMatchObject({
			success: false,
		});
		expect(notify).not.toHaveBeenCalled();
	});
});
