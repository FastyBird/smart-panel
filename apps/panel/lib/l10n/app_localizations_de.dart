import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get value_not_available => 'N/A';

  @override
  String get value_not_set => 'Nicht eingestellt';

  @override
  String get value_loading => 'Laden';

  @override
  String get information => 'Information';

  @override
  String get warning => 'Warnung';

  @override
  String get error => 'Fehler';

  @override
  String get action_failed => 'Aktion konnte nicht verarbeitet werden';

  @override
  String get action_retry => 'Erneut versuchen';

  @override
  String domain_data_load_failed(String domain) {
    return '$domain konnte nicht geladen werden';
  }

  @override
  String get domain_data_load_failed_description => 'Daten konnten nicht abgerufen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.';

  @override
  String get domain_not_configured_subtitle => 'Nicht konfiguriert';

  @override
  String get services_not_available => 'Dienste nicht verfügbar';

  @override
  String get button_ok => 'OK';

  @override
  String get button_cancel => 'Abbrechen';

  @override
  String get button_close => 'Schließen';

  @override
  String get button_confirm => 'Bestätigen';

  @override
  String get button_done => 'Fertig';

  @override
  String get unit_system_default => 'Standard';

  @override
  String get unit_celsius => 'Celsius (°C)';

  @override
  String get unit_fahrenheit => 'Fahrenheit (°F)';

  @override
  String get unit_wind_speed_ms => 'Meter pro Sekunde (m/s)';

  @override
  String get unit_wind_speed_kmh => 'Kilometer pro Stunde (km/h)';

  @override
  String get unit_wind_speed_mph => 'Meilen pro Stunde (mph)';

  @override
  String get unit_wind_speed_knots => 'Knoten (kn)';

  @override
  String get unit_pressure_hpa => 'Hektopascal (hPa)';

  @override
  String get unit_pressure_mbar => 'Millibar (mbar)';

  @override
  String get unit_pressure_inhg => 'Zoll Quecksilbersäule (inHg)';

  @override
  String get unit_pressure_mmhg => 'Millimeter Quecksilbersäule (mmHg)';

  @override
  String get unit_precipitation_mm => 'Millimeter (mm)';

  @override
  String get unit_precipitation_inches => 'Zoll (in)';

  @override
  String get unit_distance_km => 'Kilometer (km)';

  @override
  String get unit_distance_miles => 'Meilen (mi)';

  @override
  String get unit_distance_meters => 'Meter (m)';

  @override
  String get unit_distance_feet => 'Fuß (ft)';

  @override
  String get time_format_12h => '12-Stunden';

  @override
  String get time_format_24h => '24-Stunden';

  @override
  String get day_monday => 'Montag';

  @override
  String get day_tuesday => 'Dienstag';

  @override
  String get day_wednesday => 'Mittwoch';

  @override
  String get day_thursday => 'Donnerstag';

  @override
  String get day_friday => 'Freitag';

  @override
  String get day_saturday => 'Samstag';

  @override
  String get day_sunday => 'Sonntag';

  @override
  String get day_monday_short => 'Mo';

  @override
  String get day_tuesday_short => 'Di';

  @override
  String get day_wednesday_short => 'Mi';

  @override
  String get day_thursday_short => 'Do';

  @override
  String get day_friday_short => 'Fr';

  @override
  String get day_saturday_short => 'Sa';

  @override
  String get day_sunday_short => 'So';

  @override
  String get message_error_tiles_not_configured_title => 'Keine Kacheln konfiguriert!';

  @override
  String get message_error_tiles_not_configured_description => 'Bitte konfigurieren Sie mindestens eine Kachel auf dem Bildschirm.';

  @override
  String get message_error_cards_not_configured_title => 'Keine Karten konfiguriert!';

  @override
  String get message_error_cards_not_configured_description => 'Bitte konfigurieren Sie mindestens eine Karte auf dem Bildschirm.';

  @override
  String get message_error_device_not_found_title => 'Gerät nicht gefunden!';

  @override
  String get message_error_device_not_found_description => 'Das angeforderte Gerät konnte in der Anwendung nicht gefunden werden.';

  @override
  String get message_error_no_device_detail_title => 'Keine Gerätedetails!';

  @override
  String get message_error_no_device_detail_description => 'Für das ausgewählte Gerät ist keine Detailseite verfügbar.';

  @override
  String get message_error_no_device_detail_preparing_title => 'Gerätedetails nicht bereit!';

  @override
  String get message_error_no_device_detail_preparing_description => 'Die Detailseite für das ausgewählte Gerät ist noch nicht bereit.';

  @override
  String get device_status_offline => 'Offline';

  @override
  String get device_offline_message => 'Gerät ist offline';

  @override
  String get device_offline_title => 'Gerät offline';

  @override
  String get device_offline_description => 'Kommunikation mit diesem Gerät nicht möglich. Prüfen Sie, ob das Gerät eingeschaltet und mit Ihrem Netzwerk verbunden ist.';

  @override
  String get device_offline_retry => 'Verbindung wiederherstellen';

  @override
  String device_offline_last_seen(String time) {
    return 'Zuletzt gesehen $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Offline-Geräte übersprungen',
      one: '1 Offline-Gerät übersprungen',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'Alle Geräte sind offline';

  @override
  String get time_ago_just_now => 'gerade eben';

  @override
  String time_ago_minutes(int count) {
    return 'vor $count Min';
  }

  @override
  String time_ago_hours(int count) {
    return 'vor $count Std';
  }

  @override
  String time_ago_days(int count) {
    return 'vor $count T';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Minuten',
      one: 'vor 1 Minute',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Stunden',
      one: 'vor 1 Stunde',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Tagen',
      one: 'vor 1 Tag',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Minuten',
      one: 'vor 1 Minute',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_hours_minutes(int hours, int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours Stunden',
      one: '1 Stunde',
    );
    String _temp1 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes Minuten',
      one: '1 Minute',
    );
    return 'vor $_temp0 $_temp1';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Stunden',
      one: 'vor 1 Stunde',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days Tagen',
      one: '1 Tag',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours Stunden',
      one: '1 Stunde',
    );
    return 'vor $_temp0 $_temp1';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'vor $count Tagen',
      one: 'vor 1 Tag',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Konfigurationsproblem';

  @override
  String get device_details => 'Gerätedetails';

  @override
  String get message_error_page_not_found_title => 'Seite nicht gefunden!';

  @override
  String get message_error_page_not_found_description => 'Die angeforderte Seite konnte in der Anwendung nicht gefunden werden.';

  @override
  String get electrical_energy_consumption_title => 'Energieverbrauch';

  @override
  String get electrical_energy_consumption_description => 'Gesamter Energieverbrauch im Zeitverlauf';

  @override
  String get electrical_energy_average_power_title => 'Durchschnittliche Leistung';

  @override
  String get electrical_energy_average_power_description => 'Durchschnittliche Leistungsaufnahme im letzten Berichtszeitraum';

  @override
  String get electrical_generation_production_title => 'Energieerzeugung';

  @override
  String get electrical_generation_production_description => 'Gesamte erzeugte Energie der Erzeugungsquelle';

  @override
  String get electrical_generation_power_title => 'Erzeugungsleistung';

  @override
  String get electrical_generation_power_description => 'Aktuelle Leistungsabgabe der Erzeugungsquelle';

  @override
  String get electrical_power_current_title => 'Strom';

  @override
  String get electrical_power_current_description => 'Wie viel Elektrizität fließt';

  @override
  String get electrical_power_voltage_title => 'Spannung';

  @override
  String get electrical_power_voltage_description => 'Die Stärke der Elektrizität';

  @override
  String get electrical_power_power_title => 'Leistung';

  @override
  String get electrical_power_power_description => 'Wie viel Energie verbraucht wird';

  @override
  String get electrical_power_frequency_title => 'Frequenz';

  @override
  String get electrical_power_frequency_description => 'Wie stabil die Elektrizität ist';

  @override
  String get electrical_power_over_current_title => 'Überstrom';

  @override
  String get electrical_power_over_current_description => 'Warnung: Zu hoher Stromfluss';

  @override
  String get electrical_power_over_voltage_title => 'Überspannung';

  @override
  String get electrical_power_over_voltage_description => 'Warnung: Spannung ist zu hoch';

  @override
  String get electrical_power_over_power_title => 'Überleistung';

  @override
  String get electrical_power_over_power_description => 'Warnung: Leistungsaufnahme ist zu hoch';

  @override
  String get light_state_on => 'Ein';

  @override
  String get light_state_on_description => 'Licht ist an';

  @override
  String get light_state_off => 'Aus';

  @override
  String get light_state_failed => 'Fehlgeschlagen';

  @override
  String get light_state_off_description => 'Licht ist aus';

  @override
  String get light_state_brightness_description => 'Aktuelle Helligkeit';

  @override
  String get light_state_mixed_description => 'Geräte haben unterschiedliche Werte';

  @override
  String get light_state_syncing_description => 'Geräte werden synchronisiert...';

  @override
  String get light_state_not_synced_description => 'Geräte sind nicht synchronisiert';

  @override
  String get light_role_main => 'Haupt';

  @override
  String get light_role_task => 'Arbeits';

  @override
  String get light_role_ambient => 'Ambiente';

  @override
  String get light_role_accent => 'Akzent';

  @override
  String get light_role_night => 'Nacht';

  @override
  String get light_role_other => 'Sonstige';

  @override
  String get light_role_hidden => 'Versteckt';

  @override
  String get light_role_on_description => 'Lichter sind an';

  @override
  String get light_role_off_description => 'Lichter sind aus';

  @override
  String get light_role_not_synced_description => 'Synchronisierung fehlgeschlagen';

  @override
  String get light_role_syncing_description => 'Synchronisierung läuft';

  @override
  String get light_role_mixed_description => 'Lichter haben unterschiedliche Werte';

  @override
  String get light_state_out_of_sync => 'Nicht synchron';

  @override
  String get light_mode_off => 'Aus';

  @override
  String get light_mode_on => 'Ein';

  @override
  String get light_mode_brightness => 'Helligkeit';

  @override
  String get light_mode_color => 'Farbe';

  @override
  String get light_mode_temperature => 'Temperatur';

  @override
  String get light_mode_saturation => 'Sättigung';

  @override
  String get light_mode_white => 'Weiß';

  @override
  String get light_mode_swatches => 'Farbpaletten';

  @override
  String get lights_more_scenes => 'Mehr Szenen';

  @override
  String get thermostat_state_title => 'Thermostat-Status';

  @override
  String get thermostat_state_configured_temperature_description => 'Eingestellte Temperatur';

  @override
  String get thermostat_state_current_temperature_description => 'Aktuelle Raumtemperatur';

  @override
  String get thermostat_state_current_humidity_description => 'Aktuelle Luftfeuchtigkeit';

  @override
  String get thermostat_child_lock_title => 'Kindersicherung';

  @override
  String get thermostat_openings_state_title => 'Fenster ist geöffnet';

  @override
  String get thermostat_openings_state_description => 'Thermostat ist deaktiviert';

  @override
  String get contact_sensor_window => 'Fenster';

  @override
  String get contact_sensor_open => 'Offen';

  @override
  String get contact_sensor_closed => 'Geschlossen';

  @override
  String get leak_sensor_water => 'Wasserleck';

  @override
  String get leak_sensor_detected => 'Erkannt';

  @override
  String get leak_sensor_dry => 'Trocken';

  @override
  String get thermostat_lock_locked => 'Gesperrt';

  @override
  String get thermostat_lock_unlocked => 'Entsperrt';

  @override
  String get thermostat_mode_label => 'Modus';

  @override
  String get thermostat_mode_off => 'Aus';

  @override
  String get thermostat_mode_heat => 'Heizen';

  @override
  String get thermostat_mode_cool => 'Kühlen';

  @override
  String get thermostat_mode_auto => 'Automatisch';

  @override
  String get thermostat_mode_manual => 'Manuell';

  @override
  String get thermostat_min => 'min';

  @override
  String get thermostat_max => 'max';

  @override
  String get thermostat_target_label => 'Ziel';

  @override
  String get thermostat_state_off => 'Aus';

  @override
  String get thermostat_state_heating => 'Heizen';

  @override
  String thermostat_state_heating_to(String temperature) {
    return 'Heizen auf $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Kühlen';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Kühlen auf $temperature';
  }

  @override
  String get thermostat_state_idling => 'Leerlauf';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'Leerlauf bei $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'Dieses Thermostatgerät ist falsch konfiguriert.';

  @override
  String get on_state_on => 'Ein';

  @override
  String get on_state_off => 'Aus';

  @override
  String get power_hint_tap_to_turn_on => 'Tippen zum Einschalten';

  @override
  String get power_hint_tap_to_turn_off => 'Tippen zum Ausschalten';

  @override
  String get message_info_app_reboot_title => 'Gerät wird neu gestartet!';

  @override
  String get message_info_app_reboot_description => 'Bitte warten Sie, während das Gerät neu startet. Dieser Vorgang kann einen Moment dauern.';

  @override
  String get message_info_app_power_off_title => 'Gerät wird heruntergefahren!';

  @override
  String get message_info_app_power_off_description => 'Das Gerät wird heruntergefahren. Um es wieder einzuschalten, verwenden Sie bitte den Einschaltknopf.';

  @override
  String get message_info_factory_reset_title => 'Gerät wird zurückgesetzt!';

  @override
  String get message_info_factory_reset_description => 'Alle Einstellungen und Daten werden gelöscht und das Gerät wird auf die Werkseinstellungen zurückgesetzt. Bitte schalten Sie das Gerät während des Vorgangs nicht aus. Dies kann einige Minuten dauern.';

  @override
  String get settings_general_settings_title => 'Allgemeine Einstellungen';

  @override
  String get settings_general_settings_button_display_settings => 'Anzeigeeinstellungen';

  @override
  String get settings_general_settings_button_language_settings => 'Spracheinstellungen';

  @override
  String get settings_general_settings_button_audio_settings => 'Audioeinstellungen';

  @override
  String get settings_general_settings_button_weather_settings => 'Wettereinstellungen';

  @override
  String get settings_general_settings_button_about => 'Über die Anwendung';

  @override
  String get settings_general_settings_button_maintenance => 'Wartung';

  @override
  String get settings_general_settings_button_voice_activation => 'Sprachaktivierung';

  @override
  String get settings_voice_activation_settings_title => 'Einstellungen der Sprachaktivierung';

  @override
  String get settings_voice_activation_section_detection => 'Sprachaktivierungserkennung';

  @override
  String get settings_voice_activation_enable_label => 'Sprachaktivierung aktivieren';

  @override
  String settings_voice_activation_enable_description(String wakeWord) {
    return 'Sagen Sie \"$wakeWord\", um Sprachbefehle zu aktivieren, ohne das Panel zu berühren.';
  }

  @override
  String get settings_voice_activation_microphone_unavailable => 'Mikrofon ist auf diesem Display nicht verfügbar oder deaktiviert.';

  @override
  String get settings_voice_activation_section_sensitivity => 'Empfindlichkeit';

  @override
  String get settings_voice_activation_sensitivity_label => 'Erkennungsempfindlichkeit';

  @override
  String get settings_voice_activation_sensitivity_description => 'Höhere Empfindlichkeit erkennt leisere Sprache, kann aber auf Umgebungsgeräusche reagieren.';

  @override
  String get settings_voice_activation_section_status => 'Status';

  @override
  String get settings_voice_activation_status_label => 'Engine-Status';

  @override
  String get settings_voice_activation_status_stopped => 'Gestoppt';

  @override
  String get settings_voice_activation_status_listening => 'Warte auf Sprachaktivierung...';

  @override
  String get settings_voice_activation_status_recording => 'Sprache wird aufgenommen...';

  @override
  String get settings_voice_activation_status_processing => 'Audio wird verarbeitet...';

  @override
  String get settings_weather_settings_title => 'Wettereinstellungen';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Temperatureinheit';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Bevorzugte Temperatureinheit für die Wetteranzeige festlegen.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Wetterstandort';

  @override
  String get settings_weather_settings_temperature_location_description => 'Datenquelle für den Wetterstandort wählen.';

  @override
  String get settings_weather_settings_temperature_location_single => 'Nur ein Standort verfügbar.';

  @override
  String get settings_maintenance_title => 'Wartung';

  @override
  String get settings_maintenance_restart_title => 'Neustart';

  @override
  String get settings_maintenance_restart_description => 'Gerät neu starten, um Änderungen zu übernehmen.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Gerät neu starten';

  @override
  String get settings_maintenance_restart_confirm_description => 'Sind Sie sicher, dass Sie das Gerät neu starten möchten? Diese Aktion unterbricht vorübergehend die Funktionalität.';

  @override
  String get settings_maintenance_power_off_title => 'Ausschalten';

  @override
  String get settings_maintenance_power_off_description => 'Gerät vollständig ausschalten.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Gerät ausschalten';

  @override
  String get settings_maintenance_power_off_confirm_description => 'Sind Sie sicher, dass Sie das Gerät ausschalten möchten? Es muss manuell wieder eingeschaltet werden.';

  @override
  String get settings_maintenance_factory_reset_title => 'Werkseinstellungen';

  @override
  String get settings_maintenance_factory_reset_description => 'Gerät auf die ursprünglichen Werkseinstellungen zurücksetzen.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Werkseinstellungen wiederherstellen';

  @override
  String get settings_maintenance_factory_reset_confirm_description => 'Sind Sie sicher, dass Sie alle Daten löschen und das Gerät auf die Werkseinstellungen zurücksetzen möchten? Diese Aktion ist unwiderruflich.';

  @override
  String get settings_maintenance_system_heading => 'System';

  @override
  String get settings_maintenance_danger_heading => 'Gefahrenbereich';

  @override
  String get settings_maintenance_restart_display_description => 'Dieses Display neu starten, um Änderungen zu übernehmen.';

  @override
  String get settings_maintenance_restart_display_confirm_title => 'Display neu starten';

  @override
  String get settings_maintenance_restart_display_confirm_description => 'Sind Sie sicher, dass Sie dieses Display neu starten möchten? Das Gateway und andere Displays werden nicht beeinträchtigt.';

  @override
  String get settings_maintenance_power_off_display_description => 'Dieses Display vollständig ausschalten.';

  @override
  String get settings_maintenance_power_off_display_confirm_title => 'Display ausschalten';

  @override
  String get settings_maintenance_power_off_display_confirm_description => 'Sind Sie sicher, dass Sie dieses Display ausschalten möchten? Es muss manuell wieder eingeschaltet werden. Das Gateway wird nicht beeinträchtigt.';

  @override
  String get settings_maintenance_factory_reset_display_description => 'Dieses Display vom Gateway entfernen und auf Werkseinstellungen zurücksetzen.';

  @override
  String get settings_maintenance_factory_reset_display_confirm_title => 'Display auf Werkseinstellungen zurücksetzen';

  @override
  String get settings_maintenance_factory_reset_display_confirm_description => 'Sind Sie sicher, dass Sie dieses Display auf Werkseinstellungen zurücksetzen möchten? Es wird vom Gateway entfernt und alle lokalen Daten werden gelöscht. Diese Aktion ist unwiderruflich.';

  @override
  String get settings_language_settings_title => 'Spracheinstellungen';

  @override
  String get settings_language_settings_language_title => 'Sprache';

  @override
  String get settings_language_settings_language_description => 'Wählen Sie Ihre bevorzugte Sprache.';

  @override
  String get settings_language_settings_timezone_title => 'Zeitzone';

  @override
  String get settings_language_settings_timezone_description => 'Lokale Zeitzone für die Zeitanzeige.';

  @override
  String get settings_language_settings_time_format_title => 'Zeitformat';

  @override
  String get settings_language_settings_time_format_description => '12-Stunden- oder 24-Stunden-Format.';

  @override
  String get settings_language_settings_number_format_title => 'Number Format';

  @override
  String get settings_language_settings_number_format_description => 'How numbers are displayed (thousands and decimal separators).';

  @override
  String get number_format_comma_dot => '1,234.56';

  @override
  String get number_format_dot_comma => '1.234,56';

  @override
  String get number_format_space_comma => '1 234,56';

  @override
  String get number_format_none => '1234.56';

  @override
  String get settings_display_settings_title => 'Anzeigeeinstellungen';

  @override
  String get settings_display_settings_theme_mode_title => 'Designmodus';

  @override
  String get settings_display_settings_theme_mode_description => 'Zwischen hellem und dunklem Design wechseln.';

  @override
  String get settings_display_settings_brightness_title => 'Helligkeit';

  @override
  String get settings_display_settings_brightness_description => 'Bildschirmhelligkeit anpassen.';

  @override
  String get settings_display_settings_screen_lock_title => 'Bildschirmsperre';

  @override
  String get settings_display_settings_screen_lock_description => 'Automatische Sperre bei Inaktivität.';

  @override
  String get settings_display_settings_screen_saver_title => 'Bildschirmschoner';

  @override
  String get settings_display_settings_screen_saver_description => 'Bildschirmschoner bei Inaktivität anzeigen.';

  @override
  String get settings_display_settings_unit_overrides_section => 'Einheitenüberschreibungen';

  @override
  String get settings_display_settings_temperature_unit_title => 'Temperatureinheit';

  @override
  String get settings_display_settings_temperature_unit_description => 'System-Temperatureinheit für dieses Display überschreiben.';

  @override
  String get settings_display_settings_wind_speed_unit_title => 'Windgeschwindigkeitseinheit';

  @override
  String get settings_display_settings_wind_speed_unit_description => 'System-Windgeschwindigkeitseinheit für dieses Display überschreiben.';

  @override
  String get settings_display_settings_pressure_unit_title => 'Druckeinheit';

  @override
  String get settings_display_settings_pressure_unit_description => 'System-Druckeinheit für dieses Display überschreiben.';

  @override
  String get settings_display_settings_precipitation_unit_title => 'Niederschlagseinheit';

  @override
  String get settings_display_settings_precipitation_unit_description => 'System-Niederschlagseinheit für dieses Display überschreiben.';

  @override
  String get settings_display_settings_distance_unit_title => 'Entfernungseinheit';

  @override
  String get settings_display_settings_distance_unit_description => 'System-Entfernungseinheit für dieses Display überschreiben.';

  @override
  String get settings_audio_settings_title => 'Audioeinstellungen';

  @override
  String get settings_audio_settings_speaker_title => 'Lautsprecher';

  @override
  String get settings_audio_settings_speaker_description => 'Lautsprecher aktivieren oder deaktivieren.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Lautsprecherlautstärke';

  @override
  String get settings_audio_settings_speaker_volume_description => 'Lautsprecherausgabe anpassen.';

  @override
  String get settings_audio_settings_microphone_title => 'Mikrofon';

  @override
  String get settings_audio_settings_microphone_description => 'Mikrofon aktivieren oder deaktivieren.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Mikrofonlautstärke';

  @override
  String get settings_audio_settings_microphone_volume_description => 'Mikrofoneingangsempfindlichkeit anpassen.';

  @override
  String get settings_audio_settings_no_support => 'Dieses Display unterstützt keinen Audio-Eingang oder -Ausgang.';

  @override
  String get settings_about_title => 'Über die Anwendung';

  @override
  String get settings_about_about_heading => 'Über';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel ist eine Smart-Home-Anwendung, die eine nahtlose Integration mit Ihren intelligenten Geräten ermöglicht und verbesserte Steuerungs- und Überwachungsfunktionen bietet.';

  @override
  String get settings_about_developed_by_heading => 'Entwickelt von';

  @override
  String get settings_about_license_heading => 'Lizenz';

  @override
  String get settings_about_device_information_heading => 'Geräteinformationen';

  @override
  String get settings_about_show_license_button => 'Lizenz anzeigen';

  @override
  String get settings_about_ip_address_title => 'IP-Adresse';

  @override
  String get settings_about_mac_address_title => 'MAC-Adresse';

  @override
  String get settings_about_cpu_usage_title => 'CPU-Auslastung';

  @override
  String get settings_about_memory_usage_title => 'Speicherauslastung';

  @override
  String get weather_forecast_title => 'Wettervorhersage';

  @override
  String get weather_forecast_feels_like => 'Gefühlt wie:';

  @override
  String get weather_forecast_humidity => 'Luftfeuchtigkeit:';

  @override
  String get weather_detail_rain => 'Regen';

  @override
  String get weather_detail_snow => 'Schnee';

  @override
  String get weather_detail_sunrise => 'Sonnenaufgang';

  @override
  String get weather_detail_sunset => 'Sonnenuntergang';

  @override
  String get weather_detail_forecast => 'Vorhersage';

  @override
  String get weather_detail_not_configured => 'Wetter nicht konfiguriert';

  @override
  String get weather_detail_today => 'Heute';

  @override
  String get weather_detail_hourly_forecast => 'Stündliche Vorhersage';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Gewitter mit leichtem Regen';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Gewitter mit Regen';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Gewitter mit starkem Regen';

  @override
  String get weather_condition_light_thunderstorm => 'Leichtes Gewitter';

  @override
  String get weather_condition_thunderstorm => 'Gewitter';

  @override
  String get weather_condition_heavy_thunderstorm => 'Starkes Gewitter';

  @override
  String get weather_condition_ragged_thunderstorm => 'Unregelmäßiges Gewitter';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Gewitter mit leichtem Nieselregen';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Gewitter mit Nieselregen';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Gewitter mit starkem Nieselregen';

  @override
  String get weather_condition_light_intensity_drizzle => 'Leichter Nieselregen';

  @override
  String get weather_condition_drizzle => 'Nieselregen';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Starker Nieselregen';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Leichter Nieselregen mit Regen';

  @override
  String get weather_condition_drizzle_rain => 'Nieselregen mit Regen';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Starker Nieselregen mit Regen';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Regenschauer mit Nieselregen';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Starke Regenschauer mit Nieselregen';

  @override
  String get weather_condition_shower_drizzle => 'Schauerartige Nieselregen';

  @override
  String get weather_condition_light_rain => 'Leichter Regen';

  @override
  String get weather_condition_moderate_rain => 'Mäßiger Regen';

  @override
  String get weather_condition_heavy_intensity_rain => 'Starker Regen';

  @override
  String get weather_condition_very_heavy_rain => 'Sehr starker Regen';

  @override
  String get weather_condition_extreme_rain => 'Extremer Regen';

  @override
  String get weather_condition_freezing_rain => 'Gefrierender Regen';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Leichte Regenschauer';

  @override
  String get weather_condition_shower_rain => 'Regenschauer';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Starke Regenschauer';

  @override
  String get weather_condition_ragged_shower_rain => 'Unregelmäßige Regenschauer';

  @override
  String get weather_condition_light_snow => 'Leichter Schnee';

  @override
  String get weather_condition_snow => 'Schnee';

  @override
  String get weather_condition_heavy_snow => 'Starker Schneefall';

  @override
  String get weather_condition_sleet => 'Schneeregen';

  @override
  String get weather_condition_light_shower_sleet => 'Leichte Schneeregenschauer';

  @override
  String get weather_condition_shower_sleet => 'Schneeregenschauer';

  @override
  String get weather_condition_light_rain_and_snow => 'Leichter Regen mit Schnee';

  @override
  String get weather_condition_rain_and_snow => 'Regen mit Schnee';

  @override
  String get weather_condition_light_shower_snow => 'Leichte Schneeschauer';

  @override
  String get weather_condition_shower_snow => 'Schneeschauer';

  @override
  String get weather_condition_heavy_shower_snow => 'Starke Schneeschauer';

  @override
  String get weather_condition_mist => 'Dunst';

  @override
  String get weather_condition_smoke => 'Rauch';

  @override
  String get weather_condition_haze => 'Diesig';

  @override
  String get weather_condition_fog => 'Nebel';

  @override
  String get weather_condition_sand => 'Sand';

  @override
  String get weather_condition_dust => 'Staub';

  @override
  String get weather_condition_volcanic_ash => 'Vulkanasche';

  @override
  String get weather_condition_squalls => 'Sturmböen';

  @override
  String get weather_condition_tornado => 'Tornado';

  @override
  String get weather_condition_clear_sky => 'Klarer Himmel';

  @override
  String get weather_condition_few_clouds => 'Wenige Wolken';

  @override
  String get weather_condition_scattered_clouds => 'Vereinzelte Wolken';

  @override
  String get weather_condition_broken_clouds => 'Aufgelockerte Bewölkung';

  @override
  String get weather_condition_overcast_clouds => 'Bedeckt';

  @override
  String get weather_condition_unknown => 'Unbekannt';

  @override
  String get discovery_searching_title => 'Suche nach Gateways';

  @override
  String get discovery_searching_description => 'Suche nach FastyBird Smart Panel Gateways in Ihrem Netzwerk...';

  @override
  String discovery_found_count(int count) {
    return '$count Gateway(s) gefunden...';
  }

  @override
  String get discovery_select_title => 'Gateway auswählen';

  @override
  String discovery_select_description(int count) {
    return '$count Gateway(s) in Ihrem Netzwerk gefunden:';
  }

  @override
  String get discovery_not_found_title => 'Kein Gateway gefunden';

  @override
  String get discovery_not_found_description => 'Es konnte kein FastyBird Smart Panel Gateway in Ihrem Netzwerk gefunden werden.\n\nStellen Sie sicher, dass das Gateway läuft und mit demselben Netzwerk wie dieses Gerät verbunden ist.';

  @override
  String get discovery_error_title => 'Suchfehler';

  @override
  String get discovery_error_description => 'Bei der Suche nach Gateways ist ein Fehler aufgetreten.\n\nBitte prüfen Sie Ihre Netzwerkverbindung und versuchen Sie es erneut.';

  @override
  String discovery_error_failed(String error) {
    return 'Suche fehlgeschlagen: $error';
  }

  @override
  String get discovery_connecting_title => 'Verbindung zum Gateway';

  @override
  String discovery_connecting_description(String address) {
    return 'Verbindung zu $address...';
  }

  @override
  String get discovery_connecting_fallback => 'Gateway';

  @override
  String get discovery_manual_entry_title => 'Gateway-Adresse eingeben';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Gateway-Adresse';

  @override
  String get discovery_manual_entry_help => 'Geben Sie eine IP-Adresse oder einen Hostnamen mit optionalem Port ein.\nBeispiele: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Bitte geben Sie eine Gateway-Adresse ein';

  @override
  String get discovery_validation_invalid => 'Ungültige Adresse. Geben Sie eine gültige IP-Adresse oder einen Hostnamen ein.';

  @override
  String get discovery_button_back => 'Zurück';

  @override
  String get discovery_button_connect => 'Verbinden';

  @override
  String get discovery_button_connect_selected => 'Mit ausgewähltem Gateway verbinden';

  @override
  String get discovery_button_rescan => 'Erneut suchen';

  @override
  String get discovery_button_try_again => 'Erneut versuchen';

  @override
  String get discovery_button_manual => 'Manuell eingeben';

  @override
  String get discovery_button_cancel => 'Abbrechen';

  @override
  String get room_selection_title => 'Raum auswählen';

  @override
  String room_selection_description(int count) {
    return 'Wählen Sie den Raum, zu dem dieses Display gehört ($count verfügbar):';
  }

  @override
  String get room_selection_button_confirm => 'Diesem Raum zuweisen';

  @override
  String get room_selection_saving => 'Raum wird zugewiesen...';

  @override
  String get room_selection_error => 'Raumzuweisung fehlgeschlagen. Bitte versuchen Sie es erneut.';

  @override
  String get room_selection_empty_title => 'Keine Räume verfügbar';

  @override
  String get room_selection_empty_description => 'Es wurden noch keine Räume erstellt. Bitte öffnen Sie die Verwaltung und fügen Sie mindestens einen Raum hinzu.';

  @override
  String get action_success => 'Aktion erfolgreich abgeschlossen';

  @override
  String get space_lighting_controls_title => 'Beleuchtungssteuerung';

  @override
  String get space_lighting_mode_off => 'Aus';

  @override
  String get space_lighting_mode_work => 'Arbeit';

  @override
  String get space_lighting_mode_relax => 'Entspannung';

  @override
  String get space_lighting_mode_night => 'Nacht';

  @override
  String get space_devices_title => 'Geräte';

  @override
  String get space_devices_placeholder => 'Geräte in diesem Raum werden hier angezeigt';

  @override
  String get space_climate_controls_title => 'Klima';

  @override
  String get space_climate_current_label => 'Aktuell';

  @override
  String get space_climate_target_label => 'Ziel';

  @override
  String get climate_role_auxiliary => 'Zusatz';

  @override
  String get climate_tap_for_details => 'Tippen für Details';

  @override
  String get climate_role_ventilation => 'Lüftung';

  @override
  String get climate_role_humidity => 'Feuchtigkeitssteuerung';

  @override
  String get climate_role_other => 'Weitere Geräte';

  @override
  String get space_suggestion_applied => 'Vorschlag angewendet';

  @override
  String get space_suggestion_dismissed => 'Vorschlag verworfen';

  @override
  String get space_undo_success => 'Aktion rückgängig gemacht';

  @override
  String get space_undo_button => 'Rückgängig';

  @override
  String get space_empty_state_title => 'Display ist bereit';

  @override
  String space_empty_state_description(String spaceName) {
    return 'Um Geräte und Steuerungen hinzuzufügen, richten Sie \"$spaceName\" über die Verwaltung ein.';
  }

  @override
  String get space_sensors_only_title => 'Nur Sensoren';

  @override
  String get space_sensors_only_description => 'Dieser Raum hat nur Sensoren — keine steuerbaren Geräte';

  @override
  String get house_overview_no_spaces_title => 'Keine Räume konfiguriert';

  @override
  String get house_overview_no_spaces_description => 'Erstellen Sie Räume über die Verwaltung, um sie hier anzuzeigen';

  @override
  String get house_overview_no_space_page => 'Für diesen Raum ist keine Seite konfiguriert';

  @override
  String get house_overview_tap_to_view => 'Tippen zum Anzeigen';

  @override
  String get house_modes_home => 'Zuhause';

  @override
  String get house_modes_home_description => 'Normaler Betrieb zu Hause';

  @override
  String get house_modes_away => 'Abwesend';

  @override
  String get house_modes_away_description => 'Nicht zu Hause';

  @override
  String get house_modes_night => 'Nacht';

  @override
  String get house_modes_night_description => 'Nachteinstellungen';

  @override
  String get house_modes_changed_success => 'Hausmodus erfolgreich geändert';

  @override
  String get house_modes_changed_error => 'Hausmodus konnte nicht geändert werden';

  @override
  String get house_modes_confirm_title => 'Moduswechsel bestätigen';

  @override
  String get house_modes_confirm_away_description => 'Sind Sie sicher, dass Sie den Hausmodus auf Abwesend setzen möchten? Dies kann Automatisierungsregeln und Sicherheitseinstellungen beeinflussen.';

  @override
  String get space_scenes_title => 'Schnellszenen';

  @override
  String get space_scene_triggered => 'Szene aktiviert';

  @override
  String get space_scene_partial_success => 'Szene teilweise aktiviert';

  @override
  String get window_covering_status_open => 'Offen';

  @override
  String get window_covering_status_closed => 'Geschlossen';

  @override
  String get window_covering_status_opening => 'Öffnet';

  @override
  String get window_covering_status_closing => 'Schließt';

  @override
  String get window_covering_status_stopped => 'Gestoppt';

  @override
  String get window_covering_type_curtain => 'Vorhang';

  @override
  String get window_covering_type_blind => 'Jalousie';

  @override
  String get window_covering_type_roller => 'Rollo';

  @override
  String get window_covering_type_outdoor_blind => 'Außenjalousie';

  @override
  String get window_covering_type_venetian_blind => 'Venezianische Jalousie';

  @override
  String get window_covering_type_vertical_blind => 'Vertikaljalousie';

  @override
  String get window_covering_type_shutter => 'Rolladen';

  @override
  String get window_covering_type_awning => 'Markise';

  @override
  String get window_covering_command_open => 'Öffnen';

  @override
  String get window_covering_command_close => 'Schließen';

  @override
  String get window_covering_command_stop => 'Stopp';

  @override
  String get window_covering_position_label => 'Position';

  @override
  String get window_covering_position_description => 'Aktuelle Position';

  @override
  String get window_covering_tilt_label => 'Neigung';

  @override
  String get window_covering_tilt_description => 'Lamellenwinkel anpassen';

  @override
  String get window_covering_obstruction_warning => 'Hindernis erkannt';

  @override
  String get window_covering_fault_warning => 'Störung erkannt';

  @override
  String get window_covering_preset_morning => 'Morgen';

  @override
  String get window_covering_preset_day => 'Tag';

  @override
  String get window_covering_preset_evening => 'Abend';

  @override
  String get window_covering_preset_night => 'Nacht';

  @override
  String get window_covering_preset_privacy => 'Privatsphäre';

  @override
  String get window_covering_preset_away => 'Abwesend';

  @override
  String get window_covering_presets_label => 'Voreinstellungen';

  @override
  String get window_covering_channels_label => 'Jalousien';

  @override
  String get window_covering_info_status => 'Status';

  @override
  String get window_covering_info_obstruction => 'Hindernis';

  @override
  String get window_covering_obstruction_detected => 'Erkannt';

  @override
  String get window_covering_obstruction_clear => 'Frei';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Offen';
  }

  @override
  String get battery_title => 'Batterie';

  @override
  String get connection_lost_title => 'Verbindung verloren';

  @override
  String get connection_lost_message => 'Verbindung zum Gateway nicht möglich. Bitte prüfen Sie Ihre Netzwerkverbindung und versuchen Sie es erneut.';

  @override
  String get connection_lost_button_reconnect => 'Erneut verbinden';

  @override
  String get connection_lost_button_change_gateway => 'Gateway wechseln';

  @override
  String get button_retry => 'Erneut versuchen';

  @override
  String get button_sync_all => 'Alle synchronisieren';

  @override
  String get system_view_room => 'Raum';

  @override
  String get system_view_master => 'Zuhause';

  @override
  String get deck_nav_more => 'Mehr';

  @override
  String get deck_all_pages => 'Alle Seiten';

  @override
  String get system_view_entry => 'Eingang';

  @override
  String get domain_lights => 'Lichter';

  @override
  String get domain_lights_other => 'Weitere Lichter';

  @override
  String get domain_lights_empty_title => 'Beleuchtung nicht konfiguriert';

  @override
  String get domain_lights_empty_description => 'Beleuchtungsrollen wurden für diesen Raum nicht eingerichtet. Konfigurieren Sie Rollen in der Verwaltung.';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Lichter an',
      one: '1 Licht an',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'alle aus';

  @override
  String get domain_lights_all_on => 'alle an';

  @override
  String get domain_lights_button_all_off => 'Alle aus';

  @override
  String get domain_lights_button_all_on => 'Alle an';

  @override
  String get domain_lights_syncing => 'synchronisiere';

  @override
  String get domain_lights_unsynced => 'nicht synchron';

  @override
  String get domain_lights_mixed => 'gemischt';

  @override
  String get domain_climate => 'Klima';

  @override
  String get domain_climate_empty_title => 'Klima nicht konfiguriert';

  @override
  String get domain_climate_empty_description => 'In diesem Raum sind keine Thermostate oder Klimaaktoren eingerichtet. Fügen Sie Klimageräte in der Verwaltung hinzu.';

  @override
  String get domain_media => 'Medien';

  @override
  String media_devices_summary(Object count) {
    return '$count Geräte';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count Geräte • $on an';
  }

  @override
  String get media_modes_title => 'Modi';

  @override
  String get media_action_power_on => 'Einschalten';

  @override
  String get media_action_power_off => 'Ausschalten';

  @override
  String get media_action_mute => 'Stummschalten';

  @override
  String get media_action_unmute => 'Stummschaltung aufheben';

  @override
  String get media_mode_off => 'Aus';

  @override
  String get media_mode_background => 'Hintergrund';

  @override
  String get media_mode_focused => 'Fokussiert';

  @override
  String get media_mode_party => 'Party';

  @override
  String get media_roles_title => 'Rollen';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on von $total an';
  }

  @override
  String get media_roles_unassigned => 'Nicht zugewiesene Geräte';

  @override
  String get media_role_primary => 'Primär';

  @override
  String get media_role_secondary => 'Sekundär';

  @override
  String get media_role_background => 'Hintergrund';

  @override
  String get media_role_gaming => 'Gaming';

  @override
  String get media_role_hidden => 'Versteckt';

  @override
  String get media_targets_title => 'Geräte';

  @override
  String get media_capability_power => 'Strom';

  @override
  String get media_capability_volume => 'Lautstärke';

  @override
  String get media_capability_mute => 'Stummschaltung';

  @override
  String get media_capability_none => 'Keine Funktionen';

  @override
  String get media_no_endpoints_title => 'Keine Mediengeräte';

  @override
  String get media_no_endpoints_description => 'Dieser Raum hat keine medienfähigen Geräte. Fügen Sie einen Fernseher, Lautsprecher oder Streamer hinzu.';

  @override
  String get media_no_bindings_description => 'Medienaktivitäten werden konfiguriert. Zum Aktualisieren nach unten ziehen.';

  @override
  String get media_ws_offline_title => 'Verbindung verloren';

  @override
  String get media_ws_offline_description => 'Mediensteuerung benötigt eine aktive Verbindung. Verbindung wird hergestellt...';

  @override
  String get domain_sensors => 'Sensoren';

  @override
  String get domain_energy => 'Energie';

  @override
  String get energy_consumption => 'Verbrauch';

  @override
  String get energy_production => 'Erzeugung';

  @override
  String get energy_net => 'Netto';

  @override
  String get energy_range_today => 'Heute';

  @override
  String get energy_range_week => 'Woche';

  @override
  String get energy_range_month => 'Monat';

  @override
  String get energy_top_consumers => 'Größte Verbraucher';

  @override
  String get energy_chart_title => 'Verbrauch im Zeitverlauf';

  @override
  String get energy_summary_title => 'Zusammenfassung';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'Keine Energiedaten';

  @override
  String get energy_empty_description => 'Keine Energieüberwachungsgeräte in diesem Raum gefunden';

  @override
  String get energy_load_failed => 'Energiedaten konnten nicht geladen werden';

  @override
  String get energy_consumed_today => 'Gesamter Energieverbrauch heute';

  @override
  String get energy_consumed_week => 'Gesamter Energieverbrauch diese Woche';

  @override
  String get energy_consumed_month => 'Gesamter Energieverbrauch diesen Monat';

  @override
  String get energy_comparison_vs_yesterday => 'ggü. gestern';

  @override
  String get energy_comparison_vs_last_week => 'ggü. letzter Woche';

  @override
  String get energy_comparison_vs_last_month => 'ggü. letztem Monat';

  @override
  String energy_comparison_same(String period) {
    return 'Gleich wie $period';
  }

  @override
  String get energy_period_yesterday => 'gestern';

  @override
  String get energy_period_last_week => 'letzte Woche';

  @override
  String get energy_period_last_month => 'letzter Monat';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Geräte',
      one: '1 Gerät',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Beleuchtung';

  @override
  String get device_category_climate => 'Klima';

  @override
  String get device_category_sensors => 'Sensoren';

  @override
  String get device_category_media => 'Medien';

  @override
  String get master_rooms => 'Räume';

  @override
  String get master_devices => 'Geräte';

  @override
  String get master_scenes => 'Szenen';

  @override
  String get master_quick_actions => 'Schnellaktionen';

  @override
  String get entry_mode_activated => 'Modus aktiviert';

  @override
  String get entry_house_modes => 'Hausmodi';

  @override
  String get entry_mode_home => 'Zuhause';

  @override
  String get entry_mode_away => 'Abwesend';

  @override
  String get entry_mode_night => 'Nacht';

  @override
  String get entry_mode_movie => 'Film';

  @override
  String get entry_security => 'Sicherheit';

  @override
  String get entry_no_security_devices => 'Keine Sicherheitsgeräte konfiguriert';

  @override
  String get entry_locks => 'Schlösser';

  @override
  String get entry_alarm => 'Alarm';

  @override
  String get entry_cameras => 'Kameras';

  @override
  String get air_quality_level_excellent => 'Sehr gut';

  @override
  String get air_quality_level_good => 'Gut';

  @override
  String get air_quality_level_fair => 'Befriedigend';

  @override
  String get air_quality_level_inferior => 'Mäßig';

  @override
  String get air_quality_level_poor => 'Schlecht';

  @override
  String get air_quality_level_unknown => 'Unbekannt';

  @override
  String get aqi_label_good => 'Gut';

  @override
  String get aqi_label_moderate => 'Mäßig';

  @override
  String get aqi_label_unhealthy_sensitive => 'Ungesund (Empfindliche)';

  @override
  String get aqi_label_unhealthy => 'Ungesund';

  @override
  String get aqi_label_very_unhealthy => 'Sehr ungesund';

  @override
  String get aqi_label_hazardous => 'Gefährlich';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Niedrig';

  @override
  String get sensor_enum_voc_level_low_long => 'Niedrige VOC';

  @override
  String get sensor_enum_voc_level_medium => 'Mittel';

  @override
  String get sensor_enum_voc_level_medium_long => 'Mittlere VOC';

  @override
  String get sensor_enum_voc_level_high => 'Hoch';

  @override
  String get sensor_enum_voc_level_high_long => 'Hohe VOC';

  @override
  String get fan_mode_auto => 'Automatisch';

  @override
  String get fan_mode_manual => 'Manuell';

  @override
  String get fan_mode_eco => 'Eco';

  @override
  String get fan_mode_sleep => 'Schlaf';

  @override
  String get fan_mode_natural => 'Natürlich';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Aus';

  @override
  String get fan_speed_low => 'Niedrig';

  @override
  String get fan_speed_medium => 'Mittel';

  @override
  String get fan_speed_high => 'Hoch';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Automatisch';

  @override
  String get fan_timer_off => 'Aus';

  @override
  String get fan_timer_30m => '30m';

  @override
  String get fan_timer_1h => '1h';

  @override
  String get fan_timer_2h => '2h';

  @override
  String get fan_timer_4h => '4h';

  @override
  String get fan_timer_8h => '8h';

  @override
  String get fan_timer_12h => '12h';

  @override
  String get fan_direction_clockwise => 'Im Uhrzeigersinn';

  @override
  String get fan_direction_counter_clockwise => 'Gegen den Uhrzeigersinn';

  @override
  String get filter_status_good => 'Gut';

  @override
  String get filter_status_replace_soon => 'Bald fällig';

  @override
  String get filter_status_replace_now => 'Wechseln';

  @override
  String get filter_status_unknown => 'Unbekannt';

  @override
  String get dehumidifier_mode_auto => 'Automatisch';

  @override
  String get dehumidifier_mode_manual => 'Manuell';

  @override
  String get dehumidifier_mode_continuous => 'Dauerbetrieb';

  @override
  String get dehumidifier_mode_laundry => 'Wäschetrocknung';

  @override
  String get dehumidifier_mode_quiet => 'Leise';

  @override
  String get dehumidifier_status_idle => 'Leerlauf';

  @override
  String get dehumidifier_status_dehumidifying => 'Entfeuchtet';

  @override
  String get dehumidifier_status_defrosting => 'Abtauung';

  @override
  String get dehumidifier_timer_off => 'Aus';

  @override
  String get dehumidifier_timer_30m => '30 Min';

  @override
  String get dehumidifier_timer_1h => '1 Stunde';

  @override
  String get dehumidifier_timer_2h => '2 Stunden';

  @override
  String get dehumidifier_timer_4h => '4 Stunden';

  @override
  String get dehumidifier_timer_8h => '8 Stunden';

  @override
  String get dehumidifier_timer_12h => '12 Stunden';

  @override
  String get dehumidifier_water_tank => 'Wassertank';

  @override
  String get dehumidifier_defrost => 'Abtauung';

  @override
  String get dehumidifier_defrost_active => 'Abtauung aktiv';

  @override
  String get humidifier_mode_auto => 'Automatisch';

  @override
  String get humidifier_mode_manual => 'Manuell';

  @override
  String get humidifier_mode_sleep => 'Schlaf';

  @override
  String get humidifier_mode_baby => 'Baby';

  @override
  String get humidifier_status_idle => 'Leerlauf';

  @override
  String get humidifier_status_humidifying => 'Befeuchtet';

  @override
  String get humidifier_mist_level => 'Nebelstufe';

  @override
  String get humidifier_mist_level_off => 'Aus';

  @override
  String get humidifier_mist_level_low => 'Niedrig';

  @override
  String get humidifier_mist_level_medium => 'Mittel';

  @override
  String get humidifier_mist_level_high => 'Hoch';

  @override
  String get humidifier_timer_off => 'Aus';

  @override
  String get humidifier_timer_30m => '30 Min';

  @override
  String get humidifier_timer_1h => '1 Stunde';

  @override
  String get humidifier_timer_2h => '2 Stunden';

  @override
  String get humidifier_timer_4h => '4 Stunden';

  @override
  String get humidifier_timer_8h => '8 Stunden';

  @override
  String get humidifier_timer_12h => '12 Stunden';

  @override
  String get humidifier_water_tank => 'Wassertank';

  @override
  String get humidifier_warm_mist => 'Warmer Nebel';

  @override
  String get device_current_humidity => 'Aktuell';

  @override
  String get device_current_temperature => 'Temperatur';

  @override
  String get device_fan_speed => 'Geschwindigkeit';

  @override
  String get device_fan_mode => 'Ventilatormodus';

  @override
  String get device_timer => 'Timer';

  @override
  String get device_child_lock => 'Kindersicherung';

  @override
  String get device_oscillation => 'Oszillation';

  @override
  String get device_direction => 'Richtung';

  @override
  String get device_natural_breeze => 'Natürliche Brise';

  @override
  String get device_auto_off_timer => 'Automatische Abschaltung';

  @override
  String get device_filter_life => 'Filterlebensdauer';

  @override
  String get device_filter_status => 'Filter';

  @override
  String get device_voc => 'VOC';

  @override
  String get device_co2 => 'CO₂';

  @override
  String get device_co => 'CO';

  @override
  String get device_no2 => 'NO₂';

  @override
  String get device_o3 => 'O₃';

  @override
  String get device_so2 => 'SO₂';

  @override
  String get device_pressure => 'Druck';

  @override
  String get air_quality_healthy => 'Gesund';

  @override
  String get air_quality_unhealthy => 'Ungesund';

  @override
  String get gas_detected => 'Erkannt';

  @override
  String get gas_clear => 'Kein Gas';

  @override
  String get gas_level_low => 'Niedrig';

  @override
  String get gas_level_medium => 'Mittel';

  @override
  String get gas_level_high => 'Hoch';

  @override
  String get device_humidity => 'Luftfeuchtigkeit';

  @override
  String get device_air_quality_index => 'Luftqualitätsindex';

  @override
  String get device_temperature => 'Temp';

  @override
  String get device_sensors => 'Sensoren';

  @override
  String get device_controls => 'Steuerung';

  @override
  String get device_settings => 'Einstellungen';

  @override
  String duration_format_hours_minutes(int hours, int minutes) {
    return '${hours}h ${minutes}m';
  }

  @override
  String duration_format_hours(int hours) {
    return '${hours}h';
  }

  @override
  String duration_format_minutes(int minutes) {
    return '${minutes}m';
  }

  @override
  String get media_playing => 'Wiedergabe';

  @override
  String get media_idle => 'Leerlauf';

  @override
  String get media_standby => 'Standby';

  @override
  String get media_volume => 'Lautstärke';

  @override
  String get media_source => 'Quelle';

  @override
  String get media_queue => 'Warteschlange';

  @override
  String get media_up_next => 'Als Nächstes';

  @override
  String get media_other_devices => 'Weitere Geräte';

  @override
  String get device_status_standby => 'Standby';

  @override
  String get device_status_active => 'Aktiv';

  @override
  String get device_status_inactive => 'Inaktiv';

  @override
  String get climate_devices_section => 'Klimageräte';

  @override
  String get climate_more_sensors => 'Mehr Sensoren';

  @override
  String get domain_shading => 'Beschattung';

  @override
  String get domain_shading_empty_title => 'Beschattung nicht konfiguriert';

  @override
  String get domain_shading_empty_description => 'Beschattungsrollen wurden für diesen Raum nicht eingerichtet. Konfigurieren Sie Rollen in der Verwaltung.';

  @override
  String get shading_modes_title => 'Modi';

  @override
  String get shading_devices_title => 'Geräte';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Geräte',
      one: '1 Gerät',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Öffnen';

  @override
  String get shading_action_close => 'Zu';

  @override
  String get shading_action_stop => 'Stopp';

  @override
  String get shading_state_open => 'Offen';

  @override
  String get shading_state_closed => 'Zu';

  @override
  String shading_state_partial(int position) {
    return '$position% offen';
  }

  @override
  String get shading_position => 'Position';

  @override
  String get shading_tap_for_controls => 'Tippen für Steuerung';

  @override
  String get shading_hide_controls => 'Steuerung ausblenden';

  @override
  String get covers_mode_open => 'Offen';

  @override
  String get covers_mode_closed => 'Zu';

  @override
  String get covers_mode_privacy => 'Privatsphäre';

  @override
  String get covers_mode_daylight => 'Tageslicht';

  @override
  String get domain_mode_custom => 'Eigen';

  @override
  String get covers_role_primary => 'Haupt';

  @override
  String get covers_role_blackout => 'Verdunklung';

  @override
  String get covers_role_sheer => 'Gardinen';

  @override
  String get covers_role_outdoor => 'Außen';

  @override
  String get covers_role_hidden => 'Versteckt';

  @override
  String get cover_type_curtain => 'Vorhang';

  @override
  String get cover_type_blind => 'Jalousie';

  @override
  String get cover_type_roller => 'Rollo';

  @override
  String get cover_type_outdoor_blind => 'Außenjalousie';

  @override
  String get cover_type_cover => 'Abdeckung';

  @override
  String get light_preset_candle => 'Kerze';

  @override
  String get light_preset_warm => 'Warm';

  @override
  String get light_preset_daylight => 'Tageslicht';

  @override
  String get light_preset_cool => 'Kalt';

  @override
  String get light_preset_warm_white => 'Warmweiß';

  @override
  String get light_preset_neutral => 'Neutral';

  @override
  String get light_preset_cool_white => 'Kaltweiß';

  @override
  String get light_color_red => 'Rot';

  @override
  String get light_color_orange => 'Orange';

  @override
  String get light_color_yellow => 'Gelb';

  @override
  String get light_color_green => 'Grün';

  @override
  String get light_color_cyan => 'Cyan';

  @override
  String get light_color_blue => 'Blau';

  @override
  String get light_color_purple => 'Lila';

  @override
  String get light_color_pink => 'Rosa';

  @override
  String get light_color_violet => 'Violett';

  @override
  String get light_color_white => 'Weiß';

  @override
  String get light_cap_brightness => 'Hell.';

  @override
  String get light_cap_color_temp => 'Temp';

  @override
  String get light_cap_hue => 'Farbton';

  @override
  String get light_cap_saturation => 'Sätt.';

  @override
  String get light_cap_white => 'Weiß';

  @override
  String light_header_mode_count(String mode, int count) {
    return '$mode • $count an';
  }

  @override
  String light_header_count_of_total(int count, int total) {
    return '$count von $total an';
  }

  @override
  String get popup_label_mode => 'Modus';

  @override
  String get connection_banner_reconnecting => 'Verbindung wird hergestellt...';

  @override
  String get connection_banner_retry => 'Erneut versuchen';

  @override
  String get connection_overlay_title_reconnecting => 'Verbindungsaufbau';

  @override
  String get connection_overlay_message_reconnecting => 'Versuch, die Verbindung wiederherzustellen...';

  @override
  String get connection_overlay_message_still_trying => 'Verbindungsaufbau läuft weiterhin...';

  @override
  String get connection_overlay_retry => 'Jetzt erneut versuchen';

  @override
  String get connection_overlay_retrying => 'Verbinde...';

  @override
  String get connection_recovery_connected => 'Verbunden';

  @override
  String get connection_auth_error_title => 'Sitzung abgelaufen';

  @override
  String get connection_auth_error_message => 'Ihre Sitzung ist abgelaufen oder wurde widerrufen. Bitte setzen Sie das Gerät zurück, um sich erneut zu verbinden.';

  @override
  String get connection_auth_error_button_reset => 'Gerät zurücksetzen';

  @override
  String get connection_network_error_title => 'Netzwerk nicht verfügbar';

  @override
  String get connection_network_error_message => 'Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Netzwerkverbindung.';

  @override
  String get connection_network_error_button_retry => 'Erneut versuchen';

  @override
  String get connection_server_error_title => 'Server nicht verfügbar';

  @override
  String get connection_server_error_message => 'Der Server ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.';

  @override
  String get connection_server_error_button_retry => 'Erneut versuchen';

  @override
  String get sensor_enum_illuminance_bright => 'Hell';

  @override
  String get sensor_enum_illuminance_bright_long => 'Hell';

  @override
  String get sensor_enum_illuminance_moderate => 'Mäßig';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Mäßige Beleuchtung';

  @override
  String get sensor_enum_illuminance_dusky => 'Dämmerig';

  @override
  String get sensor_enum_illuminance_dusky_long => 'Dämmerig';

  @override
  String get sensor_enum_illuminance_dark => 'Dunkel';

  @override
  String get sensor_enum_illuminance_dark_long => 'Dunkel';

  @override
  String get sensor_enum_gas_status_normal => 'OK';

  @override
  String get sensor_enum_gas_status_normal_long => 'Normal';

  @override
  String get sensor_enum_gas_status_warning => 'Warn.';

  @override
  String get sensor_enum_gas_status_warning_long => 'Warnung';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarm';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Gasalarm';

  @override
  String get sensor_enum_leak_level_low => 'Niedrig';

  @override
  String get sensor_enum_leak_level_low_long => 'Geringes Leck';

  @override
  String get sensor_enum_leak_level_medium => 'Mittel';

  @override
  String get sensor_enum_leak_level_medium_long => 'Mittleres Leck';

  @override
  String get sensor_enum_leak_level_high => 'Hoch';

  @override
  String get sensor_enum_leak_level_high_long => 'Schweres Leck';

  @override
  String get sensor_enum_battery_level_critical => 'Krit.';

  @override
  String get sensor_enum_battery_level_critical_long => 'Kritisch';

  @override
  String get sensor_enum_battery_level_low => 'Niedrig';

  @override
  String get sensor_enum_battery_level_low_long => 'Niedrig';

  @override
  String get sensor_enum_battery_level_medium => 'Mittel';

  @override
  String get sensor_enum_battery_level_medium_long => 'Mittel';

  @override
  String get sensor_enum_battery_level_high => 'Hoch';

  @override
  String get sensor_enum_battery_level_high_long => 'Hoch';

  @override
  String get sensor_enum_battery_level_full => 'Voll';

  @override
  String get sensor_enum_battery_level_full_long => 'Voll';

  @override
  String get sensor_enum_battery_status_ok => 'OK';

  @override
  String get sensor_enum_battery_status_ok_long => 'Batterie OK';

  @override
  String get sensor_enum_battery_status_low => 'Niedrig';

  @override
  String get sensor_enum_battery_status_low_long => 'Batterie schwach';

  @override
  String get sensor_enum_battery_status_charging => 'Laden';

  @override
  String get sensor_enum_battery_status_charging_long => 'Wird geladen';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Ruhe';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarm in Ruhe';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Warten';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarm ausstehend';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Auslös.';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarm ausgelöst';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Stumm';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarm stummgeschaltet';

  @override
  String get sensor_enum_alarm_disarmed => 'Aus';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Deaktiviert';

  @override
  String get sensor_enum_alarm_armed_home => 'Haus';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Scharf zu Hause';

  @override
  String get sensor_enum_alarm_armed_away => 'Weg';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Scharf abwesend';

  @override
  String get sensor_enum_alarm_armed_night => 'Nacht';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Scharf Nacht';

  @override
  String get sensor_enum_filter_good => 'Gut';

  @override
  String get sensor_enum_filter_good_long => 'Filter gut';

  @override
  String get sensor_enum_filter_replace_soon => 'Bald';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Bald wechseln';

  @override
  String get sensor_enum_filter_replace_now => 'Jetzt!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Jetzt wechseln';

  @override
  String get sensor_enum_door_opened => 'Offen';

  @override
  String get sensor_enum_door_opened_long => 'Tür geöffnet';

  @override
  String get sensor_enum_door_closed => 'Zu';

  @override
  String get sensor_enum_door_closed_long => 'Tür geschlossen';

  @override
  String get sensor_enum_door_opening => 'Öffnet';

  @override
  String get sensor_enum_door_opening_long => 'Tür öffnet sich';

  @override
  String get sensor_enum_door_closing => 'Schließt';

  @override
  String get sensor_enum_door_closing_long => 'Tür schließt sich';

  @override
  String get sensor_enum_door_stopped => 'Stopp';

  @override
  String get sensor_enum_door_stopped_long => 'Tür gestoppt';

  @override
  String get sensor_enum_lock_locked => 'Verr.';

  @override
  String get sensor_enum_lock_locked_long => 'Verriegelt';

  @override
  String get sensor_enum_lock_unlocked => 'Offen';

  @override
  String get sensor_enum_lock_unlocked_long => 'Entriegelt';

  @override
  String get sensor_enum_camera_available => 'An';

  @override
  String get sensor_enum_camera_available_long => 'Kamera verfügbar';

  @override
  String get sensor_enum_camera_in_use => 'Aktiv';

  @override
  String get sensor_enum_camera_in_use_long => 'Kamera wird verwendet';

  @override
  String get sensor_enum_camera_unavailable => 'N/A';

  @override
  String get sensor_enum_camera_unavailable_long => 'Kamera nicht verfügbar';

  @override
  String get sensor_enum_camera_offline => 'Aus';

  @override
  String get sensor_enum_camera_offline_long => 'Kamera offline';

  @override
  String get sensor_enum_camera_initializing => 'Init';

  @override
  String get sensor_enum_camera_initializing_long => 'Kamera wird initialisiert';

  @override
  String get sensor_enum_camera_error => 'Fehler';

  @override
  String get sensor_enum_camera_error_long => 'Kamerafehler';

  @override
  String get sensor_enum_device_info_connected => 'An';

  @override
  String get sensor_enum_device_info_connected_long => 'Verbunden';

  @override
  String get sensor_enum_device_info_disconnected => 'Aus';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Getrennt';

  @override
  String get sensor_enum_device_info_init => 'Init';

  @override
  String get sensor_enum_device_info_init_long => 'Initialisierung';

  @override
  String get sensor_enum_device_info_ready => 'Bereit';

  @override
  String get sensor_enum_device_info_ready_long => 'Bereit';

  @override
  String get sensor_enum_device_info_running => 'Läuft';

  @override
  String get sensor_enum_device_info_running_long => 'Läuft';

  @override
  String get sensor_enum_device_info_sleeping => 'Schlaf';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Schlafmodus';

  @override
  String get sensor_enum_device_info_stopped => 'Stopp';

  @override
  String get sensor_enum_device_info_stopped_long => 'Gestoppt';

  @override
  String get sensor_enum_device_info_lost => 'Verl.';

  @override
  String get sensor_enum_device_info_lost_long => 'Verbindung verloren';

  @override
  String get sensor_enum_device_info_alert => 'Alarm';

  @override
  String get sensor_enum_device_info_alert_long => 'Alarm';

  @override
  String get sensor_enum_device_info_unknown => 'N/A';

  @override
  String get sensor_enum_device_info_unknown_long => 'Unbekannt';

  @override
  String get sensor_freshness_live => 'Live';

  @override
  String get sensor_freshness_stale => 'Veraltet';

  @override
  String get sensor_freshness_offline => 'Offline';

  @override
  String get media_input_hdmi1 => 'HDMI 1';

  @override
  String get media_input_hdmi2 => 'HDMI 2';

  @override
  String get media_input_hdmi3 => 'HDMI 3';

  @override
  String get media_input_hdmi4 => 'HDMI 4';

  @override
  String get media_input_hdmi5 => 'HDMI 5';

  @override
  String get media_input_hdmi6 => 'HDMI 6';

  @override
  String get media_input_arc => 'ARC';

  @override
  String get media_input_earc => 'eARC';

  @override
  String get media_input_tv => 'TV';

  @override
  String get media_input_cable => 'Kabel';

  @override
  String get media_input_satellite => 'Satellit';

  @override
  String get media_input_antenna => 'Antenne';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Komponente';

  @override
  String get media_input_vga => 'VGA';

  @override
  String get media_input_dvi => 'DVI';

  @override
  String get media_input_usb => 'USB';

  @override
  String get media_input_bluetooth => 'Bluetooth';

  @override
  String get media_input_wifi => 'Wi-Fi';

  @override
  String get media_input_airplay => 'AirPlay';

  @override
  String get media_input_cast => 'Chromecast';

  @override
  String get media_input_dlna => 'DLNA';

  @override
  String get media_input_miracast => 'Miracast';

  @override
  String get media_input_app_netflix => 'Netflix';

  @override
  String get media_input_app_youtube => 'YouTube';

  @override
  String get media_input_app_spotify => 'Spotify';

  @override
  String get media_input_app_prime_video => 'Prime Video';

  @override
  String get media_input_app_disney_plus => 'Disney+';

  @override
  String get media_input_app_hbo_max => 'HBO Max';

  @override
  String get media_input_app_apple_tv => 'Apple TV';

  @override
  String get media_input_app_plex => 'Plex';

  @override
  String get media_input_app_kodi => 'Kodi';

  @override
  String get media_input_other => 'Sonstige';

  @override
  String get media_off_title => 'Medien aus';

  @override
  String get media_off_subtitle => 'Aktivität auswählen, um zu beginnen';

  @override
  String get media_not_configured_title => 'Medien nicht konfiguriert';

  @override
  String get media_not_configured_description => 'Medienaktivitäten wurden für diesen Raum nicht eingerichtet. Konfigurieren Sie Aktivitätsbindungen in der Verwaltung.';

  @override
  String media_starting_activity(String activityName) {
    return '$activityName wird gestartet...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName fehlgeschlagen';
  }

  @override
  String get media_activity_failed_description => 'Aktivität konnte nicht angewendet werden. Prüfen Sie die Geräteverbindung.';

  @override
  String get media_activity_retry => 'Erneut versuchen';

  @override
  String get media_activity_turn_off => 'Ausschalten';

  @override
  String get media_warning_audio_offline => 'Audio-Ausgang offline – Displaylautsprecher werden verwendet';

  @override
  String get media_warning_some_devices_offline => 'Einige Geräte sind offline';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Warnungen',
      one: 'Warnung',
    );
    return 'Einige Schritte fehlgeschlagen ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Bei einigen Schritten traten Probleme auf';

  @override
  String get media_remote => 'Fernbedienung';

  @override
  String get media_remote_control => 'Fernbedienung';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Aktivierungsdetails';

  @override
  String get media_failure_summary_total => 'Gesamt';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Fehler';

  @override
  String get media_failure_summary_warnings => 'Warnungen';

  @override
  String get media_failure_errors_critical => 'Fehler (kritisch)';

  @override
  String get media_failure_warnings_non_critical => 'Warnungen (nicht kritisch)';

  @override
  String get media_failure_warnings_label => 'Warnungen';

  @override
  String get media_failure_retry_activity => 'Aktivität erneut versuchen';

  @override
  String get media_failure_deactivate => 'Deaktivieren';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Gerät: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'Fehler',
      one: 'Fehler',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'Warnungen',
      one: 'Warnung',
    );
    return 'Aktivität konnte nicht angewendet werden ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Ansehen';

  @override
  String get media_activity_listen => 'Anhören';

  @override
  String get media_activity_gaming => 'Gaming';

  @override
  String get media_activity_background => 'Hintergr.';

  @override
  String get media_activity_off => 'Aus';

  @override
  String media_activity_active(String activityName) {
    return '$activityName aktiv';
  }

  @override
  String get media_status_standby => 'Standby';

  @override
  String get media_status_activating => 'Aktivierung...';

  @override
  String get media_status_failed => 'Fehlgeschlagen';

  @override
  String get media_status_stopping => 'Wird gestoppt...';

  @override
  String get media_status_active_with_issues => 'Aktiv mit Problemen';

  @override
  String get media_status_active => 'Aktiv';

  @override
  String get media_status_ready => 'Bereit';

  @override
  String get media_remote_up => 'Hoch';

  @override
  String get media_remote_down => 'Runter';

  @override
  String get media_remote_left => 'Links';

  @override
  String get media_remote_right => 'Rechts';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Zurück';

  @override
  String get media_remote_exit => 'Beenden';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Zurückspulen';

  @override
  String get media_remote_fast_forward => 'Vorspulen';

  @override
  String get media_remote_play => 'Abspielen';

  @override
  String get media_remote_pause => 'Pause';

  @override
  String get media_remote_next => 'Nächster';

  @override
  String get media_remote_prev => 'Vorh.';

  @override
  String get media_detail_connection_lost => 'Verbindung verloren';

  @override
  String get media_detail_connection_lost_description => 'Mediensteuerung erfordert eine aktive WebSocket-Verbindung.';

  @override
  String get media_detail_go_back => 'Zurück';

  @override
  String get media_detail_section_display => 'Display';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Quelle';

  @override
  String get media_detail_section_remote => 'Fernbedienung';

  @override
  String get media_detail_input => 'Eingang';

  @override
  String get media_detail_select => 'Auswählen';

  @override
  String get media_detail_now_playing => 'Läuft gerade';

  @override
  String get media_detail_no_track_info => 'Keine Titelinformationen verfügbar';

  @override
  String get media_detail_home => 'Startseite';

  @override
  String get media_detail_menu => 'Menü';

  @override
  String get media_playback => 'Wiedergabe';

  @override
  String get filter_all => 'Alle';

  @override
  String sensor_alert_high_title(String name) {
    return 'Warnung: hoher $name-Wert';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name hat den Schwellenwert überschritten';
  }

  @override
  String get sensor_state_detected => 'Erkannt';

  @override
  String get sensor_state_not_detected => 'Nicht erkannt';

  @override
  String get sensor_state_clear => 'In Ordnung';

  @override
  String get sensor_state_open => 'Offen';

  @override
  String get sensor_state_closed => 'Geschlossen';

  @override
  String get sensor_state_active => 'Aktiv';

  @override
  String get sensor_state_inactive => 'Inaktiv';

  @override
  String get sensor_state_occupied => 'Belegt';

  @override
  String get sensor_state_unoccupied => 'Nicht belegt';

  @override
  String get sensor_state_smoke_detected => 'Rauch erkannt';

  @override
  String get sensor_state_gas_detected => 'Gas erkannt';

  @override
  String get sensor_state_leak_detected => 'Leck erkannt';

  @override
  String get sensor_state_co_detected => 'CO erkannt';

  @override
  String get sensor_label_temperature => 'Temperatur';

  @override
  String get sensor_label_humidity => 'Luftfeuchtigkeit';

  @override
  String get sensor_label_pressure => 'Druck';

  @override
  String get sensor_label_illuminance => 'Beleuchtungsstärke';

  @override
  String get sensor_label_carbon_dioxide => 'Kohlendioxid';

  @override
  String get sensor_label_carbon_monoxide => 'Kohlenmonoxid';

  @override
  String get sensor_label_ozone => 'Ozon';

  @override
  String get sensor_label_nitrogen_dioxide => 'Stickstoffdioxid';

  @override
  String get sensor_label_sulphur_dioxide => 'Schwefeldioxid';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Feinstaub';

  @override
  String get sensor_label_motion => 'Bewegung';

  @override
  String get sensor_label_occupancy => 'Belegung';

  @override
  String get sensor_label_contact => 'Kontakt';

  @override
  String get sensor_label_leak => 'Leck';

  @override
  String get sensor_label_smoke => 'Rauch';

  @override
  String get sensor_label_battery => 'Batterie';

  @override
  String get sensor_label_alarm => 'Alarm';

  @override
  String get sensor_label_door => 'Tür';

  @override
  String get sensor_label_lock => 'Schloss';

  @override
  String get sensor_label_camera => 'Kamera';

  @override
  String get sensor_label_filter => 'Filter';

  @override
  String get sensor_label_device_info => 'Geräteinfo';

  @override
  String get sensor_label_gas => 'Gas';

  @override
  String get sensor_label_electrical_energy => 'Energie';

  @override
  String get sensor_label_electrical_generation => 'Erzeugung';

  @override
  String get sensor_label_electrical_power => 'Leistung';

  @override
  String get sensor_alert_high_level => 'Hoher Wert';

  @override
  String get sensor_alert_low_battery => 'Batterie schwach';

  @override
  String get sensor_alert_charging => 'Wird geladen';

  @override
  String get sensor_category_temperature => 'Temperatur';

  @override
  String get sensor_category_humidity => 'Luftfeuchtigkeit';

  @override
  String get sensor_category_air_quality => 'Luftqualität';

  @override
  String get sensor_category_motion => 'Bewegung';

  @override
  String get sensor_category_safety => 'Sicherheit';

  @override
  String get sensor_category_light => 'Licht';

  @override
  String get sensor_category_energy => 'Energie';

  @override
  String get sensor_ui_event_log => 'Ereignisprotokoll';

  @override
  String get sensor_ui_history => 'Verlauf';

  @override
  String get sensor_ui_current => 'Aktuell';

  @override
  String sensor_ui_current_value(String name) {
    return 'Aktueller $name';
  }

  @override
  String get sensor_ui_min => 'Min';

  @override
  String get sensor_ui_max => 'Max';

  @override
  String get sensor_ui_avg => 'Durch.';

  @override
  String sensor_ui_period_min(String period) {
    return '$period Min';
  }

  @override
  String sensor_ui_period_max(String period) {
    return '$period Max';
  }

  @override
  String sensor_ui_period_avg(String period) {
    return '$period Durch.';
  }

  @override
  String get sensor_ui_online => 'Online';

  @override
  String get sensor_ui_offline => 'Offline';

  @override
  String get sensor_ui_period_1h => '1H';

  @override
  String get sensor_ui_period_24h => '24H';

  @override
  String get sensor_ui_period_7d => '7T';

  @override
  String get sensor_ui_period_30d => '30T';

  @override
  String get sensor_empty_no_events => 'Keine Ereignisse aufgezeichnet';

  @override
  String get sensor_empty_no_state_changes => 'Keine Statusänderungen';

  @override
  String get sensor_empty_no_history => 'Keine Verlaufsdaten verfügbar';

  @override
  String get sensor_empty_no_data => 'Keine Daten verfügbar';

  @override
  String get sensor_status_loading => 'Daten werden geladen...';

  @override
  String get sensor_status_failed => 'Laden der Daten fehlgeschlagen';

  @override
  String get sensor_status_retry => 'Erneut versuchen';

  @override
  String get sensors_domain_title => 'Sensoren';

  @override
  String get sensors_domain_empty_title => 'Sensoren nicht konfiguriert';

  @override
  String get sensors_domain_empty_description => 'Sensorrollen wurden für diesen Raum nicht eingerichtet. Konfigurieren Sie Sensorzuweisungen in der Verwaltung.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Warnungen aktiv',
      one: 'Warnung aktiv',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_summary => 'Keine Umgebungsdaten verfügbar';

  @override
  String get sensors_domain_no_sensors => 'Keine Sensoren konfiguriert';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count veraltet';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count offline';
  }

  @override
  String get sensors_domain_health_normal => 'Alles normal';

  @override
  String get sensors_domain_avg_temperature => 'Durchschn. Temperatur';

  @override
  String get sensors_domain_avg_humidity => 'Durchschn. Feuchte';

  @override
  String get sensors_domain_all_sensors => 'Alle Sensoren';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count Sensoren';
  }

  @override
  String get domain_security => 'Sicherheit';

  @override
  String get security_tab_entry_points => 'Zugangspunkte';

  @override
  String get security_tab_alerts => 'Warnungen';

  @override
  String get security_tab_events => 'Ereignisse';

  @override
  String get security_header_recent_events => 'Letzte Ereignisse';

  @override
  String get security_status_triggered => 'Ausgelöst';

  @override
  String get security_status_warning => 'Warnung';

  @override
  String get security_status_secure => 'Gesichert';

  @override
  String get security_armed_disarmed => 'Deaktiviert';

  @override
  String get security_armed_home => 'Scharf zu Hause';

  @override
  String get security_armed_away => 'Scharf abwesend';

  @override
  String get security_armed_night => 'Scharf Nacht';

  @override
  String get security_armed_unknown => 'Unbekannt';

  @override
  String get security_alarm_idle => 'Ruhe';

  @override
  String get security_alarm_pending => 'Ausstehend';

  @override
  String get security_alarm_triggered => 'Ausgelöst';

  @override
  String get security_alarm_silenced => 'Stummgeschaltet';

  @override
  String get security_alarm_unknown => 'Unbekannt';

  @override
  String security_entry_open_count(int count) {
    return '$count offen';
  }

  @override
  String get security_entry_all_secure => 'Alles gesichert';

  @override
  String get security_entry_status_breach => 'Einbruch';

  @override
  String get security_entry_status_open => 'Offen';

  @override
  String get security_entry_status_unknown => 'Unbekannt';

  @override
  String get security_entry_status_closed => 'Geschlossen';

  @override
  String security_summary_all_clear(int count) {
    return 'Alles in Ordnung · $count Zugangspunkte gesichert';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count Warnungen';
  }

  @override
  String get security_summary_alerts_label => 'Warnungen';

  @override
  String security_summary_entry_points_open(int count) {
    return '$count Zugangspunkte offen';
  }

  @override
  String get security_summary_open_label => 'Offen';

  @override
  String get security_no_active_alerts => 'Keine aktiven Warnungen';

  @override
  String get security_ack_all => 'Alle bestätigen';

  @override
  String get security_no_recent_events => 'Keine aktuellen Ereignisse';

  @override
  String get security_events_load_failed => 'Ereignisse konnten nicht geladen werden';

  @override
  String get security_retry => 'Erneut versuchen';

  @override
  String get security_alert_type_intrusion => 'Einbruch erkannt';

  @override
  String get security_alert_type_entry_open => 'Eingang offen';

  @override
  String get security_alert_type_smoke => 'Rauch erkannt';

  @override
  String get security_alert_type_co => 'CO erkannt';

  @override
  String get security_alert_type_water_leak => 'Wasserleck';

  @override
  String get security_alert_type_gas => 'Gas erkannt';

  @override
  String get security_alert_type_tamper => 'Manipulation erkannt';

  @override
  String get security_alert_type_fault => 'Systemfehler';

  @override
  String get security_alert_type_device_offline => 'Gerät offline';

  @override
  String get security_alert_type_unknown => 'Unbekannt';

  @override
  String get security_event_alert_raised => 'Warnung ausgelöst';

  @override
  String get security_event_alert_resolved => 'Warnung behoben';

  @override
  String get security_event_alert_acknowledged => 'Warnung bestätigt';

  @override
  String get security_event_alarm_state_changed => 'Alarmstatus geändert';

  @override
  String get security_event_arming_mode_changed => 'Sicherheitsmodus geändert';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Warnung ausgelöst: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Warnung behoben: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Warnung bestätigt: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Alarmstatus geändert: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Sicherheitsmodus geändert: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'unbekannt';

  @override
  String get security_overlay_alarm_triggered => 'Alarm ausgelöst';

  @override
  String get security_overlay_default_title => 'Sicherheitswarnung';

  @override
  String get security_overlay_acknowledge => 'Bestätigen';

  @override
  String get security_overlay_open_security => 'Sicherheit öffnen';

  @override
  String security_overlay_more_alerts(int count) {
    return '+$count weitere Warnungen';
  }

  @override
  String get room_overview_no_room => 'Diesem Display ist kein Raum zugewiesen';

  @override
  String get room_overview_display_not_configured => 'Display nicht konfiguriert';

  @override
  String get room_overview_load_failed => 'Raumdaten konnten nicht geladen werden';

  @override
  String room_overview_lights_active(int lightsOn, int totalLights) {
    return '$lightsOn von $totalLights aktiv';
  }

  @override
  String room_overview_light_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Lichter',
      one: '1 Licht',
    );
    return '$_temp0';
  }

  @override
  String room_overview_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Geräte',
      one: '1 Gerät',
    );
    return '$_temp0';
  }

  @override
  String room_overview_reading_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Messwerte',
      one: '1 Messwert',
    );
    return '$_temp0';
  }

  @override
  String get room_overview_action_failed => 'Aktion fehlgeschlagen';

  @override
  String get suggested_action_turn_off_lights => 'Lichter ausschalten';

  @override
  String get suggested_action_movie_mode => 'Filmmodus';

  @override
  String get suggested_action_night_mode => 'Nachtmodus';

  @override
  String get shading_fully_closed => 'Vollständig geschlossen';

  @override
  String get shading_fully_open => 'Vollständig geöffnet';

  @override
  String get sensor_label_light => 'Licht';

  @override
  String get settings_save_failed => 'Einstellungen konnten nicht gespeichert werden.';

  @override
  String get settings_about_version_loading => 'Laden...';

  @override
  String get app_error_failed_to_start => 'Anwendung konnte nicht gestartet werden';

  @override
  String get app_error_failed_to_start_short => 'Start fehlgeschlagen';

  @override
  String get app_error_unexpected => 'Beim Starten der Anwendung ist ein unerwarteter Fehler aufgetreten.';

  @override
  String get app_error_see_details => 'Ein Fehler ist aufgetreten. Details siehe unten.';

  @override
  String get app_error_restart_button => 'Anwendung neu starten';

  @override
  String get app_error_permit_join_hint => 'Bitten Sie den Administrator, \"Permit Join\" in der Verwaltung zu aktivieren, und starten Sie dann die Anwendung neu.';

  @override
  String get app_error_connection_failed_stored => 'Verbindung zum gespeicherten Backend-Server konnte nicht hergestellt werden.';

  @override
  String app_error_connection_failed_backend(String name, String address) {
    return 'Verbindung zu $name unter $address konnte nicht hergestellt werden';
  }

  @override
  String get app_error_initialization_failed => 'Verbindung zum Backend konnte nicht initialisiert werden.';

  @override
  String app_error_connection_failed_url(String url) {
    return 'Verbindung zu $url konnte nicht hergestellt werden';
  }

  @override
  String get deck_empty_title => 'Keine Seiten konfiguriert';

  @override
  String get deck_empty_description => 'Bitte konfigurieren Sie Ihr Dashboard in der Verwaltung.';

  @override
  String get alert_banner_view_button => 'Anzeigen';

  @override
  String get sensor_chart_label_now => 'Jetzt';

  @override
  String get room_name_fallback => 'Raum';

  @override
  String get weather_tile_not_configured => 'Nicht konfiguriert';

  @override
  String get entry_error_load_security_data => 'Sicherheitsdaten konnten nicht geladen werden';

  @override
  String get entry_locks_all_locked => 'Alle verriegelt';

  @override
  String entry_locks_status_partial(int locked, int total) {
    return '$locked/$total verriegelt';
  }

  @override
  String get entry_alarm_armed => 'Scharf';

  @override
  String get entry_alarm_disarmed => 'Unscharf';

  @override
  String entry_cameras_status_active(int count) {
    return '$count aktiv';
  }

  @override
  String get master_error_load_house_data => 'Hausdaten konnten nicht geladen werden';

  @override
  String master_room_device_count(int online, int total) {
    return '$online/$total Geräte';
  }

  @override
  String get buddy_dismiss => 'Schließen';

  @override
  String get buddy_apply => 'Anwenden';

  @override
  String get buddy_got_it => 'Verstanden';

  @override
  String get buddy_empty_state_message => 'Fragen Sie mich alles über Ihr Zuhause!';

  @override
  String get buddy_init_failed_message => 'Konversation konnte nicht gestartet werden';

  @override
  String get buddy_provider_not_configured_title => 'KI-Anbieter nicht konfiguriert';

  @override
  String get buddy_provider_not_configured_description => 'Konfigurieren Sie einen KI-Anbieter in der Verwaltung, um den Chat zu aktivieren.';

  @override
  String get buddy_thinking => 'Denke nach...';

  @override
  String get buddy_hint_init_failed => 'Konversation konnte nicht gestartet werden';

  @override
  String get buddy_hint_starting_conversation => 'Konversation wird gestartet...';

  @override
  String get buddy_hint_default => 'Fragen Sie über Ihr Zuhause...';

  @override
  String get buddy_error_load_conversations => 'Konversationen konnten nicht geladen werden';

  @override
  String get buddy_error_create_conversation => 'Konversation konnte nicht erstellt werden';

  @override
  String get buddy_error_load_messages => 'Nachrichten konnten nicht geladen werden';

  @override
  String get buddy_error_send_message => 'Nachricht konnte nicht gesendet werden';

  @override
  String get buddy_error_provider_not_configured => 'KI-Anbieter nicht konfiguriert';

  @override
  String get buddy_error_request_timeout => 'Zeitüberschreitung. Bitte versuchen Sie es erneut.';

  @override
  String get buddy_error_connection_error => 'Verbindungsfehler. Bitte prüfen Sie Ihr Netzwerk.';

  @override
  String get buddy_error_generic => 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';

  @override
  String get buddy_hint_recording => 'Audio wird aufgenommen...';

  @override
  String buddy_recording_progress(int seconds, int maxSeconds) {
    return 'Aufnahme... ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_recording_cancel => 'Abbrechen';

  @override
  String get buddy_recording_too_short => 'Aufnahme zu kurz. Halten Sie länger gedrückt.';

  @override
  String get buddy_recording_permission_error => 'Aufnahme konnte nicht gestartet werden. Prüfen Sie die Mikrofonberechtigungen.';

  @override
  String get buddy_voice_listening => 'Höre zu...';

  @override
  String buddy_voice_recording_timer(int seconds, int maxSeconds) {
    return '${seconds}s / ${maxSeconds}s';
  }

  @override
  String buddy_voice_recording_progress(int seconds, int maxSeconds) {
    return 'Aufnahme ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_voice_processing => 'Verarbeite...';

  @override
  String get buddy_voice_transcribing => 'Audio wird transkribiert...';

  @override
  String get security_events_error_unexpected_response => 'Unerwartete Antwort';

  @override
  String media_activation_step_fallback(int index) {
    return 'Schritt $index';
  }

  @override
  String get intent_error_deck_not_initialized => 'Deck nicht initialisiert';

  @override
  String get intent_error_deck_item_not_found => 'Deck-Element nicht gefunden';

  @override
  String get intent_error_no_home_item => 'Kein Startseiten-Element verfügbar';

  @override
  String get intent_error_scenes_not_available => 'Szenendienst nicht verfügbar';

  @override
  String get intent_error_scene_activation_failed => 'Szene konnte nicht aktiviert werden';

  @override
  String get intent_error_scene_activation_error => 'Fehler beim Aktivieren der Szene';

  @override
  String get intent_error_device_repo_not_available => 'Geräte-Eigenschafts-Repository nicht verfügbar';

  @override
  String get intent_error_set_property_failed => 'Eigenschaftswert konnte nicht gesetzt werden';

  @override
  String get intent_error_set_property_error => 'Fehler beim Setzen des Eigenschaftswerts';

  @override
  String get intent_error_toggle_device_failed => 'Gerät konnte nicht umgeschaltet werden';

  @override
  String get intent_error_toggle_device_error => 'Fehler beim Umschalten des Geräts';

  @override
  String get settings_display_screen_lock_never => 'Nie';
}
