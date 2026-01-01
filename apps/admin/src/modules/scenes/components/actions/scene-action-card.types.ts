import type { ISceneActionAddForm } from '../../schemas/scenes.types';

export interface ISceneActionCardProps {
	action: ISceneActionAddForm & { type: string };
}
