import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:flutter/material.dart';

extension AppExtendedColors on ThemeData {
  Color get primary => brightness == Brightness.light
      ? AppColorsLight.primary
      : AppColorsDark.primary;

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
}

class AppTheme {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static ThemeData get startThemeLight {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.light,
      primaryColor: AppColorsLight.primary,
      primaryColorLight: AppColorsLight.primary,
      primaryColorDark: AppColorsDark.primary,
      scaffoldBackgroundColor: AppBgColorLight.base,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColorsLight.primary,
        linearTrackColor: AppColors.white,
      ),
      colorScheme: const ColorScheme.light(
        primary: AppColorsLight.primary,
        error: AppColorsLight.error,
      ),
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
      scaffoldBackgroundColor: AppBgColorDark.base,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColorsDark.primary,
        linearTrackColor: AppColors.white,
      ),
      colorScheme: const ColorScheme.dark(
        primary: AppColorsDark.primary,
        error: AppColorsDark.error,
      ),
      visualDensity: _visualDensityService.visualDensity,
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.light,
      primaryColor: AppColorsLight.primary,
      primaryColorLight: AppColorsLight.primary,
      primaryColorDark: AppColorsDark.primary,
      scaffoldBackgroundColor: AppBgColorLight.base,
      textTheme: AppTextThemes.light,
      outlinedButtonTheme: AppOutlinedButtonsLightThemes.base,
      filledButtonTheme: AppFilledButtonsLightThemes.base,
      colorScheme: const ColorScheme.light(
        primary: AppColorsLight.primary,
        error: AppColorsLight.error,
      ),
      visualDensity: _visualDensityService.visualDensity,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColorsLight.primary,
        linearTrackColor: AppColors.white,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: AppColorsLight.primary,
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
            color: AppBorderColorLight.base,
            width: _screenService.scale(
              1,
              density: _visualDensityService.density,
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

  static ThemeData get darkTheme {
    return ThemeData(
      fontFamily: 'Roboto',
      brightness: Brightness.dark,
      primaryColor: AppColorsLight.primary,
      primaryColorLight: AppColorsLight.primary,
      primaryColorDark: AppColorsDark.primary,
      scaffoldBackgroundColor: AppBgColorDark.base,
      textTheme: AppTextThemes.dark,
      outlinedButtonTheme: AppOutlinedButtonsDarkThemes.base,
      filledButtonTheme: AppFilledButtonsDarkThemes.base,
      colorScheme: const ColorScheme.dark(
        primary: AppColorsDark.primary,
        error: AppColorsDark.error,
      ),
      visualDensity: _visualDensityService.visualDensity,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColorsDark.primary,
        linearTrackColor: AppColors.white,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: AppColorsDark.primary,
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
            color: AppBorderColorDark.base,
            width: _screenService.scale(
              1,
              density: _visualDensityService.density,
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

class AppColorsLight {
  static const Color primary = Color(0xFFd9230f);
  static const Color primaryLight3 = Color(0xFFE46557);
  static const Color primaryLight5 = Color(0xFFec9187);
  static const Color primaryLight7 = Color(0xFFF3BDB7);
  static const Color primaryLight8 = Color(0xFFF7D3CF);
  static const Color primaryLight9 = Color(0xFFFBE9E7);
  static const Color primaryDark2 = Color(0xFFAD1C0C);

  static const Color success = Color(0xFF469408);
  static const Color successLight3 = Color(0xFF7DB452);
  static const Color successLight5 = Color(0xFFA2C983);
  static const Color successLight7 = Color(0xFFC7DEB4);
  static const Color successLight8 = Color(0xFFDAE9CD);
  static const Color successLight9 = Color(0xFFECF4E6);
  static const Color successDark2 = Color(0xFF387606);

  static const Color warning = Color(0xFFd9831f);
  static const Color warningLight3 = Color(0xFFE4A862);
  static const Color warningLight5 = Color(0xFFecc18f);
  static const Color warningLight7 = Color(0xFFF3D9BB);
  static const Color warningLight8 = Color(0xFFF7E6D2);
  static const Color warningLight9 = Color(0xFFFBF2E8);
  static const Color warningDark2 = Color(0xFFAD6818);

  static const Color danger = Color(0xFFdb2828);
  static const Color dangerLight3 = Color(0xFFE56868);
  static const Color dangerLight5 = Color(0xFFED9393);
  static const Color dangerLight7 = Color(0xFFF4BEBE);
  static const Color dangerLight8 = Color(0xFFF7D4D4);
  static const Color dangerLight9 = Color(0xFFFBE9E9);
  static const Color dangerDark2 = Color(0xFFAF2020);

  static const Color error = Color(0xFFdb2828);
  static const Color errorLight3 = Color(0xFFE56868);
  static const Color errorLight5 = Color(0xFFED9393);
  static const Color errorLight7 = Color(0xFFF4BEBE);
  static const Color errorLight8 = Color(0xFFF7D4D4);
  static const Color errorLight9 = Color(0xFFFBE9E9);
  static const Color errorDark2 = Color(0xFFAF2020);

  static const Color info = Color(0xFF029acf);
  static const Color infoLight3 = Color(0xFF4DB8DD);
  static const Color infoLight5 = Color(0xFF80CCE7);
  static const Color infoLight7 = Color(0xFFB3E0F0);
  static const Color infoLight8 = Color(0xFFCCEAF5);
  static const Color infoLight9 = Color(0xFFE5F4FA);
  static const Color infoDark2 = Color(0xFF017BA5);

  static const Color neutral = Color(0xFF909399);
  static const Color neutralLight3 = Color(0xFFB1B3B7);
  static const Color neutralLight5 = Color(0xFFC7C9CC);
  static const Color neutralLight7 = Color(0xFFDDDEE0);
  static const Color neutralLight8 = Color(0xFFE8E9EB);
  static const Color neutralLight9 = Color(0xFFF3F4F5);
  static const Color neutralDark2 = Color(0xFF73767A);

  static const Color flutter = Color(0xFF6200EE);
  static const Color flutterLight3 = Color(0xFF9F8FF5);
  static const Color flutterLight5 = Color(0xFFC6CCFA);
  static const Color flutterLight7 = Color(0xFFEDF1FE);
  static const Color flutterLight8 = Color(0xFFF7F9FE);
  static const Color flutterLight9 = Color(0xFFFBFDFF);
  static const Color flutterDark2 = Color(0xFF4F00BD);

  static const Color teal = Color(0xFF26A69A);
  static const Color tealLight3 = Color(0xFF67C1B8);
  static const Color tealLight5 = Color(0xFF92D2CC);
  static const Color tealLight7 = Color(0xFFBEE4E1);
  static const Color tealLight8 = Color(0xFFD3EDEA);
  static const Color tealLight9 = Color(0xFFE9F6F5);
  static const Color tealDark2 = Color(0xFF1E857B);

  static const Color cyan = Color(0xFF00BCD4);
  static const Color cyanLight3 = Color(0xFF4DD0E1);
  static const Color cyanLight5 = Color(0xFF80DEEA);
  static const Color cyanLight7 = Color(0xFFB2EBF2);
  static const Color cyanLight8 = Color(0xFFCCF2F6);
  static const Color cyanLight9 = Color(0xFFE5F8FA);
  static const Color cyanDark2 = Color(0xFF0097A7);

  static const Color pink = Color(0xFFE91E63);
  static const Color pinkLight3 = Color(0xFFEF5B8A);
  static const Color pinkLight5 = Color(0xFFF48EB1);
  static const Color pinkLight7 = Color(0xFFF9C1D7);
  static const Color pinkLight8 = Color(0xFFFBD7E5);
  static const Color pinkLight9 = Color(0xFFFDECF3);
  static const Color pinkDark2 = Color(0xFFBA184F);

  static const Color indigo = Color(0xFF3F51B5);
  static const Color indigoLight3 = Color(0xFF7986CB);
  static const Color indigoLight5 = Color(0xFF9FA8DA);
  static const Color indigoLight7 = Color(0xFFC5CAE9);
  static const Color indigoLight8 = Color(0xFFD9DCF0);
  static const Color indigoLight9 = Color(0xFFECEFF7);
  static const Color indigoDark2 = Color(0xFF324191);
}

class AppBgColorLight {
  static const Color base = Color(0xFFffffff);
  static const Color page = Color(0xFFf2f3f5);
  static const Color overlay = Color(0xFFffffff);

  /// Semi-transparent page overlay (50% opacity)
  static const Color pageOverlay50 = Color.fromRGBO(242, 243, 245, 0.5);

  /// Semi-transparent page overlay (70% opacity)
  static const Color pageOverlay70 = Color.fromRGBO(242, 243, 245, 0.7);
}

class AppTextColorLight {
  static const Color primary = Color(0xFF303133);
  static const Color secondary = Color(0xFF909399);
  static const Color regular = Color(0xFF606266);
  static const Color placeholder = Color(0xFFa8abb2);
  static const Color disabled = Color(0xFFc0c4cc);
}

class AppBorderColorLight {
  static const Color extraLight = Color(0xFFf2f6fc);
  static const Color lighter = Color(0xFFebeef5);
  static const Color light = Color(0xFFe4e7ed);
  static const Color base = Color(0xFFdcdfe6);
  static const Color dark = Color(0xFFd4d7de);
  static const Color darker = Color(0xFFcdd0d6);
}

class AppFillColorLight {
  static const Color darker = Color(0xFFe6e8eb);
  static const Color dark = Color(0xFFebedf0);
  static const Color base = Color(0xFFf0f2f5);
  static const Color light = Color(0xFFf5f7fa);
  static const Color lighter = Color(0xFFfafafa);
  static const Color extraLight = Color(0xFFfafcff);
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
  static const Color primary = Color(0xFFa91b0c);
  static const Color primaryLight3 = Color(0xFF7C190E);
  static const Color primaryLight5 = Color(0xFF5E170F);
  static const Color primaryLight7 = Color(0xFF411611);
  static const Color primaryLight8 = Color(0xFF321513);
  static const Color primaryLight9 = Color(0xFF231417);
  static const Color primaryDark2 = Color(0xFFBA483C);

  static const Color success = Color(0xFF67c23a);
  static const Color successLight3 = Color(0xFF4E8D2E);
  static const Color successLight5 = Color(0xFF3D6B27);
  static const Color successLight7 = Color(0xFF2C481F);
  static const Color successLight8 = Color(0xFF24361B);
  static const Color successLight9 = Color(0xFF1C2517);
  static const Color successDark2 = Color(0xFF85CE61);

  static const Color warning = Color(0xFFe6a23c);
  static const Color warningLight3 = Color(0xFFA77730);
  static const Color warningLight5 = Color(0xFF7D5B28);
  static const Color warningLight7 = Color(0xFF533E20);
  static const Color warningLight8 = Color(0xFF3E301C);
  static const Color warningLight9 = Color(0xFF291C18);
  static const Color warningDark2 = Color(0xFFEBB463);

  static const Color danger = Color(0xFFf56c6c);
  static const Color dangerLight3 = Color(0xFFB15151);
  static const Color dangerLight5 = Color(0xFF843F3F);
  static const Color dangerLight7 = Color(0xFF572E2E);
  static const Color dangerLight8 = Color(0xFF412525);
  static const Color dangerLight9 = Color(0xFF2A1C1C);
  static const Color dangerDark2 = Color(0xFFF78989);

  static const Color error = Color(0xFFf56c6c);
  static const Color errorLight3 = Color(0xFFB15151);
  static const Color errorLight5 = Color(0xFF843F3F);
  static const Color errorLight7 = Color(0xFF572E2E);
  static const Color errorLight8 = Color(0xFF412525);
  static const Color errorLight9 = Color(0xFF2A1C1C);
  static const Color errorDark2 = Color(0xFFF78989);

  static const Color info = Color(0xFF409EFF);
  static const Color infoLight3 = Color(0xFF337ECC);
  static const Color infoLight5 = Color(0xFF265F99);
  static const Color infoLight7 = Color(0xFF1A3F66);
  static const Color infoLight8 = Color(0xFF132F4D);
  static const Color infoLight9 = Color(0xFF0D2033);
  static const Color infoDark2 = Color(0xFF66B1FF);

  static const Color neutral = Color(0xFF909399);
  static const Color neutralLight3 = Color(0xFF6A6C71);
  static const Color neutralLight5 = Color(0xFF525355);
  static const Color neutralLight7 = Color(0xFF393B3C);
  static const Color neutralLight8 = Color(0xFF2C2D2F);
  static const Color neutralLight9 = Color(0xFF202121);
  static const Color neutralDark2 = Color(0xFFA6A8AD);

  static const Color flutter = Color(0xFF4F00BD);
  static const Color flutterLight3 = Color(0xFF3E0098);
  static const Color flutterLight5 = Color(0xFF31007A);
  static const Color flutterLight7 = Color(0xFF24005C);
  static const Color flutterLight8 = Color(0xFF1B0047);
  static const Color flutterLight9 = Color(0xFF120032);
  static const Color flutterDark2 = Color(0xFF6A33CF);

  static const Color teal = Color(0xFF4DB6AC);
  static const Color tealLight3 = Color(0xFF3D8B83);
  static const Color tealLight5 = Color(0xFF2E6963);
  static const Color tealLight7 = Color(0xFF1F4743);
  static const Color tealLight8 = Color(0xFF173533);
  static const Color tealLight9 = Color(0xFF0F2423);
  static const Color tealDark2 = Color(0xFF70C4BC);

  static const Color cyan = Color(0xFF26C6DA);
  static const Color cyanLight3 = Color(0xFF1E9AA9);
  static const Color cyanLight5 = Color(0xFF17757F);
  static const Color cyanLight7 = Color(0xFF0F4F55);
  static const Color cyanLight8 = Color(0xFF0B3B40);
  static const Color cyanLight9 = Color(0xFF07282B);
  static const Color cyanDark2 = Color(0xFF4DD0E1);

  static const Color pink = Color(0xFFF06292);
  static const Color pinkLight3 = Color(0xFFB34A6E);
  static const Color pinkLight5 = Color(0xFF863852);
  static const Color pinkLight7 = Color(0xFF592637);
  static const Color pinkLight8 = Color(0xFF421C29);
  static const Color pinkLight9 = Color(0xFF2C131B);
  static const Color pinkDark2 = Color(0xFFF48AAF);

  static const Color indigo = Color(0xFF5C6BC0);
  static const Color indigoLight3 = Color(0xFF465293);
  static const Color indigoLight5 = Color(0xFF353E6E);
  static const Color indigoLight7 = Color(0xFF242A49);
  static const Color indigoLight8 = Color(0xFF1A1F37);
  static const Color indigoLight9 = Color(0xFF111525);
  static const Color indigoDark2 = Color(0xFF7E8BD0);
}

class AppBgColorDark {
  static const Color page = Color(0xFF0a0a0a);
  static const Color base = Color(0xFF141414);
  static const Color overlay = Color(0xFF1d1e1f);

  /// Semi-transparent overlay (50% opacity)
  static const Color overlayOverlay50 = Color.fromRGBO(29, 30, 31, 0.5);

  /// Semi-transparent overlay (70% opacity)
  static const Color overlayOverlay70 = Color.fromRGBO(29, 30, 31, 0.7);
}

class AppTextColorDark {
  static const Color primary = Color(0xFFE5EAF3);
  static const Color secondary = Color(0xFFA3A6AD);
  static const Color regular = Color(0xFFCFD3DC);
  static const Color placeholder = Color(0xFF8D9095);
  static const Color disabled = Color(0xFF6C6E72);
}

class AppBorderColorDark {
  static const Color extraLight = Color(0xFF2B2B2C);
  static const Color lighter = Color(0xFF363637);
  static const Color light = Color(0xFF414243);
  static const Color base = Color(0xFF4C4D4F);
  static const Color dark = Color(0xFF636466);
  static const Color darker = Color(0xFF636466);
}

class AppFillColorDark {
  static const Color extraLight = Color(0xFF191919);
  static const Color lighter = Color(0xFF1D1D1D);
  static const Color light = Color(0xFF262727);
  static const Color base = Color(0xFF303030);
  static const Color dark = Color(0xFF39393A);
  static const Color darker = Color(0xFF424243);
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
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static double get medium =>
      _screenService.scale(12.0, density: _visualDensityService.density);

  static double get base =>
      _screenService.scale(6.0, density: _visualDensityService.density);

  static double get small =>
      _screenService.scale(2.0, density: _visualDensityService.density);

  static double get round =>
      _screenService.scale(20.0, density: _visualDensityService.density);
}

class AppFontSize {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static double get extraLarge =>
      _screenService.scale(18.0, density: _visualDensityService.density);

  static double get large =>
      _screenService.scale(16.0, density: _visualDensityService.density);

  static double get base =>
      _screenService.scale(14.0, density: _visualDensityService.density);

  static double get small =>
      _screenService.scale(12.0, density: _visualDensityService.density);

  static double get extraSmall =>
      _screenService.scale(10.0, density: _visualDensityService.density);

  static double get extraExtraSmall =>
      _screenService.scale(8.0, density: _visualDensityService.density);
}

// Centralized spacing
class AppSpacings {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static double get pXs =>
      _screenService.scale(2.0, density: _visualDensityService.density);

  static double get pSm =>
      _screenService.scale(4.0, density: _visualDensityService.density);

  static double get pMd =>
      _screenService.scale(8.0, density: _visualDensityService.density);

  static double get pLg =>
      _screenService.scale(16.0, density: _visualDensityService.density);

  static double get pXl =>
      _screenService.scale(32.0, density: _visualDensityService.density);

  static EdgeInsets get paddingXs => EdgeInsets.all(pXs);

  static EdgeInsets get paddingSm => EdgeInsets.all(pSm);

  static EdgeInsets get paddingMd => EdgeInsets.all(pMd);

  static EdgeInsets get paddingLg => EdgeInsets.all(pLg);

  static EdgeInsets get paddingXl => EdgeInsets.all(pXl);

  static SizedBox get spacingXsVertical => SizedBox(height: pXs);

  static SizedBox get spacingSmVertical => SizedBox(height: pSm);

  static SizedBox get spacingMdVertical => SizedBox(height: pMd);

  static SizedBox get spacingLgVertical => SizedBox(height: pLg);

  static SizedBox get spacingXlVertical => SizedBox(height: pXl);

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
      hoveredBgColor: AppColorsLight.primaryLight3,
      disabledBgColor: AppColorsLight.primaryLight5,
      borderColor: AppColorsLight.primary,
      pressedBorderColor: AppColorsLight.primaryDark2,
      hoveredBorderColor: AppColorsLight.primaryLight3,
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
      hoveredBgColor: AppColorsLight.successLight3,
      disabledBgColor: AppColorsLight.successLight5,
      borderColor: AppColorsLight.success,
      pressedBorderColor: AppColorsLight.successDark2,
      hoveredBorderColor: AppColorsLight.successLight3,
      disabledBorderColor: AppColorsLight.successLight5,
    ),
  );

  static FilledButtonThemeData get warning => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get danger => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get error => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get info => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get neutral => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: AppColors.white,
      bgColor: AppColorsLight.neutral,
      pressedBgColor: AppColorsLight.neutralDark2,
      hoveredBgColor: AppColorsLight.neutralLight3,
      disabledBgColor: AppColorsLight.neutralLight5,
      borderColor: AppColorsLight.neutral,
      pressedBorderColor: AppColorsLight.neutralDark2,
      hoveredBorderColor: AppColorsLight.neutralLight3,
      disabledBorderColor: AppColorsLight.neutralLight5,
    ),
  );
}

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
      pressedBgColor: AppColorsDark.primaryDark2,
      hoveredBgColor: AppColorsDark.primaryLight3,
      disabledBgColor: AppColorsDark.primaryLight5,
      borderColor: AppColorsDark.primary,
      pressedBorderColor: AppColorsDark.primaryDark2,
      hoveredBorderColor: AppColorsDark.primaryLight3,
      disabledBorderColor: AppColorsDark.primaryLight5,
    ),
  );

  static FilledButtonThemeData get success => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get warning => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get error => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get danger => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get info => FilledButtonThemeData(
    style: createButtonTheme(
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

  static FilledButtonThemeData get neutral => FilledButtonThemeData(
    style: createButtonTheme(
      color: AppColors.white,
      pressedColor: AppColors.white,
      hoveredColor: AppColors.white,
      disabledColor: const Color.fromRGBO(255, 255, 255, 0.5),
      bgColor: AppColorsDark.neutral,
      pressedBgColor: AppColorsDark.neutralDark2,
      hoveredBgColor: AppColorsDark.neutralLight3,
      disabledBgColor: AppColorsDark.neutralLight5,
      borderColor: AppColorsDark.neutral,
      pressedBorderColor: AppColorsDark.neutralDark2,
      hoveredBorderColor: AppColorsDark.neutralLight3,
      disabledBorderColor: AppColorsDark.neutralLight5,
    ),
  );
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
      pressedColor: AppColorsLight.primaryDark2,
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
      pressedBgColor: AppColorsLight.infoDark2,
      hoveredBgColor: AppColorsDark.info,
      disabledBgColor: AppColorsDark.infoLight9,
      borderColor: AppColorsDark.infoLight5,
      pressedBorderColor: AppColorsDark.infoDark2,
      hoveredBorderColor: AppColorsDark.info,
      disabledBorderColor: AppColorsDark.infoLight8,
    ),
  );
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
}

class AppTextThemes {
  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static TextTheme getBaseTextTheme(Color textColor) {
    return TextTheme(
      headlineLarge: TextStyle(
        fontSize: _screenService.scale(
          20.0,
          density: _visualDensityService.density,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      headlineMedium: TextStyle(
        fontSize: _screenService.scale(
          18.0,
          density: _visualDensityService.density,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      headlineSmall: TextStyle(
        fontSize: _screenService.scale(
          16.0,
          density: _visualDensityService.density,
        ),
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontSize: _screenService.scale(
          16.0,
          density: _visualDensityService.density,
        ),
        color: textColor,
      ),
      bodyMedium: TextStyle(
        fontSize: _screenService.scale(
          14.0,
          density: _visualDensityService.density,
        ),
        color: textColor,
      ),
      bodySmall: TextStyle(
        fontSize: _screenService.scale(
          12.0,
          density: _visualDensityService.density,
        ),
        color: textColor,
      ),
    );
  }

  static TextTheme get light => getBaseTextTheme(AppTextColorLight.regular);

  static TextTheme get dark => getBaseTextTheme(AppTextColorDark.regular);
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
          width: screenService.scale(1, density: visualDensityService.density),
        );
      } else if (states.contains(WidgetState.hovered)) {
        return BorderSide(
          color: hoveredBorderColor,
          width: screenService.scale(1, density: visualDensityService.density),
        );
      } else if (states.contains(WidgetState.disabled)) {
        return BorderSide(
          color: disabledBorderColor,
          width: screenService.scale(1, density: visualDensityService.density),
        );
      }
      return BorderSide(
        color: borderColor,
        width: screenService.scale(1, density: visualDensityService.density),
      );
    }),
    padding: WidgetStateProperty.all(
      EdgeInsets.symmetric(
        horizontal: screenService.scale(
          49,
          density: visualDensityService.density,
        ),
        vertical: screenService.scale(8, density: visualDensityService.density),
      ),
    ),
    textStyle: WidgetStateProperty.all(
      TextStyle(
        fontSize: screenService.scale(
          14,
          density: visualDensityService.density,
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
  final VisualDensityService visualDensityService =
      locator<VisualDensityService>();

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

  return baseStyle.copyWith(
    padding: WidgetStateProperty.all(
      EdgeInsets.symmetric(
        horizontal: screenService.scale(
          8,
          density: visualDensityService.density,
        ),
        vertical: screenService.scale(8, density: visualDensityService.density),
      ),
    ),
    shape: WidgetStateProperty.all(const CircleBorder()),
    minimumSize: WidgetStateProperty.all(Size.zero),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );
}
