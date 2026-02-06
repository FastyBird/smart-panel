import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaRemoteCard<T extends Enum> extends StatelessWidget {
	final List<T> availableKeys;
	final bool isEnabled;
	final ValueChanged<T> onKeyPress;
	final double Function(double) scale;
	final ThemeColors themeColor;
	/// When false, hides the card header label (icon + "Remote" text).
	final bool showLabel;

	const MediaRemoteCard({
		super.key,
		required this.availableKeys,
		required this.isEnabled,
		required this.onKeyPress,
		required this.scale,
		this.themeColor = ThemeColors.primary,
		this.showLabel = true,
	});

	static (FilledButtonThemeData theme, Color foreground) _filledButtonFor(
		Brightness brightness,
		ThemeColors key,
	) {
		final isDark = brightness == Brightness.dark;
		if (isDark) {
			switch (key) {
				case ThemeColors.primary:
					return (AppFilledButtonsDarkThemes.primary, AppFilledButtonsDarkThemes.primaryForegroundColor);
				case ThemeColors.success:
					return (AppFilledButtonsDarkThemes.success, AppFilledButtonsDarkThemes.successForegroundColor);
				case ThemeColors.warning:
					return (AppFilledButtonsDarkThemes.warning, AppFilledButtonsDarkThemes.warningForegroundColor);
				case ThemeColors.danger:
					return (AppFilledButtonsDarkThemes.danger, AppFilledButtonsDarkThemes.dangerForegroundColor);
				case ThemeColors.error:
					return (AppFilledButtonsDarkThemes.error, AppFilledButtonsDarkThemes.errorForegroundColor);
				case ThemeColors.info:
					return (AppFilledButtonsDarkThemes.info, AppFilledButtonsDarkThemes.infoForegroundColor);
				case ThemeColors.neutral:
					return (AppFilledButtonsDarkThemes.neutral, AppFilledButtonsDarkThemes.neutralForegroundColor);
				case ThemeColors.flutter:
					return (AppFilledButtonsDarkThemes.flutter, AppFilledButtonsDarkThemes.flutterForegroundColor);
				case ThemeColors.teal:
					return (AppFilledButtonsDarkThemes.teal, AppFilledButtonsDarkThemes.tealForegroundColor);
				case ThemeColors.cyan:
					return (AppFilledButtonsDarkThemes.cyan, AppFilledButtonsDarkThemes.cyanForegroundColor);
				case ThemeColors.pink:
					return (AppFilledButtonsDarkThemes.pink, AppFilledButtonsDarkThemes.pinkForegroundColor);
				case ThemeColors.indigo:
					return (AppFilledButtonsDarkThemes.indigo, AppFilledButtonsDarkThemes.indigoForegroundColor);
			}
		} else {
			switch (key) {
				case ThemeColors.primary:
					return (AppFilledButtonsLightThemes.primary, AppFilledButtonsLightThemes.primaryForegroundColor);
				case ThemeColors.success:
					return (AppFilledButtonsLightThemes.success, AppFilledButtonsLightThemes.successForegroundColor);
				case ThemeColors.warning:
					return (AppFilledButtonsLightThemes.warning, AppFilledButtonsLightThemes.warningForegroundColor);
				case ThemeColors.danger:
					return (AppFilledButtonsLightThemes.danger, AppFilledButtonsLightThemes.dangerForegroundColor);
				case ThemeColors.error:
					return (AppFilledButtonsLightThemes.error, AppFilledButtonsLightThemes.errorForegroundColor);
				case ThemeColors.info:
					return (AppFilledButtonsLightThemes.info, AppFilledButtonsLightThemes.infoForegroundColor);
				case ThemeColors.neutral:
					return (AppFilledButtonsLightThemes.neutral, AppFilledButtonsLightThemes.neutralForegroundColor);
				case ThemeColors.flutter:
					return (AppFilledButtonsLightThemes.flutter, AppFilledButtonsLightThemes.flutterForegroundColor);
				case ThemeColors.teal:
					return (AppFilledButtonsLightThemes.teal, AppFilledButtonsLightThemes.tealForegroundColor);
				case ThemeColors.cyan:
					return (AppFilledButtonsLightThemes.cyan, AppFilledButtonsLightThemes.cyanForegroundColor);
				case ThemeColors.pink:
					return (AppFilledButtonsLightThemes.pink, AppFilledButtonsLightThemes.pinkForegroundColor);
				case ThemeColors.indigo:
					return (AppFilledButtonsLightThemes.indigo, AppFilledButtonsLightThemes.indigoForegroundColor);
			}
		}
	}

	bool _hasKey(String name) => availableKeys.any((k) => k.name == name);

	T? _findKey(String name) {
		for (final k in availableKeys) {
			if (k.name == name) return k;
		}
		return null;
	}

	IconData _iconForName(String name) => switch (name) {
		'arrowUp' => MdiIcons.chevronUp,
		'arrowDown' => MdiIcons.chevronDown,
		'arrowLeft' => MdiIcons.chevronLeft,
		'arrowRight' => MdiIcons.chevronRight,
		'select' => MdiIcons.radioboxMarked,
		'back' => MdiIcons.arrowLeft,
		'exit' => MdiIcons.circleOutline,
		'info' => MdiIcons.informationOutline,
		'rewind' => MdiIcons.rewind,
		'fastForward' => MdiIcons.fastForward,
		'play' => MdiIcons.play,
		'pause' => MdiIcons.pause,
		'next' => MdiIcons.skipNext,
		'previous' => MdiIcons.skipPrevious,
		_ => MdiIcons.help,
	};

	void _sendKey(T key) {
		if (!isEnabled) return;
		HapticFeedback.lightImpact();
		onKeyPress(key);
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

		final hasUp = _hasKey('arrowUp');
		final hasDown = _hasKey('arrowDown');
		final hasLeft = _hasKey('arrowLeft');
		final hasRight = _hasKey('arrowRight');
		final hasSelect = _hasKey('select');
		final hasDpad = hasUp || hasDown || hasLeft || hasRight || hasSelect;

		const transportOrder = ['previous', 'rewind', 'play', 'pause', 'fastForward', 'next'];
		const navKeys = {'back', 'exit', 'info'};

		final transportActions = transportOrder
			.where((name) => _hasKey(name))
			.map((name) => _findKey(name)!)
			.toList();

		final navActions = availableKeys
			.where((k) => navKeys.contains(k.name))
			.toList();

		final themeData = Theme.of(context).brightness == Brightness.light
			? ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral)
			: ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral);

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Theme(
				data: themeData,
				child: Column(
				spacing: AppSpacings.pMd,
				children: [
					if (showLabel) ...[
						Row(
							spacing: AppSpacings.pSm,
							children: [
								Icon(MdiIcons.remote, size: AppFontSize.small, color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
								Text(
									localizations.media_remote.toUpperCase(),
									style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.bold, color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
								),
							],
						),
					],
					if (hasDpad) ...[
						if (hasUp)
							_buildDpadButton(
								context,
								icon: MdiIcons.chevronUp,
								onTap: isEnabled ? () => _sendKey(_findKey('arrowUp')!) : null,
							),
						Row(
							mainAxisSize: MainAxisSize.min,
							spacing: AppSpacings.pSm,
							children: [
								if (hasLeft)
									_buildDpadButton(
										context,
										icon: MdiIcons.chevronLeft,
										onTap: isEnabled ? () => _sendKey(_findKey('arrowLeft')!) : null,
									),
								if (hasSelect)
									_buildDpadButton(
										context,
										label: localizations.media_remote_ok,
										isPrimary: true,
										onTap: isEnabled ? () => _sendKey(_findKey('select')!) : null,
									),
								if (hasRight)
									_buildDpadButton(
										context,
										icon: MdiIcons.chevronRight,
										onTap: isEnabled ? () => _sendKey(_findKey('arrowRight')!) : null,
									),
							],
						),
						if (hasDown)
							_buildDpadButton(
								context,
								icon: MdiIcons.chevronDown,
								onTap: isEnabled ? () => _sendKey(_findKey('arrowDown')!) : null,
							),
					],
					if (transportActions.isNotEmpty) ...[
						Row(
							mainAxisAlignment: MainAxisAlignment.center,
							children: transportActions.map((key) {
								final isMain = key.name == 'play';
								return Padding(
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
									child: _buildTransportButton(
										context,
										icon: _iconForName(key.name),
										isMain: isMain,
										onTap: isEnabled ? () => _sendKey(key) : null,
									),
								);
							}).toList(),
						),
					],
					if (navActions.isNotEmpty) ...[
						Row(
							mainAxisAlignment: MainAxisAlignment.center,
							children: navActions.map((key) {
								return Padding(
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
									child: _buildDpadButton(
										context,
										icon: _iconForName(key.name),
										onTap: isEnabled ? () => _sendKey(key) : null,
									),
								);
							}).toList(),
						),
					],
				],
				),
			),
		);
	}

	Widget _buildTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		VoidCallback? onTap,
	}) {
		final size = scale(isMain ? 44 : 32);
		final iconSize = scale(isMain ? 22 : 16);
		final brightness = Theme.of(context).brightness;
		final (accentTheme, accentFg) = _filledButtonFor(brightness, themeColor);
		final (neutralTheme, neutralFg) = _filledButtonFor(brightness, ThemeColors.neutral);
		final (filledTheme, foregroundColor) = isMain ? (accentTheme, accentFg) : (neutralTheme, neutralFg);

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: Theme.of(context).copyWith(filledButtonTheme: filledTheme),
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: AppSpacings.paddingMd,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: RoundedRectangleBorder(
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
					),
					child: Icon(
						icon,
						size: iconSize,
						color: foregroundColor,
					),
				),
			),
		);
	}

	Widget _buildDpadButton(
		BuildContext context, {
		IconData? icon,
		String? label,
		bool isPrimary = false,
		VoidCallback? onTap,
	}) {
		final size = scale(40);
		final brightness = Theme.of(context).brightness;
		final (accentTheme, accentFg) = _filledButtonFor(brightness, themeColor);
		final (neutralTheme, neutralFg) = _filledButtonFor(brightness, ThemeColors.neutral);
		final (filledTheme, foregroundColor) = isPrimary ? (accentTheme, accentFg) : (neutralTheme, neutralFg);

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: Theme.of(context).copyWith(filledButtonTheme: filledTheme),
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: AppSpacings.paddingMd,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: RoundedRectangleBorder(
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
					),
					child: icon != null
						? Icon(
							icon,
							size: scale(20),
							color: foregroundColor,
						)
						: Text(
							label ?? '',
							style: TextStyle(
								fontSize: AppFontSize.small,
								fontWeight: FontWeight.w600,
							),
						),
				),
			),
		);
	}
}
