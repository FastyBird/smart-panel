interface PriorityTabsProps {
	phases: Array<{ id: string; name: string }>;
	activePhaseId: string;
	onSelect: (phaseId: string) => void;
	getTestCount: (phaseId: string) => number;
}

export function PriorityTabs({ phases, activePhaseId, onSelect, getTestCount }: PriorityTabsProps) {
	return (
		<div className="flex gap-0 border-b border-panel-border px-4 bg-panel-surface">
			{phases.map((phase) => {
				const isActive = phase.id === activePhaseId;
				const count = getTestCount(phase.id);
				const shortName = phase.name.split('—')[1]?.trim() ?? phase.name;
				return (
					<button
						key={phase.id}
						onClick={() => onSelect(phase.id)}
						disabled={count === 0}
						className={`px-3 py-2 text-[12px] cursor-pointer border-b-2 ${
							isActive
								? 'text-primary border-primary font-semibold'
								: count === 0
									? 'text-panel-subtle border-transparent cursor-not-allowed'
									: 'text-panel-dim border-transparent hover:text-panel-text hover:border-panel-subtle'
						}`}
					>
						{shortName}
						{count > 0 && <span className="text-panel-subtle ml-1 text-[10px]">({count})</span>}
					</button>
				);
			})}
		</div>
	);
}
