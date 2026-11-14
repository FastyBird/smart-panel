export type AutomationLookupCollection = 'devices' | 'scenes' | 'automations';

export interface IAutomationLookupLoadFailedProps {
	// The collection that could not be read
	collection: AutomationLookupCollection;
	// It is being read again
	loading?: boolean;
}
