import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_cs.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('cs'),
    Locale('en')
  ];

  /// Displayed when no value is available for a property
  ///
  /// In en, this message translates to:
  /// **'N/A'**
  String get value_not_available;

  /// Displayed when a value has not been configured or assigned.
  ///
  /// In en, this message translates to:
  /// **'Not Set'**
  String get value_not_set;

  /// Displayed when a value is not available and loading from backend.
  ///
  /// In en, this message translates to:
  /// **'Loading'**
  String get value_loading;

  /// General informational message
  ///
  /// In en, this message translates to:
  /// **'Information'**
  String get information;

  /// A message indicating a potential issue or caution
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get warning;

  /// A message indicating an error occurred
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// Error message when an action fails
  ///
  /// In en, this message translates to:
  /// **'Action could not be processed'**
  String get action_failed;

  /// Text for OK button
  ///
  /// In en, this message translates to:
  /// **'Ok'**
  String get button_ok;

  /// Text for Cancel button
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get button_cancel;

  /// Text for Close button
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get button_close;

  /// Text for Confirm button
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get button_confirm;

  /// Label for Celsius temperature unit.
  ///
  /// In en, this message translates to:
  /// **'Celsius'**
  String get unit_celsius;

  /// Label for Fahrenheit temperature unit.
  ///
  /// In en, this message translates to:
  /// **'Fahrenheit'**
  String get unit_fahrenheit;

  /// Label for 12-hour time format, commonly used in English-speaking countries.
  ///
  /// In en, this message translates to:
  /// **'12-hour'**
  String get time_format_12h;

  /// Label for 24-hour time format, commonly used internationally.
  ///
  /// In en, this message translates to:
  /// **'24-hour'**
  String get time_format_24h;

  /// Full name for Monday in English.
  ///
  /// In en, this message translates to:
  /// **'Monday'**
  String get day_monday;

  /// Full name for Tuesday in English.
  ///
  /// In en, this message translates to:
  /// **'Tuesday'**
  String get day_tuesday;

  /// Full name for Wednesday in English.
  ///
  /// In en, this message translates to:
  /// **'Wednesday'**
  String get day_wednesday;

  /// Full name for Thursday in English.
  ///
  /// In en, this message translates to:
  /// **'Thursday'**
  String get day_thursday;

  /// Full name for Friday in English.
  ///
  /// In en, this message translates to:
  /// **'Friday'**
  String get day_friday;

  /// Full name for Saturday in English.
  ///
  /// In en, this message translates to:
  /// **'Saturday'**
  String get day_saturday;

  /// Full name for Sunday in English.
  ///
  /// In en, this message translates to:
  /// **'Sunday'**
  String get day_sunday;

  /// Short abbreviation for Monday in English.
  ///
  /// In en, this message translates to:
  /// **'Mon'**
  String get day_monday_short;

  /// Short abbreviation for Tuesday in English.
  ///
  /// In en, this message translates to:
  /// **'Tue'**
  String get day_tuesday_short;

  /// Short abbreviation for Wednesday in English.
  ///
  /// In en, this message translates to:
  /// **'Wed'**
  String get day_wednesday_short;

  /// Short abbreviation for Thursday in English.
  ///
  /// In en, this message translates to:
  /// **'Thu'**
  String get day_thursday_short;

  /// Short abbreviation for Friday in English.
  ///
  /// In en, this message translates to:
  /// **'Fri'**
  String get day_friday_short;

  /// Short abbreviation for Saturday in English.
  ///
  /// In en, this message translates to:
  /// **'Sat'**
  String get day_saturday_short;

  /// Short abbreviation for Sunday in English.
  ///
  /// In en, this message translates to:
  /// **'Sun'**
  String get day_sunday_short;

  /// Title for error when no tiles are configured
  ///
  /// In en, this message translates to:
  /// **'No tiles configured!'**
  String get message_error_tiles_not_configured_title;

  /// Indicates that no tiles have been configured for the screen
  ///
  /// In en, this message translates to:
  /// **'Please configure at least one tile on the screen.'**
  String get message_error_tiles_not_configured_description;

  /// Title for error when no cards are configured
  ///
  /// In en, this message translates to:
  /// **'No cards configured!'**
  String get message_error_cards_not_configured_title;

  /// Indicates that no cards have been configured for the screen
  ///
  /// In en, this message translates to:
  /// **'Please configure at least one card on the screen.'**
  String get message_error_cards_not_configured_description;

  /// Title for error when a requested device cannot be found
  ///
  /// In en, this message translates to:
  /// **'Device Not Found!'**
  String get message_error_device_not_found_title;

  /// Indicates that the requested device is unavailable in the system
  ///
  /// In en, this message translates to:
  /// **'Requested device could not be found in the application.'**
  String get message_error_device_not_found_description;

  /// Title for error when no device detail is available
  ///
  /// In en, this message translates to:
  /// **'No device detail!'**
  String get message_error_no_device_detail_title;

  /// Indicates that the selected device has no detailed page available
  ///
  /// In en, this message translates to:
  /// **'For selected device is not available a detail page.'**
  String get message_error_no_device_detail_description;

  /// Title for error when no device detail is available
  ///
  /// In en, this message translates to:
  /// **'Device detail not ready!'**
  String get message_error_no_device_detail_preparing_title;

  /// Indicates that the selected device has no detailed page available
  ///
  /// In en, this message translates to:
  /// **'For selected device detail page is not ready yet.'**
  String get message_error_no_device_detail_preparing_description;

  /// Title for error when a requested page cannot be found
  ///
  /// In en, this message translates to:
  /// **'Page Not Found!'**
  String get message_error_page_not_found_title;

  /// Indicates that the requested page is unavailable in the system
  ///
  /// In en, this message translates to:
  /// **'Requested page could not be found in the application.'**
  String get message_error_page_not_found_description;

  /// Title for total energy consumption
  ///
  /// In en, this message translates to:
  /// **'Energy Consumption'**
  String get electrical_energy_consumption_title;

  /// Detailed description of energy consumption measurement
  ///
  /// In en, this message translates to:
  /// **'Total energy consumed over time'**
  String get electrical_energy_consumption_description;

  /// Title for the current power usage rate
  ///
  /// In en, this message translates to:
  /// **'Current Power Rate'**
  String get electrical_energy_rate_title;

  /// Detailed description of real-time power rate measurement
  ///
  /// In en, this message translates to:
  /// **'Real-time power usage in kilowatts'**
  String get electrical_energy_rate_description;

  /// Title for the current flow measurement
  ///
  /// In en, this message translates to:
  /// **'Current'**
  String get electrical_power_current_title;

  /// Detailed description of current measurement in amperes
  ///
  /// In en, this message translates to:
  /// **'How much electricity is flowing'**
  String get electrical_power_current_description;

  /// Title for voltage measurement
  ///
  /// In en, this message translates to:
  /// **'Voltage'**
  String get electrical_power_voltage_title;

  /// Detailed description of voltage measurement in volts
  ///
  /// In en, this message translates to:
  /// **'The strength of the electricity'**
  String get electrical_power_voltage_description;

  /// Title for power measurement
  ///
  /// In en, this message translates to:
  /// **'Power'**
  String get electrical_power_power_title;

  /// Detailed description of power measurement in watts
  ///
  /// In en, this message translates to:
  /// **'How much energy is being used'**
  String get electrical_power_power_description;

  /// Title for electrical frequency
  ///
  /// In en, this message translates to:
  /// **'Frequency'**
  String get electrical_power_frequency_title;

  /// Detailed description of frequency measurement in hertz
  ///
  /// In en, this message translates to:
  /// **'How steady the electricity is'**
  String get electrical_power_frequency_description;

  /// Title for over current warning
  ///
  /// In en, this message translates to:
  /// **'Over Current'**
  String get electrical_power_over_current_title;

  /// Detailed description of over current warning
  ///
  /// In en, this message translates to:
  /// **'Warning: Too much electricity is flowing'**
  String get electrical_power_over_current_description;

  /// Title for over voltage warning
  ///
  /// In en, this message translates to:
  /// **'Over Voltage'**
  String get electrical_power_over_voltage_title;

  /// Detailed description of over voltage warning
  ///
  /// In en, this message translates to:
  /// **'Warning: Electricity is too strong'**
  String get electrical_power_over_voltage_description;

  /// Title for over power warning
  ///
  /// In en, this message translates to:
  /// **'Over Power'**
  String get electrical_power_over_power_title;

  /// Detailed description of over power warning
  ///
  /// In en, this message translates to:
  /// **'Warning: Power consumption is too high'**
  String get electrical_power_over_power_description;

  /// State when the light is turned off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get light_state_off;

  /// Detailed description of the light being turned off
  ///
  /// In en, this message translates to:
  /// **'Light is turned off'**
  String get light_state_off_description;

  /// Description of the current brightness level
  ///
  /// In en, this message translates to:
  /// **'Current brightness'**
  String get light_state_brightness_description;

  /// Mode when the light is off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get light_mode_off;

  /// Mode for adjusting brightness
  ///
  /// In en, this message translates to:
  /// **'Brightness'**
  String get light_mode_brightness;

  /// Mode for adjusting color
  ///
  /// In en, this message translates to:
  /// **'Color'**
  String get light_mode_color;

  /// Mode for adjusting color temperature
  ///
  /// In en, this message translates to:
  /// **'Temperature'**
  String get light_mode_temperature;

  /// Mode for adjusting white color
  ///
  /// In en, this message translates to:
  /// **'White'**
  String get light_mode_white;

  /// Mode for selecting predefined color swatches
  ///
  /// In en, this message translates to:
  /// **'Swatches'**
  String get light_mode_swatches;

  /// Title displayed for the thermostat state section
  ///
  /// In en, this message translates to:
  /// **'Thermostat state'**
  String get thermostat_state_title;

  /// Displays the user-configured target temperature
  ///
  /// In en, this message translates to:
  /// **'Configured temperature'**
  String get thermostat_state_configured_temperature_description;

  /// Displays the current room temperature
  ///
  /// In en, this message translates to:
  /// **'Current temperature'**
  String get thermostat_state_current_temperature_description;

  /// Displays the current room humidity level
  ///
  /// In en, this message translates to:
  /// **'Current humidity'**
  String get thermostat_state_current_humidity_description;

  /// Indicates whether the child lock is active
  ///
  /// In en, this message translates to:
  /// **'Child lock'**
  String get thermostat_child_lock_title;

  /// Indicates an open window detected near the thermostat
  ///
  /// In en, this message translates to:
  /// **'Window is opened'**
  String get thermostat_openings_state_title;

  /// Displays that the thermostat is disabled due to an open window
  ///
  /// In en, this message translates to:
  /// **'Thermostat is disabled'**
  String get thermostat_openings_state_description;

  /// Indicates the child lock is active
  ///
  /// In en, this message translates to:
  /// **'Locked'**
  String get thermostat_lock_locked;

  /// Indicates the child lock is not active
  ///
  /// In en, this message translates to:
  /// **'Unlocked'**
  String get thermostat_lock_unlocked;

  /// Thermostat is turned off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get thermostat_mode_off;

  /// Thermostat is set to heating mode
  ///
  /// In en, this message translates to:
  /// **'Heat'**
  String get thermostat_mode_heat;

  /// Thermostat is set to cooling mode
  ///
  /// In en, this message translates to:
  /// **'Cool'**
  String get thermostat_mode_cool;

  /// Thermostat automatically adjusts between heating and cooling
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get thermostat_mode_auto;

  /// Thermostat is set to manual adjustment mode
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get thermostat_mode_manual;

  /// Represents the minimum adjustable temperature
  ///
  /// In en, this message translates to:
  /// **'min'**
  String get thermostat_min;

  /// Represents the maximum adjustable temperature
  ///
  /// In en, this message translates to:
  /// **'max'**
  String get thermostat_max;

  /// Indicates the thermostat is turned off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get thermostat_state_off;

  /// Indicates the thermostat is actively heating the space
  ///
  /// In en, this message translates to:
  /// **'Heating'**
  String get thermostat_state_heating;

  /// Indicates the thermostat is actively cooling the space
  ///
  /// In en, this message translates to:
  /// **'Cooling'**
  String get thermostat_state_cooling;

  /// Indicates the thermostat is in idle state
  ///
  /// In en, this message translates to:
  /// **'Idling'**
  String get thermostat_state_idling;

  /// Displays an error when the thermostat configuration is invalid
  ///
  /// In en, this message translates to:
  /// **'This thermostat device is wrongly configured.'**
  String get thermostat_with_invalid_configuration;

  /// Indicates that a device or feature is turned on
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get on_state_on;

  /// Indicates that a device or feature is turned off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get on_state_off;

  /// Title displayed during a device reboot operation.
  ///
  /// In en, this message translates to:
  /// **'Rebooting Device!'**
  String get message_info_app_reboot_title;

  /// Message displayed during a device reboot operation.
  ///
  /// In en, this message translates to:
  /// **'Please wait while the device reboots. This may take a few moments. The system will restart automatically once the process is complete.'**
  String get message_info_app_reboot_description;

  /// Title displayed when the device is powering off.
  ///
  /// In en, this message translates to:
  /// **'Shutting Down!'**
  String get message_info_app_power_off_title;

  /// Message displayed when the device is powering off.
  ///
  /// In en, this message translates to:
  /// **'The device is powering off. To turn it back on, please use the power button. Thank you for using FastyBird! Smart Panel.'**
  String get message_info_app_power_off_description;

  /// Title displayed during a factory reset operation.
  ///
  /// In en, this message translates to:
  /// **'Resetting Device!'**
  String get message_info_factory_reset_title;

  /// Message displayed during a factory reset operation.
  ///
  /// In en, this message translates to:
  /// **'All settings and data will be erased, and the device will be restored to its factory defaults. Please do not turn off the device during the reset process. This may take a few minutes.'**
  String get message_info_factory_reset_description;

  /// Title for the General Settings section.
  ///
  /// In en, this message translates to:
  /// **'General Settings'**
  String get settings_general_settings_title;

  /// Button label for navigating to Display Settings.
  ///
  /// In en, this message translates to:
  /// **'Display settings'**
  String get settings_general_settings_button_display_settings;

  /// Button label for navigating to Language Settings.
  ///
  /// In en, this message translates to:
  /// **'Language settings'**
  String get settings_general_settings_button_language_settings;

  /// Button label for navigating to Audio Settings.
  ///
  /// In en, this message translates to:
  /// **'Audio settings'**
  String get settings_general_settings_button_audio_settings;

  /// Button label for navigating to Weather Settings.
  ///
  /// In en, this message translates to:
  /// **'Weather settings'**
  String get settings_general_settings_button_weather_settings;

  /// Button label for navigating to About Application section.
  ///
  /// In en, this message translates to:
  /// **'About application'**
  String get settings_general_settings_button_about;

  /// Button label for navigating to Maintenance section.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get settings_general_settings_button_maintenance;

  /// Title for the Weather Settings section.
  ///
  /// In en, this message translates to:
  /// **'Weather Settings'**
  String get settings_weather_settings_title;

  /// Label for selecting the temperature unit for weather display.
  ///
  /// In en, this message translates to:
  /// **'Temperature Unit'**
  String get settings_weather_settings_temperature_unit_title;

  /// Description explaining the purpose of the temperature unit setting.
  ///
  /// In en, this message translates to:
  /// **'Set the preferred temperature unit for weather display.'**
  String get settings_weather_settings_temperature_unit_description;

  /// Label for displaying the weather location setting.
  ///
  /// In en, this message translates to:
  /// **'Weather Location'**
  String get settings_weather_settings_temperature_location_title;

  /// Description explaining that the weather location is configured externally.
  ///
  /// In en, this message translates to:
  /// **'Weather location is configured in the administrator app.'**
  String get settings_weather_settings_temperature_location_description;

  /// Title for the Maintenance section.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get settings_maintenance_title;

  /// Label for the restart action in Maintenance settings.
  ///
  /// In en, this message translates to:
  /// **'Restart'**
  String get settings_maintenance_restart_title;

  /// Description for the restart action, explaining its purpose.
  ///
  /// In en, this message translates to:
  /// **'Restart the device to apply changes or resolve issues.'**
  String get settings_maintenance_restart_description;

  /// Title for the confirmation dialog when restarting the device.
  ///
  /// In en, this message translates to:
  /// **'Restart Device'**
  String get settings_maintenance_restart_confirm_title;

  /// Message displayed in the confirmation dialog for restarting the device.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to restart the device? This action will temporarily interrupt functionality.'**
  String get settings_maintenance_restart_confirm_description;

  /// Label for the power off action in Maintenance settings.
  ///
  /// In en, this message translates to:
  /// **'Power Off'**
  String get settings_maintenance_power_off_title;

  /// Description for the power off action, explaining its purpose.
  ///
  /// In en, this message translates to:
  /// **'Power off the device completely.'**
  String get settings_maintenance_power_off_description;

  /// Title for the confirmation dialog when powering off the device.
  ///
  /// In en, this message translates to:
  /// **'Power Off Device'**
  String get settings_maintenance_power_off_confirm_title;

  /// Message displayed in the confirmation dialog for powering off the device.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to power off the device? It will need to be manually turned on again.'**
  String get settings_maintenance_power_off_confirm_description;

  /// Label for the factory reset action in Maintenance settings.
  ///
  /// In en, this message translates to:
  /// **'Factory Reset'**
  String get settings_maintenance_factory_reset_title;

  /// Description for the factory reset action, explaining its purpose.
  ///
  /// In en, this message translates to:
  /// **'Restore the device to its original factory settings.'**
  String get settings_maintenance_factory_reset_description;

  /// Title for the confirmation dialog when performing a factory reset.
  ///
  /// In en, this message translates to:
  /// **'Factory Reset Device'**
  String get settings_maintenance_factory_reset_confirm_title;

  /// Message displayed in the confirmation dialog for performing a factory reset.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to erase all data and restore the device to its factory settings? This action is irreversible.'**
  String get settings_maintenance_factory_reset_confirm_description;

  /// Title for the Language Settings section.
  ///
  /// In en, this message translates to:
  /// **'Language Settings'**
  String get settings_language_settings_title;

  /// Label for selecting the preferred language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settings_language_settings_language_title;

  /// Description explaining the purpose of the language setting.
  ///
  /// In en, this message translates to:
  /// **'Select your preferred language.'**
  String get settings_language_settings_language_description;

  /// Label for selecting the timezone.
  ///
  /// In en, this message translates to:
  /// **'Timezone'**
  String get settings_language_settings_timezone_title;

  /// Description explaining the purpose of the timezone setting.
  ///
  /// In en, this message translates to:
  /// **'Select your timezone.'**
  String get settings_language_settings_timezone_description;

  /// Label for selecting the time format.
  ///
  /// In en, this message translates to:
  /// **'Time Format'**
  String get settings_language_settings_time_format_title;

  /// Description explaining the purpose of the time format setting.
  ///
  /// In en, this message translates to:
  /// **'Select your preferred time format.'**
  String get settings_language_settings_time_format_description;

  /// Title for the Display Settings section.
  ///
  /// In en, this message translates to:
  /// **'Display Settings'**
  String get settings_display_settings_title;

  /// Label for selecting the theme mode.
  ///
  /// In en, this message translates to:
  /// **'Theme Mode'**
  String get settings_display_settings_theme_mode_title;

  /// Description explaining the theme mode setting.
  ///
  /// In en, this message translates to:
  /// **'Choose between light or dark mode.'**
  String get settings_display_settings_theme_mode_description;

  /// Label for adjusting the display brightness.
  ///
  /// In en, this message translates to:
  /// **'Brightness'**
  String get settings_display_settings_brightness_title;

  /// Label for setting the screen lock delay.
  ///
  /// In en, this message translates to:
  /// **'Screen Lock'**
  String get settings_display_settings_screen_lock_title;

  /// Description explaining the screen lock delay setting.
  ///
  /// In en, this message translates to:
  /// **'Set screen lock delay duration.'**
  String get settings_display_settings_screen_lock_description;

  /// Label for enabling or disabling the screen saver.
  ///
  /// In en, this message translates to:
  /// **'Screen Saver'**
  String get settings_display_settings_screen_saver_title;

  /// Description explaining the screen saver setting.
  ///
  /// In en, this message translates to:
  /// **'Enable or disable the screen saver.'**
  String get settings_display_settings_screen_saver_description;

  /// Title for the Audio Settings section.
  ///
  /// In en, this message translates to:
  /// **'Audio Settings'**
  String get settings_audio_settings_title;

  /// Label for enabling or disabling the speaker.
  ///
  /// In en, this message translates to:
  /// **'Speaker'**
  String get settings_audio_settings_speaker_title;

  /// Description explaining the speaker setting.
  ///
  /// In en, this message translates to:
  /// **'Enable or disable the speaker.'**
  String get settings_audio_settings_speaker_description;

  /// Label for adjusting the speaker volume.
  ///
  /// In en, this message translates to:
  /// **'Speaker Volume'**
  String get settings_audio_settings_speaker_volume_title;

  /// Label for enabling or disabling the microphone.
  ///
  /// In en, this message translates to:
  /// **'Microphone'**
  String get settings_audio_settings_microphone_title;

  /// Description explaining the microphone setting.
  ///
  /// In en, this message translates to:
  /// **'Enable or disable the microphone.'**
  String get settings_audio_settings_microphone_description;

  /// Label for adjusting the microphone volume.
  ///
  /// In en, this message translates to:
  /// **'Microphone Volume'**
  String get settings_audio_settings_microphone_volume_title;

  /// Title for the About Application section.
  ///
  /// In en, this message translates to:
  /// **'About Application'**
  String get settings_about_title;

  /// Heading for the about information section.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get settings_about_about_heading;

  /// General information about the FastyBird Smart Panel application.
  ///
  /// In en, this message translates to:
  /// **'FastyBird Smart Panel is a home automation app that enables seamless integration with your smart devices, offering enhanced control and monitoring capabilities.'**
  String get settings_about_about_info;

  /// Heading for the developer information section.
  ///
  /// In en, this message translates to:
  /// **'Developed By'**
  String get settings_about_developed_by_heading;

  /// Heading for the license information section.
  ///
  /// In en, this message translates to:
  /// **'License'**
  String get settings_about_license_heading;

  /// Heading for the device information section.
  ///
  /// In en, this message translates to:
  /// **'Device Information'**
  String get settings_about_device_information_heading;

  /// Button label for viewing license details.
  ///
  /// In en, this message translates to:
  /// **'View License'**
  String get settings_about_show_license_button;

  /// Label for displaying the device's IP address.
  ///
  /// In en, this message translates to:
  /// **'IP Address'**
  String get settings_about_ip_address_title;

  /// Label for displaying the device's MAC address.
  ///
  /// In en, this message translates to:
  /// **'MAC Address'**
  String get settings_about_mac_address_title;

  /// Label for displaying the device's CPU usage.
  ///
  /// In en, this message translates to:
  /// **'CPU Usage'**
  String get settings_about_cpu_usage_title;

  /// Label for displaying the device's memory usage.
  ///
  /// In en, this message translates to:
  /// **'Memory Usage'**
  String get settings_about_memory_usage_title;

  ///
  ///
  /// In en, this message translates to:
  /// **'Weather forecast'**
  String get weather_forecast_title;

  ///
  ///
  /// In en, this message translates to:
  /// **'Feels like:'**
  String get weather_forecast_feels_like;

  ///
  ///
  /// In en, this message translates to:
  /// **'Humidity:'**
  String get weather_forecast_humidity;

  /// A thunderstorm accompanied by light rain.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with light rain'**
  String get weather_condition_thunderstorm_with_light_rain;

  /// A thunderstorm with moderate rainfall.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with rain'**
  String get weather_condition_thunderstorm_with_rain;

  /// A thunderstorm with intense rainfall.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with heavy rain'**
  String get weather_condition_thunderstorm_with_heavy_rain;

  /// A weak thunderstorm with little or no precipitation.
  ///
  /// In en, this message translates to:
  /// **'Light thunderstorm'**
  String get weather_condition_light_thunderstorm;

  /// A storm with thunder, lightning, and rain.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm'**
  String get weather_condition_thunderstorm;

  /// A strong thunderstorm with intense lightning and rain.
  ///
  /// In en, this message translates to:
  /// **'Heavy thunderstorm'**
  String get weather_condition_heavy_thunderstorm;

  /// A thunderstorm with irregular cloud formations.
  ///
  /// In en, this message translates to:
  /// **'Ragged thunderstorm'**
  String get weather_condition_ragged_thunderstorm;

  /// A thunderstorm with very light drizzle.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with light drizzle'**
  String get weather_condition_thunderstorm_with_light_drizzle;

  /// A thunderstorm with light rain showers.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with drizzle'**
  String get weather_condition_thunderstorm_with_drizzle;

  /// A thunderstorm with steady, misty rain.
  ///
  /// In en, this message translates to:
  /// **'Thunderstorm with heavy drizzle'**
  String get weather_condition_thunderstorm_with_heavy_drizzle;

  /// A light and misty drizzle.
  ///
  /// In en, this message translates to:
  /// **'Light intensity drizzle'**
  String get weather_condition_light_intensity_drizzle;

  /// A light rain shower with fine drops.
  ///
  /// In en, this message translates to:
  /// **'Drizzle'**
  String get weather_condition_drizzle;

  /// A heavy drizzle with continuous light rain.
  ///
  /// In en, this message translates to:
  /// **'Heavy intensity drizzle'**
  String get weather_condition_heavy_intensity_drizzle;

  /// Light drizzle transitioning to rain.
  ///
  /// In en, this message translates to:
  /// **'Light intensity drizzle rain'**
  String get weather_condition_light_intensity_drizzle_rain;

  /// Drizzle mixed with light rain.
  ///
  /// In en, this message translates to:
  /// **'Drizzle rain'**
  String get weather_condition_drizzle_rain;

  /// Heavy drizzle transitioning to steady rain.
  ///
  /// In en, this message translates to:
  /// **'Heavy intensity drizzle rain'**
  String get weather_condition_heavy_intensity_drizzle_rain;

  /// Intermittent rain showers mixed with drizzle.
  ///
  /// In en, this message translates to:
  /// **'Shower rain and drizzle'**
  String get weather_condition_shower_rain_and_drizzle;

  /// Heavy rain showers mixed with drizzle.
  ///
  /// In en, this message translates to:
  /// **'Heavy shower rain and drizzle'**
  String get weather_condition_heavy_shower_rain_and_drizzle;

  /// Intermittent drizzle showers.
  ///
  /// In en, this message translates to:
  /// **'Shower drizzle'**
  String get weather_condition_shower_drizzle;

  /// A light rainfall.
  ///
  /// In en, this message translates to:
  /// **'Light rain'**
  String get weather_condition_light_rain;

  /// A steady rainfall of moderate intensity.
  ///
  /// In en, this message translates to:
  /// **'Moderate rain'**
  String get weather_condition_moderate_rain;

  /// A strong and continuous rain shower.
  ///
  /// In en, this message translates to:
  /// **'Heavy intensity rain'**
  String get weather_condition_heavy_intensity_rain;

  /// Intense, heavy rain with possible flooding.
  ///
  /// In en, this message translates to:
  /// **'Very heavy rain'**
  String get weather_condition_very_heavy_rain;

  /// Exceptionally heavy rainfall.
  ///
  /// In en, this message translates to:
  /// **'Extreme rain'**
  String get weather_condition_extreme_rain;

  /// Rain that freezes upon impact.
  ///
  /// In en, this message translates to:
  /// **'Freezing rain'**
  String get weather_condition_freezing_rain;

  /// Intermittent light rain showers.
  ///
  /// In en, this message translates to:
  /// **'Light intensity shower rain'**
  String get weather_condition_light_intensity_shower_rain;

  /// A rain shower that comes and goes.
  ///
  /// In en, this message translates to:
  /// **'Shower rain'**
  String get weather_condition_shower_rain;

  /// Heavy and intermittent rain showers.
  ///
  /// In en, this message translates to:
  /// **'Heavy intensity shower rain'**
  String get weather_condition_heavy_intensity_shower_rain;

  /// Irregular and scattered rain showers.
  ///
  /// In en, this message translates to:
  /// **'Ragged shower rain'**
  String get weather_condition_ragged_shower_rain;

  /// A light snowfall.
  ///
  /// In en, this message translates to:
  /// **'Light snow'**
  String get weather_condition_light_snow;

  /// A steady snowfall.
  ///
  /// In en, this message translates to:
  /// **'Snow'**
  String get weather_condition_snow;

  /// A heavy snowfall with accumulation.
  ///
  /// In en, this message translates to:
  /// **'Heavy snow'**
  String get weather_condition_heavy_snow;

  /// Frozen raindrops mixed with snow.
  ///
  /// In en, this message translates to:
  /// **'Sleet'**
  String get weather_condition_sleet;

  /// Light sleet in intermittent showers.
  ///
  /// In en, this message translates to:
  /// **'Light shower sleet'**
  String get weather_condition_light_shower_sleet;

  /// Sleet in intermittent showers.
  ///
  /// In en, this message translates to:
  /// **'Shower sleet'**
  String get weather_condition_shower_sleet;

  /// A mix of light rain and snow.
  ///
  /// In en, this message translates to:
  /// **'Light rain and snow'**
  String get weather_condition_light_rain_and_snow;

  /// Rain mixed with snow, typically seen in transition seasons.
  ///
  /// In en, this message translates to:
  /// **'Rain and snow'**
  String get weather_condition_rain_and_snow;

  /// Light snow showers occurring intermittently.
  ///
  /// In en, this message translates to:
  /// **'Light shower snow'**
  String get weather_condition_light_shower_snow;

  /// Intermittent snow showers.
  ///
  /// In en, this message translates to:
  /// **'Shower snow'**
  String get weather_condition_shower_snow;

  /// Heavy snow showers occurring in bursts.
  ///
  /// In en, this message translates to:
  /// **'Heavy shower snow'**
  String get weather_condition_heavy_shower_snow;

  /// A thin fog reducing visibility.
  ///
  /// In en, this message translates to:
  /// **'Mist'**
  String get weather_condition_mist;

  /// Smoke in the air reducing visibility.
  ///
  /// In en, this message translates to:
  /// **'Smoke'**
  String get weather_condition_smoke;

  /// Light atmospheric dust or pollution.
  ///
  /// In en, this message translates to:
  /// **'Haze'**
  String get weather_condition_haze;

  /// Thick mist reducing visibility.
  ///
  /// In en, this message translates to:
  /// **'Fog'**
  String get weather_condition_fog;

  /// Dust or sand in the air reducing visibility.
  ///
  /// In en, this message translates to:
  /// **'Sand'**
  String get weather_condition_sand;

  /// Fine dust particles in the air.
  ///
  /// In en, this message translates to:
  /// **'Dust'**
  String get weather_condition_dust;

  /// Fine particles of volcanic ash in the air.
  ///
  /// In en, this message translates to:
  /// **'Volcanic ash'**
  String get weather_condition_volcanic_ash;

  /// Sudden, strong gusts of wind with rain or snow.
  ///
  /// In en, this message translates to:
  /// **'Squalls'**
  String get weather_condition_squalls;

  /// A powerful rotating storm.
  ///
  /// In en, this message translates to:
  /// **'Tornado'**
  String get weather_condition_tornado;

  /// No clouds in the sky.
  ///
  /// In en, this message translates to:
  /// **'Clear sky'**
  String get weather_condition_clear_sky;

  /// A few scattered clouds.
  ///
  /// In en, this message translates to:
  /// **'Few clouds'**
  String get weather_condition_few_clouds;

  /// Clouds scattered throughout the sky.
  ///
  /// In en, this message translates to:
  /// **'Scattered clouds'**
  String get weather_condition_scattered_clouds;

  /// Mostly cloudy with some breaks of sun.
  ///
  /// In en, this message translates to:
  /// **'Broken clouds'**
  String get weather_condition_broken_clouds;

  /// Completely covered sky with clouds.
  ///
  /// In en, this message translates to:
  /// **'Overcast clouds'**
  String get weather_condition_overcast_clouds;

  ///
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get weather_condition_unknown;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['cs', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'cs': return AppLocalizationsCs();
    case 'en': return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
