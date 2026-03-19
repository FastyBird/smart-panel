interface PriorityTabsProps {
	phases: Array<{ id: string; name: string }>;
	activePhaseId: string;
	onSelect: (phaseId: string) => void;
	getTestCount: (phaseId: string) => number;
}

export function PriorityTabs({ phases, activePhaseId, onSelect, getTestCount }: PriorityTabsProps) {
	return (
		<div className="flex gap-0 border-b border-panel-border px-4 bg-panel-bg">
			{phases.map((phase) => {
				const isActive = phase.id === activePhaseId;
				const count = getTestCount(phase.id);
				const shortName = phase.name.split('—')[1]?.trim() ?? phase.name;
				return (
					<button
						key={phase.id}
						onClick={() => onSelect(phase.id)}
						disabled={count === 0}
						className={`px-3 py-1.5 text-[11px] cursor-pointer ${
							isActive
								? 'text-panel-text border-b-2 border-amber-500 font-semibold'
								: count === 0
									? 'text-panel-border cursor-not-allowed'
									: 'text-panel-dim hover:text-panel-muted'
						}`}
					>
						{shortName}
					</button>
				);
			})}
		</div>
	);
}
