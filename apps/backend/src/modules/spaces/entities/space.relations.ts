import { IRelationLoader } from '../../../common/plugin-relations/relation-loader.interface';
import { CreateSpaceDto } from '../dto/create-space.dto';

import { SpaceEntity } from './space.entity';

export interface ISpaceRelationsLoader extends IRelationLoader {
	supports(entity: SpaceEntity): boolean;

	loadRelations(entity: SpaceEntity): Promise<void>;
}

export interface ISpaceNestedCreateBuilder {
	supports(dto: CreateSpaceDto): boolean;

	build(dto: CreateSpaceDto, space: SpaceEntity): Promise<void>;
}
