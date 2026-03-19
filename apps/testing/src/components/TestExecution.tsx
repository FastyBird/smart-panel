import { useState } from 'react';

import type { Orientation, Status, TestPlanYaml, TestSession } from '../types';
import { buildResultKey, countResults, getTestsForConfig } from '../utils';

import { DeviceTabs } from './DeviceTabs';
import { PriorityTabs } from './PriorityTabs';
import { ProgressBar } from './ProgressBar';
import { TestRow } from './TestRow';

interface TestExecutionProps {
	session: TestSession;
	testPlan: TestPlanYaml;
	updateResult: (configId: string, testId: string, orientation: Orientation, status: Status) => void;
	updateNotes: (configId: string, testId: string, orientation: Orientation, notes: string) => void;
	onViewResults: () => void;
	onExportJson: () => void;
	onExportMarkdown: () => void;
}

export function TestExecution({
	session,
	testPlan,
	updateResult,
	updateNotes,
	onViewResults,
	onExportJson,
	onExportMarkdown,
}: TestExecutionProps) {
	const [activeConfigId, setActiveConfigId] = useState<string>(session.configurations[0]?.id ?? '');
	const [activePhaseId, setActivePhaseId] = useState<string>('smoke');

	const activeConfig = session.configurations.find((c) => c.id === activeConfigId);
	const activePhase = testPlan.phases.find((p) => p.id === activePhaseId);

	// Global counts across all results
	const globalCounts = countResults(session.results);

	// Per-config progress for DeviceTabs: count non-pending results
	const getProgress = (configId: string) => {
		const totals = countResults(session.results, configId);
		return {
			done: totals.pass + totals.fail + totals.skip,
			total: totals.total,
		};
	};

	// Per-phase test count for active config (PriorityTabs)
	const getTestCount = (phaseId: string): number => {
		if (!activeConfig) return 0;
		const phase = testPlan.phases.find((p) => p.id === phaseId);
		if (!phase) return 0;
		return getTestsForConfig(phase, activeConfig, session.integrations).length;
	};

	// Tests to display for active config + phase
	const visibleTests =
		activeConfig && activePhase ? getTestsForConfig(activePhase, activeConfig, session.integrations) : [];

	// Phase progress for bottom ProgressBar
	const getPhaseProgress = () => {
		if (!activeConfig || !activePhase) return { pass: 0, fail: 0, skip: 0, total: 0 };
		const tests = getTestsForConfig(activePhase, activeConfig, session.integrations);
		let pass = 0;
		let fail = 0;
		let skip = 0;
		let total = 0;
		for (const test of tests) {
			if (test.orientations) {
				const lKey = buildResultKey(activeConfig.id, test.id, 'landscape');
				const pKey = buildResultKey(activeConfig.id, test.id, 'portrait');
				const lStatus = session.results[lKey]?.status ?? 'pending';
				const pStatus = session.results[pKey]?.status ?? 'pending';
				for (const s of [lStatus, pStatus]) {
					total++;
					if (s === 'pass') pass++;
					else if (s === 'fail') fail++;
					else if (s === 'skip') skip++;
				}
			} else {
				const key = buildResultKey(activeConfig.id, test.id, 'single');
				const s = session.results[key]?.status ?? 'pending';
				total++;
				if (s === 'pass') pass++;
				else if (s === 'fail') fail++;
				else if (s === 'skip') skip++;
			}
		}
		return { pass, fail, skip, total };
	};

	const phaseProgress = getPhaseProgress();

	// Build results record for a TestRow
	const getTestResults = (configId: string, testId: string) => {
		const landscape = session.results[buildResultKey(configId, testId, 'landscape')] ?? {
			status: 'pending' as Status,
			notes: '',
		};
		const portrait = session.results[buildResultKey(configId, testId, 'portrait')] ?? {
			status: 'pending' as Status,
			notes: '',
		};
		const single = session.results[buildResultKey(configId, testId, 'single')] ?? {
			status: 'pending' as Status,
			notes: '',
		};
		return { landscape, portrait, single };
	};

	return (
		<div className="min-h-screen bg-panel-bg text-panel-text flex flex-col">
			{/* Top Bar */}
			<div className="bg-panel-surface border-b border-panel-border px-4 py-2 flex items-center gap-4 shrink-0">
				{/* Session info */}
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-sm font-mono text-blue-400 whitespace-nowrap">{session.version}</span>
					<span className="text-panel-border">|</span>
					<span className="text-xs text-panel-dim whitespace-nowrap">{session.tester}</span>
				</div>

				{/* Global counts */}
				<div className="flex items-center gap-3 text-[11px] font-mono ml-2">
					<span className="text-status-pass">{globalCounts.pass} pass</span>
					<span className="text-status-fail">{globalCounts.fail} fail</span>
					<span className="text-status-skip">{globalCounts.skip} skip</span>
					<span className="text-panel-dim">{globalCounts.pending} pending</span>
				</div>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Action buttons */}
				<div className="flex items-center gap-2 shrink-0">
					<button
						onClick={onViewResults}
						className="px-3 py-1 rounded text-xs font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted cursor-pointer"
					>
						Results
					</button>
					<button
						onClick={onExportJson}
						className="px-3 py-1 rounded text-xs font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted cursor-pointer"
					>
						JSON
					</button>
					<button
						onClick={onExportMarkdown}
						className="px-3 py-1 rounded text-xs font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted cursor-pointer"
					>
						Markdown
					</button>
				</div>
			</div>

			{/* Device Tabs */}
			<DeviceTabs
				configurations={session.configurations}
				activeConfigId={activeConfigId}
				onSelect={setActiveConfigId}
				getProgress={getProgress}
			/>

			{/* Priority Tabs */}
			<PriorityTabs
				phases={testPlan.phases}
				activePhaseId={activePhaseId}
				onSelect={setActivePhaseId}
				getTestCount={getTestCount}
			/>

			{/* Test List */}
			<div className="flex-1 overflow-y-auto px-4 py-2">
				{visibleTests.length === 0 ? (
					<div className="flex items-center justify-center h-32">
						<p className="text-sm text-panel-dim">No tests applicable for this configuration</p>
					</div>
				) : (
					<div>
						{visibleTests.map((test) => {
							if (!activeConfig) return null;
							const results = getTestResults(activeConfig.id, test.id);
							return (
								<TestRow
									key={test.id}
									testId={test.id}
									name={test.name}
									criteria={test.criteria}
									orientations={test.orientations}
									results={results}
									onStatusChange={(orientation, status) => updateResult(activeConfig.id, test.id, orientation, status)}
									onNotesChange={(orientation, notes) => updateNotes(activeConfig.id, test.id, orientation, notes)}
								/>
							);
						})}
					</div>
				)}
			</div>

			{/* Bottom Progress Bar */}
			<div className="bg-panel-surface border-t border-panel-border px-4 py-2 shrink-0">
				<ProgressBar
					pass={phaseProgress.pass}
					fail={phaseProgress.fail}
					skip={phaseProgress.skip}
					total={phaseProgress.total}
					label={activePhase ? (activePhase.name.split('—')[1]?.trim() ?? activePhase.name) : ''}
				/>
			</div>
		</div>
	);
}
