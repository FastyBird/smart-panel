import bcrypt from 'bcrypt';

export const hashToken = async (token: string): Promise<string> => {
	return await bcrypt.hash(token, 10);
};
