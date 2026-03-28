import type { Status } from '../types';

const STATUS_DISPLAY: Record<Status, { label: string; className: string }> = {
	pending: {
		label: '—',
		className: 'bg-info-bg text-panel-subtle border border-panel-border',
	},
	pass: { label: 'PASS', className: 'bg-status-pass-bg text-status-pass border border-status-pass-border' },
	fail: { label: 'FAIL', className: 'bg-status-fail-bg text-status-fail border border-status-fail-border' },
	skip: { label: 'SKIP', className: 'bg-status-skip-bg text-status-skip border border-status-skip-border' },
};

interface StatusButtonProps {
	status: Status;
	onClick: () => void;
	label?: string;
}

export function StatusButton({ status, onClick, label }: StatusButtonProps) {
	const display = STATUS_DISPLAY[status];
	return (
		<div className="flex items-center gap-1">
			{label && <span className="text-[9px] text-panel-dim w-2.5">{label}</span>}
			<button
				onClick={onClick}
				className={`px-2 py-0.5 rounded text-[10px] font-mono min-w-[40px] text-center cursor-pointer hover:opacity-80 ${display.className}`}
			>
				{display.label}
			</button>
		</div>
	);
}
