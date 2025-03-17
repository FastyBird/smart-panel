import { ElNotification } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { useFlashMessage } from './useFlashMessage';

vi.mock('element-plus', () => ({
	ElNotification: {
		success: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
	},
}));

describe('useFlashMessage', () => {
	it('calls success notification with the correct message', () => {
		const { success } = useFlashMessage();
		success('Operation successful');

		expect(ElNotification.success).toHaveBeenCalledWith('Operation successful');
	});

	it('calls info notification with the correct message', () => {
		const { info } = useFlashMessage();
		info('Information message');

		expect(ElNotification.info).toHaveBeenCalledWith('Information message');
	});

	it('calls error notification with the correct message', () => {
		const { error } = useFlashMessage();
		error('An error occurred');

		expect(ElNotification.error).toHaveBeenCalledWith('An error occurred');
	});

	it('calls exception notification with the correct message', () => {
		const { exception } = useFlashMessage();
		exception('Unexpected error');

		expect(ElNotification.error).toHaveBeenCalledWith('Unexpected error');
	});
});
