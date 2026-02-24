import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_glass_card.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_overview_model_builder.dart';
import 'package:flutter/material.dart';

/// Text content overlay on the sky panel: room name, clock, date,
/// weather glass card, and scene pills (landscape only).
class SkyContentOverlay extends StatelessWidget {
	final bool isPortrait;
	final bool isNight;
	final String roomName;
	final String time;
	final String date;
	final String? temperature;
	final String? weatherDescription;
	final List<QuickScene> scenes;
	final bool isSceneTriggering;
	final String? triggeringSceneId;
	final ValueChanged<String>? onSceneTap;

	const SkyContentOverlay({
		super.key,
		required this.isPortrait,
		required this.isNight,
		required this.roomName,
		required this.time,
		required this.date,
		this.temperature,
		this.weatherDescription,
		this.scenes = const [],
		this.isSceneTriggering = false,
		this.triggeringSceneId,
		this.onSceneTap,
	});

	@override
	Widget build(BuildContext context) {
		return Padding(
			padding: isPortrait
					? const EdgeInsets.symmetric(horizontal: 20, vertical: 16)
					: const EdgeInsets.fromLTRB(24, 28, 24, 28),
			child: isPortrait ? _buildPortrait() : _buildLandscape(),
		);
	}

	Widget _buildLandscape() {
		final dim = Colors.white.withValues(alpha: isNight ? 0.5 : 0.75);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				Text(
					roomName,
					style: TextStyle(
						fontSize: 11,
						fontWeight: FontWeight.w600,
						color: Colors.white.withValues(alpha: isNight ? 0.5 : 0.8),
						letterSpacing: 1.5,
					),
				),
				const SizedBox(height: 4),
				Text(
					time,
					style: TextStyle(
						fontSize: 64,
						fontWeight: FontWeight.w200,
						color: Colors.white.withValues(alpha: isNight ? 0.9 : 1.0),
						height: 1.0,
						letterSpacing: -2,
					),
				),
				const SizedBox(height: 4),
				Text(date, style: TextStyle(fontSize: 12, color: dim)),
				if (temperature != null) ...[
					const SizedBox(height: 16),
					_buildWeatherCard(),
				],
				if (scenes.isNotEmpty) ...[
					const SizedBox(height: 12),
					_buildScenePills(),
				],
			],
		);
	}

	Widget _buildPortrait() {
		return Column(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				Text(
					roomName,
					style: TextStyle(
						fontSize: 10,
						fontWeight: FontWeight.w600,
						color: Colors.white.withValues(alpha: isNight ? 0.45 : 0.8),
						letterSpacing: 1.5,
					),
				),
				const SizedBox(height: 2),
				Text(
					time,
					style: TextStyle(
						fontSize: 48,
						fontWeight: FontWeight.w200,
						color: Colors.white.withValues(alpha: isNight ? 0.85 : 1.0),
						height: 1.0,
						letterSpacing: -1.5,
					),
				),
				const SizedBox(height: 4),
				Text(
					date,
					style: TextStyle(
						fontSize: 11,
						color: Colors.white.withValues(alpha: isNight ? 0.35 : 0.7),
					),
				),
				if (temperature != null) ...[
					const SizedBox(height: 10),
					_buildCompactWeatherCard(),
				],
			],
		);
	}

	Widget _buildWeatherCard() {
		final muted = Colors.white.withValues(alpha: isNight ? 0.4 : 0.65);

		return SkyGlassCard(
			isNight: isNight,
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						mainAxisSize: MainAxisSize.min,
						children: [
							Text(
								temperature ?? '',
								style: const TextStyle(
									fontSize: 16,
									fontWeight: FontWeight.w700,
									color: Colors.white,
								),
							),
							if (weatherDescription != null)
								Text(
									weatherDescription!,
									style: TextStyle(fontSize: 10, color: muted),
								),
						],
					),
				],
			),
		);
	}

	Widget _buildCompactWeatherCard() {
		return SkyGlassCard(
			isNight: isNight,
			padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					Text(
						temperature ?? '',
						style: const TextStyle(
							fontSize: 13,
							fontWeight: FontWeight.w700,
							color: Colors.white,
						),
					),
					if (weatherDescription != null) ...[
						const SizedBox(width: 6),
						Text(
							weatherDescription!,
							style: TextStyle(
								fontSize: 9,
								color: Colors.white.withValues(alpha: 0.8),
							),
						),
					],
				],
			),
		);
	}

	Widget _buildScenePills() {
		return Wrap(
			spacing: 5,
			runSpacing: 5,
			children: scenes.map((scene) {
				final isTriggering = triggeringSceneId == scene.sceneId;

				return GestureDetector(
					onTap: (isSceneTriggering || onSceneTap == null)
							? null
							: () => onSceneTap!(scene.sceneId),
					child: Container(
						padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
						decoration: BoxDecoration(
							color: isTriggering
									? AppColors.white
									: Colors.white.withValues(alpha: isNight ? 0.06 : 0.25),
							borderRadius: BorderRadius.circular(8),
							border: isNight && !isTriggering
									? Border.all(color: Colors.white.withValues(alpha: 0.08))
									: null,
						),
						child: isTriggering
								? SizedBox(
										width: 12,
										height: 12,
										child: CircularProgressIndicator(
											strokeWidth: 1.5,
											color: Colors.white.withValues(alpha: 0.7),
										),
									)
								: Row(
										mainAxisSize: MainAxisSize.min,
										children: [
											Icon(
												scene.icon,
												size: 12,
												color: Colors.white.withValues(alpha: isNight ? 0.5 : 0.9),
											),
											const SizedBox(width: 4),
											Text(
												scene.name,
												style: TextStyle(
													fontSize: 10,
													fontWeight: FontWeight.w600,
													color: Colors.white.withValues(
														alpha: isNight ? 0.5 : 0.9,
													),
												),
											),
										],
									),
					),
				);
			}).toList(),
		);
	}
}
