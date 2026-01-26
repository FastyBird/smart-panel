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

  /// Displayed when required services are not initialized
  ///
  /// In en, this message translates to:
  /// **'Services not available'**
  String get services_not_available;

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

  /// Text for Done button
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get button_done;

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

  /// Label shown when a device is offline/disconnected
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get device_status_offline;

  /// Message shown when a device is not connected
  ///
  /// In en, this message translates to:
  /// **'Device is offline'**
  String get device_offline_message;

  /// Message shown when a device has configuration problems
  ///
  /// In en, this message translates to:
  /// **'Configuration issue'**
  String get device_config_issue;

  /// Button label to open device details
  ///
  /// In en, this message translates to:
  /// **'Device Details'**
  String get device_details;

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

  /// State when the light is turned on
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get light_state_on;

  /// Detailed description of the light being turned on
  ///
  /// In en, this message translates to:
  /// **'Light is on'**
  String get light_state_on_description;

  /// State when the light is turned off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get light_state_off;

  /// State when the light command failed
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get light_state_failed;

  /// Detailed description of the light being off (singular)
  ///
  /// In en, this message translates to:
  /// **'Light is off'**
  String get light_state_off_description;

  /// Description of the current brightness level
  ///
  /// In en, this message translates to:
  /// **'Current brightness'**
  String get light_state_brightness_description;

  /// Description when devices in a group have different brightness values
  ///
  /// In en, this message translates to:
  /// **'Devices have different values'**
  String get light_state_mixed_description;

  /// Description shown while waiting for devices to sync after a command
  ///
  /// In en, this message translates to:
  /// **'Syncing devices...'**
  String get light_state_syncing_description;

  /// Description shown when devices in a group are initially out of sync
  ///
  /// In en, this message translates to:
  /// **'Devices are not synced'**
  String get light_state_not_synced_description;

  /// Name for main lighting role (ceiling lights, primary illumination)
  ///
  /// In en, this message translates to:
  /// **'Main'**
  String get light_role_main;

  /// Name for task lighting role (desk lamps, reading lights)
  ///
  /// In en, this message translates to:
  /// **'Task'**
  String get light_role_task;

  /// Name for ambient lighting role (wall sconces, mood lighting)
  ///
  /// In en, this message translates to:
  /// **'Ambient'**
  String get light_role_ambient;

  /// Name for accent lighting role (floor lamps, decorative lights)
  ///
  /// In en, this message translates to:
  /// **'Accent'**
  String get light_role_accent;

  /// Name for night lighting role (nightlights, low-level lighting)
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get light_role_night;

  /// Name for other/uncategorized lighting role
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get light_role_other;

  /// Name for hidden lighting role (excluded from UI)
  ///
  /// In en, this message translates to:
  /// **'Hidden'**
  String get light_role_hidden;

  /// Description for role detail when lights are on (plural)
  ///
  /// In en, this message translates to:
  /// **'Lights are on'**
  String get light_role_on_description;

  /// Description for role detail when all lights are off (plural)
  ///
  /// In en, this message translates to:
  /// **'Lights are off'**
  String get light_role_off_description;

  /// Description for role detail when lights failed to sync after a command
  ///
  /// In en, this message translates to:
  /// **'Lights failed to sync'**
  String get light_role_not_synced_description;

  /// Description for role detail when lights are actively syncing
  ///
  /// In en, this message translates to:
  /// **'Lights are syncing'**
  String get light_role_syncing_description;

  /// Description for role detail when lights intentionally have different values
  ///
  /// In en, this message translates to:
  /// **'Lights have different values'**
  String get light_role_mixed_description;

  /// Short label for a device that is out of sync with the target value
  ///
  /// In en, this message translates to:
  /// **'Out of sync'**
  String get light_state_out_of_sync;

  /// Mode when the light is off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get light_mode_off;

  /// Mode when the light is on
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get light_mode_on;

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

  /// Label for window contact sensor
  ///
  /// In en, this message translates to:
  /// **'Window'**
  String get contact_sensor_window;

  /// Contact sensor state when window/door is open
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get contact_sensor_open;

  /// Contact sensor state when window/door is closed
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get contact_sensor_closed;

  /// Label for water leak sensor
  ///
  /// In en, this message translates to:
  /// **'Water Leak'**
  String get leak_sensor_water;

  /// Leak sensor state when water is detected
  ///
  /// In en, this message translates to:
  /// **'Detected'**
  String get leak_sensor_detected;

  /// Leak sensor state when no water is detected
  ///
  /// In en, this message translates to:
  /// **'Dry'**
  String get leak_sensor_dry;

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

  /// Indicates the thermostat is actively heating to a target temperature
  ///
  /// In en, this message translates to:
  /// **'Heating to {temperature}'**
  String thermostat_state_heating_to(String temperature);

  /// Indicates the thermostat is actively cooling the space
  ///
  /// In en, this message translates to:
  /// **'Cooling'**
  String get thermostat_state_cooling;

  /// Indicates the thermostat is actively cooling to a target temperature
  ///
  /// In en, this message translates to:
  /// **'Cooling to {temperature}'**
  String thermostat_state_cooling_to(String temperature);

  /// Indicates the thermostat is in idle state
  ///
  /// In en, this message translates to:
  /// **'Idling'**
  String get thermostat_state_idling;

  /// Indicates the thermostat is idle at a target temperature
  ///
  /// In en, this message translates to:
  /// **'Idle at {temperature}'**
  String thermostat_state_idle_at(String temperature);

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

  /// Hint text shown on power button when device is off
  ///
  /// In en, this message translates to:
  /// **'Tap to turn on'**
  String get power_hint_tap_to_turn_on;

  /// Hint text shown on power button when device is on
  ///
  /// In en, this message translates to:
  /// **'Tap to turn off'**
  String get power_hint_tap_to_turn_off;

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

  /// Description explaining that the weather location can be selected from configured options.
  ///
  /// In en, this message translates to:
  /// **'Select from available locations configured in the administrator app.'**
  String get settings_weather_settings_temperature_location_description;

  /// Description explaining that the weather location is configured externally when only one location exists.
  ///
  /// In en, this message translates to:
  /// **'Location is configured in the administrator app.'**
  String get settings_weather_settings_temperature_location_single;

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

  /// Message shown when the display doesn't support audio.
  ///
  /// In en, this message translates to:
  /// **'This display does not support audio input or output.'**
  String get settings_audio_settings_no_support;

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

  /// Title displayed while searching for gateways
  ///
  /// In en, this message translates to:
  /// **'Searching for Gateways'**
  String get discovery_searching_title;

  /// Description displayed while searching for gateways
  ///
  /// In en, this message translates to:
  /// **'Looking for FastyBird Smart Panel gateways on your network...'**
  String get discovery_searching_description;

  /// Message showing how many gateways were found during search
  ///
  /// In en, this message translates to:
  /// **'Found {count} gateway(s)...'**
  String discovery_found_count(int count);

  /// Title when gateways are found and user needs to select one
  ///
  /// In en, this message translates to:
  /// **'Select a Gateway'**
  String get discovery_select_title;

  /// Description showing how many gateways were found
  ///
  /// In en, this message translates to:
  /// **'Found {count} gateway(s) on your network:'**
  String discovery_select_description(int count);

  /// Title when no gateways are found
  ///
  /// In en, this message translates to:
  /// **'No Gateway Found'**
  String get discovery_not_found_title;

  /// Description when no gateways are found
  ///
  /// In en, this message translates to:
  /// **'Could not find any FastyBird Smart Panel gateway on your network.\n\nMake sure the gateway is running and connected to the same network as this device.'**
  String get discovery_not_found_description;

  /// Title when discovery fails with an error
  ///
  /// In en, this message translates to:
  /// **'Discovery Error'**
  String get discovery_error_title;

  /// Description when discovery fails with an error
  ///
  /// In en, this message translates to:
  /// **'An error occurred while searching for gateways.\n\nPlease check your network connection and try again.'**
  String get discovery_error_description;

  /// Error message when discovery fails
  ///
  /// In en, this message translates to:
  /// **'Discovery failed: {error}'**
  String discovery_error_failed(String error);

  /// Title when connecting to a gateway
  ///
  /// In en, this message translates to:
  /// **'Connecting to Gateway'**
  String get discovery_connecting_title;

  /// Description when connecting to a gateway
  ///
  /// In en, this message translates to:
  /// **'Contacting {address}...'**
  String discovery_connecting_description(String address);

  /// Fallback name when gateway name is not available
  ///
  /// In en, this message translates to:
  /// **'gateway'**
  String get discovery_connecting_fallback;

  /// Title for manual gateway address entry
  ///
  /// In en, this message translates to:
  /// **'Enter Gateway Address'**
  String get discovery_manual_entry_title;

  /// Hint text for gateway address input field
  ///
  /// In en, this message translates to:
  /// **'192.168.1.100:3000'**
  String get discovery_manual_entry_hint;

  /// Label for gateway address input field
  ///
  /// In en, this message translates to:
  /// **'Gateway Address'**
  String get discovery_manual_entry_label;

  /// Help text for manual gateway address entry
  ///
  /// In en, this message translates to:
  /// **'Enter IP address or hostname with optional port.\nExamples: 192.168.1.100:3000, gateway.local, 10.0.0.5'**
  String get discovery_manual_entry_help;

  /// Warning message when gateway address is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter a gateway address'**
  String get discovery_validation_empty;

  /// Error message when gateway address is invalid
  ///
  /// In en, this message translates to:
  /// **'Invalid address. Enter a valid IP address or hostname.'**
  String get discovery_validation_invalid;

  /// Back button text
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get discovery_button_back;

  /// Connect button text
  ///
  /// In en, this message translates to:
  /// **'Connect'**
  String get discovery_button_connect;

  /// Button text to connect to selected gateway
  ///
  /// In en, this message translates to:
  /// **'Connect to Selected Gateway'**
  String get discovery_button_connect_selected;

  /// Rescan button text
  ///
  /// In en, this message translates to:
  /// **'Rescan'**
  String get discovery_button_rescan;

  /// Manual entry button text
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get discovery_button_manual;

  /// Cancel search button text
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get discovery_button_cancel;

  /// Success message when an action completes
  ///
  /// In en, this message translates to:
  /// **'Action completed successfully'**
  String get action_success;

  /// Title for the lighting controls section on space page
  ///
  /// In en, this message translates to:
  /// **'Lighting Controls'**
  String get space_lighting_controls_title;

  /// Label for the off lighting mode button
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get space_lighting_mode_off;

  /// Label for the work lighting mode button
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get space_lighting_mode_work;

  /// Label for the relax lighting mode button
  ///
  /// In en, this message translates to:
  /// **'Relax'**
  String get space_lighting_mode_relax;

  /// Label for the night lighting mode button
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get space_lighting_mode_night;

  /// Title for the devices section on space page
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get space_devices_title;

  /// Placeholder text when no devices are displayed
  ///
  /// In en, this message translates to:
  /// **'Devices in this space will be displayed here'**
  String get space_devices_placeholder;

  /// Title for the climate controls section on space page
  ///
  /// In en, this message translates to:
  /// **'Climate'**
  String get space_climate_controls_title;

  /// Label for current temperature display
  ///
  /// In en, this message translates to:
  /// **'Current'**
  String get space_climate_current_label;

  /// Label for target temperature display
  ///
  /// In en, this message translates to:
  /// **'Target'**
  String get space_climate_target_label;

  /// Section header for auxiliary climate devices
  ///
  /// In en, this message translates to:
  /// **'Auxiliary'**
  String get climate_role_auxiliary;

  /// Hint text for tapping on climate dial
  ///
  /// In en, this message translates to:
  /// **'Tap for details'**
  String get climate_tap_for_details;

  /// Section header for ventilation devices (fans, purifiers)
  ///
  /// In en, this message translates to:
  /// **'Ventilation'**
  String get climate_role_ventilation;

  /// Section header for humidity control devices
  ///
  /// In en, this message translates to:
  /// **'Humidity Control'**
  String get climate_role_humidity;

  /// Section header for other climate devices
  ///
  /// In en, this message translates to:
  /// **'Other Devices'**
  String get climate_role_other;

  /// Message shown when a suggestion is applied
  ///
  /// In en, this message translates to:
  /// **'Suggestion applied'**
  String get space_suggestion_applied;

  /// Message shown when a suggestion is dismissed
  ///
  /// In en, this message translates to:
  /// **'Suggestion dismissed'**
  String get space_suggestion_dismissed;

  /// Message shown when an action is undone
  ///
  /// In en, this message translates to:
  /// **'Action undone'**
  String get space_undo_success;

  /// Label for the undo button
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get space_undo_button;

  /// Title shown when space has no controllable devices
  ///
  /// In en, this message translates to:
  /// **'No Controls Available'**
  String get space_empty_state_title;

  /// Description shown when space has no controllable devices
  ///
  /// In en, this message translates to:
  /// **'This space has no controllable devices configured yet'**
  String get space_empty_state_description;

  /// Title shown when space only has sensors
  ///
  /// In en, this message translates to:
  /// **'Sensors Only'**
  String get space_sensors_only_title;

  /// Description shown when space only has sensors
  ///
  /// In en, this message translates to:
  /// **'This space only has sensors — no controllable devices'**
  String get space_sensors_only_description;

  /// Title shown when house overview has no spaces
  ///
  /// In en, this message translates to:
  /// **'No Spaces Configured'**
  String get house_overview_no_spaces_title;

  /// Description shown when house overview has no spaces
  ///
  /// In en, this message translates to:
  /// **'Create spaces in the admin app to see them here'**
  String get house_overview_no_spaces_description;

  /// Message shown when trying to navigate to a space without a page
  ///
  /// In en, this message translates to:
  /// **'No room page configured for this space'**
  String get house_overview_no_space_page;

  /// Hint text on space cards in house overview
  ///
  /// In en, this message translates to:
  /// **'Tap to view'**
  String get house_overview_tap_to_view;

  /// Label for home mode
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get house_modes_home;

  /// Description for home mode
  ///
  /// In en, this message translates to:
  /// **'Normal home operation'**
  String get house_modes_home_description;

  /// Label for away mode
  ///
  /// In en, this message translates to:
  /// **'Away'**
  String get house_modes_away;

  /// Description for away mode
  ///
  /// In en, this message translates to:
  /// **'Away from home'**
  String get house_modes_away_description;

  /// Label for night mode
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get house_modes_night;

  /// Description for night mode
  ///
  /// In en, this message translates to:
  /// **'Night time settings'**
  String get house_modes_night_description;

  /// Success message when house mode is changed
  ///
  /// In en, this message translates to:
  /// **'House mode changed successfully'**
  String get house_modes_changed_success;

  /// Error message when house mode change fails
  ///
  /// In en, this message translates to:
  /// **'Failed to change house mode'**
  String get house_modes_changed_error;

  /// Title for confirmation dialog when changing to away mode
  ///
  /// In en, this message translates to:
  /// **'Confirm Mode Change'**
  String get house_modes_confirm_title;

  /// Confirmation message for away mode
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to set the house to Away mode? This may affect automation rules and security settings.'**
  String get house_modes_confirm_away_description;

  /// Title for the quick scenes section on space page
  ///
  /// In en, this message translates to:
  /// **'Quick Scenes'**
  String get space_scenes_title;

  /// Success message when a scene is triggered
  ///
  /// In en, this message translates to:
  /// **'Scene activated'**
  String get space_scene_triggered;

  /// Message when a scene is partially activated (some actions failed)
  ///
  /// In en, this message translates to:
  /// **'Scene partially activated'**
  String get space_scene_partial_success;

  /// Status when the window covering is fully open
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get window_covering_status_open;

  /// Status when the window covering is fully closed
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get window_covering_status_closed;

  /// Status when the window covering is opening
  ///
  /// In en, this message translates to:
  /// **'Opening'**
  String get window_covering_status_opening;

  /// Status when the window covering is closing
  ///
  /// In en, this message translates to:
  /// **'Closing'**
  String get window_covering_status_closing;

  /// Status when the window covering is stopped mid-way
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get window_covering_status_stopped;

  /// Type label for curtain window covering
  ///
  /// In en, this message translates to:
  /// **'Curtain'**
  String get window_covering_type_curtain;

  /// Type label for blind window covering
  ///
  /// In en, this message translates to:
  /// **'Blind'**
  String get window_covering_type_blind;

  /// Type label for roller window covering
  ///
  /// In en, this message translates to:
  /// **'Roller'**
  String get window_covering_type_roller;

  /// Type label for outdoor blind window covering
  ///
  /// In en, this message translates to:
  /// **'Outdoor Blind'**
  String get window_covering_type_outdoor_blind;

  /// Type label for venetian blind window covering
  ///
  /// In en, this message translates to:
  /// **'Venetian Blind'**
  String get window_covering_type_venetian_blind;

  /// Type label for vertical blind window covering
  ///
  /// In en, this message translates to:
  /// **'Vertical Blind'**
  String get window_covering_type_vertical_blind;

  /// Type label for shutter window covering
  ///
  /// In en, this message translates to:
  /// **'Shutter'**
  String get window_covering_type_shutter;

  /// Type label for awning window covering
  ///
  /// In en, this message translates to:
  /// **'Awning'**
  String get window_covering_type_awning;

  /// Button label to open the window covering
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get window_covering_command_open;

  /// Button label to close the window covering
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get window_covering_command_close;

  /// Button label to stop the window covering
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get window_covering_command_stop;

  /// Label for position control
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get window_covering_position_label;

  /// Description for the current position value
  ///
  /// In en, this message translates to:
  /// **'Current position'**
  String get window_covering_position_description;

  /// Label for tilt control
  ///
  /// In en, this message translates to:
  /// **'Tilt'**
  String get window_covering_tilt_label;

  /// Description for the tilt control
  ///
  /// In en, this message translates to:
  /// **'Adjust slat angle'**
  String get window_covering_tilt_description;

  /// Warning message when obstruction is detected
  ///
  /// In en, this message translates to:
  /// **'Obstruction detected'**
  String get window_covering_obstruction_warning;

  /// Warning message when a fault is detected
  ///
  /// In en, this message translates to:
  /// **'Fault detected'**
  String get window_covering_fault_warning;

  /// Morning preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Morning'**
  String get window_covering_preset_morning;

  /// Day preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Day'**
  String get window_covering_preset_day;

  /// Evening preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Evening'**
  String get window_covering_preset_evening;

  /// Night preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get window_covering_preset_night;

  /// Privacy preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get window_covering_preset_privacy;

  /// Away preset name for window covering
  ///
  /// In en, this message translates to:
  /// **'Away'**
  String get window_covering_preset_away;

  /// Section label for window covering presets
  ///
  /// In en, this message translates to:
  /// **'Presets'**
  String get window_covering_presets_label;

  /// Section label for window covering channels list
  ///
  /// In en, this message translates to:
  /// **'Blinds'**
  String get window_covering_channels_label;

  /// Status label in window covering info card
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get window_covering_info_status;

  /// Obstruction label in window covering info card
  ///
  /// In en, this message translates to:
  /// **'Obstruction'**
  String get window_covering_info_obstruction;

  /// Obstruction detected status
  ///
  /// In en, this message translates to:
  /// **'Detected'**
  String get window_covering_obstruction_detected;

  /// No obstruction status
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get window_covering_obstruction_clear;

  /// Position display showing percentage open
  ///
  /// In en, this message translates to:
  /// **'{position}% Open'**
  String window_covering_position_open_percent(int position);

  /// Title label for battery level display
  ///
  /// In en, this message translates to:
  /// **'Battery'**
  String get battery_title;

  /// Title shown when display configuration is invalid
  ///
  /// In en, this message translates to:
  /// **'Configuration Required'**
  String get config_error_title;

  /// Hint text explaining how to fix configuration error
  ///
  /// In en, this message translates to:
  /// **'Configure this display in Admin > Displays'**
  String get config_error_hint;

  /// Text for Retry button
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get button_retry;

  /// Text for Sync All button when devices are out of sync
  ///
  /// In en, this message translates to:
  /// **'Sync All'**
  String get button_sync_all;

  /// Title for room system view in deck navigation
  ///
  /// In en, this message translates to:
  /// **'Room'**
  String get system_view_room;

  /// Title for master/home system view in deck navigation
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get system_view_master;

  /// Title for entry system view in deck navigation
  ///
  /// In en, this message translates to:
  /// **'Entry'**
  String get system_view_entry;

  /// Title for lights domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Lights'**
  String get domain_lights;

  /// Section header for uncategorized lights in lights domain view
  ///
  /// In en, this message translates to:
  /// **'Other Lights'**
  String get domain_lights_other;

  /// Title shown when no lights are found in the room
  ///
  /// In en, this message translates to:
  /// **'No Lights'**
  String get domain_lights_empty_title;

  /// Description shown when no lights are found in the room
  ///
  /// In en, this message translates to:
  /// **'No lighting devices found in this room'**
  String get domain_lights_empty_description;

  /// Count of lights that are on in a role group
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 light on} other{{count} lights on}}'**
  String domain_lights_count_on(int count);

  /// Text shown when all lights in a role group are off
  ///
  /// In en, this message translates to:
  /// **'all off'**
  String get domain_lights_all_off;

  /// Text shown when all lights in a role group are on
  ///
  /// In en, this message translates to:
  /// **'all on'**
  String get domain_lights_all_on;

  /// Button label to turn all lights off
  ///
  /// In en, this message translates to:
  /// **'All Off'**
  String get domain_lights_button_all_off;

  /// Button label to turn all lights on
  ///
  /// In en, this message translates to:
  /// **'All On'**
  String get domain_lights_button_all_on;

  /// Text shown when lights are syncing after a command
  ///
  /// In en, this message translates to:
  /// **'syncing'**
  String get domain_lights_syncing;

  /// Text shown when lights failed to sync after a command
  ///
  /// In en, this message translates to:
  /// **'unsynced'**
  String get domain_lights_unsynced;

  /// Text shown when lights intentionally have different values
  ///
  /// In en, this message translates to:
  /// **'mixed'**
  String get domain_lights_mixed;

  /// Title for climate domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Climate'**
  String get domain_climate;

  /// Title for media domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Media'**
  String get domain_media;

  /// Summary showing total media devices
  ///
  /// In en, this message translates to:
  /// **'{count} devices'**
  String media_devices_summary(Object count);

  /// Summary showing total/on media devices
  ///
  /// In en, this message translates to:
  /// **'{count} devices • {on} on'**
  String media_devices_summary_on(Object count, Object on);

  /// Section heading for media modes
  ///
  /// In en, this message translates to:
  /// **'Modes'**
  String get media_modes_title;

  /// Button label to power on media devices
  ///
  /// In en, this message translates to:
  /// **'Power on'**
  String get media_action_power_on;

  /// Button label to power off media devices
  ///
  /// In en, this message translates to:
  /// **'Power off'**
  String get media_action_power_off;

  /// Button label to mute media devices
  ///
  /// In en, this message translates to:
  /// **'Mute'**
  String get media_action_mute;

  /// Button label to unmute media devices
  ///
  /// In en, this message translates to:
  /// **'Unmute'**
  String get media_action_unmute;

  /// Media mode Off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get media_mode_off;

  /// Media mode Background
  ///
  /// In en, this message translates to:
  /// **'Background'**
  String get media_mode_background;

  /// Media mode Focused
  ///
  /// In en, this message translates to:
  /// **'Focused'**
  String get media_mode_focused;

  /// Media mode Party
  ///
  /// In en, this message translates to:
  /// **'Party'**
  String get media_mode_party;

  /// Section heading for media roles
  ///
  /// In en, this message translates to:
  /// **'Roles'**
  String get media_roles_title;

  /// Summary for a media role
  ///
  /// In en, this message translates to:
  /// **'{on} of {total} on'**
  String media_role_summary(Object on, Object total);

  /// Label for unassigned media devices
  ///
  /// In en, this message translates to:
  /// **'Unassigned devices'**
  String get media_roles_unassigned;

  /// Label for primary media role
  ///
  /// In en, this message translates to:
  /// **'Primary'**
  String get media_role_primary;

  /// Label for secondary media role
  ///
  /// In en, this message translates to:
  /// **'Secondary'**
  String get media_role_secondary;

  /// Label for background media role
  ///
  /// In en, this message translates to:
  /// **'Background'**
  String get media_role_background;

  /// Label for gaming media role
  ///
  /// In en, this message translates to:
  /// **'Gaming'**
  String get media_role_gaming;

  /// Label for hidden media role
  ///
  /// In en, this message translates to:
  /// **'Hidden'**
  String get media_role_hidden;

  /// Section heading for media targets/devices
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get media_targets_title;

  /// Capability label - power
  ///
  /// In en, this message translates to:
  /// **'Power'**
  String get media_capability_power;

  /// Capability label - volume
  ///
  /// In en, this message translates to:
  /// **'Volume'**
  String get media_capability_volume;

  /// Capability label - mute
  ///
  /// In en, this message translates to:
  /// **'Mute'**
  String get media_capability_mute;

  /// Shown when device has no media capabilities
  ///
  /// In en, this message translates to:
  /// **'No capabilities'**
  String get media_capability_none;

  /// Title for sensors domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Sensors'**
  String get domain_sensors;

  /// Label for lighting device category
  ///
  /// In en, this message translates to:
  /// **'Lights'**
  String get device_category_lighting;

  /// Label for climate device category
  ///
  /// In en, this message translates to:
  /// **'Climate'**
  String get device_category_climate;

  /// Label for sensors device category
  ///
  /// In en, this message translates to:
  /// **'Sensors'**
  String get device_category_sensors;

  /// Label for media device category
  ///
  /// In en, this message translates to:
  /// **'Media'**
  String get device_category_media;

  /// Label for rooms in master overview
  ///
  /// In en, this message translates to:
  /// **'Rooms'**
  String get master_rooms;

  /// Label for devices in master overview
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get master_devices;

  /// Label for scenes in master overview
  ///
  /// In en, this message translates to:
  /// **'Scenes'**
  String get master_scenes;

  /// Title for quick actions section in master overview
  ///
  /// In en, this message translates to:
  /// **'Quick Actions'**
  String get master_quick_actions;

  /// Success message when house mode is activated
  ///
  /// In en, this message translates to:
  /// **'Mode activated'**
  String get entry_mode_activated;

  /// Title for house modes section in entry overview
  ///
  /// In en, this message translates to:
  /// **'House Modes'**
  String get entry_house_modes;

  /// Label for home mode
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get entry_mode_home;

  /// Label for away mode
  ///
  /// In en, this message translates to:
  /// **'Away'**
  String get entry_mode_away;

  /// Label for night mode
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get entry_mode_night;

  /// Label for movie mode
  ///
  /// In en, this message translates to:
  /// **'Movie'**
  String get entry_mode_movie;

  /// Title for security section in entry overview
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get entry_security;

  /// Message when no security devices are available
  ///
  /// In en, this message translates to:
  /// **'No security devices configured'**
  String get entry_no_security_devices;

  /// Label for locks in security section
  ///
  /// In en, this message translates to:
  /// **'Locks'**
  String get entry_locks;

  /// Label for alarm in security section
  ///
  /// In en, this message translates to:
  /// **'Alarm'**
  String get entry_alarm;

  /// Label for cameras in security section
  ///
  /// In en, this message translates to:
  /// **'Cameras'**
  String get entry_cameras;

  /// Air quality level - excellent
  ///
  /// In en, this message translates to:
  /// **'Excellent'**
  String get air_quality_level_excellent;

  /// Air quality level - good
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get air_quality_level_good;

  /// Air quality level - fair
  ///
  /// In en, this message translates to:
  /// **'Fair'**
  String get air_quality_level_fair;

  /// Air quality level - inferior
  ///
  /// In en, this message translates to:
  /// **'Inferior'**
  String get air_quality_level_inferior;

  /// Air quality level - poor
  ///
  /// In en, this message translates to:
  /// **'Poor'**
  String get air_quality_level_poor;

  /// Air quality level - unknown
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get air_quality_level_unknown;

  /// AQI label for good air quality (0-50)
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get aqi_label_good;

  /// AQI label for moderate air quality (51-100)
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get aqi_label_moderate;

  /// AQI label for unhealthy for sensitive groups (101-150)
  ///
  /// In en, this message translates to:
  /// **'Unhealthy (Sensitive)'**
  String get aqi_label_unhealthy_sensitive;

  /// AQI label for unhealthy air quality (151-200)
  ///
  /// In en, this message translates to:
  /// **'Unhealthy'**
  String get aqi_label_unhealthy;

  /// AQI label for very unhealthy air quality (201-300)
  ///
  /// In en, this message translates to:
  /// **'Very Unhealthy'**
  String get aqi_label_very_unhealthy;

  /// AQI label for hazardous air quality (301+)
  ///
  /// In en, this message translates to:
  /// **'Hazardous'**
  String get aqi_label_hazardous;

  /// Label for PM1 particulate matter
  ///
  /// In en, this message translates to:
  /// **'PM1'**
  String get particulate_label_pm1;

  /// Label for PM2.5 particulate matter
  ///
  /// In en, this message translates to:
  /// **'PM2.5'**
  String get particulate_label_pm25;

  /// Label for PM10 particulate matter
  ///
  /// In en, this message translates to:
  /// **'PM10'**
  String get particulate_label_pm10;

  /// VOC level - good/low
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get voc_level_good;

  /// VOC level - moderate/medium
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get voc_level_moderate;

  /// VOC level - poor/high
  ///
  /// In en, this message translates to:
  /// **'Poor'**
  String get voc_level_poor;

  /// Fan mode - automatic
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get fan_mode_auto;

  /// Fan mode - manual
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get fan_mode_manual;

  /// Fan mode - eco/energy saving
  ///
  /// In en, this message translates to:
  /// **'Eco'**
  String get fan_mode_eco;

  /// Fan mode - sleep/quiet
  ///
  /// In en, this message translates to:
  /// **'Sleep'**
  String get fan_mode_sleep;

  /// Fan mode - natural breeze
  ///
  /// In en, this message translates to:
  /// **'Natural'**
  String get fan_mode_natural;

  /// Fan mode - turbo/high power
  ///
  /// In en, this message translates to:
  /// **'Turbo'**
  String get fan_mode_turbo;

  /// Fan speed level - off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get fan_speed_off;

  /// Fan speed level - low
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get fan_speed_low;

  /// Fan speed level - medium
  ///
  /// In en, this message translates to:
  /// **'Med'**
  String get fan_speed_medium;

  /// Fan speed level - high
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get fan_speed_high;

  /// Fan speed level - turbo
  ///
  /// In en, this message translates to:
  /// **'Turbo'**
  String get fan_speed_turbo;

  /// Fan speed level - auto
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get fan_speed_auto;

  /// Fan timer - off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get fan_timer_off;

  /// Fan timer - 30 minutes
  ///
  /// In en, this message translates to:
  /// **'30m'**
  String get fan_timer_30m;

  /// Fan timer - 1 hour
  ///
  /// In en, this message translates to:
  /// **'1h'**
  String get fan_timer_1h;

  /// Fan timer - 2 hours
  ///
  /// In en, this message translates to:
  /// **'2h'**
  String get fan_timer_2h;

  /// Fan timer - 4 hours
  ///
  /// In en, this message translates to:
  /// **'4h'**
  String get fan_timer_4h;

  /// Fan timer - 8 hours
  ///
  /// In en, this message translates to:
  /// **'8h'**
  String get fan_timer_8h;

  /// Fan timer - 12 hours
  ///
  /// In en, this message translates to:
  /// **'12h'**
  String get fan_timer_12h;

  /// Fan direction - clockwise
  ///
  /// In en, this message translates to:
  /// **'Clockwise'**
  String get fan_direction_clockwise;

  /// Fan direction - counter-clockwise
  ///
  /// In en, this message translates to:
  /// **'Counter-Clockwise'**
  String get fan_direction_counter_clockwise;

  /// Filter status - good condition
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get filter_status_good;

  /// Filter status - needs replacement soon
  ///
  /// In en, this message translates to:
  /// **'Due Soon'**
  String get filter_status_replace_soon;

  /// Filter status - needs immediate replacement
  ///
  /// In en, this message translates to:
  /// **'Replace'**
  String get filter_status_replace_now;

  /// Filter status - unknown or unavailable
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get filter_status_unknown;

  /// Dehumidifier mode - automatic
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get dehumidifier_mode_auto;

  /// Dehumidifier mode - manual
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get dehumidifier_mode_manual;

  /// Dehumidifier mode - continuous operation
  ///
  /// In en, this message translates to:
  /// **'Continuous'**
  String get dehumidifier_mode_continuous;

  /// Dehumidifier mode - laundry drying
  ///
  /// In en, this message translates to:
  /// **'Laundry'**
  String get dehumidifier_mode_laundry;

  /// Dehumidifier mode - quiet/silent operation
  ///
  /// In en, this message translates to:
  /// **'Quiet'**
  String get dehumidifier_mode_quiet;

  /// Dehumidifier status - idle
  ///
  /// In en, this message translates to:
  /// **'Idle'**
  String get dehumidifier_status_idle;

  /// Dehumidifier status - actively dehumidifying
  ///
  /// In en, this message translates to:
  /// **'Dehumidifying'**
  String get dehumidifier_status_dehumidifying;

  /// Dehumidifier status - defrost cycle active
  ///
  /// In en, this message translates to:
  /// **'Defrosting'**
  String get dehumidifier_status_defrosting;

  /// Dehumidifier timer - off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get dehumidifier_timer_off;

  /// Dehumidifier timer - 30 minutes
  ///
  /// In en, this message translates to:
  /// **'30 min'**
  String get dehumidifier_timer_30m;

  /// Dehumidifier timer - 1 hour
  ///
  /// In en, this message translates to:
  /// **'1 hour'**
  String get dehumidifier_timer_1h;

  /// Dehumidifier timer - 2 hours
  ///
  /// In en, this message translates to:
  /// **'2 hours'**
  String get dehumidifier_timer_2h;

  /// Dehumidifier timer - 4 hours
  ///
  /// In en, this message translates to:
  /// **'4 hours'**
  String get dehumidifier_timer_4h;

  /// Dehumidifier timer - 8 hours
  ///
  /// In en, this message translates to:
  /// **'8 hours'**
  String get dehumidifier_timer_8h;

  /// Dehumidifier timer - 12 hours
  ///
  /// In en, this message translates to:
  /// **'12 hours'**
  String get dehumidifier_timer_12h;

  /// Dehumidifier water tank label
  ///
  /// In en, this message translates to:
  /// **'Water Tank'**
  String get dehumidifier_water_tank;

  /// Dehumidifier defrost cycle label
  ///
  /// In en, this message translates to:
  /// **'Defrost'**
  String get dehumidifier_defrost;

  /// Dehumidifier defrost cycle is active
  ///
  /// In en, this message translates to:
  /// **'Defrosting'**
  String get dehumidifier_defrost_active;

  /// Humidifier mode - automatic
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get humidifier_mode_auto;

  /// Humidifier mode - manual
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get humidifier_mode_manual;

  /// Humidifier mode - sleep mode
  ///
  /// In en, this message translates to:
  /// **'Sleep'**
  String get humidifier_mode_sleep;

  /// Humidifier mode - baby safe mode
  ///
  /// In en, this message translates to:
  /// **'Baby'**
  String get humidifier_mode_baby;

  /// Humidifier status - idle
  ///
  /// In en, this message translates to:
  /// **'Idle'**
  String get humidifier_status_idle;

  /// Humidifier status - actively humidifying
  ///
  /// In en, this message translates to:
  /// **'Humidifying'**
  String get humidifier_status_humidifying;

  /// Mist level control label
  ///
  /// In en, this message translates to:
  /// **'Mist Level'**
  String get humidifier_mist_level;

  /// Humidifier mist level - off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get humidifier_mist_level_off;

  /// Humidifier mist level - low
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get humidifier_mist_level_low;

  /// Humidifier mist level - medium
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get humidifier_mist_level_medium;

  /// Humidifier mist level - high
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get humidifier_mist_level_high;

  /// Humidifier timer - off
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get humidifier_timer_off;

  /// Humidifier timer - 30 minutes
  ///
  /// In en, this message translates to:
  /// **'30 min'**
  String get humidifier_timer_30m;

  /// Humidifier timer - 1 hour
  ///
  /// In en, this message translates to:
  /// **'1 hour'**
  String get humidifier_timer_1h;

  /// Humidifier timer - 2 hours
  ///
  /// In en, this message translates to:
  /// **'2 hours'**
  String get humidifier_timer_2h;

  /// Humidifier timer - 4 hours
  ///
  /// In en, this message translates to:
  /// **'4 hours'**
  String get humidifier_timer_4h;

  /// Humidifier timer - 8 hours
  ///
  /// In en, this message translates to:
  /// **'8 hours'**
  String get humidifier_timer_8h;

  /// Humidifier timer - 12 hours
  ///
  /// In en, this message translates to:
  /// **'12 hours'**
  String get humidifier_timer_12h;

  /// Humidifier water tank label
  ///
  /// In en, this message translates to:
  /// **'Water Tank'**
  String get humidifier_water_tank;

  /// Humidifier warm mist feature label
  ///
  /// In en, this message translates to:
  /// **'Warm Mist'**
  String get humidifier_warm_mist;

  /// Current humidity label
  ///
  /// In en, this message translates to:
  /// **'Current'**
  String get device_current_humidity;

  /// Current temperature label
  ///
  /// In en, this message translates to:
  /// **'Temperature'**
  String get device_current_temperature;

  /// Fan speed label
  ///
  /// In en, this message translates to:
  /// **'Fan Speed'**
  String get device_fan_speed;

  /// Fan mode label
  ///
  /// In en, this message translates to:
  /// **'Fan Mode'**
  String get device_fan_mode;

  /// Timer label
  ///
  /// In en, this message translates to:
  /// **'Timer'**
  String get device_timer;

  /// Child lock label
  ///
  /// In en, this message translates to:
  /// **'Child Lock'**
  String get device_child_lock;

  /// Fan oscillation/swing label
  ///
  /// In en, this message translates to:
  /// **'Oscillation'**
  String get device_oscillation;

  /// Fan direction label
  ///
  /// In en, this message translates to:
  /// **'Direction'**
  String get device_direction;

  /// Natural breeze mode label
  ///
  /// In en, this message translates to:
  /// **'Natural Breeze'**
  String get device_natural_breeze;

  /// Auto-off timer sheet title
  ///
  /// In en, this message translates to:
  /// **'Auto-Off Timer'**
  String get device_auto_off_timer;

  /// Filter life remaining label
  ///
  /// In en, this message translates to:
  /// **'Filter Life'**
  String get device_filter_life;

  /// Filter status label
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get device_filter_status;

  /// Volatile organic compounds label
  ///
  /// In en, this message translates to:
  /// **'VOC'**
  String get device_voc;

  /// Carbon dioxide label
  ///
  /// In en, this message translates to:
  /// **'CO₂'**
  String get device_co2;

  /// Carbon monoxide label
  ///
  /// In en, this message translates to:
  /// **'CO'**
  String get device_co;

  /// Nitrogen dioxide label
  ///
  /// In en, this message translates to:
  /// **'NO₂'**
  String get device_no2;

  /// Ozone label
  ///
  /// In en, this message translates to:
  /// **'O₃'**
  String get device_o3;

  /// Sulphur dioxide label
  ///
  /// In en, this message translates to:
  /// **'SO₂'**
  String get device_so2;

  /// Atmospheric pressure label
  ///
  /// In en, this message translates to:
  /// **'Pressure'**
  String get device_pressure;

  /// Air quality status when healthy
  ///
  /// In en, this message translates to:
  /// **'Healthy'**
  String get air_quality_healthy;

  /// Air quality status when unhealthy
  ///
  /// In en, this message translates to:
  /// **'Unhealthy'**
  String get air_quality_unhealthy;

  /// Gas detected status
  ///
  /// In en, this message translates to:
  /// **'Detected'**
  String get gas_detected;

  /// No gas detected status
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get gas_clear;

  /// Low gas level
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get gas_level_low;

  /// Medium gas level
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get gas_level_medium;

  /// High gas level
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get gas_level_high;

  /// Humidity short label
  ///
  /// In en, this message translates to:
  /// **'Humidity'**
  String get device_humidity;

  /// Air quality index label
  ///
  /// In en, this message translates to:
  /// **'Air Quality Index'**
  String get device_air_quality_index;

  /// Temperature short label
  ///
  /// In en, this message translates to:
  /// **'Temp'**
  String get device_temperature;

  /// Sensors section label
  ///
  /// In en, this message translates to:
  /// **'Sensors'**
  String get device_sensors;

  /// Controls section label
  ///
  /// In en, this message translates to:
  /// **'Controls'**
  String get device_controls;

  /// Duration format with hours and minutes
  ///
  /// In en, this message translates to:
  /// **'{hours}h {minutes}m'**
  String duration_format_hours_minutes(int hours, int minutes);

  /// Duration format with hours only
  ///
  /// In en, this message translates to:
  /// **'{hours}h'**
  String duration_format_hours(int hours);

  /// Duration format with minutes only
  ///
  /// In en, this message translates to:
  /// **'{minutes}m'**
  String duration_format_minutes(int minutes);

  /// Media player status - playing
  ///
  /// In en, this message translates to:
  /// **'Playing'**
  String get media_playing;

  /// Media player status - idle
  ///
  /// In en, this message translates to:
  /// **'Idle'**
  String get media_idle;

  /// Media player status - standby
  ///
  /// In en, this message translates to:
  /// **'Standby'**
  String get media_standby;

  /// Media player volume label
  ///
  /// In en, this message translates to:
  /// **'Volume'**
  String get media_volume;

  /// Media player source label
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get media_source;

  /// Media player queue label
  ///
  /// In en, this message translates to:
  /// **'Queue'**
  String get media_queue;

  /// Media player up next section label
  ///
  /// In en, this message translates to:
  /// **'Up Next'**
  String get media_up_next;

  /// Media player other devices section label
  ///
  /// In en, this message translates to:
  /// **'Other Devices'**
  String get media_other_devices;

  /// Device status - standby (on but not actively working)
  ///
  /// In en, this message translates to:
  /// **'Standby'**
  String get device_status_standby;

  /// Device status - active
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get device_status_active;

  /// Device status - inactive
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get device_status_inactive;

  /// Section header for climate devices list
  ///
  /// In en, this message translates to:
  /// **'Climate Devices'**
  String get climate_devices_section;

  /// Title for shading domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Shading'**
  String get domain_shading;

  /// Title shown when no window coverings are found in the room
  ///
  /// In en, this message translates to:
  /// **'No Window Coverings'**
  String get domain_shading_empty_title;

  /// Description shown when no window coverings are found in the room
  ///
  /// In en, this message translates to:
  /// **'No window covering devices found in this room'**
  String get domain_shading_empty_description;

  /// Title for modes section in shading domain
  ///
  /// In en, this message translates to:
  /// **'Modes'**
  String get shading_modes_title;

  /// Title for devices section in shading domain
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get shading_devices_title;

  /// Count of devices in a role group
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 device} other{{count} devices}}'**
  String shading_devices_count(int count);

  /// Button label for open action
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get shading_action_open;

  /// Button label for close action
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get shading_action_close;

  /// Button label for stop action
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get shading_action_stop;

  /// State label when covering is fully open
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get shading_state_open;

  /// State label when covering is fully closed
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get shading_state_closed;

  /// State label when covering is partially open
  ///
  /// In en, this message translates to:
  /// **'{position}% open'**
  String shading_state_partial(int position);

  /// Label for the position slider
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get shading_position;

  /// Text to show expandable controls on role card
  ///
  /// In en, this message translates to:
  /// **'Tap for controls'**
  String get shading_tap_for_controls;

  /// Text to hide expanded controls on role card
  ///
  /// In en, this message translates to:
  /// **'Hide controls'**
  String get shading_hide_controls;

  /// Covers mode for fully open blinds
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get covers_mode_open;

  /// Covers mode for fully closed blinds
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get covers_mode_closed;

  /// Covers mode for privacy (partial close)
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get covers_mode_privacy;

  /// Covers mode optimized for natural daylight
  ///
  /// In en, this message translates to:
  /// **'Daylight'**
  String get covers_mode_daylight;

  /// Label for primary covers role
  ///
  /// In en, this message translates to:
  /// **'Primary'**
  String get covers_role_primary;

  /// Label for blackout covers role
  ///
  /// In en, this message translates to:
  /// **'Blackout'**
  String get covers_role_blackout;

  /// Label for sheer covers role
  ///
  /// In en, this message translates to:
  /// **'Sheer'**
  String get covers_role_sheer;

  /// Label for outdoor covers role
  ///
  /// In en, this message translates to:
  /// **'Outdoor'**
  String get covers_role_outdoor;

  /// Label for hidden covers role
  ///
  /// In en, this message translates to:
  /// **'Hidden'**
  String get covers_role_hidden;

  /// Cover type label for curtain
  ///
  /// In en, this message translates to:
  /// **'Curtain'**
  String get cover_type_curtain;

  /// Cover type label for blind
  ///
  /// In en, this message translates to:
  /// **'Blind'**
  String get cover_type_blind;

  /// Cover type label for roller shade
  ///
  /// In en, this message translates to:
  /// **'Roller'**
  String get cover_type_roller;

  /// Cover type label for outdoor blind
  ///
  /// In en, this message translates to:
  /// **'Outdoor Blind'**
  String get cover_type_outdoor_blind;

  /// Generic cover type label
  ///
  /// In en, this message translates to:
  /// **'Cover'**
  String get cover_type_cover;

  /// Candle color temperature preset label
  ///
  /// In en, this message translates to:
  /// **'Candle'**
  String get light_preset_candle;

  /// Warm color temperature preset label
  ///
  /// In en, this message translates to:
  /// **'Warm'**
  String get light_preset_warm;

  /// Daylight color temperature preset label
  ///
  /// In en, this message translates to:
  /// **'Daylight'**
  String get light_preset_daylight;

  /// Cool color temperature preset label
  ///
  /// In en, this message translates to:
  /// **'Cool'**
  String get light_preset_cool;

  /// Red color preset label
  ///
  /// In en, this message translates to:
  /// **'Red'**
  String get light_color_red;

  /// Orange color preset label
  ///
  /// In en, this message translates to:
  /// **'Orange'**
  String get light_color_orange;

  /// Yellow color preset label
  ///
  /// In en, this message translates to:
  /// **'Yellow'**
  String get light_color_yellow;

  /// Green color preset label
  ///
  /// In en, this message translates to:
  /// **'Green'**
  String get light_color_green;

  /// Cyan color preset label
  ///
  /// In en, this message translates to:
  /// **'Cyan'**
  String get light_color_cyan;

  /// Blue color preset label
  ///
  /// In en, this message translates to:
  /// **'Blue'**
  String get light_color_blue;

  /// Purple color preset label
  ///
  /// In en, this message translates to:
  /// **'Purple'**
  String get light_color_purple;

  /// Pink color preset label
  ///
  /// In en, this message translates to:
  /// **'Pink'**
  String get light_color_pink;
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
