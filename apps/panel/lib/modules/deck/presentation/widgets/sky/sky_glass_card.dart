import 'dart:ui';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Frosted-glass card for displaying weather info on the sky panel.
class SkyGlassCard extends StatelessWidget {
	final bool isDark;
	final Widget child;
	final EdgeInsets? padding;

	const SkyGlassCard({
		super.key,
		required this.isDark,
		required this.child,
		this.padding,
	});

	@override
	Widget build(BuildContext context) {
		final radius = BorderRadius.circular(AppBorderRadius.base);

		return ClipRRect(
			borderRadius: radius,
			child: BackdropFilter(
				filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
				child: Container(
					padding: padding ?? EdgeInsets.symmetric(horizontal: AppSpacings.pLg, vertical: AppSpacings.pMd),
					decoration: BoxDecoration(
						color: isDark
								? Colors.white.withValues(alpha: 0.08)
								: Colors.white.withValues(alpha: 0.3),
						borderRadius: radius,
						border: Border.all(
							color: isDark
									? Colors.white.withValues(alpha: 0.12)
									: Colors.white.withValues(alpha: 0.45),
						),
					),
					child: child,
				),
			),
		);
	}
}
