import type { TestPlanYaml, TestSession } from '../types';
import { computeReadiness, countResults, exportAsJson, exportAsMarkdown } from '../utils';

interface ResultsSummaryProps {
	session: TestSession;
	testPlan: TestPlanYaml;
	onBack: () => void;
	onReset: () => void;
}

export function ResultsSummary({ session, testPlan, onBack, onReset }: ResultsSummaryProps) {
	const verdict = computeReadiness(session, testPlan.phases);

	// Collect smoke, P0 and P1 failures (blockers)
	const blockers = Object.entries(session.results).filter(([key, result]) => {
		if (result.status !== 'fail') return false;
		const testId = key.split('::')[1] ?? '';
		return testId.startsWith('smoke.') || testId.startsWith('p0.') || testId.startsWith('p1.');
	});

	// Collect P4 failures and skips (known limitations)
	const limitations = Object.entries(session.results).filter(([key, result]) => {
		const testId = key.split('::')[1] ?? '';
		return testId.startsWith('p4.') && (result.status === 'fail' || result.status === 'skip');
	});

	// Find test name by test ID
	const getTestName = (testId: string): string => {
		for (const phase of testPlan.phases) {
			const found = phase.tests.find((t) => t.id === testId);
			if (found) return found.name;
		}
		return testId;
	};

	return (
		<div className="min-h-screen bg-panel-bg text-panel-text flex flex-col">
			{/* Top Bar */}
			<div className="bg-panel-surface border-b border-panel-border px-4 py-3 flex items-center gap-3 shrink-0">
				<button
					onClick={onBack}
					className="text-xs font-mono text-panel-dim hover:text-panel-text cursor-pointer"
				>
					← Back to Testing
				</button>
				<div className="flex-1" />
				<span className="text-sm font-mono text-panel-muted">{session.version}</span>
				<span className="text-panel-border text-xs">|</span>
				<span className="text-xs text-panel-dim">{session.tester}</span>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
				{/* Readiness Verdict Banner */}
				<div
					className={`rounded-lg p-6 mb-6 border ${
						verdict.ready ? 'bg-status-pass-bg border-status-pass' : 'bg-status-fail-bg border-status-fail'
					}`}
				>
					<div className="flex items-center gap-3">
						<span className={`text-3xl font-mono font-bold ${verdict.ready ? 'text-status-pass' : 'text-status-fail'}`}>
							{verdict.ready ? 'READY' : 'NOT READY'}
						</span>
						<span className="text-panel-muted text-sm">for release</span>
					</div>
					{!verdict.ready && verdict.reasons.length > 0 && (
						<ul className="mt-3 space-y-1">
							{verdict.reasons.map((reason, i) => (
								<li
									key={i}
									className="text-xs text-status-fail flex items-start gap-2"
								>
									<span className="mt-0.5 shrink-0">✕</span>
									<span>{reason}</span>
								</li>
							))}
						</ul>
					)}
					{verdict.ready && <p className="mt-2 text-xs text-status-pass opacity-80">All release criteria met.</p>}
				</div>

				{/* Per-Config Summary Table */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-4">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">
						Per-Configuration Summary
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-xs font-mono">
							<thead>
								<tr className="text-panel-dim border-b border-panel-border">
									<th className="text-left pb-2 pr-4">Configuration</th>
									<th className="text-right pb-2 px-3">Total</th>
									<th className="text-right pb-2 px-3 text-status-pass">Pass</th>
									<th className="text-right pb-2 px-3 text-status-fail">Fail</th>
									<th className="text-right pb-2 px-3 text-status-skip">Skip</th>
									<th className="text-right pb-2 pl-3 text-panel-dim">Pending</th>
								</tr>
							</thead>
							<tbody>
								{session.configurations.map((config) => {
									const counts = countResults(session.results, config.id);
									const pctDone =
										counts.total > 0 ? Math.round(((counts.pass + counts.fail + counts.skip) / counts.total) * 100) : 0;
									return (
										<tr
											key={config.id}
											className="border-b border-panel-border last:border-0"
										>
											<td className="py-2 pr-4 text-panel-text">
												{config.id.replace('--', ' — ')}
												<span className="ml-2 text-panel-dim">({pctDone}%)</span>
											</td>
											<td className="py-2 px-3 text-right text-panel-muted">{counts.total}</td>
											<td className="py-2 px-3 text-right text-status-pass">{counts.pass}</td>
											<td className="py-2 px-3 text-right text-status-fail">{counts.fail}</td>
											<td className="py-2 px-3 text-right text-status-skip">{counts.skip}</td>
											<td className="py-2 pl-3 text-right text-panel-dim">{counts.pending}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>

				{/* Blocker List */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-4">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">
						Blockers
						{blockers.length > 0 && (
							<span className="ml-2 px-1.5 py-0.5 bg-status-fail-bg text-status-fail rounded">{blockers.length}</span>
						)}
					</h2>
					{blockers.length === 0 ? (
						<p className="text-xs text-panel-dim">No P0 or P1 failures.</p>
					) : (
						<div className="space-y-2">
							{blockers.map(([key, result]) => {
								const parts = key.split('::');
								const configId = parts[0] ?? '';
								const testId = parts[1] ?? '';
								const orientation = parts[2] ?? '';
								const orientLabel = orientation === 'single' ? '' : ` (${orientation})`;
								const testName = getTestName(testId);
								return (
									<div
										key={key}
										className="border border-status-fail-bg rounded px-3 py-2 bg-panel-bg"
									>
										<div className="flex items-start gap-2">
											<span className="text-status-fail text-xs font-mono shrink-0">
												{testId}
												{orientLabel}
											</span>
											<span className="text-panel-muted text-xs">{testName}</span>
										</div>
										<div className="text-xs text-panel-dim mt-1">
											Config: <span className="text-panel-muted font-mono">{configId.replace('--', ' — ')}</span>
										</div>
										{result.notes && <div className="text-xs text-status-skip mt-1 italic">{result.notes}</div>}
									</div>
								);
							})}
						</div>
					)}
				</section>

				{/* Known Limitations (P4 failures + skips) */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-6">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">
						Known Limitations (P4)
						{limitations.length > 0 && (
							<span className="ml-2 px-1.5 py-0.5 bg-status-skip-bg text-status-skip rounded">
								{limitations.length}
							</span>
						)}
					</h2>
					{limitations.length === 0 ? (
						<p className="text-xs text-panel-dim">No P4 failures or skips.</p>
					) : (
						<div className="space-y-2">
							{limitations.map(([key, result]) => {
								const parts = key.split('::');
								const testId = parts[1] ?? '';
								const orientation = parts[2] ?? '';
								const configId = parts[0] ?? '';
								const orientLabel = orientation === 'single' ? '' : ` (${orientation})`;
								const testName = getTestName(testId);
								return (
									<div
										key={key}
										className="flex items-start gap-3 py-1"
									>
										<span
											className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
												result.status === 'fail'
													? 'bg-status-fail-bg text-status-fail'
													: 'bg-status-skip-bg text-status-skip'
											}`}
										>
											{result.status.toUpperCase()}
										</span>
										<div className="min-w-0">
											<span className="text-xs font-mono text-panel-dim">
												{testId}
												{orientLabel}
											</span>
											<span className="text-xs text-panel-muted ml-2">{testName}</span>
											<span className="text-xs text-panel-subtle ml-2">({configId.replace('--', ' — ')})</span>
											{result.notes && <div className="text-xs text-panel-dim italic mt-0.5">{result.notes}</div>}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>

				{/* Action Buttons */}
				<div className="flex items-center justify-between gap-4">
					<div className="flex gap-3">
						<button
							onClick={() => exportAsJson(session)}
							className="px-4 py-2 rounded text-sm font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted cursor-pointer"
						>
							Export JSON
						</button>
						<button
							onClick={() => exportAsMarkdown(session, testPlan.phases)}
							className="px-4 py-2 rounded text-sm font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted cursor-pointer"
						>
							Export Markdown
						</button>
					</div>
					<button
						onClick={onReset}
						className="px-4 py-2 rounded text-sm font-mono border border-status-fail-bg text-status-fail hover:bg-status-fail-bg cursor-pointer"
					>
						Reset Session
					</button>
				</div>
			</div>
		</div>
	);
}
