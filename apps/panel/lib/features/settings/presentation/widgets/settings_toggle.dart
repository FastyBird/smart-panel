import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Coral-accented toggle switch for settings screens.
class SettingsToggle extends StatelessWidget {
	final bool value;
	final ValueChanged<bool>? onChanged;

	const SettingsToggle({
		super.key,
		required this.value,
		this.onChanged,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final activeColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final inactiveColor = isDark
				? AppBorderColorDark.dark
				: AppBorderColorLight.base;

		return GestureDetector(
			onTap: onChanged != null ? () => onChanged!(!value) : null,
			child: AnimatedContainer(
				duration: AppAnimation.standard,
				width: AppSpacings.scale(44),
				height: AppSpacings.scale(26),
				decoration: BoxDecoration(
					color: value ? activeColor : inactiveColor,
					borderRadius: BorderRadius.circular(AppSpacings.scale(13)),
				),
				child: AnimatedAlign(
					duration: AppAnimation.standard,
					alignment: value ? Alignment.centerRight : Alignment.centerLeft,
					child: Container(
						width: AppSpacings.scale(20),
						height: AppSpacings.scale(20),
						margin: EdgeInsets.symmetric(horizontal: AppSpacings.scale(3)),
						decoration: BoxDecoration(
							color: AppColors.white,
							shape: BoxShape.circle,
							boxShadow: [
								BoxShadow(
									color: Colors.black.withValues(alpha: 0.15),
									blurRadius: 3,
									offset: const Offset(0, 1),
								),
							],
						),
					),
				),
			),
		);
	}
}
