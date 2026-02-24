import 'package:flutter/material.dart';

/// Animated gradient background that smoothly transitions when weather changes.
class SkyGradientBackground extends StatelessWidget {
	final List<Color> gradientColors;
	final bool isPortrait;

	const SkyGradientBackground({
		super.key,
		required this.gradientColors,
		required this.isPortrait,
	});

	@override
	Widget build(BuildContext context) {
		return AnimatedContainer(
			duration: const Duration(milliseconds: 800),
			curve: Curves.easeInOut,
			decoration: BoxDecoration(
				gradient: LinearGradient(
					begin: isPortrait ? Alignment.topCenter : Alignment.topLeft,
					end: isPortrait ? Alignment.bottomCenter : Alignment.bottomRight,
					colors: gradientColors,
				),
			),
		);
	}
}
