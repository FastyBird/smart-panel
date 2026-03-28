import type { DeviceConfiguration } from '../types';

const ROLE_SHORT: Record<string, string> = {
	'all-in-one': 'AIO',
	panel: 'Panel',
	backend: 'Server',
};

interface DeviceTabsProps {
	configurations: DeviceConfiguration[];
	activeConfigId: string;
	onSelect: (configId: string) => void;
	getProgress: (configId: string) => { done: number; total: number };
}

export function DeviceTabs({ configurations, activeConfigId, onSelect, getProgress }: DeviceTabsProps) {
	return (
		<div className="flex gap-0 border-b border-panel-border px-4 bg-panel-surface overflow-x-auto">
			{configurations.map((config) => {
				const isActive = config.id === activeConfigId;
				const progress = getProgress(config.id);
				const allDone = progress.done === progress.total && progress.total > 0;
				const roleLabel = ROLE_SHORT[config.role] ?? config.role;
				const displayLabel = config.label || config.id.replace('--', ' — ');
				const displayInfo = config.display ? ` · ${config.display.resolution}` : '';
				return (
					<button
						key={config.id}
						onClick={() => onSelect(config.id)}
						title={`${displayLabel} (${roleLabel})${displayInfo}${config.memory ? ` · ${config.memory}` : ''}`}
						className={`px-4 py-2.5 text-[12px] cursor-pointer whitespace-nowrap border-b-2 ${
							isActive
								? 'text-primary border-primary font-semibold'
								: 'text-panel-dim border-transparent hover:text-panel-text hover:border-panel-subtle'
						}`}
					>
						<span>{displayLabel}</span>
						<span className="text-panel-dim ml-1">({roleLabel})</span>
						<span
							className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
								allDone
									? 'bg-status-pass-bg text-status-pass border border-status-pass-border'
									: 'bg-info-bg text-panel-dim'
							}`}
						>
							{progress.done}/{progress.total}
							{allDone ? ' ✓' : ''}
						</span>
					</button>
				);
			})}
		</div>
	);
}
