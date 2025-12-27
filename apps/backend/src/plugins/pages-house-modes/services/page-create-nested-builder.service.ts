import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { IPageNestedCreateBuilder } from '../../../modules/dashboard/entities/dashboard.relations';
import { CreateHouseModesPageDto } from '../dto/create-page.dto';
import { HouseModesPageEntity } from '../entities/pages-house-modes.entity';
import { PAGES_HOUSE_MODES_PLUGIN_NAME, PAGES_HOUSE_MODES_TYPE } from '../pages-house-modes.constants';
import { PagesHouseModesValidationException } from '../pages-house-modes.exceptions';

@Injectable()
export class HouseModesPageNestedBuilderService implements IPageNestedCreateBuilder {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		PAGES_HOUSE_MODES_PLUGIN_NAME,
		'HouseModesPageNestedBuilderService',
	);

	supports(dto: CreatePageDto): boolean {
		return dto.type === PAGES_HOUSE_MODES_TYPE;
	}

	async build(dto: CreateHouseModesPageDto, page: HouseModesPageEntity): Promise<void> {
		const dtoInstance = await this.validateDto<CreateHouseModesPageDto>(CreateHouseModesPageDto, dto);

		// Set the house modes page specific properties
		page.confirmOnAway = dtoInstance.confirm_on_away ?? true;
		page.showLastChanged = dtoInstance.show_last_changed ?? true;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: unknown): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[PAGES HOUSE MODES][NESTED BUILDER SERVICE] ${JSON.stringify(errors)}`);

			throw new PagesHouseModesValidationException('Provided house modes page data is invalid.');
		}

		return dtoInstance;
	}
}
