interface ProgressBarProps {
	pass: number;
	fail: number;
	skip: number;
	total: number;
	label?: string;
}

export function ProgressBar({ pass, fail, skip, total, label }: ProgressBarProps) {
	const done = pass + fail + skip;
	const pctPass = total > 0 ? (pass / total) * 100 : 0;
	const pctFail = total > 0 ? (fail / total) * 100 : 0;
	const pctSkip = total > 0 ? (skip / total) * 100 : 0;

	return (
		<div className="flex items-center gap-3">
			{label && <span className="text-[11px] text-panel-dim">{label}</span>}
			<div className="flex-1 bg-panel-border rounded h-1">
				<div className="flex h-1 rounded overflow-hidden">
					{pctPass > 0 && (
						<div
							className="bg-status-pass"
							style={{ width: `${pctPass}%` }}
						/>
					)}
					{pctFail > 0 && (
						<div
							className="bg-status-fail"
							style={{ width: `${pctFail}%` }}
						/>
					)}
					{pctSkip > 0 && (
						<div
							className="bg-status-skip"
							style={{ width: `${pctSkip}%` }}
						/>
					)}
				</div>
			</div>
			<span className="text-[11px] text-panel-dim">
				{done}/{total}
			</span>
		</div>
	);
}
