import type { IAutomationSuggestion } from '../../composables/types';

export interface IAutomationSuggestionsProps {
	suggestions: IAutomationSuggestion[];
	// The suggestions whose answer is on its way to the backend
	answering?: IAutomationSuggestion['id'][];
}
