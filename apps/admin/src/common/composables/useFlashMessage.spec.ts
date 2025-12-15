import { ElNotification } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { useFlashMessage } from './useFlashMessage';

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElNotification: {
			success: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			error: vi.fn(),
		},
	};
});

describe('useFlashMessage', () => {
	it('calls success notification with the correct message', () => {
		const { success } = useFlashMessage();
		success('Operation successful');

		expect(ElNotification.success).toHaveBeenCalledWith({
			message: 'Operation successful',
			duration: undefined,
		});
	});

	it('calls info notification with the correct message', () => {
		const { info } = useFlashMessage();
		info('Information message');

		expect(ElNotification.info).toHaveBeenCalledWith({
			message: 'Information message',
			duration: undefined,
		});
	});

	it('calls error notification with the correct message', () => {
		const { error } = useFlashMessage();
		error('An error occurred');

		expect(ElNotification.error).toHaveBeenCalledWith({
			message: 'An error occurred',
			duration: undefined,
		});
	});

	it('calls exception notification with the correct message', () => {
		const { exception } = useFlashMessage();
		exception('Unexpected error');

		expect(ElNotification.error).toHaveBeenCalledWith({
			message: 'Unexpected error',
			duration: undefined,
		});
	});

	it('passes duration option when provided', () => {
		const { success } = useFlashMessage();
		success('Operation successful', { duration: 5000 });

		expect(ElNotification.success).toHaveBeenCalledWith({
			message: 'Operation successful',
			duration: 5000,
		});
	});

	it('passes duration 0 to prevent auto-close', () => {
		const { warning } = useFlashMessage();
		warning('Warning message', { duration: 0 });

		expect(ElNotification.warning).toHaveBeenCalledWith({
			message: 'Warning message',
			duration: 0,
		});
	});
});
