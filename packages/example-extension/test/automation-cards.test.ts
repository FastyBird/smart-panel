import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { AUTOMATION_NODE_DEFAULT_PORTS, isAutomationNodeTypeId } from '@fastybird/smart-panel-extension-sdk';
import type { AutomationRunContext, AutomationTriggerData } from '@fastybird/smart-panel-extension-sdk';

import {
	EXAMPLE_AUTOMATION_OWNER,
	EXAMPLE_RECENT_MAX_SECONDS,
	ExampleSignals,
	createExampleAutomationNodeTypes,
} from '../src/automation-cards.ts';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from '../src/example-extension.constants.ts';

const context = (signal: AbortSignal = new AbortController().signal): AutomationRunContext => ({
	automationId: 'automation-1',
	runId: 'run-1',
	nodeId: 'node-1',
	signal,
	trigger: { nodeId: 't', data: {}, manual: false },
});

describe('example automation cards', () => {
	let now: number;
	let signals: ExampleSignals;
	let cards: ReturnType<typeof createExampleAutomationNodeTypes>;

	beforeEach(() => {
		now = 1_000_000;
		signals = new ExampleSignals(() => now);
		cards = createExampleAutomationNodeTypes(signals);
	});

	it('provides one card of each kind, owned by the plugin, with identifiers the backend accepts', () => {
		assert.deepEqual([cards.trigger.kind, cards.condition.kind, cards.action.kind], ['trigger', 'condition', 'action']);

		for (const card of [cards.trigger, cards.condition, cards.action]) {
			assert.ok(isAutomationNodeTypeId(card.type), card.type);
			assert.ok(card.type.startsWith(`${EXAMPLE_EXTENSION_PLUGIN_NAME}.`), card.type);
			assert.deepEqual(card.owner, { kind: 'plugin', type: EXAMPLE_EXTENSION_PLUGIN_NAME });
			// The default ports of the kind; the generic form is built from the schema
			assert.equal(card.ports, undefined);
			assert.equal(card.configSchema?.type, 'object');
			assert.equal(card.configSchema?.additionalProperties, false);
		}

		assert.equal(EXAMPLE_AUTOMATION_OWNER, cards.action.owner);
		assert.deepEqual(AUTOMATION_NODE_DEFAULT_PORTS.trigger.inputs, []);
	});

	describe('validation', () => {
		it('accepts a complete configuration', async () => {
			assert.deepEqual(await cards.trigger.validateConfig({ signal: 'door.bell' }), []);
			assert.deepEqual(await cards.condition.validateConfig({ signal: 'door.bell', within_seconds: 60 }), []);
			assert.deepEqual(await cards.action.validateConfig({ signal: 'door.bell' }), []);
		});

		it('names the field of every problem and refuses keys the card does not declare', async () => {
			assert.deepEqual(await cards.trigger.validateConfig({}), [
				{ field: 'signal', reason: 'A signal name is needed.' },
			]);
			assert.deepEqual(
				(await cards.action.validateConfig({ signal: 'Not Valid', extra: true })).map((problem) => problem.field),
				['extra', 'signal'],
			);

			for (const within of [0, 1.5, EXAMPLE_RECENT_MAX_SECONDS + 1, '60', undefined]) {
				assert.deepEqual(
					(await cards.condition.validateConfig({ signal: 'door.bell', within_seconds: within })).map(
						(problem) => problem.field,
					),
					['within_seconds'],
					String(within),
				);
			}
		});

		it('checks every field its schema declares as required, with its type', async () => {
			const complete: Record<string, Record<string, unknown>> = {
				trigger: { signal: 'door.bell' },
				condition: { signal: 'door.bell', within_seconds: 60 },
				action: { signal: 'door.bell' },
			};

			for (const [kind, card] of Object.entries(cards)) {
				const required = card.configSchema?.required;

				assert.ok(Array.isArray(required) && required.length > 0, kind);

				for (const key of required as string[]) {
					const missing = Object.fromEntries(Object.entries(complete[kind]).filter(([name]) => name !== key));

					for (const config of [missing, { ...complete[kind], [key]: { wrong: 'type' } }]) {
						assert.deepEqual(
							(await card.validateConfig(config)).map((problem) => problem.field),
							[key],
							`${kind}.${key}`,
						);
					}
				}
			}
		});

		it('never repeats the submitted value in a reason', async () => {
			const problems = await cards.trigger.validateConfig({ signal: 'SECRET-VALUE' });

			assert.equal(problems.length, 1);
			assert.ok(!problems[0].reason.includes('SECRET-VALUE'));
		});
	});

	describe('trigger', () => {
		it('fires for its own signal only and stops when released', () => {
			const fired: AutomationTriggerData[] = [];
			const release = cards.trigger.subscribe({ signal: 'door.bell' }, (data) => fired.push(data));

			signals.send('door.bell');
			signals.send('other');

			assert.deepEqual(fired, [{ signal: 'door.bell' }]);
			assert.equal(signals.listenerCount, 1);

			release();
			signals.send('door.bell');

			assert.equal(fired.length, 1);
			assert.equal(signals.listenerCount, 0);
		});
	});

	describe('condition', () => {
		const config = { signal: 'door.bell', within_seconds: 60 };

		it('is "no" for a signal that was never received', async () => {
			assert.deepEqual(await cards.condition.evaluate(config, context()), {
				result: false,
				observed: null,
				reason: 'The signal was not received yet.',
			});
		});

		it('is "yes" within the time and "no" after it', async () => {
			signals.send('door.bell');
			now += 60_000;

			assert.equal((await cards.condition.evaluate(config, context())).result, true);

			now += 1;

			assert.equal((await cards.condition.evaluate(config, context())).result, false);
		});
	});

	describe('action', () => {
		it('declares that it does nothing to the home', () => {
			assert.deepEqual(cards.action.commands?.({ signal: 'door.bell' }), []);
			// It is asked with configurations that were not validated, and must not throw
			assert.deepEqual(cards.action.commands?.({} as never), []);
		});

		it('sends its signal, which the trigger hears', async () => {
			const fired: AutomationTriggerData[] = [];

			cards.trigger.subscribe({ signal: 'door.bell' }, (data) => fired.push(data));

			assert.deepEqual(await cards.action.execute({ signal: 'door.bell' }, context()), { success: true });
			assert.deepEqual(fired, [{ signal: 'door.bell' }]);
			assert.equal(signals.age('door.bell'), 0);
		});

		it('does nothing in a run that was cancelled', async () => {
			const controller = new AbortController();

			controller.abort();

			assert.deepEqual(await cards.action.execute({ signal: 'door.bell' }, context(controller.signal)), {
				success: false,
				reason: 'The run was cancelled.',
			});
			assert.equal(signals.age('door.bell'), null);
		});
	});

	it('keeps sending a signal to the other listeners when one of them throws', () => {
		const heard: string[] = [];

		signals.listen(() => {
			throw new Error('broken');
		});
		signals.listen((signal) => heard.push(signal));

		signals.send('door.bell');

		assert.deepEqual(heard, ['door.bell']);
	});
});
