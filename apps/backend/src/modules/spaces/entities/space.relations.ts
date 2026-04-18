import { BaseEntity } from '../../../common/entities/base.entity';
import { CreateSpaceDto } from '../dto/create-space.dto';

import { SpaceEntity } from './space.entity';

export interface IRelationLoader {
	supports(entity: BaseEntity): boolean;

	loadRelations(entity: BaseEntity): Promise<void>;
}

export interface ISpaceRelationsLoader extends IRelationLoader {
	supports(entity: SpaceEntity): boolean;

	loadRelations(entity: SpaceEntity): Promise<void>;
}

export interface ISpaceNestedCreateBuilder {
	supports(dto: CreateSpaceDto): boolean;

	build(dto: CreateSpaceDto, space: SpaceEntity): Promise<void>;
}
