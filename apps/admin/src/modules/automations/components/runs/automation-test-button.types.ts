export interface IAutomationTestTrigger {
	// The trigger node the run starts at
	id: string;
	label: string;
}

export interface IAutomationTestButtonProps {
	// The triggers of the saved flow; with more than one, the trigger to start at can be chosen
	triggers: IAutomationTestTrigger[];
	// Why a test cannot be started now; null when it can
	disabledReason?: string | null;
	loading?: boolean;
}
