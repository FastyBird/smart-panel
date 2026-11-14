export interface IAutomationYamlDialogProps {
	visible: boolean;
	automationId: string;
	// Whether the editor holds changes that are not saved, and so are not in the document shown
	unsaved?: boolean;
}
