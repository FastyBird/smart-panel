import type { IAutomationNodeType } from '../../store/node-types.store.types';

export interface IAutomationPaletteProps {
	// The catalogue as `GET /node-types` returns it
	nodeTypes: IAutomationNodeType[];
	disabled?: boolean;
}
