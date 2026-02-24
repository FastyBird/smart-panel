import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/screen_layout.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

// ---------------------------------------------------------------------------
// Color mapping helpers
// ---------------------------------------------------------------------------

Color _schemeColor(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.error : AppColorsLight.error,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warning : AppColorsLight.warning,
	OverlayColorScheme.info => isDark ? AppColorsDark.info : AppColorsLight.info,
	OverlayColorScheme.success => isDark ? AppColorsDark.success : AppColorsLight.success,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primary : AppColorsLight.primary,
};

Color _schemeColorLight(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9,
	OverlayColorScheme.info => isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9,
	OverlayColorScheme.success => isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9,
};

Color _bannerBg(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.errorLight7 : AppColorsLight.errorLight9,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warningLight7 : AppColorsLight.warningLight9,
	OverlayColorScheme.info => isDark ? AppColorsDark.infoLight7 : AppColorsLight.infoLight9,
	OverlayColorScheme.success => isDark ? AppColorsDark.successLight7 : AppColorsLight.successLight9,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primaryLight7 : AppColorsLight.primaryLight9,
};

Color _bannerFg(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.error : AppColorsLight.errorDark2,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warning : AppColorsLight.warningDark2,
	OverlayColorScheme.info => isDark ? AppColorsDark.info : AppColorsLight.infoDark2,
	OverlayColorScheme.success => isDark ? AppColorsDark.success : AppColorsLight.successDark2,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primary : AppColorsLight.primaryDark2,
};

Color _bannerSpinner(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.error : AppColorsLight.error,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warning : AppColorsLight.warning,
	OverlayColorScheme.info => isDark ? AppColorsDark.info : AppColorsLight.info,
	OverlayColorScheme.success => isDark ? AppColorsDark.success : AppColorsLight.success,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primary : AppColorsLight.primary,
};

Color _bannerButtonBorder(OverlayColorScheme scheme, bool isDark) => switch (scheme) {
	OverlayColorScheme.error => isDark ? AppColorsDark.errorDark2 : AppColorsLight.errorDark2,
	OverlayColorScheme.warning => isDark ? AppColorsDark.warningDark2 : AppColorsLight.warningDark2,
	OverlayColorScheme.info => isDark ? AppColorsDark.infoDark2 : AppColorsLight.infoDark2,
	OverlayColorScheme.success => isDark ? AppColorsDark.successDark2 : AppColorsLight.successDark2,
	OverlayColorScheme.primary => isDark ? AppColorsDark.primaryDark2 : AppColorsLight.primaryDark2,
};

// ---------------------------------------------------------------------------
// OverlayRenderer
// ---------------------------------------------------------------------------

/// Renders active overlays from the [OverlayManager] as a Stack layer.
///
/// Place this widget as a child in the main app Stack. It listens to
/// the [OverlayManager] and renders all active overlays sorted by priority,
/// with appropriate positioning based on their [OverlayDisplayType].
///
/// For each entry, if [AppOverlayEntry.customBuilder] is set it is rendered
/// directly. Otherwise, a standard layout is used based on [displayType]:
/// - **banner** — colored top bar with slide-in animation
/// - **overlay** — dimmed background + centered modal card
/// - **fullScreen** — scaffold page with icon, text, and responsive buttons
class OverlayRenderer extends StatelessWidget {
	const OverlayRenderer({super.key});

	@override
	Widget build(BuildContext context) {
		return Consumer<OverlayManager>(
			builder: (context, manager, _) {
				final active = manager.activeEntries;

				if (active.isEmpty) {
					return const SizedBox.shrink();
				}

				final children = <Widget>[];

				for (final entry in active) {
					final widget = _buildEntry(context, entry);

					switch (entry.displayType) {
						case OverlayDisplayType.banner:
							children.add(
								Positioned(
									top: 0,
									left: 0,
									right: 0,
									child: KeyedSubtree(
										key: ValueKey(entry.id),
										child: widget,
									),
								),
							);
							break;

						case OverlayDisplayType.overlay:
						case OverlayDisplayType.fullScreen:
							Widget content = KeyedSubtree(
								key: ValueKey(entry.id),
								child: widget,
							);

							if (entry.closable) {
								content = GestureDetector(
									onTap: () => manager.hide(entry.id),
									behavior: HitTestBehavior.opaque,
									child: content,
								);
							}

							children.add(
								Positioned.fill(child: content),
							);
							break;
					}
				}

				return Stack(children: children);
			},
		);
	}

	Widget _buildEntry(BuildContext context, AppOverlayEntry entry) {
		// Escape hatch: custom builder bypasses standard layout
		if (entry.customBuilder != null) {
			return entry.customBuilder!(context);
		}

		return switch (entry.displayType) {
			OverlayDisplayType.banner => _AnimatedBanner(entry: entry),
			OverlayDisplayType.overlay => _OverlayCard(entry: entry),
			OverlayDisplayType.fullScreen => _FullScreenPage(entry: entry),
		};
	}
}

// ---------------------------------------------------------------------------
// Banner layout — colored top bar with slide-in animation
// ---------------------------------------------------------------------------

class _AnimatedBanner extends StatefulWidget {
	final AppOverlayEntry entry;

	const _AnimatedBanner({required this.entry});

	@override
	State<_AnimatedBanner> createState() => _AnimatedBannerState();
}

class _AnimatedBannerState extends State<_AnimatedBanner>
		with SingleTickerProviderStateMixin {
	late final AnimationController _controller;
	late final Animation<Offset> _slideAnimation;

	@override
	void initState() {
		super.initState();

		_controller = AnimationController(
			duration: const Duration(milliseconds: 300),
			vsync: this,
		);

		_slideAnimation = Tween<Offset>(
			begin: const Offset(0, -1),
			end: Offset.zero,
		).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

		_controller.forward();
	}

	@override
	void dispose() {
		_controller.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final entry = widget.entry;

		final backgroundColor = _bannerBg(entry.colorScheme, isDark);
		final textColor = _bannerFg(entry.colorScheme, isDark);
		final spinnerColor = _bannerSpinner(entry.colorScheme, isDark);
		final buttonBorderColor = _bannerButtonBorder(entry.colorScheme, isDark);

		return SlideTransition(
			position: _slideAnimation,
			child: Material(
				elevation: 2,
				child: Container(
					width: double.infinity,
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pLg,
						vertical: AppSpacings.pMd,
					),
					color: backgroundColor,
					child: SafeArea(
						bottom: false,
						child: Row(
							mainAxisAlignment: MainAxisAlignment.center,
							children: [
								if (entry.showProgress) ...[
									SizedBox(
										width: AppSpacings.pLg,
										height: AppSpacings.pLg,
										child: CircularProgressIndicator(
											strokeWidth: 2,
											color: spinnerColor,
										),
									),
									AppSpacings.spacingMdHorizontal,
								],
								if (entry.title != null)
									Text(
										entry.title!(localizations),
										style: TextStyle(
											color: textColor,
											fontSize: AppFontSize.base,
											fontWeight: FontWeight.w500,
										),
									),
								if (entry.actions.isNotEmpty) ...[
									AppSpacings.spacingMdHorizontal,
									_buildBannerAction(
										entry.actions.first,
										localizations,
										isDark,
										spinnerColor,
										buttonBorderColor,
									),
								],
							],
						),
					),
				),
			),
		);
	}

	Widget _buildBannerAction(
		OverlayAction action,
		AppLocalizations localizations,
		bool isDark,
		Color spinnerColor,
		Color buttonBorderColor,
	) {
		return SizedBox(
			height: AppSpacings.pLg + AppSpacings.pSm,
			child: OutlinedButton(
				onPressed: action.loading ? null : action.onPressed,
				style: OutlinedButton.styleFrom(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pSm,
						vertical: 0,
					),
					minimumSize: Size.zero,
					tapTargetSize: MaterialTapTargetSize.shrinkWrap,
					backgroundColor: Colors.transparent,
					side: BorderSide(
						color: action.loading
								? buttonBorderColor.withValues(alpha: 0.5)
								: buttonBorderColor,
						width: AppSpacings.scale(1),
					),
					shape: RoundedRectangleBorder(
						borderRadius: BorderRadius.circular(
							AppBorderRadius.round,
						),
					),
				),
				child: action.loading
						? SizedBox(
								width: AppFontSize.small,
								height: AppFontSize.small,
								child: CircularProgressIndicator(
									strokeWidth: 1.5,
									color: spinnerColor.withValues(alpha: 0.7),
								),
							)
						: Text(
								action.label(localizations),
								style: TextStyle(
									color: spinnerColor,
									fontSize: AppFontSize.small,
									fontWeight: FontWeight.w600,
								),
							),
			),
		);
	}
}

// ---------------------------------------------------------------------------
// Overlay layout — dimmed background + centered modal card
// ---------------------------------------------------------------------------

class _OverlayCard extends StatelessWidget {
	final AppOverlayEntry entry;

	const _OverlayCard({required this.entry});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final color = _schemeColor(entry.colorScheme, isDark);
		final colorLight = _schemeColorLight(entry.colorScheme, isDark);

		return Material(
			type: MaterialType.transparency,
			child: Container(
				color: isDark
						? AppOverlayColorDark.lighter
						: AppOverlayColorLight.lighter,
				child: Center(
					child: ListenableBuilder(
						listenable: screenService,
						builder: (context, _) {
							final isCompact =
									(screenService.isLandscape && !screenService.isLargeScreen) ||
									(screenService.isPortrait && screenService.isSmallScreen);
							final cardPadding = isCompact
									? AppSpacings.pMd
									: AppSpacings.pLg + AppSpacings.pMd;

							return Container(
								margin: EdgeInsets.all(AppSpacings.pXl),
								padding: EdgeInsets.all(cardPadding),
								constraints: BoxConstraints(
									maxWidth: screenService.scale(320),
								),
								decoration: BoxDecoration(
									color: isDark ? AppFillColorDark.base : AppFillColorLight.blank,
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
									boxShadow: [
										BoxShadow(
											color: AppShadowColor.strong,
											blurRadius: screenService.scale(20),
											offset: Offset(0, screenService.scale(4)),
										),
									],
								),
								child: Column(
									mainAxisSize: MainAxisSize.min,
									children: [
										// Scrollable body (icon, title, message, content)
										Flexible(
											child: SingleChildScrollView(
												child: Column(
													mainAxisSize: MainAxisSize.min,
													children: [
														// Icon or spinner
														_buildOverlayIcon(
															screenService,
															isDark,
															color,
															colorLight,
														),
														AppSpacings.spacingLgVertical,
														// Title
														if (entry.title != null)
															Text(
																entry.title!(localizations),
																style: TextStyle(
																	color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
																	fontSize: AppFontSize.extraLarge,
																	fontWeight: FontWeight.w600,
																),
																textAlign: TextAlign.center,
															),
														if (entry.message != null) ...[
															AppSpacings.spacingMdVertical,
															Text(
																entry.message!(localizations),
																style: TextStyle(
																	color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
																	fontSize: AppFontSize.base,
																	height: 1.4,
																),
																textAlign: TextAlign.center,
															),
														],
														if (entry.content != null) ...[
															AppSpacings.spacingMdVertical,
															entry.content!,
														],
													],
												),
											),
										),
										// Fixed footer actions
										if (entry.actions.isNotEmpty) ...[
											SizedBox(height: AppSpacings.pMd),
											_buildCardActions(context, entry.actions, localizations, isDark),
										],
									],
								),
							);
						},
					),
				),
			),
		);
	}

	Widget _buildOverlayIcon(
		ScreenService screenService,
		bool isDark,
		Color color,
		Color colorLight,
	) {
		if (entry.showProgress && entry.icon != null) {
			// Spinner ring around icon
			return Stack(
				alignment: Alignment.center,
				children: [
					SizedBox(
						width: screenService.scale(56),
						height: screenService.scale(56),
						child: CircularProgressIndicator(
							strokeWidth: 3,
							color: color,
						),
					),
					Container(
						width: screenService.scale(48),
						height: screenService.scale(48),
						decoration: BoxDecoration(
							color: colorLight,
							shape: BoxShape.circle,
						),
						child: Icon(
							entry.icon,
							size: screenService.scale(24),
							color: color,
						),
					),
				],
			);
		}

		if (entry.showProgress) {
			// Spinner only (no icon)
			return SizedBox(
				width: screenService.scale(48),
				height: screenService.scale(48),
				child: CircularProgressIndicator(
					strokeWidth: 3,
					color: color,
				),
			);
		}

		if (entry.icon != null) {
			// Icon only
			return Container(
				width: screenService.scale(48),
				height: screenService.scale(48),
				decoration: BoxDecoration(
					color: colorLight,
					shape: BoxShape.circle,
				),
				child: Icon(
					entry.icon,
					size: screenService.scale(24),
					color: color,
				),
			);
		}

		return const SizedBox.shrink();
	}

	Widget _buildCardActions(
		BuildContext context,
		List<OverlayAction> actions,
		AppLocalizations localizations,
		bool isDark,
	) {
		final isLandscape = locator<ScreenService>().isLandscape;

		if (isLandscape) {
			return Row(
				mainAxisAlignment: MainAxisAlignment.center,
				children: actions.asMap().entries.map((mapEntry) {
					final idx = mapEntry.key;
					final action = mapEntry.value;
					return Padding(
						padding: EdgeInsets.only(
							left: idx > 0 ? AppSpacings.pMd : 0,
						),
						child: _buildActionButton(context, action, localizations, isDark),
					);
				}).toList(),
			);
		}

		return Column(
			mainAxisSize: MainAxisSize.min,
			children: actions.asMap().entries.map((mapEntry) {
				final idx = mapEntry.key;
				final action = mapEntry.value;
				return Padding(
					padding: EdgeInsets.only(
						top: idx > 0 ? AppSpacings.pMd : 0,
					),
					child: SizedBox(
						width: double.infinity,
						child: _buildActionButton(context, action, localizations, isDark),
					),
				);
			}).toList(),
		);
	}
}

// ---------------------------------------------------------------------------
// FullScreen layout — scaffold page with icon, text, responsive buttons
// ---------------------------------------------------------------------------

class _FullScreenPage extends StatelessWidget {
	final AppOverlayEntry entry;

	const _FullScreenPage({required this.entry});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final color = _schemeColor(entry.colorScheme, isDark);

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
			body: SafeArea(
				child: LayoutBuilder(
					builder: (context, constraints) {
						final isLandscape = constraints.maxWidth > constraints.maxHeight;

						return Center(
							child: Padding(
								padding: EdgeInsets.all(
									screenService.systemPagePadding(isLandscape),
								),
								child: Column(
									mainAxisAlignment: MainAxisAlignment.center,
									children: [
										// Icon or spinner
										_buildFullScreenIcon(
											screenService,
											isDark,
											color,
											isLandscape,
										),
										SizedBox(
											height: screenService.iconBottomSpacing(isLandscape),
										),
										// Title
										if (entry.title != null)
											Text(
												entry.title!(localizations),
												style: TextStyle(
													color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
													fontSize: AppFontSize.extraLarge,
													fontWeight: FontWeight.w500,
												),
												textAlign: TextAlign.center,
											),
										if (entry.message != null) ...[
											AppSpacings.spacingMdVertical,
											Text(
												entry.message!(localizations),
												textAlign: TextAlign.center,
												style: TextStyle(
													color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
													fontSize: AppFontSize.base,
													height: 1.5,
												),
											),
										],
										if (entry.content != null) ...[
											AppSpacings.spacingMdVertical,
											entry.content!,
										],
										if (entry.actions.isNotEmpty) ...[
											AppSpacings.spacingXlVertical,
											_buildFullScreenActions(
												context,
												entry.actions,
												localizations,
												isDark,
												isLandscape,
											),
										],
									],
								),
							),
						);
					},
				),
			),
		);
	}

	Widget _buildFullScreenIcon(
		ScreenService screenService,
		bool isDark,
		Color color,
		bool isLandscape,
	) {
		if (entry.showProgress && entry.icon != null) {
			// Spinner ring around icon
			final isCompact =
					screenService.isSmallScreen || screenService.isMediumScreen;
			final isCompactLandscape = isCompact && isLandscape;
			final ringSize = screenService.scale(isCompactLandscape ? 64 : 88);

			return Stack(
				alignment: Alignment.center,
				children: [
					SizedBox(
						width: ringSize,
						height: ringSize,
						child: CircularProgressIndicator(
							strokeWidth: 3,
							color: color,
						),
					),
					IconContainer(
						screenService: screenService,
						icon: entry.icon!,
						color: color,
						isLandscape: isLandscape,
					),
				],
			);
		}

		if (entry.showProgress) {
			// Spinner only (no icon)
			return SizedBox(
				width: screenService.scale(50),
				height: screenService.scale(50),
				child: CircularProgressIndicator(color: color),
			);
		}

		if (entry.icon != null) {
			return IconContainer(
				screenService: screenService,
				icon: entry.icon!,
				color: color,
				isLandscape: isLandscape,
			);
		}

		return const SizedBox.shrink();
	}

	Widget _buildFullScreenActions(
		BuildContext context,
		List<OverlayAction> actions,
		AppLocalizations localizations,
		bool isDark,
		bool isLandscape,
	) {
		if (isLandscape) {
			return Row(
				mainAxisAlignment: MainAxisAlignment.center,
				children: actions.asMap().entries.map((mapEntry) {
					final idx = mapEntry.key;
					final action = mapEntry.value;
					return Padding(
						padding: EdgeInsets.only(
							left: idx > 0 ? AppSpacings.pLg : 0,
						),
						child: _buildActionButton(context, action, localizations, isDark),
					);
				}).toList(),
			);
		}

		return Column(
			children: actions.asMap().entries.map((mapEntry) {
				final idx = mapEntry.key;
				final action = mapEntry.value;
				return Padding(
					padding: EdgeInsets.only(
						top: idx > 0 ? AppSpacings.pMd + AppSpacings.pSm : 0,
					),
					child: SizedBox(
						width: double.infinity,
						child: _buildActionButton(context, action, localizations, isDark),
					),
				);
			}).toList(),
		);
	}
}

// ---------------------------------------------------------------------------
// Shared action button builder
// ---------------------------------------------------------------------------

Widget _buildActionButton(
	BuildContext context,
	OverlayAction action,
	AppLocalizations localizations,
	bool isDark,
) {
	if (action.style == OverlayActionStyle.outlined) {
		return Theme(
			data: Theme.of(context).copyWith(
				outlinedButtonTheme: isDark
						? AppOutlinedButtonsDarkThemes.primary
						: AppOutlinedButtonsLightThemes.primary,
			),
			child: action.loading
					? OutlinedButton(
							onPressed: null,
							style: OutlinedButton.styleFrom(
								padding: EdgeInsets.symmetric(
									horizontal: AppSpacings.pMd,
									vertical: AppSpacings.pMd,
								),
							),
							child: Row(
								mainAxisAlignment: MainAxisAlignment.center,
								mainAxisSize: MainAxisSize.min,
								children: [
									SizedBox(
										width: AppFontSize.base,
										height: AppFontSize.base,
										child: CircularProgressIndicator(
											strokeWidth: 2,
											color: isDark
													? AppOutlinedButtonsDarkThemes.primaryForegroundColor
													: AppOutlinedButtonsLightThemes.primaryForegroundColor,
										),
									),
									AppSpacings.spacingSmHorizontal,
									Text(action.label(localizations)),
								],
							),
						)
					: OutlinedButton.icon(
							onPressed: action.onPressed,
							icon: action.icon != null
									? Icon(
											action.icon,
											size: AppFontSize.base,
											color: isDark
													? AppOutlinedButtonsDarkThemes.primaryForegroundColor
													: AppOutlinedButtonsLightThemes.primaryForegroundColor,
										)
									: const SizedBox.shrink(),
							label: Text(action.label(localizations)),
              style: OutlinedButton.styleFrom(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pMd,
                ),
              ),
						),
		);
	}

	// Filled (default)
	return Theme(
		data: Theme.of(context).copyWith(
			filledButtonTheme: isDark
					? AppFilledButtonsDarkThemes.primary
					: AppFilledButtonsLightThemes.primary,
		),
		child: action.loading
				? FilledButton(
						onPressed: null,
						style: FilledButton.styleFrom(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pMd,
								vertical: AppSpacings.pMd,
							),
						),
						child: Row(
							mainAxisAlignment: MainAxisAlignment.center,
							mainAxisSize: MainAxisSize.min,
							children: [
								SizedBox(
									width: AppFontSize.base,
									height: AppFontSize.base,
									child: CircularProgressIndicator(
										strokeWidth: 2,
										color: isDark
												? AppFilledButtonsDarkThemes.primaryForegroundColor
												: AppFilledButtonsLightThemes.primaryForegroundColor,
									),
								),
								AppSpacings.spacingSmHorizontal,
								Text(action.label(localizations)),
							],
						),
					)
				: FilledButton.icon(
						onPressed: action.onPressed,
						icon: action.icon != null
								? Icon(
										action.icon,
										size: AppFontSize.base,
										color: isDark
												? AppFilledButtonsDarkThemes.primaryForegroundColor
												: AppFilledButtonsLightThemes.primaryForegroundColor,
									)
								: const SizedBox.shrink(),
						label: Text(action.label(localizations)),
            style: FilledButton.styleFrom(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pMd,
              ),
            ),
					),
	);
}
