import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Custom themed slider with left/right icons for settings screens.
/// Value range is 0.0 to 1.0.
class SettingsSlider extends StatelessWidget {
	final double value;
	final IconData iconSmall;
	final IconData iconLarge;
	final ValueChanged<double>? onChanged;

	const SettingsSlider({
		super.key,
		required this.value,
		required this.iconSmall,
		required this.iconLarge,
		this.onChanged,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final activeColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final trackColor = isDark
				? AppBorderColorDark.light
				: AppBorderColorLight.light;
		final hintColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

		return Row(
			children: [
				Icon(iconSmall, size: AppFontSize.base, color: hintColor),
				SizedBox(width: AppSpacings.pMd),
				Expanded(
					child: LayoutBuilder(builder: (context, constraints) {
						final trackWidth = constraints.maxWidth;
						final thumbRadius = AppSpacings.scale(9);
						final clampedValue = value.clamp(0.0, 1.0);
						final usableWidth = trackWidth - thumbRadius * 2;
						final thumbCenter = thumbRadius + clampedValue * usableWidth;

						return GestureDetector(
							onHorizontalDragUpdate: onChanged != null
									? (details) {
											final newVal =
													((details.localPosition.dx - thumbRadius) / usableWidth)
															.clamp(0.0, 1.0);
											onChanged!(newVal);
										}
									: null,
							onTapDown: onChanged != null
									? (details) {
											HapticFeedback.lightImpact();
											final newVal =
													((details.localPosition.dx - thumbRadius) / usableWidth)
															.clamp(0.0, 1.0);
											onChanged!(newVal);
										}
									: null,
							child: SizedBox(
								height: AppSpacings.scale(24),
								child: Stack(
									clipBehavior: Clip.none,
									alignment: Alignment.centerLeft,
									children: [
										// Track background
										Container(
											height: AppSpacings.scale(6),
											decoration: BoxDecoration(
												color: trackColor,
												borderRadius: BorderRadius.circular(AppSpacings.scale(3)),
											),
										),
										// Track fill
										Container(
											height: AppSpacings.scale(6),
											width: thumbCenter,
											decoration: BoxDecoration(
												color: activeColor,
												borderRadius: BorderRadius.circular(AppSpacings.scale(3)),
											),
										),
										// Thumb
										Positioned(
											left: thumbCenter - thumbRadius,
											child: Container(
												width: thumbRadius * 2,
												height: thumbRadius * 2,
												decoration: BoxDecoration(
													color: activeColor,
													shape: BoxShape.circle,
													boxShadow: [
														BoxShadow(
															color: activeColor.withValues(alpha: 0.35),
															blurRadius: 6,
															offset: const Offset(0, 2),
														),
													],
												),
											),
										),
									],
								),
							),
						);
					}),
				),
				SizedBox(width: AppSpacings.pMd),
				Icon(iconLarge, size: AppFontSize.large, color: hintColor),
			],
		);
	}
}
