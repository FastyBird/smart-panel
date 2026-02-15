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

  /// Label for retry button
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get action_retry;

  /// Error message when domain data fails to load
  ///
  /// In en, this message translates to:
  /// **'Failed to load {domain}'**
  String domain_data_load_failed(String domain);

  /// Description for domain data load failure
  ///
  /// In en, this message translates to:
  /// **'Unable to retrieve data. Please check your connection and try again.'**
  String get domain_data_load_failed_description;

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

  /// Title shown on device offline overlay
  ///
  /// In en, this message translates to:
  /// **'Device Offline'**
  String get device_offline_title;

  /// Description shown on device offline overlay
  ///
  /// In en, this message translates to:
  /// **'Unable to communicate with this device. Check if the device is powered on and connected to your network.'**
  String get device_offline_description;

  /// Button label to retry connection to offline device
  ///
  /// In en, this message translates to:
  /// **'Retry Connection'**
  String get device_offline_retry;

  /// Shows when device was last online
  ///
  /// In en, this message translates to:
  /// **'Last seen {time}'**
  String device_offline_last_seen(String time);

  /// Message shown when devices are skipped due to being offline
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Skipped 1 offline device} other{Skipped {count} offline devices}}'**
  String devices_offline_skipped(int count);

  /// Message shown when all targeted devices are offline
  ///
  /// In en, this message translates to:
  /// **'All devices are offline'**
  String get all_devices_offline;

  /// Time ago label for less than a minute
  ///
  /// In en, this message translates to:
  /// **'just now'**
  String get time_ago_just_now;

  /// Time ago label for minutes
  ///
  /// In en, this message translates to:
  /// **'{count} min ago'**
  String time_ago_minutes(int count);

  /// Time ago label for hours
  ///
  /// In en, this message translates to:
  /// **'{count} h ago'**
  String time_ago_hours(int count);

  /// Time ago label for days
  ///
  /// In en, this message translates to:
  /// **'{count} d ago'**
  String time_ago_days(int count);

  /// Medium time ago label for minutes
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 minute ago} other{{count} minutes ago}}'**
  String time_ago_medium_minutes(int count);

  /// Medium time ago label for hours
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 hour ago} other{{count} hours ago}}'**
  String time_ago_medium_hours(int count);

  /// Medium time ago label for days
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 day ago} other{{count} days ago}}'**
  String time_ago_medium_days(int count);

  /// Full time ago label for minutes (same as medium, no sub-unit)
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 minute ago} other{{count} minutes ago}}'**
  String time_ago_full_minutes(int count);

  /// Full time ago label for hours and minutes
  ///
  /// In en, this message translates to:
  /// **'{hours, plural, =1{1 hour} other{{hours} hours}} {minutes, plural, =1{1 minute} other{{minutes} minutes}} ago'**
  String time_ago_full_hours_minutes(int hours, int minutes);

  /// Full time ago label for hours only (no remaining minutes)
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 hour ago} other{{count} hours ago}}'**
  String time_ago_full_hours(int count);

  /// Full time ago label for days and hours
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =1{1 day} other{{days} days}} {hours, plural, =1{1 hour} other{{hours} hours}} ago'**
  String time_ago_full_days_hours(int days, int hours);

  /// Full time ago label for days only (no remaining hours)
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 day ago} other{{count} days ago}}'**
  String time_ago_full_days(int count);

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

  /// Title for the average power draw over last reporting interval
  ///
  /// In en, this message translates to:
  /// **'Average Power'**
  String get electrical_energy_average_power_title;

  /// Detailed description of average power measurement in watts
  ///
  /// In en, this message translates to:
  /// **'Average power draw over the last reporting interval'**
  String get electrical_energy_average_power_description;

  /// Title for cumulative PV energy production
  ///
  /// In en, this message translates to:
  /// **'Energy Production'**
  String get electrical_generation_production_title;

  /// Detailed description of cumulative energy production measurement
  ///
  /// In en, this message translates to:
  /// **'Total energy produced by the generation source'**
  String get electrical_generation_production_description;

  /// Title for instantaneous generation power output
  ///
  /// In en, this message translates to:
  /// **'Generation Power'**
  String get electrical_generation_power_title;

  /// Detailed description of instantaneous generation power output in watts
  ///
  /// In en, this message translates to:
  /// **'Current power output from the generation source'**
  String get electrical_generation_power_description;

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

  /// Status label on the 'more' tile when scenes overflow the grid in landscape
  ///
  /// In en, this message translates to:
  /// **'More scenes'**
  String get lights_more_scenes;

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

  /// Label for the target temperature in the climate hero card
  ///
  /// In en, this message translates to:
  /// **'Target'**
  String get thermostat_target_label;

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

  /// Label for rescan button in discovery screen
  ///
  /// In en, this message translates to:
  /// **'Rescan'**
  String get discovery_button_rescan;

  /// Rescan button text
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get discovery_button_try_again;

  /// Manual entry button text
  ///
  /// In en, this message translates to:
  /// **'Enter Manually'**
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

  /// First part of hint text explaining how to fix configuration error
  ///
  /// In en, this message translates to:
  /// **'Configure this display in'**
  String get config_error_hint_prefix;

  /// Path part of hint text (Admin > Displays)
  ///
  /// In en, this message translates to:
  /// **'Admin > Displays'**
  String get config_error_hint_path;

  /// Title shown when connection to gateway is lost
  ///
  /// In en, this message translates to:
  /// **'Connection Lost'**
  String get connection_lost_title;

  /// Message explaining the connection lost error
  ///
  /// In en, this message translates to:
  /// **'Unable to connect to the gateway. Please check your network connection and try again.'**
  String get connection_lost_message;

  /// Button label to attempt reconnection
  ///
  /// In en, this message translates to:
  /// **'Reconnect'**
  String get connection_lost_button_reconnect;

  /// Button label to select a different gateway
  ///
  /// In en, this message translates to:
  /// **'Change Gateway'**
  String get connection_lost_button_change_gateway;

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

  /// Label for the more/dashboard pages button in deck navigation
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get deck_nav_more;

  /// Title for the more sheet listing all navigable pages
  ///
  /// In en, this message translates to:
  /// **'All Pages'**
  String get deck_all_pages;

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

  /// Title shown when space has no media-capable devices
  ///
  /// In en, this message translates to:
  /// **'No Media Devices'**
  String get media_no_endpoints_title;

  /// Description shown when space has no media-capable devices
  ///
  /// In en, this message translates to:
  /// **'This room has no media-capable devices. Add a TV, speaker, or streamer to get started.'**
  String get media_no_endpoints_description;

  /// Description shown when endpoints exist but no bindings are configured yet
  ///
  /// In en, this message translates to:
  /// **'Media activities are being configured. Pull to refresh.'**
  String get media_no_bindings_description;

  /// Title shown when WebSocket connection is unavailable
  ///
  /// In en, this message translates to:
  /// **'Connection Lost'**
  String get media_ws_offline_title;

  /// Description shown when WebSocket connection is unavailable
  ///
  /// In en, this message translates to:
  /// **'Media controls require a live connection. Reconnecting...'**
  String get media_ws_offline_description;

  /// Title for sensors domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Sensors'**
  String get domain_sensors;

  /// Title for energy domain view in room navigation
  ///
  /// In en, this message translates to:
  /// **'Energy'**
  String get domain_energy;

  /// Label for energy consumption
  ///
  /// In en, this message translates to:
  /// **'Consumption'**
  String get energy_consumption;

  /// Label for energy production
  ///
  /// In en, this message translates to:
  /// **'Production'**
  String get energy_production;

  /// Label for net energy (consumption minus production)
  ///
  /// In en, this message translates to:
  /// **'Net'**
  String get energy_net;

  /// Label for today energy range
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get energy_range_today;

  /// Label for week energy range
  ///
  /// In en, this message translates to:
  /// **'Week'**
  String get energy_range_week;

  /// Label for month energy range
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get energy_range_month;

  /// Section title for top energy consuming devices
  ///
  /// In en, this message translates to:
  /// **'Top Consumers'**
  String get energy_top_consumers;

  /// Section title for energy timeseries chart
  ///
  /// In en, this message translates to:
  /// **'Usage Over Time'**
  String get energy_chart_title;

  /// Section title for energy summary
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get energy_summary_title;

  /// Unit label for kilowatt-hours
  ///
  /// In en, this message translates to:
  /// **'kWh'**
  String get energy_unit_kwh;

  /// Title shown when no energy data is available
  ///
  /// In en, this message translates to:
  /// **'No Energy Data'**
  String get energy_empty_title;

  /// Description shown when no energy data is available
  ///
  /// In en, this message translates to:
  /// **'No energy monitoring devices found in this space'**
  String get energy_empty_description;

  /// Message shown when energy data fetch fails due to network or server error
  ///
  /// In en, this message translates to:
  /// **'Failed to load energy data'**
  String get energy_load_failed;

  /// Count of energy devices
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 device} other{{count} devices}}'**
  String energy_device_count(int count);

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

  /// VOC level - low (short)
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get sensor_enum_voc_level_low;

  /// VOC level - low (long)
  ///
  /// In en, this message translates to:
  /// **'Low VOC'**
  String get sensor_enum_voc_level_low_long;

  /// VOC level - medium (short)
  ///
  /// In en, this message translates to:
  /// **'Med'**
  String get sensor_enum_voc_level_medium;

  /// VOC level - medium (long)
  ///
  /// In en, this message translates to:
  /// **'Medium VOC'**
  String get sensor_enum_voc_level_medium_long;

  /// VOC level - high (short)
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get sensor_enum_voc_level_high;

  /// VOC level - high (long)
  ///
  /// In en, this message translates to:
  /// **'High VOC'**
  String get sensor_enum_voc_level_high_long;

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

  /// Status label on the 'more' tile when sensors overflow the grid
  ///
  /// In en, this message translates to:
  /// **'More sensors'**
  String get climate_more_sensors;

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

  /// Shown when device state does not match any intent
  ///
  /// In en, this message translates to:
  /// **'Custom'**
  String get domain_mode_custom;

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

  /// Banner text shown during reconnection attempts
  ///
  /// In en, this message translates to:
  /// **'Reconnecting...'**
  String get connection_banner_reconnecting;

  /// Retry link text in connection banner
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get connection_banner_retry;

  /// Overlay title during reconnection
  ///
  /// In en, this message translates to:
  /// **'Reconnecting'**
  String get connection_overlay_title_reconnecting;

  /// Overlay message during reconnection
  ///
  /// In en, this message translates to:
  /// **'Attempting to reconnect...'**
  String get connection_overlay_message_reconnecting;

  /// Overlay message during prolonged reconnection
  ///
  /// In en, this message translates to:
  /// **'Still trying to reconnect...'**
  String get connection_overlay_message_still_trying;

  /// Retry button text in overlay
  ///
  /// In en, this message translates to:
  /// **'Retry Now'**
  String get connection_overlay_retry;

  /// Retry button text while attempting reconnection
  ///
  /// In en, this message translates to:
  /// **'Retrying...'**
  String get connection_overlay_retrying;

  /// Toast message shown when connection is restored
  ///
  /// In en, this message translates to:
  /// **'Connected'**
  String get connection_recovery_connected;

  /// Title for authentication error screen
  ///
  /// In en, this message translates to:
  /// **'Session Expired'**
  String get connection_auth_error_title;

  /// Message for authentication error screen
  ///
  /// In en, this message translates to:
  /// **'Your session has expired or was revoked. Please reset the device to reconnect.'**
  String get connection_auth_error_message;

  /// Reset device button text
  ///
  /// In en, this message translates to:
  /// **'Reset Device'**
  String get connection_auth_error_button_reset;

  /// Title for network error screen
  ///
  /// In en, this message translates to:
  /// **'Network Unavailable'**
  String get connection_network_error_title;

  /// Message for network error screen
  ///
  /// In en, this message translates to:
  /// **'Unable to reach the server. Please check your network connection.'**
  String get connection_network_error_message;

  /// Retry button text on network error screen
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get connection_network_error_button_retry;

  /// Title for server error screen
  ///
  /// In en, this message translates to:
  /// **'Server Unavailable'**
  String get connection_server_error_title;

  /// Message for server error screen
  ///
  /// In en, this message translates to:
  /// **'The server is temporarily unavailable. Please try again later.'**
  String get connection_server_error_message;

  /// Retry button text on server error screen
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get connection_server_error_button_retry;

  /// No description provided for @sensor_enum_illuminance_bright.
  ///
  /// In en, this message translates to:
  /// **'Bright'**
  String get sensor_enum_illuminance_bright;

  /// No description provided for @sensor_enum_illuminance_bright_long.
  ///
  /// In en, this message translates to:
  /// **'Bright'**
  String get sensor_enum_illuminance_bright_long;

  /// No description provided for @sensor_enum_illuminance_moderate.
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get sensor_enum_illuminance_moderate;

  /// No description provided for @sensor_enum_illuminance_moderate_long.
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get sensor_enum_illuminance_moderate_long;

  /// No description provided for @sensor_enum_illuminance_dusky.
  ///
  /// In en, this message translates to:
  /// **'Dusky'**
  String get sensor_enum_illuminance_dusky;

  /// No description provided for @sensor_enum_illuminance_dusky_long.
  ///
  /// In en, this message translates to:
  /// **'Dusky'**
  String get sensor_enum_illuminance_dusky_long;

  /// No description provided for @sensor_enum_illuminance_dark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get sensor_enum_illuminance_dark;

  /// No description provided for @sensor_enum_illuminance_dark_long.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get sensor_enum_illuminance_dark_long;

  /// No description provided for @sensor_enum_gas_status_normal.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get sensor_enum_gas_status_normal;

  /// No description provided for @sensor_enum_gas_status_normal_long.
  ///
  /// In en, this message translates to:
  /// **'Normal'**
  String get sensor_enum_gas_status_normal_long;

  /// No description provided for @sensor_enum_gas_status_warning.
  ///
  /// In en, this message translates to:
  /// **'Warn'**
  String get sensor_enum_gas_status_warning;

  /// No description provided for @sensor_enum_gas_status_warning_long.
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get sensor_enum_gas_status_warning_long;

  /// No description provided for @sensor_enum_gas_status_alarm.
  ///
  /// In en, this message translates to:
  /// **'Alarm'**
  String get sensor_enum_gas_status_alarm;

  /// No description provided for @sensor_enum_gas_status_alarm_long.
  ///
  /// In en, this message translates to:
  /// **'Gas Alarm'**
  String get sensor_enum_gas_status_alarm_long;

  /// No description provided for @sensor_enum_leak_level_low.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get sensor_enum_leak_level_low;

  /// No description provided for @sensor_enum_leak_level_low_long.
  ///
  /// In en, this message translates to:
  /// **'Low Leak'**
  String get sensor_enum_leak_level_low_long;

  /// No description provided for @sensor_enum_leak_level_medium.
  ///
  /// In en, this message translates to:
  /// **'Med'**
  String get sensor_enum_leak_level_medium;

  /// No description provided for @sensor_enum_leak_level_medium_long.
  ///
  /// In en, this message translates to:
  /// **'Medium Leak'**
  String get sensor_enum_leak_level_medium_long;

  /// No description provided for @sensor_enum_leak_level_high.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get sensor_enum_leak_level_high;

  /// No description provided for @sensor_enum_leak_level_high_long.
  ///
  /// In en, this message translates to:
  /// **'Severe Leak'**
  String get sensor_enum_leak_level_high_long;

  /// No description provided for @sensor_enum_battery_level_critical.
  ///
  /// In en, this message translates to:
  /// **'Crit'**
  String get sensor_enum_battery_level_critical;

  /// No description provided for @sensor_enum_battery_level_critical_long.
  ///
  /// In en, this message translates to:
  /// **'Critical'**
  String get sensor_enum_battery_level_critical_long;

  /// No description provided for @sensor_enum_battery_level_low.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get sensor_enum_battery_level_low;

  /// No description provided for @sensor_enum_battery_level_low_long.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get sensor_enum_battery_level_low_long;

  /// No description provided for @sensor_enum_battery_level_medium.
  ///
  /// In en, this message translates to:
  /// **'Med'**
  String get sensor_enum_battery_level_medium;

  /// No description provided for @sensor_enum_battery_level_medium_long.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get sensor_enum_battery_level_medium_long;

  /// No description provided for @sensor_enum_battery_level_high.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get sensor_enum_battery_level_high;

  /// No description provided for @sensor_enum_battery_level_high_long.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get sensor_enum_battery_level_high_long;

  /// No description provided for @sensor_enum_battery_level_full.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get sensor_enum_battery_level_full;

  /// No description provided for @sensor_enum_battery_level_full_long.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get sensor_enum_battery_level_full_long;

  /// No description provided for @sensor_enum_battery_status_ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get sensor_enum_battery_status_ok;

  /// No description provided for @sensor_enum_battery_status_ok_long.
  ///
  /// In en, this message translates to:
  /// **'Battery OK'**
  String get sensor_enum_battery_status_ok_long;

  /// No description provided for @sensor_enum_battery_status_low.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get sensor_enum_battery_status_low;

  /// No description provided for @sensor_enum_battery_status_low_long.
  ///
  /// In en, this message translates to:
  /// **'Low Battery'**
  String get sensor_enum_battery_status_low_long;

  /// No description provided for @sensor_enum_battery_status_charging.
  ///
  /// In en, this message translates to:
  /// **'Chrg'**
  String get sensor_enum_battery_status_charging;

  /// No description provided for @sensor_enum_battery_status_charging_long.
  ///
  /// In en, this message translates to:
  /// **'Charging'**
  String get sensor_enum_battery_status_charging_long;

  /// No description provided for @sensor_enum_alarm_alarm_idle.
  ///
  /// In en, this message translates to:
  /// **'Idle'**
  String get sensor_enum_alarm_alarm_idle;

  /// No description provided for @sensor_enum_alarm_alarm_idle_long.
  ///
  /// In en, this message translates to:
  /// **'Alarm Idle'**
  String get sensor_enum_alarm_alarm_idle_long;

  /// No description provided for @sensor_enum_alarm_alarm_pending.
  ///
  /// In en, this message translates to:
  /// **'Pend'**
  String get sensor_enum_alarm_alarm_pending;

  /// No description provided for @sensor_enum_alarm_alarm_pending_long.
  ///
  /// In en, this message translates to:
  /// **'Alarm Pending'**
  String get sensor_enum_alarm_alarm_pending_long;

  /// No description provided for @sensor_enum_alarm_alarm_triggered.
  ///
  /// In en, this message translates to:
  /// **'Trig'**
  String get sensor_enum_alarm_alarm_triggered;

  /// No description provided for @sensor_enum_alarm_alarm_triggered_long.
  ///
  /// In en, this message translates to:
  /// **'Alarm Triggered'**
  String get sensor_enum_alarm_alarm_triggered_long;

  /// No description provided for @sensor_enum_alarm_alarm_silenced.
  ///
  /// In en, this message translates to:
  /// **'Muted'**
  String get sensor_enum_alarm_alarm_silenced;

  /// No description provided for @sensor_enum_alarm_alarm_silenced_long.
  ///
  /// In en, this message translates to:
  /// **'Alarm Silenced'**
  String get sensor_enum_alarm_alarm_silenced_long;

  /// No description provided for @sensor_enum_alarm_disarmed.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get sensor_enum_alarm_disarmed;

  /// No description provided for @sensor_enum_alarm_disarmed_long.
  ///
  /// In en, this message translates to:
  /// **'Disarmed'**
  String get sensor_enum_alarm_disarmed_long;

  /// No description provided for @sensor_enum_alarm_armed_home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get sensor_enum_alarm_armed_home;

  /// No description provided for @sensor_enum_alarm_armed_home_long.
  ///
  /// In en, this message translates to:
  /// **'Armed Home'**
  String get sensor_enum_alarm_armed_home_long;

  /// No description provided for @sensor_enum_alarm_armed_away.
  ///
  /// In en, this message translates to:
  /// **'Away'**
  String get sensor_enum_alarm_armed_away;

  /// No description provided for @sensor_enum_alarm_armed_away_long.
  ///
  /// In en, this message translates to:
  /// **'Armed Away'**
  String get sensor_enum_alarm_armed_away_long;

  /// No description provided for @sensor_enum_alarm_armed_night.
  ///
  /// In en, this message translates to:
  /// **'Night'**
  String get sensor_enum_alarm_armed_night;

  /// No description provided for @sensor_enum_alarm_armed_night_long.
  ///
  /// In en, this message translates to:
  /// **'Armed Night'**
  String get sensor_enum_alarm_armed_night_long;

  /// No description provided for @sensor_enum_filter_good.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get sensor_enum_filter_good;

  /// No description provided for @sensor_enum_filter_good_long.
  ///
  /// In en, this message translates to:
  /// **'Filter Good'**
  String get sensor_enum_filter_good_long;

  /// No description provided for @sensor_enum_filter_replace_soon.
  ///
  /// In en, this message translates to:
  /// **'Soon'**
  String get sensor_enum_filter_replace_soon;

  /// No description provided for @sensor_enum_filter_replace_soon_long.
  ///
  /// In en, this message translates to:
  /// **'Replace Soon'**
  String get sensor_enum_filter_replace_soon_long;

  /// No description provided for @sensor_enum_filter_replace_now.
  ///
  /// In en, this message translates to:
  /// **'Now!'**
  String get sensor_enum_filter_replace_now;

  /// No description provided for @sensor_enum_filter_replace_now_long.
  ///
  /// In en, this message translates to:
  /// **'Replace Now'**
  String get sensor_enum_filter_replace_now_long;

  /// No description provided for @sensor_enum_door_opened.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get sensor_enum_door_opened;

  /// No description provided for @sensor_enum_door_opened_long.
  ///
  /// In en, this message translates to:
  /// **'Door Opened'**
  String get sensor_enum_door_opened_long;

  /// No description provided for @sensor_enum_door_closed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get sensor_enum_door_closed;

  /// No description provided for @sensor_enum_door_closed_long.
  ///
  /// In en, this message translates to:
  /// **'Door Closed'**
  String get sensor_enum_door_closed_long;

  /// No description provided for @sensor_enum_door_opening.
  ///
  /// In en, this message translates to:
  /// **'Opening'**
  String get sensor_enum_door_opening;

  /// No description provided for @sensor_enum_door_opening_long.
  ///
  /// In en, this message translates to:
  /// **'Door Opening'**
  String get sensor_enum_door_opening_long;

  /// No description provided for @sensor_enum_door_closing.
  ///
  /// In en, this message translates to:
  /// **'Closing'**
  String get sensor_enum_door_closing;

  /// No description provided for @sensor_enum_door_closing_long.
  ///
  /// In en, this message translates to:
  /// **'Door Closing'**
  String get sensor_enum_door_closing_long;

  /// No description provided for @sensor_enum_door_stopped.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get sensor_enum_door_stopped;

  /// No description provided for @sensor_enum_door_stopped_long.
  ///
  /// In en, this message translates to:
  /// **'Door Stopped'**
  String get sensor_enum_door_stopped_long;

  /// No description provided for @sensor_enum_lock_locked.
  ///
  /// In en, this message translates to:
  /// **'Locked'**
  String get sensor_enum_lock_locked;

  /// No description provided for @sensor_enum_lock_locked_long.
  ///
  /// In en, this message translates to:
  /// **'Lock Locked'**
  String get sensor_enum_lock_locked_long;

  /// No description provided for @sensor_enum_lock_unlocked.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get sensor_enum_lock_unlocked;

  /// No description provided for @sensor_enum_lock_unlocked_long.
  ///
  /// In en, this message translates to:
  /// **'Lock Unlocked'**
  String get sensor_enum_lock_unlocked_long;

  /// No description provided for @sensor_enum_camera_available.
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get sensor_enum_camera_available;

  /// No description provided for @sensor_enum_camera_available_long.
  ///
  /// In en, this message translates to:
  /// **'Camera Available'**
  String get sensor_enum_camera_available_long;

  /// No description provided for @sensor_enum_camera_in_use.
  ///
  /// In en, this message translates to:
  /// **'In Use'**
  String get sensor_enum_camera_in_use;

  /// No description provided for @sensor_enum_camera_in_use_long.
  ///
  /// In en, this message translates to:
  /// **'Camera In Use'**
  String get sensor_enum_camera_in_use_long;

  /// No description provided for @sensor_enum_camera_unavailable.
  ///
  /// In en, this message translates to:
  /// **'N/A'**
  String get sensor_enum_camera_unavailable;

  /// No description provided for @sensor_enum_camera_unavailable_long.
  ///
  /// In en, this message translates to:
  /// **'Camera Unavailable'**
  String get sensor_enum_camera_unavailable_long;

  /// No description provided for @sensor_enum_camera_offline.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get sensor_enum_camera_offline;

  /// No description provided for @sensor_enum_camera_offline_long.
  ///
  /// In en, this message translates to:
  /// **'Camera Offline'**
  String get sensor_enum_camera_offline_long;

  /// No description provided for @sensor_enum_camera_initializing.
  ///
  /// In en, this message translates to:
  /// **'Init'**
  String get sensor_enum_camera_initializing;

  /// No description provided for @sensor_enum_camera_initializing_long.
  ///
  /// In en, this message translates to:
  /// **'Camera Initializing'**
  String get sensor_enum_camera_initializing_long;

  /// No description provided for @sensor_enum_camera_error.
  ///
  /// In en, this message translates to:
  /// **'Err'**
  String get sensor_enum_camera_error;

  /// No description provided for @sensor_enum_camera_error_long.
  ///
  /// In en, this message translates to:
  /// **'Camera Error'**
  String get sensor_enum_camera_error_long;

  /// No description provided for @sensor_enum_device_info_connected.
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get sensor_enum_device_info_connected;

  /// No description provided for @sensor_enum_device_info_connected_long.
  ///
  /// In en, this message translates to:
  /// **'Connected'**
  String get sensor_enum_device_info_connected_long;

  /// No description provided for @sensor_enum_device_info_disconnected.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get sensor_enum_device_info_disconnected;

  /// No description provided for @sensor_enum_device_info_disconnected_long.
  ///
  /// In en, this message translates to:
  /// **'Disconnected'**
  String get sensor_enum_device_info_disconnected_long;

  /// No description provided for @sensor_enum_device_info_init.
  ///
  /// In en, this message translates to:
  /// **'Init'**
  String get sensor_enum_device_info_init;

  /// No description provided for @sensor_enum_device_info_init_long.
  ///
  /// In en, this message translates to:
  /// **'Initializing'**
  String get sensor_enum_device_info_init_long;

  /// No description provided for @sensor_enum_device_info_ready.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get sensor_enum_device_info_ready;

  /// No description provided for @sensor_enum_device_info_ready_long.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get sensor_enum_device_info_ready_long;

  /// No description provided for @sensor_enum_device_info_running.
  ///
  /// In en, this message translates to:
  /// **'Run'**
  String get sensor_enum_device_info_running;

  /// No description provided for @sensor_enum_device_info_running_long.
  ///
  /// In en, this message translates to:
  /// **'Running'**
  String get sensor_enum_device_info_running_long;

  /// No description provided for @sensor_enum_device_info_sleeping.
  ///
  /// In en, this message translates to:
  /// **'Sleep'**
  String get sensor_enum_device_info_sleeping;

  /// No description provided for @sensor_enum_device_info_sleeping_long.
  ///
  /// In en, this message translates to:
  /// **'Sleeping'**
  String get sensor_enum_device_info_sleeping_long;

  /// No description provided for @sensor_enum_device_info_stopped.
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get sensor_enum_device_info_stopped;

  /// No description provided for @sensor_enum_device_info_stopped_long.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get sensor_enum_device_info_stopped_long;

  /// No description provided for @sensor_enum_device_info_lost.
  ///
  /// In en, this message translates to:
  /// **'Lost'**
  String get sensor_enum_device_info_lost;

  /// No description provided for @sensor_enum_device_info_lost_long.
  ///
  /// In en, this message translates to:
  /// **'Connection Lost'**
  String get sensor_enum_device_info_lost_long;

  /// No description provided for @sensor_enum_device_info_alert.
  ///
  /// In en, this message translates to:
  /// **'Alert'**
  String get sensor_enum_device_info_alert;

  /// No description provided for @sensor_enum_device_info_alert_long.
  ///
  /// In en, this message translates to:
  /// **'Alert'**
  String get sensor_enum_device_info_alert_long;

  /// No description provided for @sensor_enum_device_info_unknown.
  ///
  /// In en, this message translates to:
  /// **'N/A'**
  String get sensor_enum_device_info_unknown;

  /// No description provided for @sensor_enum_device_info_unknown_long.
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get sensor_enum_device_info_unknown_long;

  /// Label shown when sensor data is fresh/live
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get sensor_freshness_live;

  /// Label prefix shown when sensor data is stale
  ///
  /// In en, this message translates to:
  /// **'Stale'**
  String get sensor_freshness_stale;

  /// Label shown when sensor device is offline
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get sensor_freshness_offline;

  /// Label for HDMI 1 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 1'**
  String get media_input_hdmi1;

  /// Label for HDMI 2 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 2'**
  String get media_input_hdmi2;

  /// Label for HDMI 3 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 3'**
  String get media_input_hdmi3;

  /// Label for HDMI 4 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 4'**
  String get media_input_hdmi4;

  /// Label for HDMI 5 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 5'**
  String get media_input_hdmi5;

  /// Label for HDMI 6 input source
  ///
  /// In en, this message translates to:
  /// **'HDMI 6'**
  String get media_input_hdmi6;

  /// Label for ARC (Audio Return Channel) input source
  ///
  /// In en, this message translates to:
  /// **'ARC'**
  String get media_input_arc;

  /// Label for eARC (Enhanced Audio Return Channel) input source
  ///
  /// In en, this message translates to:
  /// **'eARC'**
  String get media_input_earc;

  /// Label for TV tuner input source
  ///
  /// In en, this message translates to:
  /// **'TV'**
  String get media_input_tv;

  /// Label for cable TV input source
  ///
  /// In en, this message translates to:
  /// **'Cable'**
  String get media_input_cable;

  /// Label for satellite TV input source
  ///
  /// In en, this message translates to:
  /// **'Satellite'**
  String get media_input_satellite;

  /// Label for antenna/OTA input source
  ///
  /// In en, this message translates to:
  /// **'Antenna'**
  String get media_input_antenna;

  /// Label for AV 1 (composite) input source
  ///
  /// In en, this message translates to:
  /// **'AV 1'**
  String get media_input_av1;

  /// Label for AV 2 (composite) input source
  ///
  /// In en, this message translates to:
  /// **'AV 2'**
  String get media_input_av2;

  /// Label for component video input source
  ///
  /// In en, this message translates to:
  /// **'Component'**
  String get media_input_component;

  /// Label for VGA input source
  ///
  /// In en, this message translates to:
  /// **'VGA'**
  String get media_input_vga;

  /// Label for DVI input source
  ///
  /// In en, this message translates to:
  /// **'DVI'**
  String get media_input_dvi;

  /// Label for USB input source
  ///
  /// In en, this message translates to:
  /// **'USB'**
  String get media_input_usb;

  /// Label for Bluetooth input source
  ///
  /// In en, this message translates to:
  /// **'Bluetooth'**
  String get media_input_bluetooth;

  /// Label for Wi-Fi input source
  ///
  /// In en, this message translates to:
  /// **'Wi-Fi'**
  String get media_input_wifi;

  /// Label for Apple AirPlay input source
  ///
  /// In en, this message translates to:
  /// **'AirPlay'**
  String get media_input_airplay;

  /// Label for Google Cast input source
  ///
  /// In en, this message translates to:
  /// **'Chromecast'**
  String get media_input_cast;

  /// Label for DLNA input source
  ///
  /// In en, this message translates to:
  /// **'DLNA'**
  String get media_input_dlna;

  /// Label for Miracast input source
  ///
  /// In en, this message translates to:
  /// **'Miracast'**
  String get media_input_miracast;

  /// Label for Netflix app input source
  ///
  /// In en, this message translates to:
  /// **'Netflix'**
  String get media_input_app_netflix;

  /// Label for YouTube app input source
  ///
  /// In en, this message translates to:
  /// **'YouTube'**
  String get media_input_app_youtube;

  /// Label for Spotify app input source
  ///
  /// In en, this message translates to:
  /// **'Spotify'**
  String get media_input_app_spotify;

  /// Label for Amazon Prime Video app input source
  ///
  /// In en, this message translates to:
  /// **'Prime Video'**
  String get media_input_app_prime_video;

  /// Label for Disney+ app input source
  ///
  /// In en, this message translates to:
  /// **'Disney+'**
  String get media_input_app_disney_plus;

  /// Label for HBO Max app input source
  ///
  /// In en, this message translates to:
  /// **'HBO Max'**
  String get media_input_app_hbo_max;

  /// Label for Apple TV app input source
  ///
  /// In en, this message translates to:
  /// **'Apple TV'**
  String get media_input_app_apple_tv;

  /// Label for Plex app input source
  ///
  /// In en, this message translates to:
  /// **'Plex'**
  String get media_input_app_plex;

  /// Label for Kodi app input source
  ///
  /// In en, this message translates to:
  /// **'Kodi'**
  String get media_input_app_kodi;

  /// Label for unknown/other input source
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get media_input_other;

  /// Title when media is in off state
  ///
  /// In en, this message translates to:
  /// **'Media Off'**
  String get media_off_title;

  /// Subtitle shown when media is off
  ///
  /// In en, this message translates to:
  /// **'Select an activity to begin'**
  String get media_off_subtitle;

  /// Shown when an activity is being activated
  ///
  /// In en, this message translates to:
  /// **'Starting {activityName}...'**
  String media_starting_activity(String activityName);

  /// Shown when an activity failed to apply
  ///
  /// In en, this message translates to:
  /// **'{activityName} Failed'**
  String media_activity_failed(String activityName);

  /// Description when activity fails
  ///
  /// In en, this message translates to:
  /// **'Activity failed to apply. Check device connectivity.'**
  String get media_activity_failed_description;

  /// Retry button label
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get media_activity_retry;

  /// Turn off button label
  ///
  /// In en, this message translates to:
  /// **'Turn Off'**
  String get media_activity_turn_off;

  /// Warning when audio output device is offline
  ///
  /// In en, this message translates to:
  /// **'Audio output offline – using display speakers'**
  String get media_warning_audio_offline;

  /// Warning when some devices are offline
  ///
  /// In en, this message translates to:
  /// **'Some devices offline'**
  String get media_warning_some_devices_offline;

  /// Warning about failed activation steps
  ///
  /// In en, this message translates to:
  /// **'Some steps failed ({count} {count, plural, =1{warning} other{warnings}})'**
  String media_warning_steps_failed(int count);

  /// Generic warning about step issues
  ///
  /// In en, this message translates to:
  /// **'Some steps had issues'**
  String get media_warning_steps_had_issues;

  /// Remote label for device detail card
  ///
  /// In en, this message translates to:
  /// **'Remote'**
  String get media_remote;

  /// Remote control button and sheet title
  ///
  /// In en, this message translates to:
  /// **'Remote Control'**
  String get media_remote_control;

  /// Volume percentage display
  ///
  /// In en, this message translates to:
  /// **'{volume}%'**
  String media_volume_percent(int volume);

  /// Title of the failure details bottom sheet
  ///
  /// In en, this message translates to:
  /// **'Activation Details'**
  String get media_failure_details_title;

  /// Label for total steps count
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get media_failure_summary_total;

  /// Label for successful steps count
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get media_failure_summary_ok;

  /// Label for error count
  ///
  /// In en, this message translates to:
  /// **'Errors'**
  String get media_failure_summary_errors;

  /// Label for warning count
  ///
  /// In en, this message translates to:
  /// **'Warnings'**
  String get media_failure_summary_warnings;

  /// Section heading for critical errors
  ///
  /// In en, this message translates to:
  /// **'Errors (critical)'**
  String get media_failure_errors_critical;

  /// Section heading for non-critical warnings
  ///
  /// In en, this message translates to:
  /// **'Warnings (non-critical)'**
  String get media_failure_warnings_non_critical;

  /// Section heading for legacy warnings
  ///
  /// In en, this message translates to:
  /// **'Warnings'**
  String get media_failure_warnings_label;

  /// Button to retry the failed activity
  ///
  /// In en, this message translates to:
  /// **'Retry activity'**
  String get media_failure_retry_activity;

  /// Button to deactivate the activity
  ///
  /// In en, this message translates to:
  /// **'Deactivate'**
  String get media_failure_deactivate;

  /// Device ID label in failure details
  ///
  /// In en, this message translates to:
  /// **'Device: {deviceId}'**
  String media_failure_device_label(String deviceId);

  /// Inline failure summary
  ///
  /// In en, this message translates to:
  /// **'Activity failed to apply ({errors} {errors, plural, =1{error} other{errors}}, {warnings} {warnings, plural, =1{warning} other{warnings}})'**
  String media_failure_inline(int errors, int warnings);

  /// Watch activity label
  ///
  /// In en, this message translates to:
  /// **'Watch'**
  String get media_activity_watch;

  /// Listen activity label
  ///
  /// In en, this message translates to:
  /// **'Listen'**
  String get media_activity_listen;

  /// Gaming activity label
  ///
  /// In en, this message translates to:
  /// **'Gaming'**
  String get media_activity_gaming;

  /// Background activity label
  ///
  /// In en, this message translates to:
  /// **'Bgnd'**
  String get media_activity_background;

  /// Off activity label
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get media_activity_off;

  /// Header subtitle when activity is active
  ///
  /// In en, this message translates to:
  /// **'{activityName} active'**
  String media_activity_active(String activityName);

  /// Device status: standby
  ///
  /// In en, this message translates to:
  /// **'Standby'**
  String get media_status_standby;

  /// Device status: activating
  ///
  /// In en, this message translates to:
  /// **'Activating...'**
  String get media_status_activating;

  /// Device status: failed
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get media_status_failed;

  /// Device status: stopping
  ///
  /// In en, this message translates to:
  /// **'Stopping...'**
  String get media_status_stopping;

  /// Device status: active with warnings
  ///
  /// In en, this message translates to:
  /// **'Active with issues'**
  String get media_status_active_with_issues;

  /// Device status: active
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get media_status_active;

  /// Device status: ready
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get media_status_ready;

  /// Remote D-pad up label
  ///
  /// In en, this message translates to:
  /// **'Up'**
  String get media_remote_up;

  /// Remote D-pad down label
  ///
  /// In en, this message translates to:
  /// **'Down'**
  String get media_remote_down;

  /// Remote D-pad left label
  ///
  /// In en, this message translates to:
  /// **'Left'**
  String get media_remote_left;

  /// Remote D-pad right label
  ///
  /// In en, this message translates to:
  /// **'Right'**
  String get media_remote_right;

  /// Remote D-pad OK/select label
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get media_remote_ok;

  /// Remote back button label
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get media_remote_back;

  /// Remote exit button label
  ///
  /// In en, this message translates to:
  /// **'Exit'**
  String get media_remote_exit;

  /// Remote info button label
  ///
  /// In en, this message translates to:
  /// **'Info'**
  String get media_remote_info;

  /// Remote rewind button label
  ///
  /// In en, this message translates to:
  /// **'Rewind'**
  String get media_remote_rewind;

  /// Remote fast forward button label
  ///
  /// In en, this message translates to:
  /// **'FF'**
  String get media_remote_fast_forward;

  /// Remote play button label
  ///
  /// In en, this message translates to:
  /// **'Play'**
  String get media_remote_play;

  /// Remote pause button label
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get media_remote_pause;

  /// Remote next button label
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get media_remote_next;

  /// Remote previous button label
  ///
  /// In en, this message translates to:
  /// **'Prev'**
  String get media_remote_prev;

  /// Title when WebSocket connection is lost on detail page
  ///
  /// In en, this message translates to:
  /// **'Connection lost'**
  String get media_detail_connection_lost;

  /// Description when WebSocket connection is lost
  ///
  /// In en, this message translates to:
  /// **'Media controls require a live WebSocket connection.'**
  String get media_detail_connection_lost_description;

  /// Button to go back from device detail
  ///
  /// In en, this message translates to:
  /// **'Go back'**
  String get media_detail_go_back;

  /// Display section title in device detail
  ///
  /// In en, this message translates to:
  /// **'Display'**
  String get media_detail_section_display;

  /// Audio section title in device detail
  ///
  /// In en, this message translates to:
  /// **'Audio'**
  String get media_detail_section_audio;

  /// Source section title in device detail
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get media_detail_section_source;

  /// Remote section title in device detail
  ///
  /// In en, this message translates to:
  /// **'Remote'**
  String get media_detail_section_remote;

  /// Input row label in device detail
  ///
  /// In en, this message translates to:
  /// **'Input'**
  String get media_detail_input;

  /// Select button label in device detail
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get media_detail_select;

  /// Now playing section label
  ///
  /// In en, this message translates to:
  /// **'Now Playing'**
  String get media_detail_now_playing;

  /// Shown when no track metadata is available
  ///
  /// In en, this message translates to:
  /// **'No track information available'**
  String get media_detail_no_track_info;

  /// Home button label on remote
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get media_detail_home;

  /// Menu button label on remote
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get media_detail_menu;

  /// Label for media playback control tile/sheet
  ///
  /// In en, this message translates to:
  /// **'Playback'**
  String get media_playback;

  /// Label for 'All' filter option
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filter_all;

  /// Title for high sensor alert banner
  ///
  /// In en, this message translates to:
  /// **'High {name} Alert'**
  String sensor_alert_high_title(String name);

  /// Description for sensor alert when threshold exceeded
  ///
  /// In en, this message translates to:
  /// **'{name} exceeded threshold'**
  String sensor_alert_exceeded_threshold(String name);

  /// No description provided for @sensor_state_detected.
  ///
  /// In en, this message translates to:
  /// **'Detected'**
  String get sensor_state_detected;

  /// No description provided for @sensor_state_not_detected.
  ///
  /// In en, this message translates to:
  /// **'Not Detected'**
  String get sensor_state_not_detected;

  /// No description provided for @sensor_state_clear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get sensor_state_clear;

  /// No description provided for @sensor_state_open.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get sensor_state_open;

  /// No description provided for @sensor_state_closed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get sensor_state_closed;

  /// No description provided for @sensor_state_active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get sensor_state_active;

  /// No description provided for @sensor_state_inactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get sensor_state_inactive;

  /// No description provided for @sensor_state_occupied.
  ///
  /// In en, this message translates to:
  /// **'Occupied'**
  String get sensor_state_occupied;

  /// No description provided for @sensor_state_unoccupied.
  ///
  /// In en, this message translates to:
  /// **'Unoccupied'**
  String get sensor_state_unoccupied;

  /// No description provided for @sensor_state_smoke_detected.
  ///
  /// In en, this message translates to:
  /// **'Smoke detected'**
  String get sensor_state_smoke_detected;

  /// No description provided for @sensor_state_gas_detected.
  ///
  /// In en, this message translates to:
  /// **'Gas detected'**
  String get sensor_state_gas_detected;

  /// No description provided for @sensor_state_leak_detected.
  ///
  /// In en, this message translates to:
  /// **'Leak detected'**
  String get sensor_state_leak_detected;

  /// No description provided for @sensor_state_co_detected.
  ///
  /// In en, this message translates to:
  /// **'CO detected'**
  String get sensor_state_co_detected;

  /// No description provided for @sensor_label_temperature.
  ///
  /// In en, this message translates to:
  /// **'Temperature'**
  String get sensor_label_temperature;

  /// No description provided for @sensor_label_humidity.
  ///
  /// In en, this message translates to:
  /// **'Humidity'**
  String get sensor_label_humidity;

  /// No description provided for @sensor_label_pressure.
  ///
  /// In en, this message translates to:
  /// **'Pressure'**
  String get sensor_label_pressure;

  /// No description provided for @sensor_label_illuminance.
  ///
  /// In en, this message translates to:
  /// **'Illuminance'**
  String get sensor_label_illuminance;

  /// No description provided for @sensor_label_carbon_dioxide.
  ///
  /// In en, this message translates to:
  /// **'Carbon Dioxide'**
  String get sensor_label_carbon_dioxide;

  /// No description provided for @sensor_label_carbon_monoxide.
  ///
  /// In en, this message translates to:
  /// **'Carbon Monoxide'**
  String get sensor_label_carbon_monoxide;

  /// No description provided for @sensor_label_ozone.
  ///
  /// In en, this message translates to:
  /// **'Ozone'**
  String get sensor_label_ozone;

  /// No description provided for @sensor_label_nitrogen_dioxide.
  ///
  /// In en, this message translates to:
  /// **'Nitrogen Dioxide'**
  String get sensor_label_nitrogen_dioxide;

  /// No description provided for @sensor_label_sulphur_dioxide.
  ///
  /// In en, this message translates to:
  /// **'Sulphur Dioxide'**
  String get sensor_label_sulphur_dioxide;

  /// No description provided for @sensor_label_voc.
  ///
  /// In en, this message translates to:
  /// **'VOC'**
  String get sensor_label_voc;

  /// No description provided for @sensor_label_particulate_matter.
  ///
  /// In en, this message translates to:
  /// **'Particulate Matter'**
  String get sensor_label_particulate_matter;

  /// No description provided for @sensor_label_motion.
  ///
  /// In en, this message translates to:
  /// **'Motion'**
  String get sensor_label_motion;

  /// No description provided for @sensor_label_occupancy.
  ///
  /// In en, this message translates to:
  /// **'Occupancy'**
  String get sensor_label_occupancy;

  /// No description provided for @sensor_label_contact.
  ///
  /// In en, this message translates to:
  /// **'Contact'**
  String get sensor_label_contact;

  /// No description provided for @sensor_label_leak.
  ///
  /// In en, this message translates to:
  /// **'Leak'**
  String get sensor_label_leak;

  /// No description provided for @sensor_label_smoke.
  ///
  /// In en, this message translates to:
  /// **'Smoke'**
  String get sensor_label_smoke;

  /// No description provided for @sensor_label_battery.
  ///
  /// In en, this message translates to:
  /// **'Battery'**
  String get sensor_label_battery;

  /// No description provided for @sensor_label_alarm.
  ///
  /// In en, this message translates to:
  /// **'Alarm'**
  String get sensor_label_alarm;

  /// No description provided for @sensor_label_door.
  ///
  /// In en, this message translates to:
  /// **'Door'**
  String get sensor_label_door;

  /// No description provided for @sensor_label_lock.
  ///
  /// In en, this message translates to:
  /// **'Lock'**
  String get sensor_label_lock;

  /// No description provided for @sensor_label_camera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get sensor_label_camera;

  /// No description provided for @sensor_label_filter.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get sensor_label_filter;

  /// No description provided for @sensor_label_device_info.
  ///
  /// In en, this message translates to:
  /// **'Device Info'**
  String get sensor_label_device_info;

  /// No description provided for @sensor_label_gas.
  ///
  /// In en, this message translates to:
  /// **'Gas'**
  String get sensor_label_gas;

  /// No description provided for @sensor_label_electrical_energy.
  ///
  /// In en, this message translates to:
  /// **'Energy'**
  String get sensor_label_electrical_energy;

  /// No description provided for @sensor_label_electrical_generation.
  ///
  /// In en, this message translates to:
  /// **'Generation'**
  String get sensor_label_electrical_generation;

  /// No description provided for @sensor_label_electrical_power.
  ///
  /// In en, this message translates to:
  /// **'Power'**
  String get sensor_label_electrical_power;

  /// No description provided for @sensor_alert_high_level.
  ///
  /// In en, this message translates to:
  /// **'High Level'**
  String get sensor_alert_high_level;

  /// No description provided for @sensor_alert_low_battery.
  ///
  /// In en, this message translates to:
  /// **'Low Battery'**
  String get sensor_alert_low_battery;

  /// No description provided for @sensor_alert_charging.
  ///
  /// In en, this message translates to:
  /// **'Charging'**
  String get sensor_alert_charging;

  /// No description provided for @sensor_category_temperature.
  ///
  /// In en, this message translates to:
  /// **'Temperature'**
  String get sensor_category_temperature;

  /// No description provided for @sensor_category_humidity.
  ///
  /// In en, this message translates to:
  /// **'Humidity'**
  String get sensor_category_humidity;

  /// No description provided for @sensor_category_air_quality.
  ///
  /// In en, this message translates to:
  /// **'Air Quality'**
  String get sensor_category_air_quality;

  /// No description provided for @sensor_category_motion.
  ///
  /// In en, this message translates to:
  /// **'Motion'**
  String get sensor_category_motion;

  /// No description provided for @sensor_category_safety.
  ///
  /// In en, this message translates to:
  /// **'Safety'**
  String get sensor_category_safety;

  /// No description provided for @sensor_category_light.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get sensor_category_light;

  /// No description provided for @sensor_category_energy.
  ///
  /// In en, this message translates to:
  /// **'Energy'**
  String get sensor_category_energy;

  /// No description provided for @sensor_ui_event_log.
  ///
  /// In en, this message translates to:
  /// **'Event Log'**
  String get sensor_ui_event_log;

  /// No description provided for @sensor_ui_history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get sensor_ui_history;

  /// No description provided for @sensor_ui_current.
  ///
  /// In en, this message translates to:
  /// **'Current'**
  String get sensor_ui_current;

  /// No description provided for @sensor_ui_current_value.
  ///
  /// In en, this message translates to:
  /// **'Current {name}'**
  String sensor_ui_current_value(String name);

  /// No description provided for @sensor_ui_min.
  ///
  /// In en, this message translates to:
  /// **'Min'**
  String get sensor_ui_min;

  /// No description provided for @sensor_ui_max.
  ///
  /// In en, this message translates to:
  /// **'Max'**
  String get sensor_ui_max;

  /// No description provided for @sensor_ui_avg.
  ///
  /// In en, this message translates to:
  /// **'Avg'**
  String get sensor_ui_avg;

  /// No description provided for @sensor_ui_period_min.
  ///
  /// In en, this message translates to:
  /// **'{period} Min'**
  String sensor_ui_period_min(String period);

  /// No description provided for @sensor_ui_period_max.
  ///
  /// In en, this message translates to:
  /// **'{period} Max'**
  String sensor_ui_period_max(String period);

  /// No description provided for @sensor_ui_period_avg.
  ///
  /// In en, this message translates to:
  /// **'{period} Avg'**
  String sensor_ui_period_avg(String period);

  /// No description provided for @sensor_ui_online.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get sensor_ui_online;

  /// No description provided for @sensor_ui_offline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get sensor_ui_offline;

  /// No description provided for @sensor_ui_period_1h.
  ///
  /// In en, this message translates to:
  /// **'1H'**
  String get sensor_ui_period_1h;

  /// No description provided for @sensor_ui_period_24h.
  ///
  /// In en, this message translates to:
  /// **'24H'**
  String get sensor_ui_period_24h;

  /// No description provided for @sensor_ui_period_7d.
  ///
  /// In en, this message translates to:
  /// **'7D'**
  String get sensor_ui_period_7d;

  /// No description provided for @sensor_ui_period_30d.
  ///
  /// In en, this message translates to:
  /// **'30D'**
  String get sensor_ui_period_30d;

  /// No description provided for @sensor_empty_no_events.
  ///
  /// In en, this message translates to:
  /// **'No events recorded'**
  String get sensor_empty_no_events;

  /// No description provided for @sensor_empty_no_state_changes.
  ///
  /// In en, this message translates to:
  /// **'No state changes'**
  String get sensor_empty_no_state_changes;

  /// No description provided for @sensor_empty_no_history.
  ///
  /// In en, this message translates to:
  /// **'No history data available'**
  String get sensor_empty_no_history;

  /// No description provided for @sensor_empty_no_data.
  ///
  /// In en, this message translates to:
  /// **'No data available'**
  String get sensor_empty_no_data;

  /// No description provided for @sensor_status_loading.
  ///
  /// In en, this message translates to:
  /// **'Loading data...'**
  String get sensor_status_loading;

  /// No description provided for @sensor_status_failed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load data'**
  String get sensor_status_failed;

  /// No description provided for @sensor_status_retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get sensor_status_retry;

  /// No description provided for @sensors_domain_title.
  ///
  /// In en, this message translates to:
  /// **'Sensors'**
  String get sensors_domain_title;

  /// No description provided for @sensors_domain_empty_title.
  ///
  /// In en, this message translates to:
  /// **'No Sensors'**
  String get sensors_domain_empty_title;

  /// No description provided for @sensors_domain_empty_description.
  ///
  /// In en, this message translates to:
  /// **'No sensors are assigned to this room yet.'**
  String get sensors_domain_empty_description;

  /// No description provided for @sensors_domain_alerts_active.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Alert Active} other{Alerts Active}}'**
  String sensors_domain_alerts_active(int count);

  /// No description provided for @sensors_domain_no_sensors.
  ///
  /// In en, this message translates to:
  /// **'No sensors configured'**
  String get sensors_domain_no_sensors;

  /// No description provided for @sensors_domain_health_stale.
  ///
  /// In en, this message translates to:
  /// **'{count} stale'**
  String sensors_domain_health_stale(int count);

  /// No description provided for @sensors_domain_health_offline.
  ///
  /// In en, this message translates to:
  /// **'{count} offline'**
  String sensors_domain_health_offline(int count);

  /// No description provided for @sensors_domain_health_normal.
  ///
  /// In en, this message translates to:
  /// **'All normal'**
  String get sensors_domain_health_normal;

  /// No description provided for @sensors_domain_avg_temperature.
  ///
  /// In en, this message translates to:
  /// **'Avg Temperature'**
  String get sensors_domain_avg_temperature;

  /// No description provided for @sensors_domain_avg_humidity.
  ///
  /// In en, this message translates to:
  /// **'Avg Humidity'**
  String get sensors_domain_avg_humidity;

  /// No description provided for @sensors_domain_all_sensors.
  ///
  /// In en, this message translates to:
  /// **'All sensors'**
  String get sensors_domain_all_sensors;

  /// No description provided for @sensors_domain_sensor_count.
  ///
  /// In en, this message translates to:
  /// **'{count} sensors'**
  String sensors_domain_sensor_count(int count);

  /// Tab label for the entry points section on the security screen
  ///
  /// In en, this message translates to:
  /// **'Entry Points'**
  String get security_tab_entry_points;

  /// Tab label for the alerts section on the security screen
  ///
  /// In en, this message translates to:
  /// **'Alerts'**
  String get security_tab_alerts;

  /// Tab label for the events section on the security screen
  ///
  /// In en, this message translates to:
  /// **'Events'**
  String get security_tab_events;

  /// Header title for the recent events card on the security screen
  ///
  /// In en, this message translates to:
  /// **'Recent Events'**
  String get security_header_recent_events;

  /// Status ring label when the alarm is in triggered/critical state
  ///
  /// In en, this message translates to:
  /// **'Triggered'**
  String get security_status_triggered;

  /// Status ring label when there are warning-level alerts
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get security_status_warning;

  /// Status ring label when everything is secure
  ///
  /// In en, this message translates to:
  /// **'Secure'**
  String get security_status_secure;

  /// Armed state label when the system is disarmed
  ///
  /// In en, this message translates to:
  /// **'Disarmed'**
  String get security_armed_disarmed;

  /// Armed state label when the system is armed in home mode
  ///
  /// In en, this message translates to:
  /// **'Armed Home'**
  String get security_armed_home;

  /// Armed state label when the system is armed in away mode
  ///
  /// In en, this message translates to:
  /// **'Armed Away'**
  String get security_armed_away;

  /// Armed state label when the system is armed in night mode
  ///
  /// In en, this message translates to:
  /// **'Armed Night'**
  String get security_armed_night;

  /// Armed state label when the armed state is unknown
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get security_armed_unknown;

  /// Alarm state label when the alarm is idle
  ///
  /// In en, this message translates to:
  /// **'Idle'**
  String get security_alarm_idle;

  /// Alarm state label when the alarm is pending
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get security_alarm_pending;

  /// Alarm state label when the alarm is triggered
  ///
  /// In en, this message translates to:
  /// **'Triggered'**
  String get security_alarm_triggered;

  /// Alarm state label when the alarm is silenced
  ///
  /// In en, this message translates to:
  /// **'Silenced'**
  String get security_alarm_silenced;

  /// Alarm state label when the alarm state is unknown
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get security_alarm_unknown;

  /// Badge label showing how many entry points are open
  ///
  /// In en, this message translates to:
  /// **'{count} Open'**
  String security_entry_open_count(int count);

  /// Badge label when all entry points are secure
  ///
  /// In en, this message translates to:
  /// **'All Secure'**
  String get security_entry_all_secure;

  /// Entry point status when a breach is detected
  ///
  /// In en, this message translates to:
  /// **'Breach'**
  String get security_entry_status_breach;

  /// Entry point status when the entry point is open
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get security_entry_status_open;

  /// Entry point status when the state is unknown
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get security_entry_status_unknown;

  /// Entry point status when the entry point is closed
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get security_entry_status_closed;

  /// Status summary when there are no alerts and all entry points are secure
  ///
  /// In en, this message translates to:
  /// **'All clear · {count} entry points secured'**
  String security_summary_all_clear(int count);

  /// Status summary part showing the number of active alerts
  ///
  /// In en, this message translates to:
  /// **'{count} alerts'**
  String security_summary_alerts(int count);

  /// Status summary part showing the number of open entry points
  ///
  /// In en, this message translates to:
  /// **'{count} entry points open'**
  String security_summary_entry_points_open(int count);

  /// Message displayed when there are no active security alerts
  ///
  /// In en, this message translates to:
  /// **'No active alerts'**
  String get security_no_active_alerts;

  /// Button label to acknowledge all alerts
  ///
  /// In en, this message translates to:
  /// **'Ack All'**
  String get security_ack_all;

  /// Message displayed when there are no recent security events
  ///
  /// In en, this message translates to:
  /// **'No recent events'**
  String get security_no_recent_events;

  /// Error message when security events fail to load
  ///
  /// In en, this message translates to:
  /// **'Failed to load events'**
  String get security_events_load_failed;

  /// Button label to retry loading security events
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get security_retry;

  /// Alert type label for intrusion detection
  ///
  /// In en, this message translates to:
  /// **'Intrusion detected'**
  String get security_alert_type_intrusion;

  /// Alert type label for an open entry point
  ///
  /// In en, this message translates to:
  /// **'Entry open'**
  String get security_alert_type_entry_open;

  /// Alert type label for smoke detection
  ///
  /// In en, this message translates to:
  /// **'Smoke detected'**
  String get security_alert_type_smoke;

  /// Alert type label for carbon monoxide detection
  ///
  /// In en, this message translates to:
  /// **'CO detected'**
  String get security_alert_type_co;

  /// Alert type label for water leak detection
  ///
  /// In en, this message translates to:
  /// **'Water leak'**
  String get security_alert_type_water_leak;

  /// Alert type label for gas detection
  ///
  /// In en, this message translates to:
  /// **'Gas detected'**
  String get security_alert_type_gas;

  /// Alert type label for tamper detection
  ///
  /// In en, this message translates to:
  /// **'Tamper detected'**
  String get security_alert_type_tamper;

  /// Alert type label for a system fault
  ///
  /// In en, this message translates to:
  /// **'System fault'**
  String get security_alert_type_fault;

  /// Alert type label for a device going offline
  ///
  /// In en, this message translates to:
  /// **'Device offline'**
  String get security_alert_type_device_offline;

  /// Alert type label when the alert type is unknown
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get security_alert_type_unknown;

  /// Short event name for an alert being raised
  ///
  /// In en, this message translates to:
  /// **'Alert Raised'**
  String get security_event_alert_raised;

  /// Short event name for an alert being resolved
  ///
  /// In en, this message translates to:
  /// **'Alert Resolved'**
  String get security_event_alert_resolved;

  /// Short event name for an alert being acknowledged
  ///
  /// In en, this message translates to:
  /// **'Alert Acknowledged'**
  String get security_event_alert_acknowledged;

  /// Short event name for an alarm state change
  ///
  /// In en, this message translates to:
  /// **'Alarm State Changed'**
  String get security_event_alarm_state_changed;

  /// Short event name for an arming mode change
  ///
  /// In en, this message translates to:
  /// **'Arming Mode Changed'**
  String get security_event_arming_mode_changed;

  /// Full event title for an alert being raised
  ///
  /// In en, this message translates to:
  /// **'Alert raised: {alertType}'**
  String security_event_title_alert_raised(String alertType);

  /// Full event title for an alert being resolved
  ///
  /// In en, this message translates to:
  /// **'Alert resolved: {alertType}'**
  String security_event_title_alert_resolved(String alertType);

  /// Full event title for an alert being acknowledged
  ///
  /// In en, this message translates to:
  /// **'Alert acknowledged: {alertType}'**
  String security_event_title_alert_acknowledged(String alertType);

  /// Full event title for an alarm state change with from/to states
  ///
  /// In en, this message translates to:
  /// **'Alarm state changed: {from} → {to}'**
  String security_event_title_alarm_state_changed(String from, String to);

  /// Full event title for an arming mode change with from/to states
  ///
  /// In en, this message translates to:
  /// **'Arming mode changed: {from} → {to}'**
  String security_event_title_arming_mode_changed(String from, String to);

  /// State transition format showing from and to states
  ///
  /// In en, this message translates to:
  /// **'{from} → {to}'**
  String security_state_transition(String from, String to);

  /// Label for an unknown state in state transitions
  ///
  /// In en, this message translates to:
  /// **'unknown'**
  String get security_state_unknown;

  /// Overlay title when the alarm is triggered but there is no top alert
  ///
  /// In en, this message translates to:
  /// **'Alarm triggered'**
  String get security_overlay_alarm_triggered;

  /// Default overlay title when no specific alert type is available
  ///
  /// In en, this message translates to:
  /// **'Security alert'**
  String get security_overlay_default_title;
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
