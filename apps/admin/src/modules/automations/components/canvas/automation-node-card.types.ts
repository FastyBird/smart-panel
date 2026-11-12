import type { AutomationNodeKind } from '../../automations.constants';
import type { AutomationIssueSeverity } from '../../automations.graph';

export interface IAutomationNodeCardProps {
	// Null for a card that is not offered any more
	kind?: AutomationNodeKind | null;
	kindLabel: string;
	icon: string;
	title: string;
	summary: string;
	selected?: boolean;
	issue?: AutomationIssueSeverity;
}
