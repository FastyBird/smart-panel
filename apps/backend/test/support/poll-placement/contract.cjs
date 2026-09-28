// Private diagnostic wire contract. No device calls or service control.
const canonicalConfig = (config, fail) => {
	if (![1, 2].includes(config.schemaVersion)) fail('unsupported-schema');
	const durationMs = config.durationMs === undefined ? 180000 : config.durationMs;
	if (!Number.isInteger(durationMs) || durationMs < 1000 || durationMs > 360000) fail('duration-invalid');
	const result = {
		schemaVersion: config.schemaVersion,
		runId: config.runId,
		sourceDeviceId: config.sourceDeviceId,
		exportPath: config.exportPath,
		durationMs,
	};
	if (config.schemaVersion === 2) {
		result.preparationMs = config.preparationMs === undefined ? 600000 : config.preparationMs;
		if (!Number.isInteger(result.preparationMs) || result.preparationMs < 1000 || result.preparationMs > 600000)
			fail('preparation-duration-invalid');
	}
	return result;
};

const validatePair = (pair, schemaVersion, fail) => {
	if (pair[1].cycleSequence !== pair[0].cycleSequence + 1) fail('cycles-not-adjacent');
	if (
		pair.some(
			(entry) =>
				!Number.isInteger(entry.generation) ||
				entry.generation !== pair[0].generation ||
				entry.intervalMs !== pair[0].intervalMs ||
				!entry.delegateOrderFingerprint ||
				entry.delegateOrderFingerprint !== pair[0].delegateOrderFingerprint,
		)
	)
		fail('cycle-consistency-failed');
	if (schemaVersion === 2 && pair[0].attachmentRevision !== pair[1].attachmentRevision)
		fail('target-attachment-changed');
	const firstTarget = pair[0].target;
	if (
		pair.some(
			(entry) =>
				entry.target?.delegateId !== firstTarget?.delegateId ||
				entry.target?.slotIndex !== firstTarget?.slotIndex ||
				entry.target?.generation !== firstTarget?.generation,
		)
	)
		fail('target-consistency-failed');
	for (const entry of pair) {
		const target = entry.target;
		if (!Number.isInteger(entry.intervalMs) || entry.intervalMs <= 0) fail('interval-invalid');
		if (
			!target ||
			target.connected !== true ||
			!target.delegateId ||
			!Number.isInteger(target.slotIndex) ||
			target.slotIndex < 0
		)
			fail('target-unresolved');
		if (!Number.isInteger(entry.connectedDelegateCount) || target.slotIndex >= entry.connectedDelegateCount)
			fail('target-slot-out-of-range');
		if (target.decision === 'skipped') fail(`target-slot-skipped:${target.skipReason ?? 'unknown'}`);
		if (target.decision !== 'dispatch-attempt') fail('target-decision-not-observed');
		if (
			!Number.isFinite(target.delayMs) ||
			target.delayMs < 0 ||
			!Number.isFinite(target.registrationBeforeMs) ||
			!Number.isFinite(target.registrationAfterMs) ||
			target.registrationAfterMs < target.registrationBeforeMs ||
			typeof target.registrationBeforeUtc !== 'string' ||
			typeof target.registrationAfterUtc !== 'string' ||
			!Number.isFinite(Date.parse(target.registrationBeforeUtc)) ||
			!Number.isFinite(Date.parse(target.registrationAfterUtc)) ||
			Date.parse(target.registrationAfterUtc) < Date.parse(target.registrationBeforeUtc)
		)
			fail('registration-bounds-invalid');
		const expectedDelayMs = Math.floor((target.slotIndex * entry.intervalMs) / entry.connectedDelegateCount);
		if (!Number.isSafeInteger(expectedDelayMs) || target.delayMs !== expectedDelayMs) fail('slot-delay-mismatch');
		const monotonicDelta = target.registrationAfterMs - target.registrationBeforeMs;
		const utcDelta = Date.parse(target.registrationAfterUtc) - Date.parse(target.registrationBeforeUtc);
		if (Math.abs(monotonicDelta - utcDelta) > 2000) fail('registration-clock-mismatch');
	}
};

const validateLifecycle = (snapshot, config, fail) => {
	if (snapshot.schemaVersion === 1) return;
	const preparation = snapshot.preparation;
	if (
		!preparation ||
		!Number.isFinite(preparation.createdAtMonotonicMs) ||
		!Number.isFinite(Date.parse(preparation.createdAtUtc)) ||
		preparation.deadlineMonotonicMs !== preparation.createdAtMonotonicMs + config.preparationMs
	)
		fail('preparation-metadata-invalid');
	if (snapshot.status === 'preparing') fail('snapshot-preparing');
	if (
		!Number.isFinite(snapshot.armedAtMonotonicMs) ||
		!Number.isFinite(Date.parse(snapshot.armedAtUtc)) ||
		snapshot.armedAtMonotonicMs < preparation.createdAtMonotonicMs ||
		snapshot.armedAtMonotonicMs >= preparation.deadlineMonotonicMs ||
		snapshot.expiresAtMonotonicMs !== snapshot.armedAtMonotonicMs + config.durationMs
	)
		fail('activation-metadata-invalid');
	const ids = preparation.activationCycles;
	if (!Array.isArray(ids) || ids.length !== 2 || !Number.isInteger(ids[0]) || ids[1] !== ids[0] + 1)
		fail('activation-cycles-invalid');
	const observations = snapshot.observations;
	if (!Array.isArray(observations) || observations.length > 64) fail('observations-invalid');
	const pair = ids.map((id) => observations.find((entry) => entry.cycleSequence === id));
	const first = pair[0];
	if (
		!first ||
		pair.some(
			(entry) =>
				!entry ||
				entry.phase !== 'preparation' ||
				entry.generation !== first.generation ||
				entry.intervalMs !== first.intervalMs ||
				entry.delegateOrderFingerprint !== first.delegateOrderFingerprint ||
				!Number.isInteger(entry.attachmentRevision) ||
				entry.attachmentRevision !== first.attachmentRevision ||
				entry.target?.delegateId !== first.target?.delegateId ||
				entry.target?.slotIndex !== first.target?.slotIndex ||
				entry.target?.generation !== first.target?.generation ||
				entry.target?.connected !== true ||
				entry.target?.decision !== 'dispatch-attempt' ||
				!Number.isFinite(entry.target?.registrationAfterMs) ||
				!Number.isFinite(entry.target?.decisionMonotonicMs) ||
				entry.target.decisionMonotonicMs < entry.anchorMonotonicMs ||
				entry.target.decisionMonotonicMs > snapshot.armedAtMonotonicMs ||
				entry.target.registrationAfterMs > snapshot.armedAtMonotonicMs ||
				entry.anchorMonotonicMs < preparation.createdAtMonotonicMs ||
				entry.anchorMonotonicMs > snapshot.armedAtMonotonicMs,
		)
	)
		fail('activation-evidence-invalid');
	validatePair(pair, 2, fail);
	if (pair[1].anchorMonotonicMs <= first.anchorMonotonicMs) fail('activation-order-invalid');
	for (const entry of observations) {
		const beforeActivation = entry.cycleSequence <= ids[1];
		if (
			entry.phase !== (beforeActivation ? 'preparation' : 'measurement') ||
			(beforeActivation
				? entry.anchorMonotonicMs > snapshot.armedAtMonotonicMs
				: entry.anchorMonotonicMs < snapshot.armedAtMonotonicMs)
		)
			fail('observation-phase-invalid');
	}
};
module.exports = { canonicalConfig, validateLifecycle, validatePair };
