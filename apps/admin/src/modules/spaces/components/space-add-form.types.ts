import type { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store';

export interface ISpaceAddFormProps {
	/**
	 * Pre-selected space type. When set, the form hides its internal type
	 * dropdown and seeds `model.type` with this value — used by the
	 * dashboard-style plugin-picker flow where the parent view chooses the
	 * type before dispatching the plugin's `spaceAddForm` component.
	 *
	 * Declared as the full `SpaceType` union because this is the dispatch
	 * boundary — the view passes whatever the picker produced. Internally,
	 * this form only wires up ROOM / ZONE; the home-control plugin
	 * registers it only against those element types, so any other value
	 * here would indicate a bug in the picker's filter.
	 */
	type?: SpaceType;
	hideActions?: boolean;
}

export const spaceAddFormEmits = {
	saved: (space: ISpace): boolean => typeof space === 'object',
	cancel: (): boolean => true,
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};
