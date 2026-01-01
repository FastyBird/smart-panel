import { SpaceType } from '../spaces.constants';

export interface ISpaceEditSummarySectionProps {
	spaceId: string;
	spaceType: SpaceType;
	deviceCount: number;
	displayCount: number;
}

export const spaceEditSummarySectionEmits = {
	'manage-devices': (): boolean => true,
	'manage-displays': (): boolean => true,
};
