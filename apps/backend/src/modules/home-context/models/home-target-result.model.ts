import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import { SceneCategory } from '../../scenes/scenes.constants';
import { SpaceType } from '../../spaces/spaces.constants';
import { HomeTargetLightingMode } from '../home-context.constants';

export interface HomeWritablePropertyResult {
	property_id: string;
	property_name: string | null;
	property_category: PropertyCategory;
	device_id: string;
	device_name: string;
	channel_id: string;
	channel_name: string;
	channel_category: ChannelCategory;
	data_type: DataTypeType;
	unit: string | null;
	format: string[] | number[] | null;
	step: number | null;
	invalid: string | number | boolean | null;
}

export interface HomeWritablePropertiesResult {
	properties: HomeWritablePropertyResult[];
	truncated: boolean;
}

export interface HomeTriggerSceneResult {
	scene_id: string;
	name: string;
	category: SceneCategory;
	primary_space_id: string | null;
}

export interface HomeTriggerSpaceResult {
	space_id: string;
	name: string;
	type: SpaceType;
	modes: HomeTargetLightingMode[];
}

export interface HomeTriggerTargetsResult {
	scenes: HomeTriggerSceneResult[];
	spaces: HomeTriggerSpaceResult[];
	truncated: {
		scenes: boolean;
		spaces: boolean;
	};
}
