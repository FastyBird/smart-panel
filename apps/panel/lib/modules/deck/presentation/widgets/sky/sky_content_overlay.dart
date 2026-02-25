import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_glass_card.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_overview_model_builder.dart';
import 'package:flutter/material.dart';

/// Text content overlay on the sky panel: clock, date,
/// weather glass card, and scene pills (landscape only).
class SkyContentOverlay extends StatelessWidget {
	final bool isPortrait;
	final bool isNight;
	final String roomName;
	final String time;
	final String date;
	final String? temperature;
	final String? weatherDescription;
	final Color primaryTextColor;
	final Color secondaryTextColor;
	final bool isCompact;
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
		this.primaryTextColor = Colors.white,
		this.secondaryTextColor = const Color(0xBFFFFFFF),
		this.isCompact = false,
		this.scenes = const [],
		this.isSceneTriggering = false,
		this.triggeringSceneId,
		this.onSceneTap,
	});

	@override
	Widget build(BuildContext context) {
		return Padding(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pLg,
				vertical: AppSpacings.pLg,
			),
			child: isPortrait ? _buildPortrait() : _buildLandscape(),
		);
	}

	Widget _buildLandscape() {
		final clockSize = AppSpacings.scale(isCompact ? 48 : 72);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				Text(
					time,
					style: TextStyle(
						fontSize: clockSize,
						fontWeight: FontWeight.w200,
						color: primaryTextColor,
						height: 1.0,
						letterSpacing: -2,
					),
				),
				SizedBox(height: AppSpacings.pSm),
				Text(date, style: TextStyle(fontSize: isCompact ? AppFontSize.base : AppFontSize.large, color: secondaryTextColor)),
				if (temperature != null) ...[
					SizedBox(height: AppSpacings.pLg),
					_buildWeatherCard(),
				],
				if (scenes.isNotEmpty) ...[
					SizedBox(height: AppSpacings.pMd),
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
					time,
					style: TextStyle(
						fontSize: AppSpacings.scale(56),
						fontWeight: FontWeight.w200,
						color: primaryTextColor,
						height: 1.0,
						letterSpacing: -1.5,
					),
				),
				SizedBox(height: AppSpacings.pSm),
				Text(
					date,
					style: TextStyle(
						fontSize: AppFontSize.base,
						color: secondaryTextColor,
					),
				),
				if (temperature != null) ...[
					SizedBox(height: AppSpacings.pMd),
					_buildCompactWeatherCard(),
				],
			],
		);
	}

	Widget _buildWeatherCard() {
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
								style: TextStyle(
									fontSize: AppFontSize.extraLarge,
									fontWeight: FontWeight.w700,
									color: primaryTextColor,
								),
							),
							if (weatherDescription != null)
								Text(
									weatherDescription!,
									style: TextStyle(fontSize: AppFontSize.base, color: secondaryTextColor),
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
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					Text(
						temperature ?? '',
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w700,
							color: primaryTextColor,
						),
					),
					if (weatherDescription != null) ...[
						SizedBox(width: AppSpacings.pSm),
						Text(
							weatherDescription!,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: secondaryTextColor,
							),
						),
					],
				],
			),
		);
	}

	Widget _buildScenePills() {
		return Wrap(
			spacing: AppSpacings.pSm,
			runSpacing: AppSpacings.pSm,
			children: scenes.map((scene) {
				final isTriggering = triggeringSceneId == scene.sceneId;

				return GestureDetector(
					onTap: (isSceneTriggering || onSceneTap == null)
							? null
							: () => onSceneTap!(scene.sceneId),
					child: Container(
						padding: EdgeInsets.symmetric(
							horizontal: AppSpacings.pMd,
							vertical: AppSpacings.pSm,
						),
						decoration: BoxDecoration(
							color: isTriggering
									? AppColors.white
									: Colors.white.withValues(alpha: isNight ? 0.06 : 0.25),
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
							border: isNight && !isTriggering
									? Border.all(color: Colors.white.withValues(alpha: 0.08))
									: null,
						),
						child: isTriggering
								? SizedBox(
										width: AppSpacings.scale(12),
										height: AppSpacings.scale(12),
										child: CircularProgressIndicator(
											strokeWidth: 1.5,
											color: Colors.white.withValues(alpha: 0.7),
										),
									)
								: Row(
										mainAxisSize: MainAxisSize.min,
										spacing: AppSpacings.pSm,
										children: [
											Icon(
												scene.icon,
												size: AppSpacings.scale(12),
												color: Colors.white.withValues(alpha: isNight ? 0.5 : 0.9),
											),
											Text(
												scene.name,
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
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
