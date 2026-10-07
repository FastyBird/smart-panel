export type TailscaleSetupStage = 'install' | 'daemon' | 'operator';
export type TailscaleSetupStageState = 'pending' | 'running' | 'complete' | 'failed' | 'interrupted';

interface SetupProgress {
	job?: string;
	state: string;
	step?: string | null;
}

export interface ITailscaleSetupStage {
	step: TailscaleSetupStage;
	state: TailscaleSetupStageState;
}

const stages: TailscaleSetupStage[] = ['install', 'daemon', 'operator'];

/** The script starts each stage only after its predecessor succeeds; snapshots can skip short stages. */
export const getTailscaleSetupStages = (progress: SetupProgress | null): ITailscaleSetupStage[] => {
	if (!progress?.job) return [];

	if (progress.state === 'complete' && progress.step === 'complete') {
		return stages.map((step) => ({ step, state: 'complete' }));
	}

	const current = stages.findIndex((step) => step === progress.step);
	const namedStage = current >= 0 && (progress.state === 'running' || progress.state === 'failed');

	return stages.map((step, index): ITailscaleSetupStage => {
		if (!namedStage) {
			return { step, state: progress.state === 'running' ? 'pending' : 'interrupted' };
		}

		if (index < current) return { step, state: 'complete' };
		if (index > current) return { step, state: 'pending' };

		return { step, state: progress.state === 'failed' ? 'failed' : 'running' };
	});
};
