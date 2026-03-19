import type {
	DeviceConfiguration,
	Orientation,
	PhaseDefinition,
	ReadinessVerdict,
	Status,
	TestDefinition,
	TestSession,
} from './types';

// ── Result key builders ──

export function buildResultKey(configId: string, testId: string, orientation: Orientation): string {
	return `${configId}::${testId}::${orientation}`;
}

export function buildConfigId(deviceId: string, role: string): string {
	return `${deviceId}--${role}`;
}

// ── Status cycle ──

const STATUS_CYCLE: Status[] = ['pending', 'pass', 'fail', 'skip'];

export function nextStatus(current: Status): Status {
	const idx = STATUS_CYCLE.indexOf(current);
	return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// ── Filtering ──

export function getTestsForConfig(
	phase: PhaseDefinition,
	config: DeviceConfiguration,
	selectedIntegrations: string[],
): TestDefinition[] {
	return phase.tests.filter((test) => {
		if (!test.roles.includes(config.role)) return false;
		if (test.requires && !test.requires.every((r) => selectedIntegrations.includes(r))) return false;
		return true;
	});
}

// ── Counting ──

export function countResults(
	results: Record<string, { status: Status }>,
	filterPrefix?: string,
): { total: number; pass: number; fail: number; skip: number; pending: number } {
	const entries = filterPrefix
		? Object.entries(results).filter(([k]) => k.startsWith(filterPrefix + '::'))
		: Object.entries(results);

	const counts = { total: 0, pass: 0, fail: 0, skip: 0, pending: 0 };
	for (const [, r] of entries) {
		counts.total++;
		counts[r.status]++;
	}
	return counts;
}

// ── Readiness verdict ──

export function computeReadiness(session: TestSession, phases: PhaseDefinition[]): ReadinessVerdict {
	const reasons: string[] = [];

	const getPhaseResults = (phaseId: string) =>
		Object.entries(session.results).filter(([k]) => {
			const testId = k.split('::')[1];
			return testId.startsWith(phaseId + '.');
		});

	// Smoke: all must pass
	const smokeResults = getPhaseResults('smoke');
	const smokeNotPassed = smokeResults.filter(([, r]) => r.status !== 'pass');
	if (smokeNotPassed.length > 0) {
		const failed = smokeNotPassed.filter(([, r]) => r.status === 'fail').length;
		const pending = smokeNotPassed.filter(([, r]) => r.status === 'pending').length;
		const skipped = smokeNotPassed.filter(([, r]) => r.status === 'skip').length;
		const parts: string[] = [];
		if (failed > 0) parts.push(`${failed} failed`);
		if (skipped > 0) parts.push(`${skipped} skipped`);
		if (pending > 0) parts.push(`${pending} pending`);
		reasons.push(`Smoke: ${parts.join(', ')} — all must pass`);
	}

	// P0: all must pass on all configs
	const p0Results = getPhaseResults('p0');
	const p0NotPassed = p0Results.filter(([, r]) => r.status !== 'pass');
	if (p0NotPassed.length > 0) {
		const failed = p0NotPassed.filter(([, r]) => r.status === 'fail').length;
		const pending = p0NotPassed.filter(([, r]) => r.status === 'pending').length;
		const skipped = p0NotPassed.filter(([, r]) => r.status === 'skip').length;
		const parts: string[] = [];
		if (failed > 0) parts.push(`${failed} failed`);
		if (skipped > 0) parts.push(`${skipped} skipped`);
		if (pending > 0) parts.push(`${pending} pending`);
		reasons.push(`P0: ${parts.join(', ')} — all must pass`);
	}

	// P1: all must pass
	const p1Results = getPhaseResults('p1');
	const p1NotPassed = p1Results.filter(([, r]) => r.status !== 'pass');
	if (p1NotPassed.length > 0) {
		const failed = p1NotPassed.filter(([, r]) => r.status === 'fail').length;
		const pending = p1NotPassed.filter(([, r]) => r.status === 'pending').length;
		const skipped = p1NotPassed.filter(([, r]) => r.status === 'skip').length;
		const parts: string[] = [];
		if (failed > 0) parts.push(`${failed} failed`);
		if (skipped > 0) parts.push(`${skipped} skipped`);
		if (pending > 0) parts.push(`${pending} pending`);
		reasons.push(`P1: ${parts.join(', ')} — all must pass`);
	}

	// P2: must pass on at least one config (except p2.10 which passes on any)
	const p2Phase = phases.find((p) => p.id === 'p2');
	if (p2Phase) {
		for (const test of p2Phase.tests) {
			const testResults = Object.entries(session.results).filter(([k]) => k.split('::')[1] === test.id);
			if (testResults.length === 0) continue;
			const hasPass = testResults.some(([, r]) => r.status === 'pass');
			if (!hasPass) {
				const allPending = testResults.every(([, r]) => r.status === 'pending');
				const allUntested = testResults.every(([, r]) => r.status === 'skip' || r.status === 'pending');
				const hasFail = testResults.some(([, r]) => r.status === 'fail');
				if (allPending) {
					reasons.push(`${test.id} (${test.name}) not yet tested on any config`);
				} else if (hasFail && !allUntested) {
					reasons.push(`${test.id} (${test.name}) failed on all tested configs`);
				}
			}
		}
	}

	// P3: no blocker (fail on soak or memory)
	const p3Results = getPhaseResults('p3');
	const p3BlockerIds = new Set(['p3.3', 'p3.9']);
	const p3Blockers = p3Results.filter(([k, r]) => {
		const testId = k.split('::')[1];
		return r.status === 'fail' && p3BlockerIds.has(testId);
	});
	if (p3Blockers.length > 0) {
		reasons.push(`P3 blocker: memory leak or soak test failure`);
	}

	return { ready: reasons.length === 0, reasons };
}

// ── Export ──

export function exportAsJson(session: TestSession): void {
	const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `test-results-${session.version}-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function exportAsMarkdown(session: TestSession, phases: PhaseDefinition[]): void {
	const verdict = computeReadiness(session, phases);
	const date = new Date().toISOString().slice(0, 10);

	let md = `# Release Testing Report — ${session.version}\n`;
	md += `**Tester:** ${session.tester} | **Date:** ${date} | **Verdict:** ${verdict.ready ? 'READY' : 'NOT READY'}\n\n`;

	// Summary table
	md += `## Summary\n`;
	md += `| Config | Pass | Fail | Skip | Pending |\n`;
	md += `|--------|------|------|------|--------|\n`;
	for (const config of session.configurations) {
		const counts = countResults(session.results, config.id);
		md += `| ${config.id} | ${counts.pass} | ${counts.fail} | ${counts.skip} | ${counts.pending} |\n`;
	}

	// Blockers
	const failures = Object.entries(session.results).filter(([k, r]) => {
		if (r.status !== 'fail') return false;
		const testId = k.split('::')[1];
		return testId.startsWith('smoke.') || testId.startsWith('p0.') || testId.startsWith('p1.');
	});
	if (failures.length > 0) {
		md += `\n## Blockers\n`;
		for (const [key, result] of failures) {
			const [configId, testId, orientation] = key.split('::');
			const orientLabel = orientation === 'single' ? '' : `, ${orientation}`;
			const note = result.notes ? `: ${result.notes}` : '';
			md += `- **${testId}** (${configId}${orientLabel})${note}\n`;
		}
	}

	// Known limitations (P4 failures + skips)
	const limitations = Object.entries(session.results).filter(
		([k, r]) => (r.status === 'fail' || r.status === 'skip') && k.includes('::p4.'),
	);
	if (limitations.length > 0) {
		md += `\n## Known Limitations\n`;
		for (const [key, result] of limitations) {
			const testId = key.split('::')[1];
			const note = result.notes ? `: ${result.notes}` : '';
			md += `- ${testId}${note}\n`;
		}
	}

	if (!verdict.ready) {
		md += `\n## Release Blockers\n`;
		for (const reason of verdict.reasons) {
			md += `- ${reason}\n`;
		}
	}

	const blob = new Blob([md], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `test-report-${session.version}-${date}.md`;
	a.click();
	URL.revokeObjectURL(url);
}
