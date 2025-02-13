import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateCardDto } from './create-card.dto';

type ReqCreatePageCard = components['schemas']['DashboardReqCreatePageCard'];

export class CreatePageCardDto extends CreateCardDto {}

export class ReqCreatePageCardDto implements ReqCreatePageCard {
	@Expose()
	@ValidateNested()
	@Type(() => CreatePageCardDto)
	data: CreatePageCardDto;
}
