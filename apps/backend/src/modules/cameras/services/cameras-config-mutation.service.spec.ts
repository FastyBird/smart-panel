import { BadRequestException } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { UpdateCamerasConfigDto } from '../dto/update-config.dto';
import { CamerasConfigModel } from '../models/config.model';

import { CamerasConfigMutationService } from './cameras-config-mutation.service';

describe('CamerasConfigMutationService', () => {
	const dto = (data: Record<string, unknown>): UpdateCamerasConfigDto =>
		toInstance(UpdateCamerasConfigDto, { type: CAMERAS_MODULE_NAME, ...data }, { excludeExtraneousValues: false });
	const stored = (data: Record<string, unknown>): CamerasConfigModel =>
		toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME, ...data });

	let commit: jest.Mock;

	const serviceFor = (current: CamerasConfigModel): CamerasConfigMutationService =>
		new CamerasConfigMutationService({ getModuleConfig: jest.fn().mockReturnValue(current) } as never);

	beforeEach(() => {
		commit = jest.fn().mockResolvedValue(undefined);
	});

	it('rejects switching to external mode without a stored or submitted url', async () => {
		const service = serviceFor(stored({}));

		await expect(service.update(dto({ go2rtc: { mode: 'external' } }), commit)).rejects.toBeInstanceOf(
			BadRequestException,
		);
		await expect(service.update(dto({ go2rtc: { mode: 'external' } }), commit)).rejects.toThrow(
			'go2rtc external mode requires external_url',
		);
		expect(commit).not.toHaveBeenCalled();
	});

	it('rejects clearing the url while external mode stays on', async () => {
		const service = serviceFor(stored({ go2rtc: { mode: 'external', external_url: 'http://h:1984' } }));

		await expect(service.update(dto({ go2rtc: { external_url: null } }), commit)).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(commit).not.toHaveBeenCalled();
	});

	it('accepts external mode when the stored config already has a url', async () => {
		const service = serviceFor(stored({ go2rtc: { external_url: 'http://h:1984' } }));

		await service.update(dto({ go2rtc: { mode: 'external' } }), commit);

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('accepts any update that leaves external mode off', async () => {
		const service = serviceFor(stored({}));

		await service.update(dto({ max_sessions: 2 }), commit);

		expect(commit).toHaveBeenCalledTimes(1);
	});
});
