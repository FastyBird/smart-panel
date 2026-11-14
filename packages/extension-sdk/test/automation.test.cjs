const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
	AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON,
	AUTOMATION_EXTENSION_NODE_KINDS,
	AUTOMATION_NODE_DEFAULT_PORTS,
	AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS,
	AUTOMATION_NODE_MAX_TIMEOUT_SECONDS,
	checkAutomationConfigKeys,
	defineAutomationAction,
	defineAutomationCondition,
	defineAutomationTrigger,
	isAutomationNodeTypeId,
} = require('../dist');

test('card type identifiers follow the backend rule', () => {
	for (const id of ['acme.doorbell.rang', 'example-extension.signal', 'a_b', 'x1']) assert.ok(isAutomationNodeTypeId(id), id);
	for (const id of ['', 'Upper.case', 'trailing.', '.leading', 'double..dot', 'space here', 'a'.repeat(101), 42, null])
		assert.equal(isAutomationNodeTypeId(id), false, String(id));
});

test('default ports and kinds match what the engine uses, and can not be changed', () => {
	assert.deepEqual(AUTOMATION_EXTENSION_NODE_KINDS, ['trigger', 'condition', 'action']);
	assert.deepEqual(AUTOMATION_NODE_DEFAULT_PORTS, {
		trigger: { inputs: [], outputs: ['out'] },
		condition: { inputs: ['in'], outputs: ['yes', 'no'] },
		action: { inputs: ['in'], outputs: ['done', 'error'] },
	});
	assert.ok(Object.isFrozen(AUTOMATION_NODE_DEFAULT_PORTS));
	for (const ports of Object.values(AUTOMATION_NODE_DEFAULT_PORTS)) {
		assert.ok(Object.isFrozen(ports));
		assert.ok(Object.isFrozen(ports.inputs));
		assert.ok(Object.isFrozen(ports.outputs));
	}
	assert.throws(() => AUTOMATION_NODE_DEFAULT_PORTS.action.outputs.splice(0), TypeError);
	assert.deepEqual(AUTOMATION_NODE_DEFAULT_PORTS.action.outputs, ['done', 'error']);
	assert.ok(Object.isFrozen(AUTOMATION_EXTENSION_NODE_KINDS));
	assert.ok(AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS <= AUTOMATION_NODE_MAX_TIMEOUT_SECONDS);
});

test('the define helpers return the very definition they were given', () => {
	const trigger = { type: 't', kind: 'trigger', name: 'T', description: '', validateConfig: () => [], subscribe: () => () => undefined };
	const condition = { type: 'c', kind: 'condition', name: 'C', description: '', validateConfig: () => [], evaluate: async () => ({ result: true }) };
	const action = { type: 'a', kind: 'action', name: 'A', description: '', validateConfig: () => [], execute: async () => ({ success: true }) };

	assert.equal(defineAutomationTrigger(trigger), trigger);
	assert.equal(defineAutomationCondition(condition), condition);
	assert.equal(defineAutomationAction(action), action);
});

test('configuration keys a card does not declare are refused, one problem per key', () => {
	assert.deepEqual(checkAutomationConfigKeys({ name: 'a' }, ['name', 'seconds']), []);
	assert.deepEqual(checkAutomationConfigKeys({}, ['name']), []);
	assert.deepEqual(checkAutomationConfigKeys({ name: 'a', extra: 1, other: 2 }, ['name']), [
		{ field: 'extra', reason: AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON },
		{ field: 'other', reason: AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON },
	]);

	for (const config of [null, undefined, 'text', 1, ['name']])
		assert.deepEqual(checkAutomationConfigKeys(config, ['name']), [{ reason: 'The configuration must be an object.' }]);
});
