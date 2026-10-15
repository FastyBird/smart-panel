const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
	snapshotNumericOperator,
	validateNumericOperatorParameters,
	isSmartPanelBackendExtensionManifest,
} = require('../dist');
const definition = () => ({
	contractVersion: 1,
	name: 'offset',
	operatorVersion: 1,
	input: { quantity: 'temperature', unit: '°C' },
	output: { quantity: 'temperature', unit: '°C' },
	inputRange: { minimum: -40, maximum: 100 },
	outputRange: { minimum: -50, maximum: 110 },
	parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
	evaluate: (n, p) => n + p.offset,
});
test('descriptors and validated numeric parameters are detached and frozen', () => {
	const raw = definition(),
		snapshot = snapshotNumericOperator(raw);
	raw.parameters.offset.minimum = 99;
	assert.equal(snapshot.parameters.offset.minimum, -10);
	assert.ok(Object.isFrozen(snapshot.parameters.offset));
	assert.ok(Object.isFrozen(snapshot.input));
	const params = { offset: 2 },
		validated = validateNumericOperatorParameters(snapshot, params);
	params.offset = 3;
	assert.equal(validated.offset, 2);
	assert.ok(Object.isFrozen(validated));
});
test('reject unsupported contracts, names, versions, measurements, domains and parameter schemas', () => {
	for (const patch of [
		{ contractVersion: 2 },
		{ name: 'Upper' },
		{ operatorVersion: 0 },
		{ operatorVersion: 1.5 },
		{ input: { quantity: 'arbitrary', unit: 'foo' } },
		{ inputRange: { minimum: 0, maximum: Infinity } },
		{ parameters: { flag: { required: true, minimum: false, maximum: true } } },
		{ protection: true },
	])
		assert.throws(() => snapshotNumericOperator({ ...definition(), ...patch }));
});
test('reject nonnumeric, unknown, missing and out of bounds parameters', () => {
	const d = snapshotNumericOperator(definition());
	for (const p of [
		{},
		{ offset: 1, typo: 1 },
		{ offset: true },
		{ offset: NaN },
		{ offset: Infinity },
		{ offset: 11 },
		[],
	])
		assert.throws(() => validateNumericOperatorParameters(d, p));
	assert.equal(validateNumericOperatorParameters(d, { offset: -10 }).offset, -10);
});
test('manifest numeric opt-in requires both explicit fields', () => {
	const m = { kind: 'plugin', routePrefix: 'different-route', extensionExport: 'Module' };
	assert.equal(isSmartPanelBackendExtensionManifest(m), true);
	assert.equal(isSmartPanelBackendExtensionManifest({ ...m, configOwnerType: 'owner' }), false);
	assert.equal(
		isSmartPanelBackendExtensionManifest({ ...m, numericOperatorsExport: 'operators', configOwnerType: 'owner' }),
		true,
	);
});
