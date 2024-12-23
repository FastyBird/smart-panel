import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class AppError extends StatelessWidget {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  AppError({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _configurationRepository.displayConfiguration.hasDarkMode
          ? ThemeMode.dark
          : ThemeMode.light,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: LanguageType.values.map(
        (item) => Locale(item.value.split('_')[0], item.value.split('_')[1]),
      ),
      locale: Locale(
        _configurationRepository.languageConfiguration.language.value
            .split('_')[0],
        _configurationRepository.languageConfiguration.language.value
            .split('_')[1],
      ),
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error,
                  color: Theme.of(context).danger,
                  size: _scaler.scale(64),
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
                const Text(
                  'Please try to restart device.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
