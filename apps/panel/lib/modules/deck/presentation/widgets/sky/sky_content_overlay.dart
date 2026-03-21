import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_glass_card.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_overview_model_builder.dart';
import 'package:flutter/material.dart';
import 'package:weather_icons/weather_icons.dart';

/// Text content overlay on the sky panel: clock, date,
/// weather glass card, and scene pills (landscape only).
class SkyContentOverlay extends StatelessWidget {
	final bool isPortrait;
	final bool isDark;
	final String roomName;
	final String time;
	final String date;
	final String? temperature;
	final String? weatherDescription;
	final IconData? weatherIcon;
	final Color primaryTextColor;
	final Color secondaryTextColor;
	final bool isCompact;
	final List<QuickScene> scenes;
	final bool isSceneTriggering;
	final String? triggeringSceneId;
	final ValueChanged<String>? onSceneTap;
	final VoidCallback? onWeatherTap;

	const SkyContentOverlay({
		super.key,
		required this.isPortrait,
		required this.isDark,
		required this.roomName,
		required this.time,
		required this.date,
		this.temperature,
		this.weatherDescription,
		this.weatherIcon,
		this.primaryTextColor = Colors.white,
		this.secondaryTextColor = const Color(0xBFFFFFFF),
		this.isCompact = false,
		this.scenes = const [],
		this.isSceneTriggering = false,
		this.triggeringSceneId,
		this.onSceneTap,
		this.onWeatherTap,
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
						fontWeight: FontWeight.w100,
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
		return GestureDetector(
		onTap: onWeatherTap,
		child: SkyGlassCard(
			isDark: isDark,
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				mainAxisSize: MainAxisSize.min,
				children: [
					Row(
						mainAxisSize: MainAxisSize.min,
						spacing: AppSpacings.pMd,
						children: [
							if (weatherIcon != null)
								BoxedIcon(
									weatherIcon!,
									size: AppSpacings.scale(22),
									color: primaryTextColor,
								),
							Text(
								temperature ?? '',
								style: TextStyle(
									fontSize: AppSpacings.scale(22),
									fontWeight: FontWeight.w700,
									color: primaryTextColor,
								),
							),
						],
					),
					if (weatherDescription != null)
						Text(
							weatherDescription!,
							style: TextStyle(fontSize: AppFontSize.base, color: secondaryTextColor),
						),
				],
			),
		),
		);
	}

	Widget _buildCompactWeatherCard() {
		return GestureDetector(
		onTap: onWeatherTap,
		child: SkyGlassCard(
			isDark: isDark,
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pSm,
				children: [
					if (weatherIcon != null)
						BoxedIcon(
							weatherIcon!,
							size: AppSpacings.scale(16),
							color: primaryTextColor,
						),
					Text(
						temperature ?? '',
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w700,
							color: primaryTextColor,
						),
					),
					if (weatherDescription != null)
						Text(
							weatherDescription!,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: secondaryTextColor,
							),
						),
				],
			),
		),
		);
	}

	Widget _buildScenePills() {
		final maxRows = isCompact ? 3 : 4;
		final pillHeight = AppSpacings.pSm * 2 + AppFontSize.extraSmall + 2;
		final maxHeight = maxRows * pillHeight + (maxRows - 1) * AppSpacings.pSm;

		return ConstrainedBox(
			constraints: BoxConstraints(maxHeight: maxHeight),
			child: Wrap(
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
									? primaryTextColor
									: secondaryTextColor.withValues(alpha: 0.15),
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
							border: !isTriggering
									? Border.all(color: secondaryTextColor.withValues(alpha: 0.12))
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
												color: primaryTextColor,
											),
											Text(
												scene.name,
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
													fontWeight: FontWeight.w600,
													color: primaryTextColor,
												),
											),
										],
									),
					),
				);
			}).toList(),
			),
		);
	}
}
