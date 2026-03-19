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
	const smokeFailures = smokeResults.filter(([, r]) => r.status === 'fail');
	if (smokeFailures.length > 0) {
		reasons.push(`${smokeFailures.length} smoke test(s) failed — must all pass before Phase 2`);
	}
	const smokePending = smokeResults.filter(([, r]) => r.status === 'pending');
	if (smokePending.length > 0) {
		reasons.push(`${smokePending.length} smoke test(s) still pending`);
	}

	// P0: all must pass on all configs
	const p0Results = getPhaseResults('p0');
	const p0Failures = p0Results.filter(([, r]) => r.status === 'fail');
	if (p0Failures.length > 0) {
		reasons.push(`${p0Failures.length} P0 test(s) failed — must all pass`);
	}
	const p0Pending = p0Results.filter(([, r]) => r.status === 'pending');
	if (p0Pending.length > 0) {
		reasons.push(`${p0Pending.length} P0 test(s) still pending`);
	}

	// P1: all must pass
	const p1Results = getPhaseResults('p1');
	const p1Failures = p1Results.filter(([, r]) => r.status === 'fail');
	if (p1Failures.length > 0) {
		reasons.push(`${p1Failures.length} P1 visual test(s) failed`);
	}
	const p1Pending = p1Results.filter(([, r]) => r.status === 'pending');
	if (p1Pending.length > 0) {
		reasons.push(`${p1Pending.length} P1 visual test(s) still pending`);
	}

	// P2: must pass on at least one config (except p2.10 which passes on any)
	const p2Phase = phases.find((p) => p.id === 'p2');
	if (p2Phase) {
		for (const test of p2Phase.tests) {
			const testResults = Object.entries(session.results).filter(([k]) => k.split('::')[1] === test.id);
			if (testResults.length === 0) continue;
			const hasPass = testResults.some(([, r]) => r.status === 'pass');
			if (!hasPass) {
				const allSkipped = testResults.every(([, r]) => r.status === 'skip' || r.status === 'pending');
				if (!allSkipped) {
					reasons.push(`${test.id} (${test.name}) failed on all tested configs`);
				}
			}
		}
	}

	// P3: no blocker (fail on soak or memory)
	const p3Results = getPhaseResults('p3');
	const p3Blockers = p3Results.filter(([k, r]) => r.status === 'fail' && (k.includes('p3.3') || k.includes('p3.9')));
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
	const failures = Object.entries(session.results).filter(
		([k, r]) => r.status === 'fail' && (k.includes('::p0.') || k.includes('::p1.')),
	);
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
