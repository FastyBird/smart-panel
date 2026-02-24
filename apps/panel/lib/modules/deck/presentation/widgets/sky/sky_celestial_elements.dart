import 'dart:math' as math;

import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:flutter/material.dart';

/// Renders sun, moon, and/or twinkling stars based on [SkyVisualConfig].
class SkyCelestialElements extends StatelessWidget {
	final SkyVisualConfig config;
	final bool isPortrait;

	const SkyCelestialElements({
		super.key,
		required this.config,
		required this.isPortrait,
	});

	@override
	Widget build(BuildContext context) {
		return Stack(
			children: [
				if (config.showSun)
					Positioned(
						top: isPortrait ? 16 : 30,
						right: isPortrait ? 32 : 48,
						child: _SunWidget(size: 40, opacity: config.sunOpacity),
					),
				if (config.showMoon)
					Positioned(
						top: isPortrait ? 12 : 24,
						right: isPortrait ? 32 : 48,
						child: const _MoonWidget(size: 34),
					),
				if (config.showStars) ..._buildStars(),
			],
		);
	}

	List<Widget> _buildStars() {
		final rng = math.Random(42);

		return List.generate(
			14,
			(i) => Positioned(
				top: rng.nextDouble() * (isPortrait ? 180 : 400),
				left: rng.nextDouble() * (isPortrait ? 360 : 340),
				child: _StarWidget(delay: Duration(milliseconds: (i * 300) % 3000)),
			),
		);
	}
}

class _SunWidget extends StatelessWidget {
	final double size;
	final double opacity;

	const _SunWidget({required this.size, this.opacity = 1.0});

	@override
	Widget build(BuildContext context) {
		return Opacity(
			opacity: opacity,
			child: Container(
				width: size,
				height: size,
				decoration: BoxDecoration(
					shape: BoxShape.circle,
					gradient: const RadialGradient(
						colors: [Color(0xFFFFE066), Color(0xFFFFD93D), Color(0x4DFFD93D)],
						stops: [0.3, 0.7, 1.0],
					),
					boxShadow: [
						BoxShadow(
							color: const Color(0xFFFFD93D).withValues(alpha: 0.5),
							blurRadius: 30,
							spreadRadius: 5,
						),
						BoxShadow(
							color: const Color(0xFFFFD93D).withValues(alpha: 0.2),
							blurRadius: 60,
							spreadRadius: 10,
						),
					],
				),
			),
		);
	}
}

class _MoonWidget extends StatelessWidget {
	final double size;

	const _MoonWidget({required this.size});

	@override
	Widget build(BuildContext context) {
		return Container(
			width: size,
			height: size,
			decoration: BoxDecoration(
				shape: BoxShape.circle,
				gradient: const RadialGradient(
					center: Alignment(-0.3, -0.2),
					colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)],
				),
				boxShadow: [
					BoxShadow(
						color: const Color(0xFFC8C8B4).withValues(alpha: 0.25),
						blurRadius: 20,
						spreadRadius: 2,
					),
				],
			),
		);
	}
}

class _StarWidget extends StatefulWidget {
	final Duration delay;

	const _StarWidget({required this.delay});

	@override
	State<_StarWidget> createState() => _StarWidgetState();
}

class _StarWidgetState extends State<_StarWidget> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3));
		Future.delayed(widget.delay, () {
			if (mounted) _ctrl.repeat(reverse: true);
		});
	}

	@override
	void dispose() {
		_ctrl.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		return AnimatedBuilder(
			animation: _ctrl,
			builder: (_, __) => Opacity(
				opacity: 0.3 + (_ctrl.value * 0.7),
				child: Container(
					width: 2,
					height: 2,
					decoration: const BoxDecoration(
						shape: BoxShape.circle,
						color: Colors.white,
					),
				),
			),
		);
	}
}
