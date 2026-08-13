import inquirer from 'inquirer';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { TokensService } from '../services/tokens.service';

import { ResetPasswordCommand } from './reset-password.command';

jest.mock('inquirer', () => ({
	__esModule: true,
	default: { prompt: jest.fn() },
}));

describe('ResetPasswordCommand', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([UserRole.OWNER, UserRole.ADMIN])(
		'should reset a %s password and revoke every user credential',
		async (role) => {
			jest.mocked(inquirer.prompt).mockResolvedValue({ password: 'replacement-password' });
			const update = jest.fn().mockResolvedValue(undefined);
			const revokeUserCredentials = jest.fn().mockResolvedValue(undefined);
			const user = {
				id: 'e9b1b3fb-f813-42b8-985f-2cb068baf1a8',
				username: 'privileged-user',
				role,
			} as UserEntity;
			const usersService = {
				findByUsername: jest.fn().mockResolvedValue(user),
				update,
			} as unknown as UsersService;
			const tokensService = {
				revokeUserCredentials,
			} as unknown as TokensService;
			const command = new ResetPasswordCommand(usersService, tokensService);

			jest.spyOn(console, 'log').mockImplementation(() => undefined);

			await command.run(['privileged-user']);

			expect(update).toHaveBeenCalledWith(user.id, { password: 'replacement-password' });
			expect(revokeUserCredentials).toHaveBeenCalledWith(user.id);
		},
	);
});
