import type { Component } from 'vue';

import type { AutomationNodeKind } from '../../automations.constants';
import type { AutomationIssueSeverity } from '../../automations.graph';

import type { IAutomationNodeSummaryProps } from './automation-node-form.types';

export interface IAutomationNodeCardProps {
	// Null for a card that is not offered any more
	kind?: AutomationNodeKind | null;
	kindLabel: string;
	icon: string;
	title: string;
	// The generic one-line summary, shown unless the card brings its own
	summary: string;
	summaryComponent?: Component;
	summaryProps?: IAutomationNodeSummaryProps;
	selected?: boolean;
	issue?: AutomationIssueSeverity;
}
