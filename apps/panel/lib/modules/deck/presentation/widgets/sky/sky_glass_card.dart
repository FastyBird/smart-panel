import 'dart:ui';

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
		return ClipRRect(
			borderRadius: BorderRadius.circular(12),
			child: BackdropFilter(
				filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
				child: Container(
					padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
					decoration: BoxDecoration(
						color: isDark
								? Colors.white.withValues(alpha: 0.08)
								: Colors.white.withValues(alpha: 0.3),
						borderRadius: BorderRadius.circular(12),
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
