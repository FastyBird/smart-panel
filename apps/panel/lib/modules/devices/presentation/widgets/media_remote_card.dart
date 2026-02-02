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
	final Color? accentColor;

	const MediaRemoteCard({
		super.key,
		required this.availableKeys,
		required this.isEnabled,
		required this.onKeyPress,
		required this.scale,
		this.accentColor,
	});

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
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

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

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				children: [
					Row(
						children: [
							Icon(MdiIcons.remote, size: AppFontSize.small, color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
							AppSpacings.spacingSmHorizontal,
							Text(
								localizations.media_remote.toUpperCase(),
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.bold, color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					if (hasDpad) ...[
						if (hasUp)
							_buildDpadButton(
								context,
								icon: MdiIcons.chevronUp,
								onTap: isEnabled ? () => _sendKey(_findKey('arrowUp')!) : null,
							),
						AppSpacings.spacingSmVertical,
						Row(
							mainAxisSize: MainAxisSize.min,
							children: [
								if (hasLeft)
									_buildDpadButton(
										context,
										icon: MdiIcons.chevronLeft,
										onTap: isEnabled ? () => _sendKey(_findKey('arrowLeft')!) : null,
									),
								if (hasSelect) ...[
									AppSpacings.spacingSmHorizontal,
									_buildDpadButton(
										context,
										label: localizations.media_remote_ok,
										isPrimary: true,
										onTap: isEnabled ? () => _sendKey(_findKey('select')!) : null,
									),
									AppSpacings.spacingSmHorizontal,
								],
								if (hasRight)
									_buildDpadButton(
										context,
										icon: MdiIcons.chevronRight,
										onTap: isEnabled ? () => _sendKey(_findKey('arrowRight')!) : null,
									),
							],
						),
						AppSpacings.spacingSmVertical,
						if (hasDown)
							_buildDpadButton(
								context,
								icon: MdiIcons.chevronDown,
								onTap: isEnabled ? () => _sendKey(_findKey('arrowDown')!) : null,
							),
					],
					if (transportActions.isNotEmpty) ...[
						AppSpacings.spacingLgVertical,
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
						AppSpacings.spacingLgVertical,
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
		);
	}

	Widget _buildTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		bool isActive = false,
		VoidCallback? onTap,
	}) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final effectiveAccent = accentColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
		final baseColor = isDark ? AppFillColorDark.base : AppFillColorLight.base;

		final size = scale(isMain ? 44 : 32);
		final iconSize = scale(isMain ? 22 : 16);

		final Color bgColor;
		final Color iconColor;

		if (isActive || isMain) {
			bgColor = effectiveAccent;
			iconColor = AppColors.white;
		} else {
			bgColor = baseColor;
			iconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		}

		final border = (isActive || isMain) || isDark ? null : Border.all(color: AppBorderColorLight.base);

		return SizedBox(
			width: size,
			height: size,
			child: Material(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				child: InkWell(
					onTap: onTap,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					child: Container(
						decoration: BoxDecoration(
							border: border,
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Center(
							child: Icon(
								icon,
								size: iconSize,
								color: iconColor,
							),
						),
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
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final effectiveAccent = accentColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
		final baseColor = isDark ? AppFillColorDark.base : AppFillColorLight.base;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final size = scale(40);

		final bgColor = isPrimary ? effectiveAccent : baseColor;
		final contentColor = isPrimary ? AppColors.white : secondaryColor;
		final border = isPrimary || isDark ? null : Border.all(color: AppBorderColorLight.base);

		return SizedBox(
			width: size,
			height: size,
			child: Material(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				child: InkWell(
					onTap: onTap,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					child: Container(
						decoration: BoxDecoration(
							border: border,
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Center(
							child: icon != null
								? Icon(icon, size: scale(20), color: contentColor)
								: Text(
									label ?? '',
									style: TextStyle(
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w600,
										color: contentColor,
									),
								),
						),
					),
				),
			),
		);
	}
}
