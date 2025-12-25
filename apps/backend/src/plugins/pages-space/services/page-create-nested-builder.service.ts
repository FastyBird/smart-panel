import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { IPageNestedCreateBuilder } from '../../../modules/dashboard/entities/dashboard.relations';
import { CreateSpacePageDto } from '../dto/create-page.dto';
import { SpacePageEntity } from '../entities/pages-space.entity';
import { PAGES_SPACE_PLUGIN_NAME, PAGES_SPACE_TYPE } from '../pages-space.constants';
import { PagesSpaceValidationException } from '../pages-space.exceptions';

@Injectable()
export class SpacePageNestedBuilderService implements IPageNestedCreateBuilder {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		PAGES_SPACE_PLUGIN_NAME,
		'SpacePageNestedBuilderService',
	);

	supports(dto: CreatePageDto): boolean {
		return dto.type === PAGES_SPACE_TYPE;
	}

	async build(dto: CreateSpacePageDto, page: SpacePageEntity): Promise<void> {
		const dtoInstance = await this.validateDto<CreateSpacePageDto>(CreateSpacePageDto, dto);

		// Set the space ID on the page entity
		page.spaceId = dtoInstance.space_id;
		page.viewMode = dtoInstance.view_mode ?? 'simple';
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
			this.logger.error(`[PAGES SPACE][NESTED BUILDER SERVICE] ${JSON.stringify(errors)}`);

			throw new PagesSpaceValidationException('Provided space page data is invalid.');
		}

		return dtoInstance;
	}
}
