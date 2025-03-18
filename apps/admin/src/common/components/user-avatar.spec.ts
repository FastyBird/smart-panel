import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import UserAvatar from './user-avatar.vue';

describe('UserAvatar.vue', () => {
	it('renders correctly with default props', () => {
		const wrapper = mount(UserAvatar);

		expect(wrapper.exists()).toBe(true);
	});

	it('renders avatar image when "email" prop is provided', () => {
		const wrapper = mount(UserAvatar, {
			props: {
				email: 'john@doe.com',
			},
		});

		const img = wrapper.find('img');

		expect(img.exists()).toBe(true);
		expect(img.attributes('src')).toBe('//www.gravatar.com/avatar/6a6c19fea4a3676970167ce51f39e6ee?s=80&d=retro&r=g');
	});

	it('renders default placeholder when "email" is not provided', () => {
		const wrapper = mount(UserAvatar);

		expect(wrapper.find('i').exists()).toBe(true);
		expect(wrapper.find('i').find('svg').exists()).toBe(true);
	});

	it('applies correct size class when "size" prop is provided', () => {
		const wrapper = mount(UserAvatar, {
			props: {
				size: 32,
			},
		});

		const avatarElement = wrapper.element;
		const computedStyles = getComputedStyle(avatarElement);

		expect(computedStyles.getPropertyValue('--el-avatar-size')).toBe('32px');
	});
});
