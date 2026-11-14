import { BadRequestException, Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { ModuleConfigCommit } from '../../config/services/module-config-mutation-registry.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { UpdateCamerasConfigDto } from '../dto/update-config.dto';
import { CamerasConfigModel } from '../models/config.model';

@Injectable()
export class CamerasConfigMutationService {
	constructor(private readonly configService: ConfigService) {}

	async update(update: UpdateCamerasConfigDto, commit: ModuleConfigCommit): Promise<void> {
		const current = this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME);
		const mode = update.go2rtc?.mode ?? current.go2rtc.mode;
		const externalUrl =
			update.go2rtc?.externalUrl === undefined ? current.go2rtc.externalUrl : update.go2rtc.externalUrl;

		if (mode === 'external' && (externalUrl === null || externalUrl === '')) {
			throw new BadRequestException('go2rtc external mode requires external_url');
		}

		await commit();
	}
}
