/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { ZodType } from 'zod';

import type { IAutomationNodeFormProps, IAutomationNodeSummaryProps, automationNodeFormEmits } from './components/canvas/automation-node-form.types';

/*
 * What an admin element brings for a card of the canvas (design § Editor, "Plugin forms"). The element's
 * `type` is the node type (`device.property.changed`); a plugin lists the automations module in its
 * `modules` and in the element's. The automations module registers its own cards the same way.
 */
export type IAutomationNodePluginsComponents = {
	// The configuration form in the side panel; replaces the form generated from the config schema
	automationNodeForm?: DefineComponent<
		IAutomationNodeFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof automationNodeFormEmits
	>;
	// The one-line summary on the card; replaces the summary read from the plain configuration values
	automationNodeCard?: DefineComponent<IAutomationNodeSummaryProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin>;
};

export type IAutomationNodePluginsSchemas = {
	// The configuration of the card, for immediate feedback in its form; the backend checks it again on save
	automationNodeConfigSchema?: ZodType;
};
