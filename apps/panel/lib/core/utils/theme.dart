import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:flutter/material.dart';

extension AppExtendedColors on ThemeData {
  /// The accent fill (see [AppAccentTheme]).
  Color get primary => accent.fill;

  Color get success => brightness == Brightness.light
      ? AppColorsLight.success
      : AppColorsDark.success;

  Color get warning => brightness == Brightness.light
      ? AppColorsLight.warning
      : AppColorsDark.warning;

  Color get danger => brightness == Brightness.light
      ? AppColorsLight.danger
      : AppColorsDark.danger;

  Color get error => brightness == Brightness.light
      ? AppColorsLight.error
      : AppColorsDark.error;

  Color get info =>
      brightness == Brightness.light ? AppColorsLight.info : AppColorsDark.info;

  Color get teal =>
      brightness == Brightness.light ? AppColorsLight.teal : AppColorsDark.teal;

  Color get cyan =>
      brightness == Brightness.light ? AppColorsLight.cyan : AppColorsDark.cyan;

  Color get pink =>
      brightness == Brightness.light ? AppColorsLight.pink : AppColorsDark.pink;

  Color get indigo => brightness == Brightness.light
      ? AppColorsLight.indigo
      : AppColorsDark.indigo;

  Color get neutral => brightness == Brightness.light
      ? AppColorsLight.neutral
      : AppColorsDark.neutral;

  Color get flutter => brightness == Brightness.light
      ? AppColorsLight.flutter
      : AppColorsDark.flutter;
}

/// Theme color key for tiles. Only these colors are allowed for tile active/accent.
/// Light/dark variant is chosen automatically from current theme.
///
/// Legacy keys map onto the redesign tokens: [primary] is the default accent
/// (blue), [success], [warning], [danger] and [error] are status colours,
/// [neutral] is the grey info status, and [info], [teal], [cyan], [pink] and
/// [indigo] keep their old meaning as the Climate, Shading, Sensors, Media and
/// Cameras colours. New code uses the domain keys and [AppStatusPalette].
enum ThemeColors {
  primary,
  success,
  warning,
  danger,
  error,
  info,
  neutral,
  flutter,
  teal,
  cyan,
  pink,
  indigo,

  // Domain colours (docs/display-ui-design-spec.md §2)
  lights,
  climate,
  shading,
  media,
  sensors,
  energy,
  cameras,
}

/// Resolved theme color family (no alpha modifiers) for a given [ThemeColors] and brightness.
/// Use in tiles, sliders, mode selector, and other widgets that need consistent theme colors.
class ThemeColorFamily {
  const ThemeColorFamily({
    required this.base,
    required this.dark2,
    required this.light3,
    required this.light5,
    required this.light7,
    required this.light8,
    required this.light9,
  });

  final Color base;
  final Color dark2;
  final Color light3;
  final Color light5;
  final Color light7;
  final Color light8;
  final Color light9;

  /// Pre-built color families for dark theme, keyed by [ThemeColors].
  static const Map<ThemeColors, ThemeColorFamily> _darkFamilies = {
    ThemeColors.primary: ThemeColorFamily(
      base: AppColorsDark.primary, dark2: AppColorsDark.primaryDark2,
      light3: AppColorsDark.primaryLight3, light5: AppColorsDark.primaryLight5,
      light7: AppColorsDark.primaryLight7, light8: AppColorsDark.primaryLight8,
      light9: AppColorsDark.primaryLight9,
    ),
    ThemeColors.success: ThemeColorFamily(
      base: AppColorsDark.success, dark2: AppColorsDark.successDark2,
      light3: AppColorsDark.successLight3, light5: AppColorsDark.successLight5,
      light7: AppColorsDark.successLight7, light8: AppColorsDark.successLight8,
      light9: AppColorsDark.successLight9,
    ),
    ThemeColors.warning: ThemeColorFamily(
      base: AppColorsDark.warning, dark2: AppColorsDark.warningDark2,
      light3: AppColorsDark.warningLight3, light5: AppColorsDark.warningLight5,
      light7: AppColorsDark.warningLight7, light8: AppColorsDark.warningLight8,
      light9: AppColorsDark.warningLight9,
    ),
    ThemeColors.danger: ThemeColorFamily(
      base: AppColorsDark.danger, dark2: AppColorsDark.dangerDark2,
      light3: AppColorsDark.dangerLight3, light5: AppColorsDark.dangerLight5,
      light7: AppColorsDark.dangerLight7, light8: AppColorsDark.dangerLight8,
      light9: AppColorsDark.dangerLight9,
    ),
    ThemeColors.error: ThemeColorFamily(
      base: AppColorsDark.error, dark2: AppColorsDark.errorDark2,
      light3: AppColorsDark.errorLight3, light5: AppColorsDark.errorLight5,
      light7: AppColorsDark.errorLight7, light8: AppColorsDark.errorLight8,
      light9: AppColorsDark.errorLight9,
    ),
    ThemeColors.info: ThemeColorFamily(
      base: AppColorsDark.info, dark2: AppColorsDark.infoDark2,
      light3: AppColorsDark.infoLight3, light5: AppColorsDark.infoLight5,
      light7: AppColorsDark.infoLight7, light8: AppColorsDark.infoLight8,
      light9: AppColorsDark.infoLight9,
    ),
    ThemeColors.neutral: ThemeColorFamily(
      base: AppColorsDark.neutral, dark2: AppColorsDark.neutralDark2,
      light3: AppColorsDark.neutralLight3, light5: AppColorsDark.neutralLight5,
      light7: AppColorsDark.neutralLight7, light8: AppColorsDark.neutralLight8,
      light9: AppColorsDark.neutralLight9,
    ),
    ThemeColors.flutter: ThemeColorFamily(
      base: AppColorsDark.flutter, dark2: AppColorsDark.flutterDark2,
      light3: AppColorsDark.flutterLight3, light5: AppColorsDark.flutterLight5,
      light7: AppColorsDark.flutterLight7, light8: AppColorsDark.flutterLight8,
      light9: AppColorsDark.flutterLight9,
    ),
    ThemeColors.teal: ThemeColorFamily(
      base: AppColorsDark.teal, dark2: AppColorsDark.tealDark2,
      light3: AppColorsDark.tealLight3, light5: AppColorsDark.tealLight5,
      light7: AppColorsDark.tealLight7, light8: AppColorsDark.tealLight8,
      light9: AppColorsDark.tealLight9,
    ),
    ThemeColors.cyan: ThemeColorFamily(
      base: AppColorsDark.cyan, dark2: AppColorsDark.cyanDark2,
      light3: AppColorsDark.cyanLight3, light5: AppColorsDark.cyanLight5,
      light7: AppColorsDark.cyanLight7, light8: AppColorsDark.cyanLight8,
      light9: AppColorsDark.cyanLight9,
    ),
    ThemeColors.pink: ThemeColorFamily(
      base: AppColorsDark.pink, dark2: AppColorsDark.pinkDark2,
      light3: AppColorsDark.pinkLight3, light5: AppColorsDark.pinkLight5,
      light7: AppColorsDark.pinkLight7, light8: AppColorsDark.pinkLight8,
      light9: AppColorsDark.pinkLight9,
    ),
    ThemeColors.indigo: ThemeColorFamily(
      base: AppColorsDark.indigo, dark2: AppColorsDark.indigoDark2,
      light3: AppColorsDark.indigoLight3, light5: AppColorsDark.indigoLight5,
      light7: AppColorsDark.indigoLight7, light8: AppColorsDark.indigoLight8,
      light9: AppColorsDark.indigoLight9,
    ),
    ThemeColors.lights: ThemeColorFamily(
      base: Color(0xFFF0A742), dark2: Color(0xFFF3B968),
      light3: Color(0xFFB07D38), light5: Color(0xFF866230),
      light7: Color(0xFF5B462A), light8: Color(0xFF463826),
      light9: Color(0xFF33261A),
    ),
    ThemeColors.climate: ThemeColorFamily(
      base: Color(0xFF4FB3E8), dark2: Color(0xFF72C2ED),
      light3: Color(0xFF3F86AC), light5: Color(0xFF356884),
      light7: Color(0xFF2B495B), light8: Color(0xFF253A47),
      light9: Color(0xFF16293A),
    ),
    ThemeColors.shading: ThemeColorFamily(
      base: Color(0xFF4DB6AC), dark2: Color(0xFF71C5BD),
      light3: Color(0xFF3E8882), light5: Color(0xFF346966),
      light7: Color(0xFF2A4A49), light8: Color(0xFF253B3B),
      light9: Color(0xFF14302D),
    ),
    ThemeColors.media: ThemeColorFamily(
      base: Color(0xFFF06292), dark2: Color(0xFFF381A8),
      light3: Color(0xFFB04D70), light5: Color(0xFF863F58),
      light7: Color(0xFF5B3142), light8: Color(0xFF462A36),
      light9: Color(0xFF3A1A28),
    ),
    ThemeColors.sensors: ThemeColorFamily(
      base: Color(0xFF4DD0E1), dark2: Color(0xFF71D9E7),
      light3: Color(0xFF3E9AA7), light5: Color(0xFF347680),
      light7: Color(0xFF2A5259), light8: Color(0xFF254046),
      light9: Color(0xFF133236),
    ),
    ThemeColors.energy: ThemeColorFamily(
      base: Color(0xFF6CC070), dark2: Color(0xFF89CD8D),
      light3: Color(0xFF548F58), light5: Color(0xFF446E48),
      light7: Color(0xFF334D37), light8: Color(0xFF2B3D2F),
      light9: Color(0xFF1D2E1F),
    ),
    ThemeColors.cameras: ThemeColorFamily(
      base: Color(0xFF8390D2), dark2: Color(0xFF9CA6DB),
      light3: Color(0xFF646D9C), light5: Color(0xFF4F5678),
      light7: Color(0xFF3A3F55), light8: Color(0xFF303343),
      light9: Color(0xFF1F2340),
    ),
  };

  /// Pre-built color families for light theme, keyed by [ThemeColors].
  static const Map<ThemeColors, ThemeColorFamily> _lightFamilies = {
    ThemeColors.primary: ThemeColorFamily(
      base: AppColorsLight.primary, dark2: AppColorsLight.primaryDark2,
      light3: AppColorsLight.primaryLight3, light5: AppColorsLight.primaryLight5,
      light7: AppColorsLight.primaryLight7, light8: AppColorsLight.primaryLight8,
      light9: AppColorsLight.primaryLight9,
    ),
    ThemeColors.success: ThemeColorFamily(
      base: AppColorsLight.success, dark2: AppColorsLight.successDark2,
      light3: AppColorsLight.successLight3, light5: AppColorsLight.successLight5,
      light7: AppColorsLight.successLight7, light8: AppColorsLight.successLight8,
      light9: AppColorsLight.successLight9,
    ),
    ThemeColors.warning: ThemeColorFamily(
      base: AppColorsLight.warning, dark2: AppColorsLight.warningDark2,
      light3: AppColorsLight.warningLight3, light5: AppColorsLight.warningLight5,
      light7: AppColorsLight.warningLight7, light8: AppColorsLight.warningLight8,
      light9: AppColorsLight.warningLight9,
    ),
    ThemeColors.danger: ThemeColorFamily(
      base: AppColorsLight.danger, dark2: AppColorsLight.dangerDark2,
      light3: AppColorsLight.dangerLight3, light5: AppColorsLight.dangerLight5,
      light7: AppColorsLight.dangerLight7, light8: AppColorsLight.dangerLight8,
      light9: AppColorsLight.dangerLight9,
    ),
    ThemeColors.error: ThemeColorFamily(
      base: AppColorsLight.error, dark2: AppColorsLight.errorDark2,
      light3: AppColorsLight.errorLight3, light5: AppColorsLight.errorLight5,
      light7: AppColorsLight.errorLight7, light8: AppColorsLight.errorLight8,
      light9: AppColorsLight.errorLight9,
    ),
    ThemeColors.info: ThemeColorFamily(
      base: AppColorsLight.info, dark2: AppColorsLight.infoDark2,
      light3: AppColorsLight.infoLight3, light5: AppColorsLight.infoLight5,
      light7: AppColorsLight.infoLight7, light8: AppColorsLight.infoLight8,
      light9: AppColorsLight.infoLight9,
    ),
    ThemeColors.neutral: ThemeColorFamily(
      base: AppColorsLight.neutral, dark2: AppColorsLight.neutralDark2,
      light3: AppColorsLight.neutralLight3, light5: AppColorsLight.neutralLight5,
      light7: AppColorsLight.neutralLight7, light8: AppColorsLight.neutralLight8,
      light9: AppColorsLight.neutralLight9,
    ),
    ThemeColors.flutter: ThemeColorFamily(
      base: AppColorsLight.flutter, dark2: AppColorsLight.flutterDark2,
      light3: AppColorsLight.flutterLight3, light5: AppColorsLight.flutterLight5,
      light7: AppColorsLight.flutterLight7, light8: AppColorsLight.flutterLight8,
      light9: AppColorsLight.flutterLight9,
    ),
    ThemeColors.teal: ThemeColorFamily(
      base: AppColorsLight.teal, dark2: AppColorsLight.tealDark2,
      light3: AppColorsLight.tealLight3, light5: AppColorsLight.tealLight5,
      light7: AppColorsLight.tealLight7, light8: AppColorsLight.tealLight8,
      light9: AppColorsLight.tealLight9,
    ),
    ThemeColors.cyan: ThemeColorFamily(
      base: AppColorsLight.cyan, dark2: AppColorsLight.cyanDark2,
      light3: AppColorsLight.cyanLight3, light5: AppColorsLight.cyanLight5,
      light7: AppColorsLight.cyanLight7, light8: AppColorsLight.cyanLight8,
      light9: AppColorsLight.cyanLight9,
    ),
    ThemeColors.pink: ThemeColorFamily(
      base: AppColorsLight.pink, dark2: AppColorsLight.pinkDark2,
      light3: AppColorsLight.pinkLight3, light5: AppColorsLight.pinkLight5,
      light7: AppColorsLight.pinkLight7, light8: AppColorsLight.pinkLight8,
      light9: AppColorsLight.pinkLight9,
    ),
    ThemeColors.indigo: ThemeColorFamily(
      base: AppColorsLight.indigo, dark2: AppColorsLight.indigoDark2,
      light3: AppColorsLight.indigoLight3, light5: AppColorsLight.indigoLight5,
      light7: AppColorsLight.indigoLight7, light8: AppColorsLight.indigoLight8,
      light9: AppColorsLight.indigoLight9,
    ),
    ThemeColors.lights: ThemeColorFamily(
      base: Color(0xFFA35600), dark2: Color(0xFF824500),
      light3: Color(0xFFBF894C), light5: Color(0xFFD1AA80),
      light7: Color(0xFFE3CCB2), light8: Color(0xFFEDDDCC),
      light9: Color(0xFFFDF1E2),
    ),
    ThemeColors.climate: ThemeColorFamily(
      base: Color(0xFF0272A1), dark2: Color(0xFF025B81),
      light3: Color(0xFF4E9CBD), light5: Color(0xFF80B8D0),
      light7: Color(0xFFB3D5E3), light8: Color(0xFFCCE3EC),
      light9: Color(0xFFE3F2FA),
    ),
    ThemeColors.shading: ThemeColorFamily(
      base: Color(0xFF00796B), dark2: Color(0xFF006156),
      light3: Color(0xFF4CA197), light5: Color(0xFF80BCB5),
      light7: Color(0xFFB2D7D3), light8: Color(0xFFCCE4E1),
      light9: Color(0xFFE0F2F1),
    ),
    ThemeColors.media: ThemeColorFamily(
      base: Color(0xFFC2185B), dark2: Color(0xFF9B1349),
      light3: Color(0xFFD45D8C), light5: Color(0xFFE08CAD),
      light7: Color(0xFFEDBACE), light8: Color(0xFFF3D1DE),
      light9: Color(0xFFFCE4EC),
    ),
    ThemeColors.sensors: ThemeColorFamily(
      base: Color(0xFF007984), dark2: Color(0xFF00616A),
      light3: Color(0xFF4CA1A9), light5: Color(0xFF80BCC2),
      light7: Color(0xFFB2D7DA), light8: Color(0xFFCCE4E6),
      light9: Color(0xFFE0F7FA),
    ),
    ThemeColors.energy: ThemeColorFamily(
      base: Color(0xFF2E7D32), dark2: Color(0xFF256428),
      light3: Color(0xFF6DA470), light5: Color(0xFF96BE98),
      light7: Color(0xFFC0D8C2), light8: Color(0xFFD5E5D6),
      light9: Color(0xFFECF6ED),
    ),
    ThemeColors.cameras: ThemeColorFamily(
      base: Color(0xFF3949AB), dark2: Color(0xFF2E3A89),
      light3: Color(0xFF7480C4), light5: Color(0xFF9CA4D5),
      light7: Color(0xFFC4C8E6), light8: Color(0xFFD7DBEE),
      light9: Color(0xFFE8EAF6),
    ),
  };

  /// Returns the [ThemeColorFamily] for the given [brightness] and [key].
  static ThemeColorFamily get(Brightness brightness, ThemeColors key) {
    final families = brightness == Brightness.dark ? _darkFamilies : _lightFamilies;
    return families[key]!;
  }
}

/// Extension to get icon container colors from a [ThemeColorFamily]:
/// [iconColor] = [ThemeColorFamily.base], [backgroundColor] = [ThemeColorFamily.light5].
/// Use for role/category icon boxes (e.g. shading role icon, sensor card icon).
extension ThemeColorFamilyIconContainer on ThemeColorFamily {
  ({Color iconColor, Color backgroundColor}) get iconContainer =>
      (iconColor: base, backgroundColor: light9);
}

/// Redesign names for a family's steps.
extension ThemeColorFamilyTokens on ThemeColorFamily {
  /// Tinted background (a domain's or status's "soft").
  Color get soft => light9;

  /// Pressed shade derived from the fill.
  Color get pressed => dark2;
}

/// Fade transition builder — lighter on GPU than the default slide transition.
/// Avoids compositing two full pages with clipping during navigation.
/// Uses a fast curve to feel snappier than a linear 300ms fade.
class _FadePageTransitionsBuilder extends PageTransitionsBuilder {
  const _FadePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: animation,
        curve: Curves.easeOut,
      ),
      child: child,
    );
  }
}

class AppTheme {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Fade transition for all platforms — lighter on GPU than slide.
  static const _pageTransitionsTheme = PageTransitionsTheme(
    builders: {
      TargetPlatform.android: _FadePageTransitionsBuilder(),
      TargetPlatform.iOS: _FadePageTransitionsBuilder(),
      TargetPlatform.linux: _FadePageTransitionsBuilder(),
      TargetPlatform.macOS: _FadePageTransitionsBuilder(),
      TargetPlatform.windows: _FadePageTransitionsBuilder(),
      TargetPlatform.fuchsia: _FadePageTransitionsBuilder(),
    },
  );

  static ColorScheme _colorScheme(Brightness brightness, AppAccent selected) {
    final n = AppNeutralPalette.of(brightness);
    final danger = AppStatusPalette.of(brightness, AppStatus.danger);
    final accent = AppAccentPalette.of(selected, brightness);
    final isDark = brightness == Brightness.dark;

    return (isDark ? const ColorScheme.dark() : const ColorScheme.light())
        .copyWith(
      primary: accent.fill,
      onPrimary: accent.onFill,
      primaryContainer: accent.soft,
      onPrimaryContainer: accent.text,
      error: danger.text,
      // White on the dark-theme danger shade is 2.8:1.
      onError: isDark ? n.surfacePage : AppColors.white,
      surface: n.surfaceCard,
      onSurface: n.textPrimary,
      onSurfaceVariant: n.textSecondary,
      surfaceContainerHighest: n.fillBase,
      outline: n.borderBase,
      outlineVariant: n.borderLight,
    );
  }

  /// Cards are flat: surface colour and a hairline outline, no shadow.
  static CardThemeData _cardTheme(Brightness brightness) {
    final n = AppNeutralPalette.of(brightness);

    return CardThemeData(
      color: n.surfaceCard,
      surfaceTintColor: AppColors.blank,
      shadowColor: AppColors.blank,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        side: BorderSide(
          color: n.borderLight,
          width: _screenService.scale(
            1,
          ),
        ),
      ),
    );
  }

  static DialogThemeData _dialogTheme(Brightness brightness) {
    final n = AppNeutralPalette.of(brightness);

    return DialogThemeData(
      backgroundColor: n.surfaceRaised,
      surfaceTintColor: AppColors.blank,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
      ),
    );
  }

  static BottomSheetThemeData _bottomSheetTheme(Brightness brightness) {
    final n = AppNeutralPalette.of(brightness);

    return BottomSheetThemeData(
      backgroundColor: n.surfaceRaised,
      surfaceTintColor: AppColors.blank,
      modalBackgroundColor: n.surfaceRaised,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppBorderRadius.medium),
        ),
      ),
    );
  }

  static List<ThemeExtension<dynamic>> _extensions(Brightness brightness, AppAccent selected) => [
        AppAccentTheme.of(selected, brightness),
      ];

  /// Switches: white thumb on the accent fill when on.
  static SwitchThemeData _switchTheme(Brightness brightness, AppAccent selected) {
    final accent = AppAccentPalette.of(selected, brightness);
    final n = AppNeutralPalette.of(brightness);

    return SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(AppColors.white),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? accent.fill
            : n.borderBase,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(AppColors.blank),
    );
  }

  static TextSelectionThemeData _textSelectionTheme(Brightness brightness, AppAccent selected) {
    final accent = AppAccentPalette.of(selected, brightness);

    return TextSelectionThemeData(
      cursorColor: accent.fill,
      selectionColor: accent.fill.withValues(alpha: 0.3),
      selectionHandleColor: accent.fill,
    );
  }

  static ThemeData get startThemeLight {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.light,
      primaryColor: AppColorsLight.primary,
      primaryColorLight: AppColorsLight.primary,
      primaryColorDark: AppColorsDark.primary,
      scaffoldBackgroundColor: AppBgColorLight.page,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppBrandColors.app,
        linearTrackColor: AppColors.white,
      ),
      colorScheme: _colorScheme(Brightness.light, AppAccents.current),
      extensions: _extensions(Brightness.light, AppAccents.current),
      visualDensity: _visualDensityService.visualDensity,
    );
  }

  static ThemeData get startThemeDark {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.dark,
      primaryColor: AppColorsDark.primary,
      primaryColorLight: AppColorsLight.primary,
      primaryColorDark: AppColorsDark.primary,
      scaffoldBackgroundColor: AppBgColorDark.page,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppBrandColors.app,
        linearTrackColor: AppColors.white,
      ),
      colorScheme: _colorScheme(Brightness.dark, AppAccents.current),
      extensions: _extensions(Brightness.dark, AppAccents.current),
      visualDensity: _visualDensityService.visualDensity,
    );
  }

  /// The light theme in the current accent ([AppAccents.current]).
  static ThemeData get lightTheme => lightThemeFor(AppAccents.current);

  /// The light theme in [accent]. The component gallery previews accents
  /// with it without changing the panel's own accent.
  static ThemeData lightThemeFor(AppAccent accent) {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.light,
      primaryColor: AppAccentPalette.of(accent, Brightness.light).fill,
      primaryColorLight: AppAccentPalette.of(accent, Brightness.light).fill,
      primaryColorDark: AppAccentPalette.of(accent, Brightness.dark).fill,
      scaffoldBackgroundColor: AppBgColorLight.page,
      textTheme: AppTextThemes.light,
      outlinedButtonTheme: AppOutlinedButtonsLightThemes.base,
      filledButtonTheme: AppFilledButtonsLightThemes.base,
      colorScheme: _colorScheme(Brightness.light, accent),
      extensions: _extensions(Brightness.light, accent),
      switchTheme: _switchTheme(Brightness.light, accent),
      textSelectionTheme: _textSelectionTheme(Brightness.light, accent),
      cardTheme: _cardTheme(Brightness.light),
      dialogTheme: _dialogTheme(Brightness.light),
      bottomSheetTheme: _bottomSheetTheme(Brightness.light),
      dividerTheme: const DividerThemeData(color: AppBorderColorLight.light),
      pageTransitionsTheme: _pageTransitionsTheme,
      visualDensity: _visualDensityService.visualDensity,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      scrollbarTheme: const ScrollbarThemeData(
        thumbVisibility: WidgetStatePropertyAll(false),
        trackVisibility: WidgetStatePropertyAll(false),
        thickness: WidgetStatePropertyAll(0),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AppAccentPalette.of(accent, Brightness.light).fill,
        linearTrackColor: AppColors.white,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: AppAccentPalette.of(accent, Brightness.light).fill,
        thumbColor: AppAccentPalette.of(accent, Brightness.light).fill,
        inactiveTrackColor: AppBorderColorLight.light,
        disabledActiveTrackColor: AppTextColorLight.disabled,
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: AppBorderColorLight.light,
        labelStyle: TextStyle(fontSize: AppFontSize.base),
      ),
      listTileTheme: ListTileThemeData(
        dense: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          side: BorderSide(
            color: AppBorderColorLight.darker,
            width: _screenService.scale(
              1,
            ),
          ),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
        horizontalTitleGap: AppSpacings.pSm,
        textColor: AppTextColorLight.regular,
        titleAlignment: ListTileTitleAlignment.center,
        minVerticalPadding: AppSpacings.pSm,
      ),
      dropdownMenuTheme: DropdownMenuThemeData(
        menuStyle: MenuStyle(
          visualDensity: VisualDensity(horizontal: 0, vertical: 0),
          padding: WidgetStatePropertyAll(EdgeInsets.all(0)),
        ),
      ),
    );
  }

  /// The dark theme in the current accent ([AppAccents.current]).
  static ThemeData get darkTheme => darkThemeFor(AppAccents.current);

  /// The dark theme in [accent].
  static ThemeData darkThemeFor(AppAccent accent) {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.dark,
      primaryColor: AppAccentPalette.of(accent, Brightness.dark).fill,
      primaryColorLight: AppAccentPalette.of(accent, Brightness.light).fill,
      primaryColorDark: AppAccentPalette.of(accent, Brightness.dark).fill,
      scaffoldBackgroundColor: AppBgColorDark.page,
      textTheme: AppTextThemes.dark,
      outlinedButtonTheme: AppOutlinedButtonsDarkThemes.base,
      filledButtonTheme: AppFilledButtonsDarkThemes.base,
      colorScheme: _colorScheme(Brightness.dark, accent),
      extensions: _extensions(Brightness.dark, accent),
      switchTheme: _switchTheme(Brightness.dark, accent),
      textSelectionTheme: _textSelectionTheme(Brightness.dark, accent),
      cardTheme: _cardTheme(Brightness.dark),
      dialogTheme: _dialogTheme(Brightness.dark),
      bottomSheetTheme: _bottomSheetTheme(Brightness.dark),
      dividerTheme: const DividerThemeData(color: AppBorderColorDark.light),
      pageTransitionsTheme: _pageTransitionsTheme,
      visualDensity: _visualDensityService.visualDensity,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      scrollbarTheme: const ScrollbarThemeData(
        thumbVisibility: WidgetStatePropertyAll(false),
        trackVisibility: WidgetStatePropertyAll(false),
        thickness: WidgetStatePropertyAll(0),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AppAccentPalette.of(accent, Brightness.dark).fill,
        linearTrackColor: AppColors.white,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: AppAccentPalette.of(accent, Brightness.dark).fill,
        thumbColor: AppAccentPalette.of(accent, Brightness.dark).fill,
        inactiveTrackColor: AppBorderColorDark.light,
        disabledActiveTrackColor: AppTextColorDark.placeholder,
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: AppBorderColorDark.light,
        labelStyle: TextStyle(fontSize: AppFontSize.base),
      ),
      listTileTheme: ListTileThemeData(
        dense: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          side: BorderSide(
            color: AppBorderColorDark.light,
            width: _screenService.scale(
              1,
            ),
          ),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
        horizontalTitleGap: AppSpacings.pSm,
        textColor: AppTextColorDark.regular,
        titleAlignment: ListTileTitleAlignment.center,
        minVerticalPadding: AppSpacings.pSm,
      ),
    );
  }
}

// Centralized colors
class AppColors {
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);
  static const Color blank = Colors.transparent;
}

// ---------------------------------------------------------------------------
// Redesign tokens (docs/display-ui-design-spec.md §2)
//
// New code reads these. The legacy families further down ([AppColorsLight],
// [AppColorsDark], [ThemeColors], [AppBgColorLight] and friends) are adapters
// onto the same values and are removed once every screen is migrated (DR-24).
// ---------------------------------------------------------------------------

/// FastyBird red. Identity only: the logo, the wordmark and the loading
/// spinner. Never on a control, a status or a navigation tab.
class AppBrandColors {
  static const Color app = Color(0xFFD9230F);
}

/// Surfaces, fills, borders and text roles for one theme.
@immutable
class AppNeutralPalette {
  const AppNeutralPalette({
    required this.surfacePage,
    required this.surfaceCard,
    required this.surfaceRaised,
    required this.fillBase,
    required this.fillLight,
    required this.borderBase,
    required this.borderLight,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
  });

  /// Behind cards.
  final Color surfacePage;

  /// Cards, tiles, deck bar and dock.
  final Color surfaceCard;

  /// Sheets, drawers, popups, overlay cards.
  final Color surfaceRaised;

  /// Slider track, skeletons, unselected segments.
  final Color fillBase;

  /// Buttons inside a card.
  final Color fillLight;

  /// Outlined controls, dividers that must be seen.
  final Color borderBase;

  /// Card outline.
  final Color borderLight;

  /// Values, titles, numerals.
  final Color textPrimary;

  /// Live-state line, units.
  final Color textSecondary;

  /// Captions, timestamps.
  final Color textMuted;

  /// Disabled, read-only and offline labels, always with an icon.
  final Color textDisabled;

  static const AppNeutralPalette light = AppNeutralPalette(
    surfacePage: Color(0xFFF3F4F6),
    surfaceCard: Color(0xFFFFFFFF),
    surfaceRaised: Color(0xFFFFFFFF),
    fillBase: Color(0xFFECEEF1),
    fillLight: Color(0xFFF6F7F9),
    borderBase: Color(0xFFDCDFE5),
    borderLight: Color(0xFFE8EAEE),
    textPrimary: Color(0xFF1B1F26),
    textSecondary: Color(0xFF5B6270),
    textMuted: Color(0xFF676E7A),
    textDisabled: Color(0xFF8B919B),
  );

  static const AppNeutralPalette dark = AppNeutralPalette(
    surfacePage: Color(0xFF121315),
    surfaceCard: Color(0xFF1B1C1F),
    surfaceRaised: Color(0xFF232428),
    fillBase: Color(0xFF2A2B30),
    fillLight: Color(0xFF222327),
    borderBase: Color(0xFF33353A),
    borderLight: Color(0xFF2A2C30),
    textPrimary: Color(0xFFE9EAEC),
    textSecondary: Color(0xFFA2A7AF),
    textMuted: Color(0xFF8A9099),
    textDisabled: Color(0xFF6B7079),
  );

  static AppNeutralPalette of(Brightness brightness) =>
      brightness == Brightness.dark ? dark : light;
}

/// Status roles. Status never takes the accent and always comes with an icon
/// and a label.
enum AppStatus { ok, warning, danger, info }

/// One status in one theme: [fill] takes white text and is the same in both
/// themes; [text] is for text and icons on a surface; [soft] and [border] are
/// the tinted background and its outline.
@immutable
class AppStatusPalette {
  const AppStatusPalette({
    required this.fill,
    required this.text,
    required this.soft,
    required this.border,
  });

  final Color fill;
  final Color text;
  final Color soft;
  final Color border;

  static const Map<AppStatus, AppStatusPalette> _light = {
    AppStatus.ok: AppStatusPalette(
      fill: Color(0xFF2E7D32),
      text: Color(0xFF2E7D32),
      soft: Color(0xFFECF6ED),
      border: Color(0xFFC5E1C7),
    ),
    AppStatus.warning: AppStatusPalette(
      fill: Color(0xFFB25E00),
      text: Color(0xFFA35600),
      soft: Color(0xFFFDF1E2),
      border: Color(0xFFF3D3A8),
    ),
    AppStatus.danger: AppStatusPalette(
      fill: Color(0xFFC62828),
      text: Color(0xFFC62828),
      soft: Color(0xFFFBEAEA),
      border: Color(0xFFF0BCBC),
    ),
    AppStatus.info: AppStatusPalette(
      fill: Color(0xFF5B6675),
      text: Color(0xFF5B6675),
      soft: Color(0xFFEEF0F3),
      border: Color(0xFFD6DAE0),
    ),
  };

  static const Map<AppStatus, AppStatusPalette> _dark = {
    AppStatus.ok: AppStatusPalette(
      fill: Color(0xFF2E7D32),
      text: Color(0xFF6CC070),
      soft: Color(0xFF1D2E1F),
      border: Color(0xFF2C4A2F),
    ),
    AppStatus.warning: AppStatusPalette(
      fill: Color(0xFFB25E00),
      text: Color(0xFFF0A742),
      soft: Color(0xFF33261A),
      border: Color(0xFF5A4223),
    ),
    AppStatus.danger: AppStatusPalette(
      fill: Color(0xFFC62828),
      text: Color(0xFFF2706B),
      soft: Color(0xFF3A1F1F),
      border: Color(0xFF5E2C2C),
    ),
    AppStatus.info: AppStatusPalette(
      fill: Color(0xFF5B6675),
      text: Color(0xFFA3ACB9),
      soft: Color(0xFF272A2F),
      border: Color(0xFF3A3E45),
    ),
  };

  static AppStatusPalette of(Brightness brightness, AppStatus status) =>
      (brightness == Brightness.dark ? _dark : _light)[status]!;
}

/// Climate colours that are not a domain colour.
class AppClimateColors {
  /// Heating on the thermostat dial. Cooling uses the Climate domain colour.
  static const Color heatingLight = Color(0xFFC2571A);
  static const Color heatingDark = Color(0xFFF0915A);

  static Color heating(Brightness brightness) =>
      brightness == Brightness.dark ? heatingDark : heatingLight;
}

/// Control colours that are not a neutral, status, domain or accent token.
class AppControlColors {
  /// The track of a switch that is off (design canvas, Settings and the
  /// domain views).
  static const Color switchOffLight = Color(0xFFA9AFB9);
  static const Color switchOffDark = Color(0xFF44474E);

  /// The thumb of a slider and a switch.
  static const Color thumb = AppColors.white;

  static Color switchOff(Brightness brightness) =>
      brightness == Brightness.dark ? switchOffDark : switchOffLight;

  /// The grab handle of a bottom sheet (design canvas, overlays).
  static const Color handleLight = Color(0xFFC3C8D0);
  static const Color handleDark = Color(0xFF44474E);

  static Color handle(Brightness brightness) =>
      brightness == Brightness.dark ? handleDark : handleLight;
}

/// One day part of the sky panel (docs/display-ui-design-spec.md §2, Sky):
/// a clear and an overcast three-stop gradient (top, 62 %, bottom), the text
/// colour for each, and the weather card's flat fill and outline.
///
/// A condition mixes the two gradients and the two text colours by its cover
/// factor; see `SkyLook` in the deck's sky widgets.
@immutable
class AppSkyPart {
  const AppSkyPart({
    required this.clear,
    required this.overcast,
    required this.text,
    required this.overcastText,
    required this.light,
    required this.glass,
    required this.glassLine,
  });

  /// Top, middle (at 62 %) and bottom.
  final List<Color> clear;
  final List<Color> overcast;

  final Color text;
  final Color overcastText;

  /// Whether the sky is light, so its layers are white on it.
  final bool light;

  /// The weather card and the scene pills on the sky.
  final Color glass;
  final Color glassLine;
}

/// The sky panel's colours (docs/display-ui-design-spec.md §2, Sky; every
/// value is in `Sky.dc.html` on the design canvas). The sky is the same in
/// the light and the dark theme.
class AppSkyColors {
  AppSkyColors._();

  static const Color _lightGlass = Color.fromRGBO(255, 255, 255, 0.62);
  static const Color _lightGlassLine = Color.fromRGBO(255, 255, 255, 0.85);
  static const Color _darkGlassLine = Color.fromRGBO(255, 255, 255, 0.18);

  static const AppSkyPart morning = AppSkyPart(
    clear: [Color(0xFF8FB6E0), Color(0xFFF0C9B8), Color(0xFFFBE6D2)],
    overcast: [Color(0xFF9AA5B1), Color(0xFFC3CAD2), Color(0xFFDDE1E6)],
    text: Color(0xFF10263F),
    overcastText: Color(0xFF1B2430),
    light: true,
    glass: _lightGlass,
    glassLine: _lightGlassLine,
  );

  static const AppSkyPart day = AppSkyPart(
    clear: [Color(0xFF7FB4EA), Color(0xFFB9D9F5), Color(0xFFE4F1FB)],
    overcast: [Color(0xFF9AA5B1), Color(0xFFC3CAD2), Color(0xFFDDE1E6)],
    text: Color(0xFF10263F),
    overcastText: Color(0xFF1B2430),
    light: true,
    glass: _lightGlass,
    glassLine: _lightGlassLine,
  );

  static const AppSkyPart evening = AppSkyPart(
    clear: [Color(0xFF252B55), Color(0xFF5A3D6E), Color(0xFFA85A55)],
    overcast: [Color(0xFF2B2F3D), Color(0xFF454A5A), Color(0xFF6B6670)],
    text: Color(0xFFFFFFFF),
    overcastText: Color(0xFFFFFFFF),
    light: false,
    glass: Color.fromRGBO(20, 16, 40, 0.55),
    glassLine: _darkGlassLine,
  );

  static const AppSkyPart night = AppSkyPart(
    clear: [Color(0xFF0B1026), Color(0xFF141C3D), Color(0xFF1D2850)],
    overcast: [Color(0xFF0D0F14), Color(0xFF191C24), Color(0xFF252A35)],
    text: Color(0xFFEEF1F8),
    overcastText: Color(0xFFEEF1F8),
    light: false,
    glass: Color.fromRGBO(255, 255, 255, 0.10),
    glassLine: _darkGlassLine,
  );

  /// The sun: a radial glow from its core to transparent at 70 %.
  static const List<Color> sunDay = [
    Color(0xFFFFFBE0),
    Color(0xFFFFE9A0),
    Color.fromRGBO(255, 233, 160, 0),
  ];
  static const List<Color> sunMorning = [
    Color(0xFFFFF3D0),
    Color(0xFFFFCF8F),
    Color.fromRGBO(255, 207, 143, 0),
  ];
  static const List<Color> sunEvening = [
    Color(0xFFFFD9A0),
    Color(0xFFF0A070),
    Color.fromRGBO(240, 160, 112, 0),
  ];

  static const Color moon = Color(0xFFF3EED8);
  static const Color star = Color.fromRGBO(255, 255, 255, 0.75);
  static const Color lightning = Color(0xFFFFE27A);

  /// Cloud bars, fog bands, rain lines and snow dots, on a light sky and on a
  /// dark one.
  static const Color cloudOnLight = Color.fromRGBO(255, 255, 255, 0.5);
  static const Color cloudOnDark = Color.fromRGBO(255, 255, 255, 0.10);
  static const Color fogOnLight = Color.fromRGBO(255, 255, 255, 0.4);
  static const Color fogOnDark = Color.fromRGBO(255, 255, 255, 0.08);
  static const Color rainOnLight = Color.fromRGBO(27, 36, 48, 0.14);
  static const Color rainOnDark = Color.fromRGBO(255, 255, 255, 0.13);
  static const Color snowOnLight = Color(0xFFFFFFFF);
  static const Color snowOnDark = Color.fromRGBO(255, 255, 255, 0.85);
}

/// The scrim behind sheets, drawers and dialogs (design canvas, overlays).
class AppScrim {
  AppScrim._();

  static const Color color = Color.fromRGBO(8, 9, 10, 0.55);
}

/// The one soft shadow under sheets, drawers, popups and toasts
/// (docs/display-ui-design-spec.md §3): in light only. Dark steps up the
/// surface instead, so it has none.
class AppRaisedShadow {
  AppRaisedShadow._();

  static const Color color = Color.fromRGBO(0, 0, 0, 0.16);

  /// The shadow for [brightness], falling away from the edge [offset]
  /// points to (design px, scaled here), or null in dark.
  static List<BoxShadow>? of(
    Brightness brightness, {
    Offset offset = const Offset(0, 4),
    double blur = 20,
  }) => brightness == Brightness.dark
      ? null
      : [
          BoxShadow(
            color: color,
            blurRadius: AppSpacings.scale(blur),
            offset: Offset(
              AppSpacings.scale(offset.dx),
              AppSpacings.scale(offset.dy),
            ),
          ),
        ];
}

/// The eight accents a panel can take (docs/display-ui-design-spec.md §2).
/// Amber and red are left out because they are warning and danger.
enum AppAccent {
  blue,
  teal,
  sage,
  terracotta,
  rose,
  violet,
  sand,
  graphite;

  /// The accent stored under [value], or blue.
  static AppAccent fromValue(String? value) => AppAccent.values.firstWhere(
        (accent) => accent.name == value,
        orElse: () => AppAccent.blue,
      );
}

/// One accent in one theme: [fill] takes white text, [text] is for text and
/// icons on a surface, [soft] is the tinted background and [pressed] is the
/// fill's pressed shade.
@immutable
class AppAccentPalette {
  const AppAccentPalette({
    required this.fill,
    required this.text,
    required this.soft,
    required this.pressed,
  });

  final Color fill;
  final Color text;
  final Color soft;
  final Color pressed;

  /// Content colour on [fill] and [pressed].
  Color get onFill => AppColors.white;

  // (fill, soft); text is the fill in the light theme.
  static const Map<AppAccent, (Color, Color)> _light = {
    AppAccent.blue: (Color(0xFF2563C9), Color(0xFFE9EFFA)),
    AppAccent.teal: (Color(0xFF0F766E), Color(0xFFE7F1F0)),
    AppAccent.sage: (Color(0xFF55702F), Color(0xFFEEF1EA)),
    AppAccent.terracotta: (Color(0xFFB04A26), Color(0xFFF7EDE9)),
    AppAccent.rose: (Color(0xFFA3476F), Color(0xFFF6EDF1)),
    AppAccent.violet: (Color(0xFF6247C4), Color(0xFFEFEDF9)),
    AppAccent.sand: (Color(0xFF7A6248), Color(0xFFF2EFED)),
    AppAccent.graphite: (Color(0xFF4A5261), Color(0xFFEDEEEF)),
  };

  // (fill, text, soft)
  static const Map<AppAccent, (Color, Color, Color)> _dark = {
    AppAccent.blue: (Color(0xFF3570D8), Color(0xFF8AB4F8), Color(0xFF212E48)),
    AppAccent.teal: (Color(0xFF11827A), Color(0xFF5FD0C5), Color(0xFF193333)),
    AppAccent.sage: (Color(0xFF5F7D36), Color(0xFFB3CF85), Color(0xFF2A3124)),
    AppAccent.terracotta: (Color(0xFFB85230), Color(0xFFF2A685), Color(0xFF3E2823)),
    AppAccent.rose: (Color(0xFFAD4F78), Color(0xFFF0A3C2), Color(0xFF3B2733)),
    AppAccent.violet: (Color(0xFF6E54D0), Color(0xFFB9A8F7), Color(0xFF2D2846)),
    AppAccent.sand: (Color(0xFF846B50), Color(0xFFD9BF9F), Color(0xFF322D2A)),
    AppAccent.graphite: (Color(0xFF5A6375), Color(0xFFB6BFCD), Color(0xFF292C32)),
  };

  /// The pressed shade: the fill 20 % toward black, so white stays readable.
  static Color _pressed(Color fill) =>
      Color.lerp(fill, const Color(0xFF000000), 0.2)!;

  static AppAccentPalette of(AppAccent accent, Brightness brightness) {
    if (brightness == Brightness.dark) {
      final (fill, text, soft) = _dark[accent]!;

      return AppAccentPalette(
        fill: fill,
        text: text,
        soft: soft,
        pressed: _pressed(fill),
      );
    }

    final (fill, soft) = _light[accent]!;

    return AppAccentPalette(
      fill: fill,
      text: fill,
      soft: soft,
      pressed: _pressed(fill),
    );
  }

  /// The accent as a legacy colour family, for widgets that take one:
  /// `base` is the fill, `light9` the soft and `dark2` the pressed shade.
  ThemeColorFamily family(Brightness brightness) {
    final toward = brightness == Brightness.dark
        ? AppNeutralPalette.dark.surfaceCard
        : AppColors.white;

    Color mix(double t) => Color.lerp(fill, toward, t)!;

    return ThemeColorFamily(
      base: fill,
      dark2: pressed,
      light3: mix(0.3),
      light5: mix(0.5),
      light7: mix(0.7),
      light8: mix(0.8),
      light9: soft,
    );
  }

  static AppAccentPalette lerp(AppAccentPalette a, AppAccentPalette b, double t) {
    return AppAccentPalette(
      fill: Color.lerp(a.fill, b.fill, t)!,
      text: Color.lerp(a.text, b.text, t)!,
      soft: Color.lerp(a.soft, b.soft, t)!,
      pressed: Color.lerp(a.pressed, b.pressed, t)!,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is AppAccentPalette &&
      other.fill == fill &&
      other.text == text &&
      other.soft == soft &&
      other.pressed == pressed;

  @override
  int get hashCode => Object.hash(fill, text, soft, pressed);
}

/// The panel's current accent.
///
/// Set by [LocalPreferencesService] when the stored choice loads or changes.
/// [AppTheme] builds its themes from it; widgets read the accent from their
/// theme ([AppDesignTokens.accent]) and fall back to this outside one.
class AppAccents {
  AppAccents._();

  static AppAccent current = AppAccent.blue;

  static AppAccentPalette palette(Brightness brightness) =>
      AppAccentPalette.of(current, brightness);
}

/// The accent scope: carries the current accent palette in a [ThemeData].
///
/// The accent colours primary buttons, the active deck tab and dock item,
/// selection, switches and slider thumbs outside domain views. It never
/// colours status, domain colours, alert overlays, alarm screens or the logo.
@immutable
class AppAccentTheme extends ThemeExtension<AppAccentTheme> {
  const AppAccentTheme({required this.accent, required this.palette});

  factory AppAccentTheme.of(AppAccent accent, Brightness brightness) =>
      AppAccentTheme(
        accent: accent,
        palette: AppAccentPalette.of(accent, brightness),
      );

  final AppAccent accent;
  final AppAccentPalette palette;

  @override
  AppAccentTheme copyWith({AppAccent? accent, AppAccentPalette? palette}) =>
      AppAccentTheme(
        accent: accent ?? this.accent,
        palette: palette ?? this.palette,
      );

  @override
  AppAccentTheme lerp(covariant AppAccentTheme? other, double t) {
    if (other == null) return this;

    return AppAccentTheme(
      accent: t < 0.5 ? accent : other.accent,
      palette: AppAccentPalette.lerp(palette, other.palette, t),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is AppAccentTheme &&
      other.accent == accent &&
      other.palette == palette;

  @override
  int get hashCode => Object.hash(accent, palette);
}

/// Token access from a [ThemeData].
extension AppDesignTokens on ThemeData {
  /// The current accent palette (see [AppAccentTheme]).
  AppAccentPalette get accent =>
      extension<AppAccentTheme>()?.palette ?? AppAccents.palette(brightness);

  AppNeutralPalette get neutrals => AppNeutralPalette.of(brightness);

  AppStatusPalette status(AppStatus status) =>
      AppStatusPalette.of(brightness, status);

  /// A domain colour family: `.base` is the domain colour, `.soft` its tint.
  /// Pass one of the domain [ThemeColors] (lights, climate, shading, media,
  /// sensors, energy, cameras).
  ThemeColorFamily domain(ThemeColors domain) =>
      ThemeColorFamily.get(brightness, domain);
}

class AppColorsLight {
  static const Color primary = Color(0xFF2563C9);
  static const Color primaryLight3 = Color(0xFF6692D9);
  static const Color primaryLight5 = Color(0xFF92B1E4);
  static const Color primaryLight7 = Color(0xFFBED0EF);
  static const Color primaryLight8 = Color(0xFFD3E0F4);
  static const Color primaryLight9 = Color(0xFFE9EFFA);
  static const Color primaryDark2 = Color(0xFF1E4FA1);

  static const Color success = Color(0xFF2E7D32);
  static const Color successLight3 = Color(0xFF6DA470);
  static const Color successLight5 = Color(0xFF96BE98);
  static const Color successLight7 = Color(0xFFC5E1C7);
  static const Color successLight8 = Color(0xFFD5E5D6);
  static const Color successLight9 = Color(0xFFECF6ED);
  static const Color successDark2 = Color(0xFF256428);

  static const Color warning = Color(0xFFA35600);
  static const Color warningLight3 = Color(0xFFBF894C);
  static const Color warningLight5 = Color(0xFFD1AA80);
  static const Color warningLight7 = Color(0xFFF3D3A8);
  static const Color warningLight8 = Color(0xFFEDDDCC);
  static const Color warningLight9 = Color(0xFFFDF1E2);
  static const Color warningDark2 = Color(0xFF824500);

  /// Status warning fill: the fill of every filled warning and Lights
  /// control, in both themes, with a white label.
  static const Color warningFill = Color(0xFFB25E00);

  /// [warningFill] 20 % toward black.
  static const Color warningFillPressed = Color(0xFF8E4B00);

  static const Color danger = Color(0xFFC62828);
  static const Color dangerLight3 = Color(0xFFD76868);
  static const Color dangerLight5 = Color(0xFFE29494);
  static const Color dangerLight7 = Color(0xFFF0BCBC);
  static const Color dangerLight8 = Color(0xFFF4D4D4);
  static const Color dangerLight9 = Color(0xFFFBEAEA);
  static const Color dangerDark2 = Color(0xFF9E2020);

  static const Color error = Color(0xFFC62828);
  static const Color errorLight3 = Color(0xFFD76868);
  static const Color errorLight5 = Color(0xFFE29494);
  static const Color errorLight7 = Color(0xFFF0BCBC);
  static const Color errorLight8 = Color(0xFFF4D4D4);
  static const Color errorLight9 = Color(0xFFFBEAEA);
  static const Color errorDark2 = Color(0xFF9E2020);

  static const Color info = Color(0xFF0272A1);
  static const Color infoLight3 = Color(0xFF4E9CBD);
  static const Color infoLight5 = Color(0xFF80B8D0);
  static const Color infoLight7 = Color(0xFFB3D5E3);
  static const Color infoLight8 = Color(0xFFCCE3EC);
  static const Color infoLight9 = Color(0xFFE3F2FA);
  static const Color infoDark2 = Color(0xFF025B81);

  static const Color neutral = Color(0xFF5B6675);
  static const Color neutralLight3 = Color(0xFF8C949E);
  static const Color neutralLight5 = Color(0xFFADB2BA);
  static const Color neutralLight7 = Color(0xFFD6DAE0);
  static const Color neutralLight8 = Color(0xFFDEE0E3);
  static const Color neutralLight9 = Color(0xFFEEF0F3);
  static const Color neutralDark2 = Color(0xFF49525E);

  static const Color flutter = Color(0xFF6247C4);
  static const Color flutterLight3 = Color(0xFF917ED6);
  static const Color flutterLight5 = Color(0xFFB0A3E2);
  static const Color flutterLight7 = Color(0xFFD0C8ED);
  static const Color flutterLight8 = Color(0xFFE0DAF3);
  static const Color flutterLight9 = Color(0xFFEFEDF9);
  static const Color flutterDark2 = Color(0xFF4E399D);

  static const Color teal = Color(0xFF00796B);
  static const Color tealLight3 = Color(0xFF4CA197);
  static const Color tealLight5 = Color(0xFF80BCB5);
  static const Color tealLight7 = Color(0xFFB2D7D3);
  static const Color tealLight8 = Color(0xFFCCE4E1);
  static const Color tealLight9 = Color(0xFFE0F2F1);
  static const Color tealDark2 = Color(0xFF006156);

  static const Color cyan = Color(0xFF007984);
  static const Color cyanLight3 = Color(0xFF4CA1A9);
  static const Color cyanLight5 = Color(0xFF80BCC2);
  static const Color cyanLight7 = Color(0xFFB2D7DA);
  static const Color cyanLight8 = Color(0xFFCCE4E6);
  static const Color cyanLight9 = Color(0xFFE0F7FA);
  static const Color cyanDark2 = Color(0xFF00616A);

  static const Color pink = Color(0xFFC2185B);
  static const Color pinkLight3 = Color(0xFFD45D8C);
  static const Color pinkLight5 = Color(0xFFE08CAD);
  static const Color pinkLight7 = Color(0xFFEDBACE);
  static const Color pinkLight8 = Color(0xFFF3D1DE);
  static const Color pinkLight9 = Color(0xFFFCE4EC);
  static const Color pinkDark2 = Color(0xFF9B1349);

  static const Color indigo = Color(0xFF3949AB);
  static const Color indigoLight3 = Color(0xFF7480C4);
  static const Color indigoLight5 = Color(0xFF9CA4D5);
  static const Color indigoLight7 = Color(0xFFC4C8E6);
  static const Color indigoLight8 = Color(0xFFD7DBEE);
  static const Color indigoLight9 = Color(0xFFE8EAF6);
  static const Color indigoDark2 = Color(0xFF2E3A89);
}

class AppBgColorLight {
  static const Color base = Color(0xFFFFFFFF);
  static const Color page = Color(0xFFF3F4F6);
  static const Color overlay = Color(0xFFFFFFFF);

  /// Semi-transparent page overlay (50% opacity)
  static const Color pageOverlay50 = Color.fromRGBO(0, 0, 0, 0.5);

  /// Semi-transparent page overlay (70% opacity)
  static const Color pageOverlay70 = Color.fromRGBO(0, 0, 0, 0.7);
}

class AppTextColorLight {
  static const Color primary = Color(0xFF1B1F26);
  // text.secondary, not text.muted: legacy secondary text is drawn on the page
  // surface, where muted is 4.2:1.
  static const Color secondary = Color(0xFF5B6270);
  static const Color regular = Color(0xFF5B6270);
  static const Color placeholder = Color(0xFF8B919B);
  static const Color disabled = Color(0xFF8B919B);
}

class AppBorderColorLight {
  static const Color extraLight = Color(0xFFE8EAEE);
  static const Color lighter = Color(0xFFE8EAEE);
  static const Color light = Color(0xFFE8EAEE);
  static const Color base = Color(0xFFDCDFE5);
  static const Color dark = Color(0xFFDCDFE5);
  static const Color darker = Color(0xFFDCDFE5);
}

class AppFillColorLight {
  static const Color darker = Color(0xFFDCDFE5);
  static const Color dark = Color(0xFFECEEF1);
  static const Color base = Color(0xFFECEEF1);
  static const Color light = Color(0xFFF6F7F9);
  static const Color lighter = Color(0xFFF6F7F9);
  static const Color extraLight = Color(0xFFF6F7F9);
  static const Color blank = Color(0xFFffffff);
}

class AppDisabledColorLight {
  static const Color bgColor = AppFillColorLight.light;
  static const Color textColor = AppTextColorLight.placeholder;
  static const Color borderColor = AppBorderColorLight.light;
}

class AppOverlayColorLight {
  static const Color base = Color.fromRGBO(0, 0, 0, 0.8);
  static const Color light = Color.fromRGBO(0, 0, 0, 0.7);
  static const Color lighter = Color.fromRGBO(0, 0, 0, 0.5);
}

class AppMaskColorLight {
  static const Color base = Color.fromRGBO(255, 255, 255, 0.9);
  static const Color extraLight = Color.fromRGBO(255, 255, 255, 0.3);
}

class AppColorsDark {
  static const Color primary = Color(0xFF3570D8);
  static const Color primaryLight3 = Color(0xFF2D57A0);
  static const Color primaryLight5 = Color(0xFF28467C);
  static const Color primaryLight7 = Color(0xFF233556);
  static const Color primaryLight8 = Color(0xFF202D44);
  static const Color primaryLight9 = Color(0xFF212E48);
  static const Color primaryDark2 = Color(0xFF5D8DE0);

  static const Color success = Color(0xFF6CC070);
  static const Color successLight3 = Color(0xFF548F58);
  static const Color successLight5 = Color(0xFF446E48);
  static const Color successLight7 = Color(0xFF2C4A2F);
  static const Color successLight8 = Color(0xFF2B3D2F);
  static const Color successLight9 = Color(0xFF1D2E1F);
  static const Color successDark2 = Color(0xFF89CD8D);

  static const Color warning = Color(0xFFF0A742);
  static const Color warningLight3 = Color(0xFFB07D38);
  static const Color warningLight5 = Color(0xFF866230);
  static const Color warningLight7 = Color(0xFF5A4223);
  static const Color warningLight8 = Color(0xFF463826);
  static const Color warningLight9 = Color(0xFF33261A);
  static const Color warningDark2 = Color(0xFFF3B968);

  static const Color danger = Color(0xFFF2706B);
  static const Color dangerLight3 = Color(0xFFB25754);
  static const Color dangerLight5 = Color(0xFF864645);
  static const Color dangerLight7 = Color(0xFF5E2C2C);
  static const Color dangerLight8 = Color(0xFF462D2E);
  static const Color dangerLight9 = Color(0xFF3A1F1F);
  static const Color dangerDark2 = Color(0xFFF58D89);

  static const Color error = Color(0xFFF2706B);
  static const Color errorLight3 = Color(0xFFB25754);
  static const Color errorLight5 = Color(0xFF864645);
  static const Color errorLight7 = Color(0xFF5E2C2C);
  static const Color errorLight8 = Color(0xFF462D2E);
  static const Color errorLight9 = Color(0xFF3A1F1F);
  static const Color errorDark2 = Color(0xFFF58D89);

  static const Color info = Color(0xFF4FB3E8);
  static const Color infoLight3 = Color(0xFF3F86AC);
  static const Color infoLight5 = Color(0xFF356884);
  static const Color infoLight7 = Color(0xFF2B495B);
  static const Color infoLight8 = Color(0xFF253A47);
  static const Color infoLight9 = Color(0xFF16293A);
  static const Color infoDark2 = Color(0xFF72C2ED);

  static const Color neutral = Color(0xFFA3ACB9);
  static const Color neutralLight3 = Color(0xFF7A818B);
  static const Color neutralLight5 = Color(0xFF5F646C);
  static const Color neutralLight7 = Color(0xFF3A3E45);
  static const Color neutralLight8 = Color(0xFF36393E);
  static const Color neutralLight9 = Color(0xFF272A2F);
  static const Color neutralDark2 = Color(0xFFB5BDC7);

  static const Color flutter = Color(0xFF6E54D0);
  static const Color flutterLight3 = Color(0xFF55439B);
  static const Color flutterLight5 = Color(0xFF443878);
  static const Color flutterLight7 = Color(0xFF342D54);
  static const Color flutterLight8 = Color(0xFF2C2742);
  static const Color flutterLight9 = Color(0xFF2D2846);
  static const Color flutterDark2 = Color(0xFF8B76D9);

  static const Color teal = Color(0xFF4DB6AC);
  static const Color tealLight3 = Color(0xFF3E8882);
  static const Color tealLight5 = Color(0xFF346966);
  static const Color tealLight7 = Color(0xFF2A4A49);
  static const Color tealLight8 = Color(0xFF253B3B);
  static const Color tealLight9 = Color(0xFF14302D);
  static const Color tealDark2 = Color(0xFF71C5BD);

  static const Color cyan = Color(0xFF4DD0E1);
  static const Color cyanLight3 = Color(0xFF3E9AA7);
  static const Color cyanLight5 = Color(0xFF347680);
  static const Color cyanLight7 = Color(0xFF2A5259);
  static const Color cyanLight8 = Color(0xFF254046);
  static const Color cyanLight9 = Color(0xFF133236);
  static const Color cyanDark2 = Color(0xFF71D9E7);

  static const Color pink = Color(0xFFF06292);
  static const Color pinkLight3 = Color(0xFFB04D70);
  static const Color pinkLight5 = Color(0xFF863F58);
  static const Color pinkLight7 = Color(0xFF5B3142);
  static const Color pinkLight8 = Color(0xFF462A36);
  static const Color pinkLight9 = Color(0xFF3A1A28);
  static const Color pinkDark2 = Color(0xFFF381A8);

  static const Color indigo = Color(0xFF8390D2);
  static const Color indigoLight3 = Color(0xFF646D9C);
  static const Color indigoLight5 = Color(0xFF4F5678);
  static const Color indigoLight7 = Color(0xFF3A3F55);
  static const Color indigoLight8 = Color(0xFF303343);
  static const Color indigoLight9 = Color(0xFF1F2340);
  static const Color indigoDark2 = Color(0xFF9CA6DB);
}

class AppBgColorDark {
  static const Color page = Color(0xFF121315);
  static const Color base = Color(0xFF1B1C1F);
  static const Color overlay = Color(0xFF232428);

  /// Semi-transparent page overlay (50% opacity)
  static const Color pageOverlay50 = Color.fromRGBO(0, 0, 0, 0.5);

  /// Semi-transparent page overlay (70% opacity)
  static const Color pageOverlay70 = Color.fromRGBO(0, 0, 0, 0.7);
}

class AppTextColorDark {
  static const Color primary = Color(0xFFE9EAEC);
  static const Color secondary = Color(0xFF8A9099);
  static const Color regular = Color(0xFFA2A7AF);
  static const Color placeholder = Color(0xFF6B7079);
  static const Color disabled = Color(0xFF6B7079);
}

class AppBorderColorDark {
  static const Color extraLight = Color(0xFF2A2C30);
  static const Color lighter = Color(0xFF2A2C30);
  static const Color light = Color(0xFF2A2C30);
  static const Color base = Color(0xFF33353A);
  static const Color dark = Color(0xFF33353A);
  static const Color darker = Color(0xFF33353A);
}

class AppFillColorDark {
  static const Color extraLight = Color(0xFF222327);
  static const Color lighter = Color(0xFF222327);
  static const Color light = Color(0xFF222327);
  static const Color base = Color(0xFF2A2B30);
  static const Color dark = Color(0xFF33353A);
  static const Color darker = Color(0xFF33353A);
  static const Color blank = Colors.transparent;
}

class AppDisabledColorDark {
  static const Color bgColor = AppFillColorDark.light;
  static const Color textColor = AppTextColorDark.placeholder;
  static const Color borderColor = AppBorderColorDark.light;
}

class AppOverlayColorDark {
  static const Color lighter = AppOverlayColorLight.lighter;
  static const Color light = AppOverlayColorLight.light;
  static const Color base = AppOverlayColorLight.base;
}

class AppMaskColorDark {
  static const Color extraLight = Color.fromRGBO(0, 0, 0, 0.8);
  static const Color base = Color.fromRGBO(0, 0, 0, 0.8);
}

class AppShadowColor {
  /// Light shadow for subtle depth (cards, buttons)
  static const Color light = Color.fromRGBO(0, 0, 0, 0.1);

  /// Medium shadow for elevated elements
  static const Color medium = Color.fromRGBO(0, 0, 0, 0.2);

  /// Strong shadow for modals, dropdowns
  static const Color strong = Color.fromRGBO(0, 0, 0, 0.3);
}

class AppBorderRadius {
  static final ScreenService _screenService = locator<ScreenService>();

  /// Dock, sheets, drawers, overlays.
  static double get medium =>
      _screenService.scale(12.0);

  /// Cards, tiles, chips, controls.
  static double get base =>
      _screenService.scale(8.0);

  /// Buttons inside a card, icon tiles.
  static double get inner =>
      _screenService.scale(6.0);

  /// Badges.
  static double get small =>
      _screenService.scale(4.0);

  static double get round =>
      _screenService.scale(20.0);

  /// Scene and status pills.
  static const double pill = 999.0;
}

class AppFontSize {
  static final ScreenService _screenService = locator<ScreenService>();

  static double get extraLarge =>
      _screenService.scale(18.0);

  static double get large =>
      _screenService.scale(16.0);

  static double get base =>
      _screenService.scale(14.0);

  static double get small =>
      _screenService.scale(12.0);

  /// Caption, status line, unit. The smallest size.
  static double get extraSmall =>
      _screenService.scale(10.0);

  /// The 8 px step is retired (under the 2.5 mm caption floor); it now
  /// renders at the caption size.
  static double get extraExtraSmall => extraSmall;
}

/// The numeral face: numerals of 18 px and larger (values, clocks, heroes).
/// Everything with letters in it, and every number below 18 px, is Roboto.
class AppNumeralFont {
  static const String family = 'BarlowSemiCondensed';

  /// Card values.
  static const FontWeight value = FontWeight.w500;

  /// Hero numerals and clocks.
  static const FontWeight display = FontWeight.w300;
}

// Centralized spacing
class AppSpacings {
  static final ScreenService _screenService = locator<ScreenService>();

  static double scale(double value) =>
      _screenService.scale(value);

  static double unscale(double value) =>
      _screenService.unscale(value);

  static double get pXxs =>
      _screenService.scale(1.0);

  static double get pXs =>
      _screenService.scale(2.0);

  static double get pSm =>
      _screenService.scale(4.0);

  static double get pSmMd =>
      _screenService.scale(6.0);

  static double get pMd =>
      _screenService.scale(8.0);

  static double get pMdLg =>
      _screenService.scale(12.0);

  static double get pLg =>
      _screenService.scale(16.0);

  static double get pLgXl =>
      _screenService.scale(24.0);

  static double get pXl =>
      _screenService.scale(32.0);

  static EdgeInsets get paddingXSs => EdgeInsets.all(pXxs);

  static EdgeInsets get paddingXs => EdgeInsets.all(pXs);

  static EdgeInsets get paddingSm => EdgeInsets.all(pSm);

  static EdgeInsets get paddingMd => EdgeInsets.all(pMd);

  static EdgeInsets get paddingLg => EdgeInsets.all(pLg);

  static EdgeInsets get paddingXl => EdgeInsets.all(pXl);

  static SizedBox get spacingXxsVertical => SizedBox(height: pXxs);

  static SizedBox get spacingXsVertical => SizedBox(height: pXs);

  static SizedBox get spacingSmVertical => SizedBox(height: pSm);

  static SizedBox get spacingMdVertical => SizedBox(height: pMd);

  static SizedBox get spacingLgVertical => SizedBox(height: pLg);

  static SizedBox get spacingXlVertical => SizedBox(height: pXl);

  static SizedBox get spacingXxsHorizontal => SizedBox(width: pXxs);

  static SizedBox get spacingXsHorizontal => SizedBox(width: pXs);

  static SizedBox get spacingSmHorizontal => SizedBox(width: pSm);

  static SizedBox get spacingMdHorizontal => SizedBox(width: pMd);

  static SizedBox get spacingLgHorizontal => SizedBox(width: pLg);

  static SizedBox get spacingXlHorizontal => SizedBox(width: pXl);
}

// Standard animation durations
class AppAnimation {
  /// Standard duration for UI state changes (200ms)
  /// Used for: button states, tile selection, color transitions
  static const Duration standard = Duration(milliseconds: 200);

  /// Fast duration for micro-interactions (100ms)
  /// Used for: icon changes, small feedback animations
  static const Duration fast = Duration(milliseconds: 100);

  /// Slow duration for complex animations (300ms)
  /// Used for: page transitions, modal appearances
  static const Duration slow = Duration(milliseconds: 300);
}

/// Standard aspect ratios for tiles across the app.
/// Aspect ratio = width / height (higher value = shorter tile)
class AppTileAspectRatio {
  /// Square tiles (1:1)
  /// Used for: sensor tiles, settings buttons, main device tiles
  static const double square = 1.0;

  /// Standard horizontal tiles (2:1)
  /// Used for: basic horizontal layouts
  static const double horizontal = 2.0;

  /// Wide horizontal tiles (2.5:1)
  /// Used for: device tiles in domain views, preset tiles
  static const double wide = 2.5;

  /// Extra wide horizontal tiles (3:1)
  /// Used for: auxiliary tiles, secondary info tiles
  static const double extraWide = 3.0;
}

/// Standard tile widths for fixed-width tile layouts.
/// Use with AppTileAspectRatio to calculate tile heights.
class AppTileWidth {
  // Horizontal layout tiles (wider than tall, aspect ratio > 1)
  static const double horizontalSmall = 100.0;
  static const double horizontalMedium = 140.0;
  static const double horizontalLarge = 180.0;

  // Vertical layout tiles (taller than wide, aspect ratio < 1)
  static const double verticalSmall = 80.0;
  static const double verticalMedium = 100.0;
  static const double verticalLarge = 120.0;
}

/// Standard tile heights for consistent tile sizing.
/// Use for horizontal tiles where height should be fixed regardless of width.
class AppTileHeight {
  /// Standard height for horizontal tiles (status, info, presets)
  static const double horizontal = 50.0;
}

/// There is no hover state on a touch panel, so hover keeps the fill: the
/// lighter Element Plus hover shade fails AA under white labels.
class AppFilledButtonsLightThemes {
  static FilledButtonThemeData get base => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: AppFillColorLight.blank,
      pressedBgColor: AppFillColorLight.blank,
      hoveredBgColor: AppFillColorLight.blank,
      disabledBgColor: AppFillColorLight.blank,
      borderColor: AppBorderColorLight.base,
      pressedBorderColor: AppColorsLight.primary,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppBorderColorLight.light,
    ),
  );

  static FilledButtonThemeData get primary => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.primary,
      pressedBgColor: AppColorsLight.primaryDark2,
      hoveredBgColor: AppColorsLight.primary,
      disabledBgColor: AppColorsLight.primaryLight5,
      borderColor: AppColorsLight.primary,
      pressedBorderColor: AppColorsLight.primaryDark2,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppColorsLight.primaryLight5,
    ),
  );

  static FilledButtonThemeData get success => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.success,
      pressedBgColor: AppColorsLight.successDark2,
      hoveredBgColor: AppColorsLight.success,
      disabledBgColor: AppColorsLight.successLight5,
      borderColor: AppColorsLight.success,
      pressedBorderColor: AppColorsLight.successDark2,
      hoveredBorderColor: AppColorsLight.success,
      disabledBorderColor: AppColorsLight.successLight5,
    ),
  );

  static FilledButtonThemeData get warning => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.warningFill,
      pressedBgColor: AppColorsLight.warningFillPressed,
      hoveredBgColor: AppColorsLight.warningFill,
      disabledBgColor: AppColorsLight.warningLight5,
      borderColor: AppColorsLight.warningFill,
      pressedBorderColor: AppColorsLight.warningFillPressed,
      hoveredBorderColor: AppColorsLight.warningFill,
      disabledBorderColor: AppColorsLight.warningLight5,
    ),
  );

  static FilledButtonThemeData get danger => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.danger,
      pressedBgColor: AppColorsLight.dangerDark2,
      hoveredBgColor: AppColorsLight.danger,
      disabledBgColor: AppColorsLight.dangerLight5,
      borderColor: AppColorsLight.danger,
      pressedBorderColor: AppColorsLight.dangerDark2,
      hoveredBorderColor: AppColorsLight.danger,
      disabledBorderColor: AppColorsLight.dangerLight5,
    ),
  );

  static FilledButtonThemeData get error => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.error,
      pressedBgColor: AppColorsLight.errorDark2,
      hoveredBgColor: AppColorsLight.error,
      disabledBgColor: AppColorsLight.errorLight5,
      borderColor: AppColorsLight.error,
      pressedBorderColor: AppColorsLight.errorDark2,
      hoveredBorderColor: AppColorsLight.error,
      disabledBorderColor: AppColorsLight.errorLight5,
    ),
  );

  static FilledButtonThemeData get info => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.info,
      pressedBgColor: AppColorsLight.infoDark2,
      hoveredBgColor: AppColorsLight.info,
      disabledBgColor: AppColorsLight.infoLight5,
      borderColor: AppColorsLight.info,
      pressedBorderColor: AppColorsLight.infoDark2,
      hoveredBorderColor: AppColorsLight.info,
      disabledBorderColor: AppColorsLight.infoLight5,
    ),
  );

  static FilledButtonThemeData get neutral => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.primary,
      pressedColor: AppTextColorLight.primary,
      hoveredColor: AppTextColorLight.primary,
      disabledColor: AppTextColorLight.secondary,
      bgColor: AppColorsLight.neutralLight7,
      pressedBgColor: AppColorsLight.neutralLight8,
      hoveredBgColor: AppColorsLight.neutralLight5,
      disabledBgColor: AppColorsLight.neutralLight8,
      borderColor: AppColorsLight.neutralLight7,
      pressedBorderColor: AppColorsLight.neutralLight8,
      hoveredBorderColor: AppColorsLight.neutralLight5,
      disabledBorderColor: AppColorsLight.neutralLight8,
    ),
  );

  static FilledButtonThemeData get flutter => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.flutter,
      pressedBgColor: AppColorsLight.flutterDark2,
      hoveredBgColor: AppColorsLight.flutter,
      disabledBgColor: AppColorsLight.flutterLight5,
      borderColor: AppColorsLight.flutter,
      pressedBorderColor: AppColorsLight.flutterDark2,
      hoveredBorderColor: AppColorsLight.flutter,
      disabledBorderColor: AppColorsLight.flutterLight5,
    ),
  );

  static FilledButtonThemeData get teal => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.teal,
      pressedBgColor: AppColorsLight.tealDark2,
      hoveredBgColor: AppColorsLight.teal,
      disabledBgColor: AppColorsLight.tealLight5,
      borderColor: AppColorsLight.teal,
      pressedBorderColor: AppColorsLight.tealDark2,
      hoveredBorderColor: AppColorsLight.teal,
      disabledBorderColor: AppColorsLight.tealLight5,
    ),
  );

  static FilledButtonThemeData get cyan => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.cyan,
      pressedBgColor: AppColorsLight.cyanDark2,
      hoveredBgColor: AppColorsLight.cyan,
      disabledBgColor: AppColorsLight.cyanLight5,
      borderColor: AppColorsLight.cyan,
      pressedBorderColor: AppColorsLight.cyanDark2,
      hoveredBorderColor: AppColorsLight.cyan,
      disabledBorderColor: AppColorsLight.cyanLight5,
    ),
  );

  static FilledButtonThemeData get pink => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.pink,
      pressedBgColor: AppColorsLight.pinkDark2,
      hoveredBgColor: AppColorsLight.pink,
      disabledBgColor: AppColorsLight.pinkLight5,
      borderColor: AppColorsLight.pink,
      pressedBorderColor: AppColorsLight.pinkDark2,
      hoveredBorderColor: AppColorsLight.pink,
      disabledBorderColor: AppColorsLight.pinkLight5,
    ),
  );

  static FilledButtonThemeData get indigo => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.indigo,
      pressedBgColor: AppColorsLight.indigoDark2,
      hoveredBgColor: AppColorsLight.indigo,
      disabledBgColor: AppColorsLight.indigoLight5,
      borderColor: AppColorsLight.indigo,
      pressedBorderColor: AppColorsLight.indigoDark2,
      hoveredBorderColor: AppColorsLight.indigo,
      disabledBorderColor: AppColorsLight.indigoLight5,
    ),
  );

  /// Look up the filled button theme for a given [ThemeColors] value.
  static FilledButtonThemeData forThemeColor(ThemeColors color) {
    return switch (color) {
      ThemeColors.primary => primary,
      ThemeColors.success || ThemeColors.energy => success,
      ThemeColors.warning || ThemeColors.lights => warning,
      ThemeColors.danger => danger,
      ThemeColors.error => error,
      ThemeColors.info || ThemeColors.climate => info,
      ThemeColors.neutral => neutral,
      ThemeColors.flutter => flutter,
      ThemeColors.teal || ThemeColors.shading => teal,
      ThemeColors.cyan || ThemeColors.sensors => cyan,
      ThemeColors.pink || ThemeColors.media => pink,
      ThemeColors.indigo || ThemeColors.cameras => indigo,
    };
  }

  /// Foreground (text/icon) color per variant. Pass to Icon/Text inside FilledButtons
  /// so they match the button theme (FilledButton can override Theme.iconTheme).
  static Color get baseForegroundColor => AppTextColorLight.regular;
  static Color get primaryForegroundColor => AppColors.white;
  static Color get successForegroundColor => AppColors.white;
  static Color get warningForegroundColor => AppColors.white;
  static Color get dangerForegroundColor => AppColors.white;
  static Color get errorForegroundColor => AppColors.white;
  static Color get infoForegroundColor => AppColors.white;
  static Color get neutralForegroundColor => AppTextColorLight.primary;
  static Color get flutterForegroundColor => AppColors.white;
  static Color get tealForegroundColor => AppColors.white;
  static Color get cyanForegroundColor => AppColors.white;
  static Color get pinkForegroundColor => AppColors.white;
  static Color get indigoForegroundColor => AppColors.white;
}

/// Dark filled buttons take the light-theme fills: the bright dark-theme
/// shades are for text and icons on dark surfaces and fail AA under white
/// labels. There is no hover state on a touch panel, so hover keeps the fill.
class AppFilledButtonsDarkThemes {
  static FilledButtonThemeData get base => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.regular,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppFillColorDark.blank,
      pressedBgColor: AppFillColorDark.blank,
      hoveredBgColor: AppFillColorDark.blank,
      disabledBgColor: AppFillColorDark.blank,
      borderColor: AppBorderColorDark.base,
      pressedBorderColor: AppColorsDark.primary,
      hoveredBorderColor: AppColorsDark.primary,
      disabledBorderColor: AppBorderColorDark.light,
    ),
  );

  static FilledButtonThemeData get primary => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.primary,
      pressedBgColor: AppColorsLight.primaryDark2,
      hoveredBgColor: AppColorsDark.primary,
      disabledBgColor: AppColorsDark.primaryLight5,
      borderColor: AppColorsDark.primary,
      pressedBorderColor: AppColorsLight.primaryDark2,
      hoveredBorderColor: AppColorsDark.primary,
      disabledBorderColor: AppColorsDark.primaryLight5,
    ),
  );

  static FilledButtonThemeData get success => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.success,
      pressedBgColor: AppColorsLight.successDark2,
      hoveredBgColor: AppColorsLight.success,
      disabledBgColor: AppColorsDark.successLight5,
      borderColor: AppColorsLight.success,
      pressedBorderColor: AppColorsLight.successDark2,
      hoveredBorderColor: AppColorsLight.success,
      disabledBorderColor: AppColorsDark.successLight5,
    ),
  );

  static FilledButtonThemeData get warning => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.warningFill,
      pressedBgColor: AppColorsLight.warningFillPressed,
      hoveredBgColor: AppColorsLight.warningFill,
      disabledBgColor: AppColorsDark.warningLight5,
      borderColor: AppColorsLight.warningFill,
      pressedBorderColor: AppColorsLight.warningFillPressed,
      hoveredBorderColor: AppColorsLight.warningFill,
      disabledBorderColor: AppColorsDark.warningLight5,
    ),
  );

  static FilledButtonThemeData get error => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.error,
      pressedBgColor: AppColorsLight.errorDark2,
      hoveredBgColor: AppColorsLight.error,
      disabledBgColor: AppColorsDark.errorLight5,
      borderColor: AppColorsLight.error,
      pressedBorderColor: AppColorsLight.errorDark2,
      hoveredBorderColor: AppColorsLight.error,
      disabledBorderColor: AppColorsDark.errorLight5,
    ),
  );

  static FilledButtonThemeData get danger => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.danger,
      pressedBgColor: AppColorsLight.dangerDark2,
      hoveredBgColor: AppColorsLight.danger,
      disabledBgColor: AppColorsDark.dangerLight5,
      borderColor: AppColorsLight.danger,
      pressedBorderColor: AppColorsLight.dangerDark2,
      hoveredBorderColor: AppColorsLight.danger,
      disabledBorderColor: AppColorsDark.dangerLight5,
    ),
  );

  static FilledButtonThemeData get info => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.info,
      pressedBgColor: AppColorsLight.infoDark2,
      hoveredBgColor: AppColorsLight.info,
      disabledBgColor: AppColorsDark.infoLight5,
      borderColor: AppColorsLight.info,
      pressedBorderColor: AppColorsLight.infoDark2,
      hoveredBorderColor: AppColorsLight.info,
      disabledBorderColor: AppColorsDark.infoLight5,
    ),
  );

  static FilledButtonThemeData get neutral => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.primary,
      pressedColor: AppTextColorDark.primary,
      hoveredColor: AppTextColorDark.primary,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.neutralLight7,
      pressedBgColor: AppColorsDark.neutralLight8,
      hoveredBgColor: AppColorsDark.neutralLight5,
      disabledBgColor: AppColorsDark.neutralLight8,
      borderColor: AppColorsDark.neutralLight7,
      pressedBorderColor: AppColorsDark.neutralLight8,
      hoveredBorderColor: AppColorsDark.neutralLight5,
      disabledBorderColor: AppColorsDark.neutralLight8,
    ),
  );

  static FilledButtonThemeData get flutter => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.flutter,
      pressedBgColor: AppColorsLight.flutterDark2,
      hoveredBgColor: AppColorsLight.flutter,
      disabledBgColor: AppColorsDark.flutterLight5,
      borderColor: AppColorsLight.flutter,
      pressedBorderColor: AppColorsLight.flutterDark2,
      hoveredBorderColor: AppColorsLight.flutter,
      disabledBorderColor: AppColorsDark.flutterLight5,
    ),
  );

  static FilledButtonThemeData get teal => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.teal,
      pressedBgColor: AppColorsLight.tealDark2,
      hoveredBgColor: AppColorsLight.teal,
      disabledBgColor: AppColorsDark.tealLight5,
      borderColor: AppColorsLight.teal,
      pressedBorderColor: AppColorsLight.tealDark2,
      hoveredBorderColor: AppColorsLight.teal,
      disabledBorderColor: AppColorsDark.tealLight5,
    ),
  );

  static FilledButtonThemeData get cyan => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.cyan,
      pressedBgColor: AppColorsLight.cyanDark2,
      hoveredBgColor: AppColorsLight.cyan,
      disabledBgColor: AppColorsDark.cyanLight5,
      borderColor: AppColorsLight.cyan,
      pressedBorderColor: AppColorsLight.cyanDark2,
      hoveredBorderColor: AppColorsLight.cyan,
      disabledBorderColor: AppColorsDark.cyanLight5,
    ),
  );

  static FilledButtonThemeData get pink => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.pink,
      pressedBgColor: AppColorsLight.pinkDark2,
      hoveredBgColor: AppColorsLight.pink,
      disabledBgColor: AppColorsDark.pinkLight5,
      borderColor: AppColorsLight.pink,
      pressedBorderColor: AppColorsLight.pinkDark2,
      hoveredBorderColor: AppColorsLight.pink,
      disabledBorderColor: AppColorsDark.pinkLight5,
    ),
  );

  static FilledButtonThemeData get indigo => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsLight.indigo,
      pressedBgColor: AppColorsLight.indigoDark2,
      hoveredBgColor: AppColorsLight.indigo,
      disabledBgColor: AppColorsDark.indigoLight5,
      borderColor: AppColorsLight.indigo,
      pressedBorderColor: AppColorsLight.indigoDark2,
      hoveredBorderColor: AppColorsLight.indigo,
      disabledBorderColor: AppColorsDark.indigoLight5,
    ),
  );

  /// Look up the filled button theme for a given [ThemeColors] value.
  static FilledButtonThemeData forThemeColor(ThemeColors color) {
    return switch (color) {
      ThemeColors.primary => primary,
      ThemeColors.success || ThemeColors.energy => success,
      ThemeColors.warning || ThemeColors.lights => warning,
      ThemeColors.danger => danger,
      ThemeColors.error => error,
      ThemeColors.info || ThemeColors.climate => info,
      ThemeColors.neutral => neutral,
      ThemeColors.flutter => flutter,
      ThemeColors.teal || ThemeColors.shading => teal,
      ThemeColors.cyan || ThemeColors.sensors => cyan,
      ThemeColors.pink || ThemeColors.media => pink,
      ThemeColors.indigo || ThemeColors.cameras => indigo,
    };
  }

  /// Foreground (text/icon) color per variant. Pass to Icon/Text inside FilledButtons
  /// so they match the button theme (FilledButton can override Theme.iconTheme).
  static Color get baseForegroundColor => AppTextColorDark.regular;
  static Color get primaryForegroundColor => AppColors.white;
  static Color get successForegroundColor => AppColors.white;
  static Color get warningForegroundColor => AppColors.white;
  static Color get dangerForegroundColor => AppColors.white;
  static Color get errorForegroundColor => AppColors.white;
  static Color get infoForegroundColor => AppColors.white;
  static Color get neutralForegroundColor => AppTextColorDark.primary;
  static Color get flutterForegroundColor => AppColors.white;
  static Color get tealForegroundColor => AppColors.white;
  static Color get cyanForegroundColor => AppColors.white;
  static Color get pinkForegroundColor => AppColors.white;
  static Color get indigoForegroundColor => AppColors.white;
}

class AppOutlinedButtonsLightThemes {
  static OutlinedButtonThemeData get base => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: AppFillColorLight.blank,
      pressedBgColor: AppFillColorLight.blank,
      hoveredBgColor: AppFillColorLight.blank,
      disabledBgColor: AppFillColorLight.blank,
      borderColor: AppBorderColorLight.base,
      pressedBorderColor: AppColorsLight.primary,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppBorderColorLight.light,
    ),
  );

  static OutlinedButtonThemeData get primary => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.primary,
      pressedColor: AppColors.white,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppColorsLight.primaryLight5,
      bgColor: AppColorsLight.primaryLight9,
      pressedBgColor: AppColorsLight.primaryDark2,
      hoveredBgColor: AppColorsLight.primary,
      disabledBgColor: AppColorsLight.primaryLight9,
      borderColor: AppColorsLight.primaryLight5,
      pressedBorderColor: AppColorsLight.primaryDark2,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppColorsLight.primaryLight8,
    ),
  );

  static OutlinedButtonThemeData get success => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.success,
      pressedColor: AppColorsLight.successDark2,
      hoveredColor: AppColorsLight.success,
      disabledColor: AppColorsLight.successLight5,
      bgColor: AppColorsLight.successLight9,
      pressedBgColor: AppColorsLight.successDark2,
      hoveredBgColor: AppColorsLight.success,
      disabledBgColor: AppColorsLight.successLight9,
      borderColor: AppColorsLight.successLight5,
      pressedBorderColor: AppColorsLight.successDark2,
      hoveredBorderColor: AppColorsLight.success,
      disabledBorderColor: AppColorsLight.successLight8,
    ),
  );

  static OutlinedButtonThemeData get warning => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.warning,
      pressedColor: AppColorsLight.warningDark2,
      hoveredColor: AppColorsLight.warning,
      disabledColor: AppColorsLight.warningLight5,
      bgColor: AppColorsLight.warningLight9,
      pressedBgColor: AppColorsLight.warningDark2,
      hoveredBgColor: AppColorsLight.warning,
      disabledBgColor: AppColorsLight.warningLight9,
      borderColor: AppColorsLight.warningLight5,
      pressedBorderColor: AppColorsLight.warningDark2,
      hoveredBorderColor: AppColorsLight.warning,
      disabledBorderColor: AppColorsLight.warningLight8,
    ),
  );

  static OutlinedButtonThemeData get danger => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.danger,
      pressedColor: AppColorsLight.dangerDark2,
      hoveredColor: AppColorsLight.danger,
      disabledColor: AppColorsLight.dangerLight5,
      bgColor: AppColorsLight.dangerLight9,
      pressedBgColor: AppColorsLight.dangerDark2,
      hoveredBgColor: AppColorsLight.danger,
      disabledBgColor: AppColorsLight.dangerLight9,
      borderColor: AppColorsLight.dangerLight5,
      pressedBorderColor: AppColorsLight.dangerDark2,
      hoveredBorderColor: AppColorsLight.danger,
      disabledBorderColor: AppColorsLight.dangerLight8,
    ),
  );

  static OutlinedButtonThemeData get error => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.error,
      pressedColor: AppColorsLight.errorDark2,
      hoveredColor: AppColorsLight.error,
      disabledColor: AppColorsLight.errorLight5,
      bgColor: AppColorsLight.errorLight9,
      pressedBgColor: AppColorsLight.errorDark2,
      hoveredBgColor: AppColorsLight.error,
      disabledBgColor: AppColorsLight.errorLight9,
      borderColor: AppColorsLight.errorLight5,
      pressedBorderColor: AppColorsLight.errorDark2,
      hoveredBorderColor: AppColorsLight.error,
      disabledBorderColor: AppColorsLight.errorLight8,
    ),
  );

  static OutlinedButtonThemeData get info => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.info,
      pressedColor: AppColorsLight.infoDark2,
      hoveredColor: AppColorsLight.info,
      disabledColor: AppColorsLight.infoLight5,
      bgColor: AppColorsLight.infoLight9,
      pressedBgColor: AppColorsLight.infoDark2,
      hoveredBgColor: AppColorsLight.info,
      disabledBgColor: AppColorsLight.infoLight9,
      borderColor: AppColorsLight.infoLight5,
      pressedBorderColor: AppColorsLight.infoDark2,
      hoveredBorderColor: AppColorsLight.info,
      disabledBorderColor: AppColorsLight.infoLight8,
    ),
  );

  static OutlinedButtonThemeData get neutral => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: AppFillColorLight.blank,
      pressedBgColor: AppFillColorLight.blank,
      hoveredBgColor: AppFillColorLight.blank,
      disabledBgColor: AppFillColorLight.blank,
      borderColor: AppBorderColorLight.base,
      pressedBorderColor: AppColorsLight.primary,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppBorderColorLight.light,
    ),
  );

  static OutlinedButtonThemeData get flutter => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.flutter,
      pressedColor: AppColorsLight.flutterDark2,
      hoveredColor: AppColorsLight.flutter,
      disabledColor: AppColorsLight.flutterLight5,
      bgColor: AppColorsLight.flutterLight9,
      pressedBgColor: AppColorsLight.flutterDark2,
      hoveredBgColor: AppColorsLight.flutter,
      disabledBgColor: AppColorsLight.flutterLight9,
      borderColor: AppColorsLight.flutterLight5,
      pressedBorderColor: AppColorsLight.flutterDark2,
      hoveredBorderColor: AppColorsLight.flutter,
      disabledBorderColor: AppColorsLight.flutterLight8,
    ),
  );

  static OutlinedButtonThemeData get teal => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.teal,
      pressedColor: AppColorsLight.tealDark2,
      hoveredColor: AppColorsLight.teal,
      disabledColor: AppColorsLight.tealLight5,
      bgColor: AppColorsLight.tealLight9,
      pressedBgColor: AppColorsLight.tealDark2,
      hoveredBgColor: AppColorsLight.teal,
      disabledBgColor: AppColorsLight.tealLight9,
      borderColor: AppColorsLight.tealLight5,
      pressedBorderColor: AppColorsLight.tealDark2,
      hoveredBorderColor: AppColorsLight.teal,
      disabledBorderColor: AppColorsLight.tealLight8,
    ),
  );

  static OutlinedButtonThemeData get cyan => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.cyan,
      pressedColor: AppColorsLight.cyanDark2,
      hoveredColor: AppColorsLight.cyan,
      disabledColor: AppColorsLight.cyanLight5,
      bgColor: AppColorsLight.cyanLight9,
      pressedBgColor: AppColorsLight.cyanDark2,
      hoveredBgColor: AppColorsLight.cyan,
      disabledBgColor: AppColorsLight.cyanLight9,
      borderColor: AppColorsLight.cyanLight5,
      pressedBorderColor: AppColorsLight.cyanDark2,
      hoveredBorderColor: AppColorsLight.cyan,
      disabledBorderColor: AppColorsLight.cyanLight8,
    ),
  );

  static OutlinedButtonThemeData get pink => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.pink,
      pressedColor: AppColorsLight.pinkDark2,
      hoveredColor: AppColorsLight.pink,
      disabledColor: AppColorsLight.pinkLight5,
      bgColor: AppColorsLight.pinkLight9,
      pressedBgColor: AppColorsLight.pinkDark2,
      hoveredBgColor: AppColorsLight.pink,
      disabledBgColor: AppColorsLight.pinkLight9,
      borderColor: AppColorsLight.pinkLight5,
      pressedBorderColor: AppColorsLight.pinkDark2,
      hoveredBorderColor: AppColorsLight.pink,
      disabledBorderColor: AppColorsLight.pinkLight8,
    ),
  );

  static OutlinedButtonThemeData get indigo => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.indigo,
      pressedColor: AppColorsLight.indigoDark2,
      hoveredColor: AppColorsLight.indigo,
      disabledColor: AppColorsLight.indigoLight5,
      bgColor: AppColorsLight.indigoLight9,
      pressedBgColor: AppColorsLight.indigoDark2,
      hoveredBgColor: AppColorsLight.indigo,
      disabledBgColor: AppColorsLight.indigoLight9,
      borderColor: AppColorsLight.indigoLight5,
      pressedBorderColor: AppColorsLight.indigoDark2,
      hoveredBorderColor: AppColorsLight.indigo,
      disabledBorderColor: AppColorsLight.indigoLight8,
    ),
  );

  /// Foreground (text/icon) color per variant. Pass to Icon/Text inside FilledButtons
  /// so they match the button theme (OutlinedButton can override Theme.iconTheme).
  static Color get baseForegroundColor => AppTextColorLight.regular;
  static Color get primaryForegroundColor => AppColorsLight.primary;
  static Color get successForegroundColor => AppColorsLight.success;
  static Color get warningForegroundColor => AppColorsLight.warning;
  static Color get dangerForegroundColor => AppColorsLight.danger;
  static Color get errorForegroundColor => AppColorsLight.error;
  static Color get infoForegroundColor => AppColorsLight.info;
  static Color get neutralForegroundColor => AppTextColorLight.regular;
  static Color get flutterForegroundColor => AppColorsLight.flutter;
  static Color get tealForegroundColor => AppColorsLight.teal;
  static Color get cyanForegroundColor => AppColorsLight.cyan;
  static Color get pinkForegroundColor => AppColorsLight.pink;
  static Color get indigoForegroundColor => AppColorsLight.indigo;
}

class AppOutlinedButtonsDarkThemes {
  static OutlinedButtonThemeData get base => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.regular,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppFillColorDark.blank,
      pressedBgColor: AppFillColorDark.blank,
      hoveredBgColor: AppFillColorDark.blank,
      disabledBgColor: AppFillColorDark.blank,
      borderColor: AppBorderColorDark.base,
      pressedBorderColor: AppColorsDark.primary,
      hoveredBorderColor: AppColorsDark.primary,
      disabledBorderColor: AppBorderColorDark.light,
    ),
  );

  static OutlinedButtonThemeData get primary => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.primary,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.primaryLight5,
      bgColor: AppColorsDark.primaryLight9,
      pressedBgColor: AppColorsDark.primaryDark2,
      hoveredBgColor: AppColorsDark.primary,
      disabledBgColor: AppColorsDark.primaryLight9,
      borderColor: AppColorsDark.primaryLight5,
      pressedBorderColor: AppColorsDark.primaryDark2,
      hoveredBorderColor: AppColorsDark.primary,
      disabledBorderColor: AppColorsDark.primaryLight8,
    ),
  );

  static OutlinedButtonThemeData get success => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.success,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.successLight5,
      bgColor: AppColorsDark.successLight9,
      pressedBgColor: AppColorsDark.successDark2,
      hoveredBgColor: AppColorsDark.success,
      disabledBgColor: AppColorsDark.successLight9,
      borderColor: AppColorsDark.successLight5,
      pressedBorderColor: AppColorsDark.successDark2,
      hoveredBorderColor: AppColorsDark.success,
      disabledBorderColor: AppColorsDark.successLight8,
    ),
  );

  static OutlinedButtonThemeData get warning => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.warning,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.warningLight5,
      bgColor: AppColorsDark.warningLight9,
      pressedBgColor: AppColorsDark.warningDark2,
      hoveredBgColor: AppColorsDark.warning,
      disabledBgColor: AppColorsDark.warningLight9,
      borderColor: AppColorsDark.warningLight5,
      pressedBorderColor: AppColorsDark.warningDark2,
      hoveredBorderColor: AppColorsDark.warning,
      disabledBorderColor: AppColorsDark.warningLight8,
    ),
  );

  static OutlinedButtonThemeData get danger => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.danger,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.dangerLight5,
      bgColor: AppColorsDark.dangerLight9,
      pressedBgColor: AppColorsDark.dangerDark2,
      hoveredBgColor: AppColorsDark.danger,
      disabledBgColor: AppColorsDark.dangerLight9,
      borderColor: AppColorsDark.dangerLight5,
      pressedBorderColor: AppColorsDark.dangerDark2,
      hoveredBorderColor: AppColorsDark.danger,
      disabledBorderColor: AppColorsDark.dangerLight8,
    ),
  );

  static OutlinedButtonThemeData get error => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.error,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.errorLight5,
      bgColor: AppColorsDark.errorLight9,
      pressedBgColor: AppColorsDark.errorDark2,
      hoveredBgColor: AppColorsDark.error,
      disabledBgColor: AppColorsDark.errorLight9,
      borderColor: AppColorsDark.errorLight5,
      pressedBorderColor: AppColorsDark.errorDark2,
      hoveredBorderColor: AppColorsDark.error,
      disabledBorderColor: AppColorsDark.errorLight8,
    ),
  );

  static OutlinedButtonThemeData get info => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.info,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.infoLight5,
      bgColor: AppColorsDark.infoLight9,
      pressedBgColor: AppColorsDark.infoDark2,
      hoveredBgColor: AppColorsDark.info,
      disabledBgColor: AppColorsDark.infoLight9,
      borderColor: AppColorsDark.infoLight5,
      pressedBorderColor: AppColorsDark.infoDark2,
      hoveredBorderColor: AppColorsDark.info,
      disabledBorderColor: AppColorsDark.infoLight8,
    ),
  );

  static OutlinedButtonThemeData get neutral => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.primary,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppFillColorDark.blank,
      pressedBgColor: AppFillColorDark.blank,
      hoveredBgColor: AppFillColorDark.blank,
      disabledBgColor: AppFillColorDark.blank,
      borderColor: AppBorderColorDark.darker,
      pressedBorderColor: AppBorderColorDark.dark,
      hoveredBorderColor: AppBorderColorDark.dark,
      disabledBorderColor: AppBorderColorDark.light,
    ),
  );

  static OutlinedButtonThemeData get flutter => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.flutter,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.flutterLight5,
      bgColor: AppColorsDark.flutterLight9,
      pressedBgColor: AppColorsDark.flutterDark2,
      hoveredBgColor: AppColorsDark.flutter,
      disabledBgColor: AppColorsDark.flutterLight9,
      borderColor: AppColorsDark.flutterLight5,
      pressedBorderColor: AppColorsDark.flutterDark2,
      hoveredBorderColor: AppColorsDark.flutter,
      disabledBorderColor: AppColorsDark.flutterLight8,
    ),
  );

  static OutlinedButtonThemeData get teal => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.teal,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.tealLight5,
      bgColor: AppColorsDark.tealLight9,
      pressedBgColor: AppColorsDark.tealDark2,
      hoveredBgColor: AppColorsDark.teal,
      disabledBgColor: AppColorsDark.tealLight9,
      borderColor: AppColorsDark.tealLight5,
      pressedBorderColor: AppColorsDark.tealDark2,
      hoveredBorderColor: AppColorsDark.teal,
      disabledBorderColor: AppColorsDark.tealLight8,
    ),
  );

  static OutlinedButtonThemeData get cyan => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.cyan,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.cyanLight5,
      bgColor: AppColorsDark.cyanLight9,
      pressedBgColor: AppColorsDark.cyanDark2,
      hoveredBgColor: AppColorsDark.cyan,
      disabledBgColor: AppColorsDark.cyanLight9,
      borderColor: AppColorsDark.cyanLight5,
      pressedBorderColor: AppColorsDark.cyanDark2,
      hoveredBorderColor: AppColorsDark.cyan,
      disabledBorderColor: AppColorsDark.cyanLight8,
    ),
  );

  static OutlinedButtonThemeData get pink => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.pink,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.pinkLight5,
      bgColor: AppColorsDark.pinkLight9,
      pressedBgColor: AppColorsDark.pinkDark2,
      hoveredBgColor: AppColorsDark.pink,
      disabledBgColor: AppColorsDark.pinkLight9,
      borderColor: AppColorsDark.pinkLight5,
      pressedBorderColor: AppColorsDark.pinkDark2,
      hoveredBorderColor: AppColorsDark.pink,
      disabledBorderColor: AppColorsDark.pinkLight8,
    ),
  );

  static OutlinedButtonThemeData get indigo => OutlinedButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.indigo,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColorsDark.indigoLight5,
      bgColor: AppColorsDark.indigoLight9,
      pressedBgColor: AppColorsDark.indigoDark2,
      hoveredBgColor: AppColorsDark.indigo,
      disabledBgColor: AppColorsDark.indigoLight9,
      borderColor: AppColorsDark.indigoLight5,
      pressedBorderColor: AppColorsDark.indigoDark2,
      hoveredBorderColor: AppColorsDark.indigo,
      disabledBorderColor: AppColorsDark.indigoLight8,
    ),
  );

  /// Foreground (text/icon) color per variant. Pass to Icon/Text inside FilledButtons
  /// so they match the button theme (OutlinedButton can override Theme.iconTheme).
  static Color get baseForegroundColor => AppTextColorDark.regular;
  static Color get primaryForegroundColor => AppColorsDark.primary;
  static Color get successForegroundColor => AppColorsDark.success;
  static Color get warningForegroundColor => AppColorsDark.warning;
  static Color get dangerForegroundColor => AppColorsDark.danger;
  static Color get errorForegroundColor => AppColorsDark.error;
  static Color get infoForegroundColor => AppColorsDark.info;
  static Color get neutralForegroundColor => AppTextColorDark.primary;
  static Color get flutterForegroundColor => AppColorsDark.flutter;
  static Color get tealForegroundColor => AppColorsDark.teal;
  static Color get cyanForegroundColor => AppColorsDark.cyan;
  static Color get pinkForegroundColor => AppColorsDark.pink;
  static Color get indigoForegroundColor => AppColorsDark.indigo;
}

class AppTextButtonsLightThemes {
  static TextButtonThemeData get base => TextButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static TextButtonThemeData get primary => TextButtonThemeData(
    style: createButtonTheme(
      color: AppColorsLight.primary,
      pressedColor: AppColorsLight.primaryDark2,
      hoveredColor: AppColorsLight.primaryLight3,
      disabledColor: AppColorsLight.primaryLight5,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static TextButtonThemeData get neutral => TextButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static Color get baseForegroundColor => AppTextColorLight.regular;
  static Color get primaryForegroundColor => AppColorsLight.primary;
  static Color get neutralForegroundColor => AppTextColorLight.regular;
}

class AppTextButtonsDarkThemes {
  static TextButtonThemeData get base => TextButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.regular,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: AppTextColorDark.placeholder,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static TextButtonThemeData get primary => TextButtonThemeData(
    style: createButtonTheme(
      color: AppColorsDark.primary,
      pressedColor: AppColorsDark.primaryDark2,
      hoveredColor: AppColorsDark.primaryLight3,
      disabledColor: AppColorsDark.primaryLight5,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static TextButtonThemeData get neutral => TextButtonThemeData(
    style: createButtonTheme(
      color: AppTextColorDark.regular,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: AppTextColorDark.placeholder,
      bgColor: Colors.transparent,
      pressedBgColor: Colors.transparent,
      hoveredBgColor: Colors.transparent,
      disabledBgColor: Colors.transparent,
      borderColor: Colors.transparent,
      pressedBorderColor: Colors.transparent,
      hoveredBorderColor: Colors.transparent,
      disabledBorderColor: Colors.transparent,
    ),
  );

  static Color get baseForegroundColor => AppTextColorDark.regular;
  static Color get primaryForegroundColor => AppColorsDark.primary;
  static Color get neutralForegroundColor => AppTextColorDark.primary;
}

class AppIconButtonsLightThemes {
  static IconButtonThemeData get base => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppTextColorLight.regular,
      pressedColor: AppColorsLight.primary,
      hoveredColor: AppColorsLight.primary,
      disabledColor: AppTextColorLight.placeholder,
      bgColor: AppFillColorLight.blank,
      pressedBgColor: AppFillColorLight.blank,
      hoveredBgColor: AppFillColorLight.blank,
      disabledBgColor: AppFillColorLight.blank,
      borderColor: AppBorderColorLight.base,
      pressedBorderColor: AppColorsLight.primary,
      hoveredBorderColor: AppColorsLight.primary,
      disabledBorderColor: AppBorderColorLight.light,
    ),
  );

  static IconButtonThemeData get primary => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.primary,
      pressedBgColor: AppColorsLight.primaryDark2,
      hoveredBgColor: AppColorsLight.primaryLight3,
      disabledBgColor: AppColorsLight.primaryLight5,
      borderColor: AppColorsLight.primary,
      pressedBorderColor: AppColorsLight.primaryDark2,
      hoveredBorderColor: AppColorsLight.primaryLight3,
      disabledBorderColor: AppColorsLight.primaryLight5,
    ),
  );

  static IconButtonThemeData get success => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.success,
      pressedBgColor: AppColorsLight.successDark2,
      hoveredBgColor: AppColorsLight.successLight3,
      disabledBgColor: AppColorsLight.successLight5,
      borderColor: AppColorsLight.success,
      pressedBorderColor: AppColorsLight.successDark2,
      hoveredBorderColor: AppColorsLight.successLight3,
      disabledBorderColor: AppColorsLight.successLight5,
    ),
  );

  static IconButtonThemeData get warning => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.warning,
      pressedBgColor: AppColorsLight.warningDark2,
      hoveredBgColor: AppColorsLight.warningLight3,
      disabledBgColor: AppColorsLight.warningLight5,
      borderColor: AppColorsLight.warning,
      pressedBorderColor: AppColorsLight.warningDark2,
      hoveredBorderColor: AppColorsLight.warningLight3,
      disabledBorderColor: AppColorsLight.warningLight5,
    ),
  );

  static IconButtonThemeData get danger => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.danger,
      pressedBgColor: AppColorsLight.dangerDark2,
      hoveredBgColor: AppColorsLight.dangerLight3,
      disabledBgColor: AppColorsLight.dangerLight5,
      borderColor: AppColorsLight.danger,
      pressedBorderColor: AppColorsLight.dangerDark2,
      hoveredBorderColor: AppColorsLight.dangerLight3,
      disabledBorderColor: AppColorsLight.dangerLight5,
    ),
  );

  static IconButtonThemeData get error => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.error,
      pressedBgColor: AppColorsLight.errorDark2,
      hoveredBgColor: AppColorsLight.errorLight3,
      disabledBgColor: AppColorsLight.errorLight5,
      borderColor: AppColorsLight.error,
      pressedBorderColor: AppColorsLight.errorDark2,
      hoveredBorderColor: AppColorsLight.errorLight3,
      disabledBorderColor: AppColorsLight.errorLight5,
    ),
  );

  static IconButtonThemeData get info => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.info,
      pressedBgColor: AppColorsLight.infoDark2,
      hoveredBgColor: AppColorsLight.infoLight3,
      disabledBgColor: AppColorsLight.infoLight5,
      borderColor: AppColorsLight.info,
      pressedBorderColor: AppColorsLight.infoDark2,
      hoveredBorderColor: AppColorsLight.infoLight3,
      disabledBorderColor: AppColorsLight.infoLight5,
    ),
  );

  static IconButtonThemeData get flutter => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.flutter,
      pressedBgColor: AppColorsLight.flutterDark2,
      hoveredBgColor: AppColorsLight.flutterLight3,
      disabledBgColor: AppColorsLight.flutterLight5,
      borderColor: AppColorsLight.flutter,
      pressedBorderColor: AppColorsLight.flutterDark2,
      hoveredBorderColor: AppColorsLight.flutterLight3,
      disabledBorderColor: AppColorsLight.flutterLight5,
    ),
  );

  static IconButtonThemeData get teal => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.teal,
      pressedBgColor: AppColorsLight.tealDark2,
      hoveredBgColor: AppColorsLight.tealLight3,
      disabledBgColor: AppColorsLight.tealLight5,
      borderColor: AppColorsLight.teal,
      pressedBorderColor: AppColorsLight.tealDark2,
      hoveredBorderColor: AppColorsLight.tealLight3,
      disabledBorderColor: AppColorsLight.tealLight5,
    ),
  );

  static IconButtonThemeData get cyan => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.cyan,
      pressedBgColor: AppColorsLight.cyanDark2,
      hoveredBgColor: AppColorsLight.cyanLight3,
      disabledBgColor: AppColorsLight.cyanLight5,
      borderColor: AppColorsLight.cyan,
      pressedBorderColor: AppColorsLight.cyanDark2,
      hoveredBorderColor: AppColorsLight.cyanLight3,
      disabledBorderColor: AppColorsLight.cyanLight5,
    ),
  );

  static IconButtonThemeData get pink => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.pink,
      pressedBgColor: AppColorsLight.pinkDark2,
      hoveredBgColor: AppColorsLight.pinkLight3,
      disabledBgColor: AppColorsLight.pinkLight5,
      borderColor: AppColorsLight.pink,
      pressedBorderColor: AppColorsLight.pinkDark2,
      hoveredBorderColor: AppColorsLight.pinkLight3,
      disabledBorderColor: AppColorsLight.pinkLight5,
    ),
  );

  static IconButtonThemeData get indigo => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.indigo,
      pressedBgColor: AppColorsLight.indigoDark2,
      hoveredBgColor: AppColorsLight.indigoLight3,
      disabledBgColor: AppColorsLight.indigoLight5,
      borderColor: AppColorsLight.indigo,
      pressedBorderColor: AppColorsLight.indigoDark2,
      hoveredBorderColor: AppColorsLight.indigoLight3,
      disabledBorderColor: AppColorsLight.indigoLight5,
    ),
  );
}

class AppIconButtonsDarkThemes {
  static IconButtonThemeData get base => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppTextColorDark.regular,
      pressedColor: AppColorsDark.primary,
      hoveredColor: AppColorsDark.primary,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppFillColorDark.blank,
      pressedBgColor: AppFillColorDark.blank,
      hoveredBgColor: AppFillColorDark.blank,
      disabledBgColor: AppFillColorDark.blank,
      borderColor: AppBorderColorDark.base,
      pressedBorderColor: AppColorsDark.primary,
      hoveredBorderColor: AppColorsDark.primary,
      disabledBorderColor: AppBorderColorDark.light,
    ),
  );

  static IconButtonThemeData get primary => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.primary,
      pressedBgColor: AppColorsDark.primaryDark2,
      hoveredBgColor: AppColorsDark.primaryLight3,
      disabledBgColor: AppColorsDark.primaryLight5,
      borderColor: AppColorsDark.primary,
      pressedBorderColor: AppColorsDark.primaryDark2,
      hoveredBorderColor: AppColorsDark.primaryLight3,
      disabledBorderColor: AppColorsDark.primaryLight5,
    ),
  );

  static IconButtonThemeData get success => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.success,
      pressedBgColor: AppColorsDark.successDark2,
      hoveredBgColor: AppColorsDark.successLight3,
      disabledBgColor: AppColorsDark.successLight5,
      borderColor: AppColorsDark.success,
      pressedBorderColor: AppColorsDark.successDark2,
      hoveredBorderColor: AppColorsDark.successLight3,
      disabledBorderColor: AppColorsDark.successLight5,
    ),
  );

  static IconButtonThemeData get warning => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.warning,
      pressedBgColor: AppColorsDark.warningDark2,
      hoveredBgColor: AppColorsDark.warningLight3,
      disabledBgColor: AppColorsDark.warningLight5,
      borderColor: AppColorsDark.warning,
      pressedBorderColor: AppColorsDark.warningDark2,
      hoveredBorderColor: AppColorsDark.warningLight3,
      disabledBorderColor: AppColorsDark.warningLight5,
    ),
  );

  static IconButtonThemeData get error => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.error,
      pressedBgColor: AppColorsDark.errorDark2,
      hoveredBgColor: AppColorsDark.errorLight3,
      disabledBgColor: AppColorsDark.errorLight5,
      borderColor: AppColorsDark.error,
      pressedBorderColor: AppColorsDark.errorDark2,
      hoveredBorderColor: AppColorsDark.errorLight3,
      disabledBorderColor: AppColorsDark.errorLight5,
    ),
  );

  static IconButtonThemeData get danger => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.danger,
      pressedBgColor: AppColorsDark.dangerDark2,
      hoveredBgColor: AppColorsDark.dangerLight3,
      disabledBgColor: AppColorsDark.dangerLight5,
      borderColor: AppColorsDark.danger,
      pressedBorderColor: AppColorsDark.dangerDark2,
      hoveredBorderColor: AppColorsDark.dangerLight3,
      disabledBorderColor: AppColorsDark.dangerLight5,
    ),
  );

  static IconButtonThemeData get info => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.info,
      pressedBgColor: AppColorsDark.infoDark2,
      hoveredBgColor: AppColorsDark.infoLight3,
      disabledBgColor: AppColorsDark.infoLight5,
      borderColor: AppColorsDark.info,
      pressedBorderColor: AppColorsDark.infoDark2,
      hoveredBorderColor: AppColorsDark.infoLight3,
      disabledBorderColor: AppColorsDark.infoLight5,
    ),
  );

  static IconButtonThemeData get flutter => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.flutter,
      pressedBgColor: AppColorsDark.flutterDark2,
      hoveredBgColor: AppColorsDark.flutterLight3,
      disabledBgColor: AppColorsDark.flutterLight5,
      borderColor: AppColorsDark.flutter,
      pressedBorderColor: AppColorsDark.flutterDark2,
      hoveredBorderColor: AppColorsDark.flutterLight3,
      disabledBorderColor: AppColorsDark.flutterLight5,
    ),
  );

  static IconButtonThemeData get teal => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.teal,
      pressedBgColor: AppColorsDark.tealDark2,
      hoveredBgColor: AppColorsDark.tealLight3,
      disabledBgColor: AppColorsDark.tealLight5,
      borderColor: AppColorsDark.teal,
      pressedBorderColor: AppColorsDark.tealDark2,
      hoveredBorderColor: AppColorsDark.tealLight3,
      disabledBorderColor: AppColorsDark.tealLight5,
    ),
  );

  static IconButtonThemeData get cyan => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.cyan,
      pressedBgColor: AppColorsDark.cyanDark2,
      hoveredBgColor: AppColorsDark.cyanLight3,
      disabledBgColor: AppColorsDark.cyanLight5,
      borderColor: AppColorsDark.cyan,
      pressedBorderColor: AppColorsDark.cyanDark2,
      hoveredBorderColor: AppColorsDark.cyanLight3,
      disabledBorderColor: AppColorsDark.cyanLight5,
    ),
  );

  static IconButtonThemeData get pink => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.pink,
      pressedBgColor: AppColorsDark.pinkDark2,
      hoveredBgColor: AppColorsDark.pinkLight3,
      disabledBgColor: AppColorsDark.pinkLight5,
      borderColor: AppColorsDark.pink,
      pressedBorderColor: AppColorsDark.pinkDark2,
      hoveredBorderColor: AppColorsDark.pinkLight3,
      disabledBorderColor: AppColorsDark.pinkLight5,
    ),
  );

  static IconButtonThemeData get indigo => IconButtonThemeData(
    style: createIconButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.indigo,
      pressedBgColor: AppColorsDark.indigoDark2,
      hoveredBgColor: AppColorsDark.indigoLight3,
      disabledBgColor: AppColorsDark.indigoLight5,
      borderColor: AppColorsDark.indigo,
      pressedBorderColor: AppColorsDark.indigoDark2,
      hoveredBorderColor: AppColorsDark.indigoLight3,
      disabledBorderColor: AppColorsDark.indigoLight5,
    ),
  );
}

class AppTextThemes {
  static final ScreenService _screenService = locator<ScreenService>();

  static TextTheme getBaseTextTheme(Color textColor) {
    return TextTheme(
      headlineLarge: TextStyle(
        fontSize: _screenService.scale(
          20.0,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      headlineMedium: TextStyle(
        fontSize: _screenService.scale(
          18.0,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      headlineSmall: TextStyle(
        fontSize: _screenService.scale(
          16.0,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontSize: _screenService.scale(
          16.0,
        ),
        color: textColor,
      ),
      bodyMedium: TextStyle(
        fontSize: _screenService.scale(
          14.0,
        ),
        color: textColor,
      ),
      bodySmall: TextStyle(
        fontSize: _screenService.scale(
          12.0,
        ),
        color: textColor,
      ),
    );
  }

  static TextTheme get light => getBaseTextTheme(AppTextColorLight.regular);

  static TextTheme get dark => getBaseTextTheme(AppTextColorDark.regular);
}

/// Buttons in the current accent. Use these for primary actions outside
/// domain views, overlays and alarm screens; the legacy `primary` button
/// themes stay blue for the screens the redesign has not reached yet.
class AppAccentButtons {
  AppAccentButtons._();

  /// A filled primary button: white on the accent fill. Hover keeps the fill
  /// (touch panels have no hover).
  static FilledButtonThemeData filled(ThemeData theme) {
    final p = theme.accent;
    final family = p.family(theme.brightness);

    return FilledButtonThemeData(
      style: createButtonTheme(
        color: p.onFill,
        pressedColor: p.onFill,
        hoveredColor: p.onFill,
        disabledColor: p.onFill,
        bgColor: p.fill,
        pressedBgColor: p.pressed,
        hoveredBgColor: p.fill,
        disabledBgColor: family.light5,
        borderColor: p.fill,
        pressedBorderColor: p.pressed,
        hoveredBorderColor: p.fill,
        disabledBorderColor: family.light5,
      ),
    );
  }

  /// A tinted secondary button: accent text on the soft background, white on
  /// the pressed shade while pressed.
  static OutlinedButtonThemeData outlined(ThemeData theme) {
    final p = theme.accent;
    final family = p.family(theme.brightness);

    return OutlinedButtonThemeData(
      style: createButtonTheme(
        color: p.text,
        pressedColor: p.onFill,
        hoveredColor: p.text,
        disabledColor: family.light5,
        bgColor: p.soft,
        pressedBgColor: p.pressed,
        hoveredBgColor: p.soft,
        disabledBgColor: p.soft,
        borderColor: family.light5,
        pressedBorderColor: p.pressed,
        hoveredBorderColor: family.light5,
        disabledBorderColor: family.light8,
      ),
    );
  }

  /// Text and icon colour inside [filled].
  static Color filledForeground(ThemeData theme) => theme.accent.onFill;

  /// Text and icon colour inside [outlined].
  static Color outlinedForeground(ThemeData theme) => theme.accent.text;
}

ButtonStyle createButtonTheme({
  required Color color,
  required Color pressedColor,
  required Color hoveredColor,
  required Color disabledColor,
  required Color bgColor,
  required Color pressedBgColor,
  required Color hoveredBgColor,
  required Color disabledBgColor,
  required Color borderColor,
  required Color pressedBorderColor,
  required Color hoveredBorderColor,
  required Color disabledBorderColor,
}) {
  final ScreenService screenService = locator<ScreenService>();
  final VisualDensityService visualDensityService =
      locator<VisualDensityService>();

  const verticalPaddingBase = 8.0;
  const fontSizeBase = 14.0;

  return ButtonStyle(
    foregroundColor: WidgetStateProperty.resolveWith<Color>((states) {
      if (states.contains(WidgetState.pressed)) {
        return pressedColor;
      } else if (states.contains(WidgetState.hovered)) {
        return hoveredColor;
      } else if (states.contains(WidgetState.disabled)) {
        return disabledColor;
      }
      return color; // Default text color
    }),
    backgroundColor: WidgetStateProperty.resolveWith<Color>((states) {
      if (states.contains(WidgetState.pressed)) {
        return pressedBgColor;
      } else if (states.contains(WidgetState.hovered)) {
        return hoveredBgColor;
      } else if (states.contains(WidgetState.disabled)) {
        return disabledBgColor;
      }
      return bgColor;
    }),
    side: WidgetStateProperty.resolveWith<BorderSide>((states) {
      if (states.contains(WidgetState.pressed)) {
        return BorderSide(
          color: pressedBorderColor,
          width: screenService.scale(1),
        );
      } else if (states.contains(WidgetState.hovered)) {
        return BorderSide(
          color: hoveredBorderColor,
          width: screenService.scale(1),
        );
      } else if (states.contains(WidgetState.disabled)) {
        return BorderSide(
          color: disabledBorderColor,
          width: screenService.scale(1),
        );
      }
      return BorderSide(
        color: borderColor,
        width: screenService.scale(1),
      );
    }),
    padding: WidgetStateProperty.all(
      EdgeInsets.symmetric(
        horizontal: screenService.scale(
          49,
        ),
        vertical: screenService.scale(verticalPaddingBase),
      ),
    ),
    minimumSize: WidgetStateProperty.all(
      Size(0, verticalPaddingBase * 2 + fontSizeBase),
    ),
    textStyle: WidgetStateProperty.all(
      TextStyle(
        fontSize: screenService.scale(
          fontSizeBase,
        ),
        fontWeight: FontWeight.w500,
      ),
    ),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
    ),
    visualDensity: visualDensityService.visualDensity,
  );
}

ButtonStyle createIconButtonTheme({
  required Color color,
  required Color pressedColor,
  required Color hoveredColor,
  required Color disabledColor,
  required Color bgColor,
  required Color pressedBgColor,
  required Color hoveredBgColor,
  required Color disabledBgColor,
  required Color borderColor,
  required Color pressedBorderColor,
  required Color hoveredBorderColor,
  required Color disabledBorderColor,
}) {
  final ScreenService screenService = locator<ScreenService>();

  final baseStyle = createButtonTheme(
    color: color,
    pressedColor: pressedColor,
    hoveredColor: hoveredColor,
    disabledColor: disabledColor,
    bgColor: bgColor,
    pressedBgColor: pressedBgColor,
    hoveredBgColor: hoveredBgColor,
    disabledBgColor: disabledBgColor,
    borderColor: borderColor,
    pressedBorderColor: pressedBorderColor,
    hoveredBorderColor: hoveredBorderColor,
    disabledBorderColor: disabledBorderColor,
  );

  const iconPaddingBase = 8.0;
  const iconSizeBase = 18.0;

  return baseStyle.copyWith(
    padding: WidgetStateProperty.all(
      EdgeInsets.symmetric(
        horizontal: screenService.scale(
          iconPaddingBase,
        ),
        vertical: screenService.scale(iconPaddingBase),
      ),
    ),
    shape: WidgetStateProperty.all(const CircleBorder()),
    minimumSize: WidgetStateProperty.all(
      Size(0, iconPaddingBase * 2 + iconSizeBase),
    ),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );
}
