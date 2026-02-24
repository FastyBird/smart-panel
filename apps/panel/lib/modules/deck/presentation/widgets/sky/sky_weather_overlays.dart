import 'dart:math' as math;

import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:flutter/material.dart';

/// Weather particle overlays: rain, snow, wind, lightning, and fog.
///
/// Each overlay uses its own [AnimationController] for repeating animations.
class SkyWeatherOverlays extends StatelessWidget {
	final SkyVisualConfig config;

	const SkyWeatherOverlays({
		super.key,
		required this.config,
	});

	@override
	Widget build(BuildContext context) {
		return Stack(
			children: [
				if (config.showRain)
					Positioned.fill(
						child: _RainOverlay(
							intensity: config.rainIntensity,
							isNight: config.isNight,
						),
					),
				if (config.showSnow)
					Positioned.fill(
						child: _SnowOverlay(
							intensity: config.snowIntensity,
							isNight: config.isNight,
						),
					),
				if (config.showWind)
					Positioned.fill(
						child: _WindOverlay(isNight: config.isNight),
					),
				if (config.showLightning)
					const Positioned.fill(
						child: _LightningOverlay(),
					),
				if (config.showFog)
					Positioned.fill(
						child: _FogOverlay(isNight: config.isNight),
					),
			],
		);
	}
}

// =============================================================================
// RAIN
// =============================================================================

class _RainOverlay extends StatefulWidget {
	final int intensity;
	final bool isNight;

	const _RainOverlay({required this.intensity, required this.isNight});

	@override
	State<_RainOverlay> createState() => _RainOverlayState();
}

class _RainOverlayState extends State<_RainOverlay> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;
	late final List<_RainDrop> _drops;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
		final rng = math.Random(11);
		_drops = List.generate(
			widget.intensity,
			(_) => _RainDrop(
				x: rng.nextDouble(),
				y: rng.nextDouble(),
				speed: 0.6 + rng.nextDouble() * 0.8,
				length: 8 + rng.nextDouble() * 16,
				opacity: 0.15 + rng.nextDouble() * 0.35,
			),
		);
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
			builder: (_, __) => CustomPaint(
				painter: _RainPainter(_drops, _ctrl.value, widget.isNight),
				size: Size.infinite,
			),
		);
	}
}

class _RainDrop {
	final double x, y, speed, length, opacity;

	const _RainDrop({
		required this.x,
		required this.y,
		required this.speed,
		required this.length,
		required this.opacity,
	});
}

class _RainPainter extends CustomPainter {
	final List<_RainDrop> drops;
	final double t;
	final bool isNight;

	_RainPainter(this.drops, this.t, this.isNight);

	@override
	void paint(Canvas canvas, Size size) {
		for (final d in drops) {
			final y = ((d.y + t * d.speed) % 1.2) * size.height;
			final x = d.x * size.width;
			final dx = d.length * 0.15;
			canvas.drawLine(
				Offset(x, y),
				Offset(x + dx, y + d.length),
				Paint()
					..color = (isNight ? const Color(0xFF8899AA) : const Color(0xFFABBFD0))
							.withValues(alpha: d.opacity)
					..strokeWidth = 1.2
					..strokeCap = StrokeCap.round,
			);
		}
	}

	@override
	bool shouldRepaint(covariant _RainPainter old) => old.t != t;
}

// =============================================================================
// SNOW
// =============================================================================

class _SnowOverlay extends StatefulWidget {
	final int intensity;
	final bool isNight;

	const _SnowOverlay({required this.intensity, required this.isNight});

	@override
	State<_SnowOverlay> createState() => _SnowOverlayState();
}

class _SnowOverlayState extends State<_SnowOverlay> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;
	late final List<_SnowFlake> _flakes;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
		final rng = math.Random(22);
		_flakes = List.generate(
			widget.intensity,
			(_) => _SnowFlake(
				x: rng.nextDouble(),
				y: rng.nextDouble(),
				speed: 0.15 + rng.nextDouble() * 0.3,
				size: 1.5 + rng.nextDouble() * 3,
				drift: (rng.nextDouble() - 0.5) * 0.08,
				opacity: 0.3 + rng.nextDouble() * 0.5,
			),
		);
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
			builder: (_, __) => CustomPaint(
				painter: _SnowPainter(_flakes, _ctrl.value, widget.isNight),
				size: Size.infinite,
			),
		);
	}
}

class _SnowFlake {
	final double x, y, speed, size, drift, opacity;

	const _SnowFlake({
		required this.x,
		required this.y,
		required this.speed,
		required this.size,
		required this.drift,
		required this.opacity,
	});
}

class _SnowPainter extends CustomPainter {
	final List<_SnowFlake> flakes;
	final double t;
	final bool isNight;

	_SnowPainter(this.flakes, this.t, this.isNight);

	@override
	void paint(Canvas canvas, Size size) {
		for (final f in flakes) {
			final y = ((f.y + t * f.speed) % 1.1) * size.height;
			final sway = math.sin((t + f.x) * math.pi * 4) * 12;
			final x = (f.x * size.width + sway + (t * f.drift * size.width)) % size.width;
			canvas.drawCircle(
				Offset(x, y),
				f.size,
				Paint()
					..color = (isNight ? const Color(0xFFCCDDEE) : Colors.white)
							.withValues(alpha: f.opacity),
			);
		}
	}

	@override
	bool shouldRepaint(covariant _SnowPainter old) => old.t != t;
}

// =============================================================================
// WIND
// =============================================================================

class _WindOverlay extends StatefulWidget {
	final bool isNight;

	const _WindOverlay({required this.isNight});

	@override
	State<_WindOverlay> createState() => _WindOverlayState();
}

class _WindOverlayState extends State<_WindOverlay> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;
	late final List<_WindStreak> _streaks;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
		final rng = math.Random(33);
		_streaks = List.generate(
			8,
			(_) => _WindStreak(
				y: rng.nextDouble(),
				speed: 0.4 + rng.nextDouble() * 0.6,
				length: 30 + rng.nextDouble() * 80,
				opacity: 0.08 + rng.nextDouble() * 0.18,
				offset: rng.nextDouble(),
			),
		);
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
			builder: (_, __) => CustomPaint(
				painter: _WindPainter(_streaks, _ctrl.value, widget.isNight),
				size: Size.infinite,
			),
		);
	}
}

class _WindStreak {
	final double y, speed, length, opacity, offset;

	const _WindStreak({
		required this.y,
		required this.speed,
		required this.length,
		required this.opacity,
		required this.offset,
	});
}

class _WindPainter extends CustomPainter {
	final List<_WindStreak> streaks;
	final double t;
	final bool isNight;

	_WindPainter(this.streaks, this.t, this.isNight);

	@override
	void paint(Canvas canvas, Size size) {
		for (final s in streaks) {
			final x = ((s.offset + t * s.speed) % 1.3) * size.width - s.length;
			final y = s.y * size.height;
			canvas.drawLine(
				Offset(x, y),
				Offset(x + s.length, y - 2),
				Paint()
					..shader = LinearGradient(
						colors: [
							Colors.white.withValues(alpha: 0),
							Colors.white.withValues(alpha: s.opacity),
							Colors.white.withValues(alpha: 0),
						],
					).createShader(Rect.fromLTWH(x, y, s.length, 2))
					..strokeWidth = 1.5
					..strokeCap = StrokeCap.round,
			);
		}
	}

	@override
	bool shouldRepaint(covariant _WindPainter old) => old.t != t;
}

// =============================================================================
// LIGHTNING
// =============================================================================

class _LightningOverlay extends StatefulWidget {
	const _LightningOverlay();

	@override
	State<_LightningOverlay> createState() => _LightningOverlayState();
}

class _LightningOverlayState extends State<_LightningOverlay> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;
	double _flashOpacity = 0;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
		_ctrl.addStatusListener((s) {
			if (s == AnimationStatus.completed) _ctrl.reverse();
		});
		_scheduleFlash();
	}

	void _scheduleFlash() {
		Future.delayed(Duration(milliseconds: 2000 + math.Random().nextInt(5000)), () {
			if (!mounted) return;
			setState(() => _flashOpacity = 0.15 + math.Random().nextDouble() * 0.2);
			_ctrl.forward();
			_scheduleFlash();
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
			builder: (_, __) => IgnorePointer(
				child: Container(
					color: Colors.white.withValues(alpha: _ctrl.value * _flashOpacity),
				),
			),
		);
	}
}

// =============================================================================
// FOG
// =============================================================================

class _FogOverlay extends StatelessWidget {
	final bool isNight;

	const _FogOverlay({required this.isNight});

	@override
	Widget build(BuildContext context) {
		final c = isNight ? const Color(0xFF1A2028) : const Color(0xFFD0D4D8);

		return IgnorePointer(
			child: Container(
				decoration: BoxDecoration(
					gradient: LinearGradient(
						begin: Alignment.topCenter,
						end: Alignment.bottomCenter,
						colors: [
							c.withValues(alpha: 0),
							c.withValues(alpha: 0.3),
							c.withValues(alpha: 0.55),
							c.withValues(alpha: 0.7),
						],
						stops: const [0, 0.3, 0.6, 1],
					),
				),
			),
		);
	}
}
