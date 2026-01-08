import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// Container box for button tiles with on/off state styling
class ButtonTileBox extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final GestureTapCallback? onTap;
  final bool isOn;
  final bool isDisabled;
  final Widget child;

  ButtonTileBox({
    super.key,
    required this.onTap,
    required this.isOn,
    this.isDisabled = false,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints.expand(),
      decoration: BoxDecoration(
        color: isDisabled
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.infoLight5
                : AppColorsDark.infoLight5)
            : (isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.primary
                    : AppColorsDark.primaryLight9)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.infoLight9
                    : AppColorsDark.infoLight9)),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isDisabled
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.infoLight5
                  : AppColorsDark.infoLight5)
              : (isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.primary
                      : AppColorsDark.primaryLight5)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.infoLight5
                      : AppColorsDark.infoLight5)),
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
        boxShadow: isOn
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 4,
                  spreadRadius: 1,
                  offset: const Offset(0, 2),
                )
              ]
            : [],
      ),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: isDisabled ? null : onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Title text widget for button tiles
class ButtonTileTitle extends StatelessWidget {
  final String title;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final bool small;

  const ButtonTileTitle({
    super.key,
    required this.title,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      overflow: TextOverflow.ellipsis,
      maxLines: 1,
      style: TextStyle(
        color: isDisabled
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColors.white
                : const Color.fromRGBO(255, 255, 255, 0.5))
            : (isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColors.white
                    : AppColorsDark.primary)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.info
                    : AppColorsDark.info)),
        fontFamily: 'DIN1451',
        fontSize: small ? AppFontSize.extraSmall : AppFontSize.small,
        fontWeight: FontWeight.bold,
      ),
    );
  }
}

/// Subtitle widget for button tiles (supports custom widget content)
class ButtonTileSubTitle extends StatelessWidget {
  final Widget? subTitle;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;

  const ButtonTileSubTitle({
    super.key,
    required this.subTitle,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return DefaultTextStyle(
      style: TextStyle(
        fontFamily: 'DIN1451',
        color: isDisabled
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.infoLight9
                : AppColorsDark.infoLight9)
            : (isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.primaryLight9
                    : AppColorsLight.primaryLight5)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.infoLight3
                    : AppColorsDark.infoLight3)),
        overflow: TextOverflow.ellipsis,
        fontSize: AppFontSize.extraSmall,
      ),
      child: Theme(
        data: ThemeData(
          iconTheme: IconThemeData(
            size: AppFontSize.extraSmall,
            color: isDisabled
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.infoLight9
                    : AppColorsDark.infoLight9)
                : (isOn
                    ? (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.primaryLight9
                        : AppColorsLight.primaryLight5)
                    : (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.infoLight3
                        : AppColorsDark.infoLight3)),
          ),
        ),
        child: subTitle ?? Text(localizations.value_not_available),
      ),
    );
  }
}

/// Composite button tile widget with automatic layout based on dimensions
class ButtonTileWidget extends StatelessWidget {
  final GestureTapCallback? onTap;
  final GestureTapCallback? onIconTap;
  final String title;
  final Widget? subTitle;
  final IconData? icon;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final int rowSpan;
  final int colSpan;

  const ButtonTileWidget({
    super.key,
    required this.onTap,
    required this.onIconTap,
    required this.title,
    required this.subTitle,
    this.icon,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.rowSpan = 1,
    this.colSpan = 1,
  });

  @override
  Widget build(BuildContext context) {
    bool isSquare = rowSpan == colSpan;
    bool isButton = rowSpan == 1 && colSpan == 1;

    return ButtonTileBox(
      onTap: onTap,
      isOn: isOn,
      isDisabled: isDisabled,
      child: isSquare
          ? LayoutBuilder(builder: (context, constraints) {
              List<Widget> parts = [];

              parts.add(ButtonTileIcon(
                icon: icon,
                onTap: onIconTap,
                isOn: isOn,
                isLoading: isLoading,
                isDisabled: isDisabled,
              ));

              if (!isButton) {
                parts.add(
                  Column(
                    children: [
                      AppSpacings.spacingMdVertical,
                      ButtonTileTitle(
                        title: title,
                        isOn: isOn,
                        isLoading: isLoading,
                        isDisabled: isDisabled,
                      ),
                      AppSpacings.spacingSmVertical,
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ButtonTileSubTitle(
                          subTitle: subTitle,
                          isOn: isOn,
                          isLoading: isLoading,
                          isDisabled: isDisabled,
                        ),
                      ),
                    ],
                  ),
                );
              }

              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: parts,
              );
            })
          : LayoutBuilder(builder: (context, constraints) {
              List<Widget> parts = [];

              parts.add(ButtonTileIcon(
                icon: icon,
                onTap: onIconTap,
                isOn: isOn,
                isLoading: isLoading,
                isDisabled: isDisabled,
              ));

              if (!isButton) {
                parts.add(AppSpacings.spacingMdHorizontal);
                parts.add(Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ButtonTileTitle(
                        title: title,
                        isOn: isOn,
                        isLoading: isLoading,
                        isDisabled: isDisabled,
                      ),
                      AppSpacings.spacingSmVertical,
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ButtonTileSubTitle(
                          subTitle: subTitle,
                          isOn: isOn,
                          isLoading: isLoading,
                          isDisabled: isDisabled,
                        ),
                      ),
                    ],
                  ),
                ));
              }

              return Row(
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: parts,
              );
            }),
    );
  }
}

/// Circular icon button for button tiles
class ButtonTileIcon extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData? icon;
  final GestureTapCallback? onTap;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final double? iconSize;
  final Color? iconColor;

  ButtonTileIcon({
    super.key,
    this.icon,
    required this.onTap,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.iconSize,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    // Total size: icon (24) + border (4*2) + padding (4*2) = 40 scaled
    final double iconSize = _screenService.scale(
      this.iconSize ?? 40,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: iconSize,
      height: iconSize,
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        borderRadius: BorderRadius.circular(100),
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
          color: isDisabled
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColors.white
                  : const Color.fromRGBO(255, 255, 255, 0.5))
              : (isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.primaryLight5
                      : AppColorsLight.primaryLight5)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.infoLight5
                      : AppColorsDark.infoLight5)),
          border: Border.all(
            color: isDisabled
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColors.white
                    : const Color.fromRGBO(255, 255, 255, 0.5))
                : (isOn
                    ? (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.primaryLight5
                        : AppColorsLight.primaryLight5)
                    : (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.infoLight5
                        : AppColorsDark.infoLight5)),
            width: _screenService.scale(
              4,
              density: _visualDensityService.density,
            ),
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            color: isDisabled
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColors.white
                    : const Color.fromRGBO(255, 255, 255, 0.5))
                : (isOn
                    ? (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.primaryLight5
                        : AppColorsLight.primaryLight5)
                    : (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.infoLight5
                        : AppColorsDark.infoLight5)),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: SizedBox(
              width: _screenService.scale(
                24,
                density: _visualDensityService.density,
              ),
              height: _screenService.scale(
                24,
                density: _visualDensityService.density,
              ),
              child: isLoading
                  ? Theme(
                      data: ThemeData(
                        progressIndicatorTheme: ProgressIndicatorThemeData(
                          color: isDisabled
                              ? (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppColorsLight.infoLight5
                                  : AppColorsDark.infoLight5)
                              : (isOn
                                  ? (Theme.of(context).brightness ==
                                          Brightness.light
                                      ? AppColorsLight.primary
                                      : AppColorsDark.primary)
                                  : (Theme.of(context).brightness ==
                                          Brightness.light
                                      ? AppColorsLight.info
                                      : AppColorsDark.info)),
                          linearTrackColor: AppColors.blank,
                        ),
                      ),
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    )
                  : FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Icon(
                        icon,
                        size: _screenService.scale(
                          24,
                          density: _visualDensityService.density,
                        ),
                        color: iconColor ??
                            (isDisabled
                                ? (Theme.of(context).brightness ==
                                        Brightness.light
                                    ? AppColorsLight.infoLight5
                                    : AppColorsDark.infoLight5)
                                : (isOn
                                    ? (Theme.of(context).brightness ==
                                            Brightness.light
                                        ? AppColorsLight.primary
                                        : AppColorsDark.primary)
                                    : (Theme.of(context).brightness ==
                                            Brightness.light
                                        ? AppColorsLight.info
                                        : AppColorsDark.info))),
                      ),
                    ),
            ),
          ),
        ),
      ),
      ),
    );
  }
}
