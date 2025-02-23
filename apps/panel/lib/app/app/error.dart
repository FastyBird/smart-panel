import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:material_symbols_icons/symbols.dart';

class AppError extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  AppError({super.key});

  @override
  Widget build(BuildContext context) {
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
                  Symbols.error,
                  color: Theme.of(context).danger,
                  size: _screenService.scale(64),
                ),
                AppSpacings.spacingMdVertical,
                const Text(
                  'Failed to start application!',
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingSmVertical,
                const Text(
                  'Application could not be initialized.',
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingLgVertical,
                Text(
                  'Please try to restart device.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
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
