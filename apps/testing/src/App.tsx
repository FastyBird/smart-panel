import { useState } from 'react';

import { ResultsSummary } from './components/ResultsSummary';
import { SetupWizard } from './components/SetupWizard';
import { TestExecution } from './components/TestExecution';
import { useSession } from './hooks/useSession';
import { useTestPlan } from './hooks/useTestPlan';
import type { Screen } from './types';
import { exportAsJson, exportAsMarkdown } from './utils';

export default function App() {
	const { testPlan, loading, error } = useTestPlan();
	const { session, hasExistingSession, startSession, updateResult, updateNotes, resetSession } = useSession();

	const [screen, setScreen] = useState<Screen>(hasExistingSession ? 'execution' : 'setup');

	// Handle resume prompt
	const [showResume, setShowResume] = useState(hasExistingSession);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<span className="text-panel-muted font-mono">Loading test plan...</span>
			</div>
		);
	}

	if (error || !testPlan) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<h1 className="text-status-fail text-xl font-mono mb-2">Failed to load test plan</h1>
					<p className="text-panel-dim text-sm">{error}</p>
				</div>
			</div>
		);
	}

	// Resume dialog
	if (showResume && session) {
		const versionMismatch = session.testPlanVersion !== testPlan.version;
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="bg-panel-surface border border-panel-border rounded-lg p-6 max-w-md">
					<h2 className="text-lg font-mono text-panel-text mb-2">Existing session found</h2>
					<p className="text-panel-muted text-sm mb-1">
						{session.version} — started {new Date(session.startedAt).toLocaleDateString()}
					</p>
					<p className="text-panel-muted text-sm mb-4">Tester: {session.tester}</p>
					{versionMismatch && (
						<p className="text-status-skip text-xs mb-4">
							⚠ Test plan has been updated since this session was saved. Some results may not match current tests.
						</p>
					)}
					<div className="flex gap-3">
						<button
							onClick={() => {
								setShowResume(false);
								setScreen('execution');
							}}
							className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm cursor-pointer hover:bg-blue-500"
						>
							Resume
						</button>
						<button
							onClick={() => {
								resetSession();
								setShowResume(false);
								setScreen('setup');
							}}
							className="flex-1 bg-panel-border text-panel-muted px-4 py-2 rounded text-sm cursor-pointer hover:bg-panel-subtle"
						>
							Start Fresh
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (screen === 'setup' || !session) {
		return (
			<SetupWizard
				testPlan={testPlan}
				onStart={(newSession) => {
					startSession(newSession);
					setScreen('execution');
				}}
			/>
		);
	}

	if (screen === 'results') {
		return (
			<ResultsSummary
				session={session}
				testPlan={testPlan}
				onBack={() => setScreen('execution')}
				onReset={() => {
					if (
						window.confirm('This will permanently delete all test results for this session. Export first if needed.')
					) {
						resetSession();
						setScreen('setup');
					}
				}}
			/>
		);
	}

	return (
		<TestExecution
			session={session}
			testPlan={testPlan}
			updateResult={updateResult}
			updateNotes={updateNotes}
			onViewResults={() => setScreen('results')}
			onExportJson={() => exportAsJson(session)}
			onExportMarkdown={() => exportAsMarkdown(session, testPlan.phases)}
		/>
	);
}
