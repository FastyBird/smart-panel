import type { Component } from 'vue';

import type { AutomationNodeKind } from '../../automations.constants';
import type { AutomationIssueSeverity } from '../../automations.graph';
import type { AutomationRunNodeState } from '../../automations.trace';

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
	// What the card did in the run laid over the canvas; null for a card the run did not reach
	run?: IAutomationNodeCardRun | null;
}

export interface IAutomationNodeCardRun {
	state: AutomationRunNodeState;
	text: string;
	// How many times the run reached the card
	visits: number;
}
