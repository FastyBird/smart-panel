import { useState } from 'react';

import type { Orientation, Status } from '../types';
import { nextStatus } from '../utils';

import { StatusButton } from './StatusButton';

interface TestRowProps {
	testId: string;
	name: string;
	criteria: string;
	orientations: boolean;
	results: Record<Orientation, { status: Status; notes: string }>;
	onStatusChange: (orientation: Orientation, status: Status) => void;
	onNotesChange: (orientation: Orientation, notes: string) => void;
}

export function TestRow({
	testId,
	name,
	criteria,
	orientations,
	results,
	onStatusChange,
	onNotesChange,
}: TestRowProps) {
	const [expanded, setExpanded] = useState(false);
	const [showNotes, setShowNotes] = useState(false);

	const hasFailure = orientations
		? results.landscape.status === 'fail' || results.portrait.status === 'fail'
		: results.single.status === 'fail';

	const hasNotes = orientations ? results.landscape.notes || results.portrait.notes : results.single.notes;

	const shouldShowNotes = showNotes || hasFailure;

	return (
		<div className="border-b border-panel-border">
			<div className="flex items-center py-2 gap-2">
				<span className="text-panel-dim w-[42px] text-[11px] font-mono">{testId}</span>
				<button
					onClick={() => setExpanded(!expanded)}
					className="flex-1 text-left text-[12px] text-panel-muted hover:text-primary cursor-pointer truncate"
					title={criteria}
				>
					{name} <span className="text-panel-subtle text-[10px]">{expanded ? '▲' : '▼'}</span>
				</button>

				{orientations ? (
					<>
						<StatusButton
							label="L"
							status={results.landscape.status}
							onClick={() => onStatusChange('landscape', nextStatus(results.landscape.status))}
						/>
						<StatusButton
							label="P"
							status={results.portrait.status}
							onClick={() => onStatusChange('portrait', nextStatus(results.portrait.status))}
						/>
					</>
				) : (
					<StatusButton
						status={results.single.status}
						onClick={() => onStatusChange('single', nextStatus(results.single.status))}
					/>
				)}

				<button
					onClick={() => setShowNotes(!showNotes)}
					className={`w-4 text-center text-[10px] cursor-pointer ${hasNotes ? 'text-status-skip' : 'text-panel-subtle hover:text-panel-dim'}`}
					title={hasNotes ? 'Has notes' : 'Add note'}
				>
					✎
				</button>
			</div>

			{expanded && (
				<div className="pl-[50px] pb-2 text-[11px] text-panel-dim border-l-2 border-primary-lighter ml-[18px]">
					Pass criteria: {criteria}
				</div>
			)}

			{shouldShowNotes && (
				<div className="pl-[50px] pb-2">
					{orientations ? (
						<div className="space-y-1">
							{results.landscape.status === 'fail' || showNotes ? (
								<input
									type="text"
									placeholder="Landscape notes..."
									value={results.landscape.notes}
									onChange={(e) => onNotesChange('landscape', e.target.value)}
									className="w-full bg-panel-surface border border-panel-border rounded px-2 py-1 text-[11px] text-panel-muted placeholder:text-panel-subtle"
								/>
							) : null}
							{results.portrait.status === 'fail' || showNotes ? (
								<input
									type="text"
									placeholder="Portrait notes..."
									value={results.portrait.notes}
									onChange={(e) => onNotesChange('portrait', e.target.value)}
									className="w-full bg-panel-surface border border-panel-border rounded px-2 py-1 text-[11px] text-panel-muted placeholder:text-panel-subtle"
								/>
							) : null}
						</div>
					) : (
						<input
							type="text"
							placeholder="Notes..."
							value={results.single.notes}
							onChange={(e) => onNotesChange('single', e.target.value)}
							className="w-full bg-panel-surface border border-panel-border rounded px-2 py-1 text-[11px] text-panel-muted placeholder:text-panel-subtle"
						/>
					)}
				</div>
			)}
		</div>
	);
}
