import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class AppError extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final Function() _onRestart;
  final String? _errorMessage;

  AppError({
    required Function() onRestart,
    String? errorMessage,
    super.key,
  })  : _onRestart = onRestart,
        _errorMessage = errorMessage;

  @override
  Widget build(BuildContext context) {
    final errorMsg = _errorMessage ?? '';
    final hasPermitJoinError = errorMsg.toLowerCase().contains('permit join');

    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: Language.values.map(
        (item) => Locale(item.value.split('_')[0], item.value.split('_')[1]),
      ),
      locale: Locale('en', 'US'),
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  MdiIcons.alertCircle,
                  color: Theme.of(context).danger,
                  size: _screenService.scale(64),
                ),
                AppSpacings.spacingMdVertical,
                const Text(
                  'Failed to start application!',
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingSmVertical,
                Text(
                  _errorMessage ?? 'Application could not be initialized.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                  ),
                ),
                if (hasPermitJoinError) ...[
                  AppSpacings.spacingMdVertical,
                  Container(
                    padding: AppSpacings.paddingMd,
                    decoration: BoxDecoration(
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppFillColorLight.light
                          : AppFillColorDark.light,
                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          MdiIcons.information,
                          size: _screenService.scale(20),
                          color: Theme.of(context).primaryColor,
                        ),
                        AppSpacings.spacingSmHorizontal,
                        Expanded(
                          child: Text(
                            'Please ask the administrator to activate "Permit Join" in the admin panel, then restart the application.',
                            style: TextStyle(
                              fontSize: AppFontSize.small,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                AppSpacings.spacingLgVertical,
                Text(
                  hasPermitJoinError
                      ? 'Please try to restart the application after the administrator has enabled permit join.'
                      : 'Please try to restart device.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                  ),
                ),
                AppSpacings.spacingLgVertical,
                Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.primary
                            : AppOutlinedButtonsDarkThemes.primary,
                  ),
                  child: OutlinedButton(
                    onPressed: () {
                      _onRestart();
                    },
                    child: Text('Restart application'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
