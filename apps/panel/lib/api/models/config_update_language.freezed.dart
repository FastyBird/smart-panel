// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_update_language.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigUpdateLanguage _$ConfigUpdateLanguageFromJson(Map<String, dynamic> json) {
  return _ConfigUpdateLanguage.fromJson(json);
}

/// @nodoc
mixin _$ConfigUpdateLanguage {
  /// Configuration section type
  ConfigUpdateLanguageType get type => throw _privateConstructorUsedError;

  /// Defines the language and region format.
  ConfigUpdateLanguageLanguage get language =>
      throw _privateConstructorUsedError;

  /// Defines the time zone using the IANA time zone format.
  String get timezone => throw _privateConstructorUsedError;

  /// Sets the time format (12-hour or 24-hour).
  @JsonKey(name: 'time_format')
  ConfigUpdateLanguageTimeFormat get timeFormat =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigUpdateLanguage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigUpdateLanguageCopyWith<ConfigUpdateLanguage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigUpdateLanguageCopyWith<$Res> {
  factory $ConfigUpdateLanguageCopyWith(ConfigUpdateLanguage value,
          $Res Function(ConfigUpdateLanguage) then) =
      _$ConfigUpdateLanguageCopyWithImpl<$Res, ConfigUpdateLanguage>;
  @useResult
  $Res call(
      {ConfigUpdateLanguageType type,
      ConfigUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class _$ConfigUpdateLanguageCopyWithImpl<$Res,
        $Val extends ConfigUpdateLanguage>
    implements $ConfigUpdateLanguageCopyWith<$Res> {
  _$ConfigUpdateLanguageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageTimeFormat,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigUpdateLanguageImplCopyWith<$Res>
    implements $ConfigUpdateLanguageCopyWith<$Res> {
  factory _$$ConfigUpdateLanguageImplCopyWith(_$ConfigUpdateLanguageImpl value,
          $Res Function(_$ConfigUpdateLanguageImpl) then) =
      __$$ConfigUpdateLanguageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigUpdateLanguageType type,
      ConfigUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigUpdateLanguageImplCopyWithImpl<$Res>
    extends _$ConfigUpdateLanguageCopyWithImpl<$Res, _$ConfigUpdateLanguageImpl>
    implements _$$ConfigUpdateLanguageImplCopyWith<$Res> {
  __$$ConfigUpdateLanguageImplCopyWithImpl(_$ConfigUpdateLanguageImpl _value,
      $Res Function(_$ConfigUpdateLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigUpdateLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigUpdateLanguageImpl implements _ConfigUpdateLanguage {
  const _$ConfigUpdateLanguageImpl(
      {required this.type,
      required this.language,
      required this.timezone,
      @JsonKey(name: 'time_format') required this.timeFormat});

  factory _$ConfigUpdateLanguageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigUpdateLanguageImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateLanguageType type;

  /// Defines the language and region format.
  @override
  final ConfigUpdateLanguageLanguage language;

  /// Defines the time zone using the IANA time zone format.
  @override
  final String timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  final ConfigUpdateLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigUpdateLanguage(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigUpdateLanguageImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.timezone, timezone) ||
                other.timezone == timezone) &&
            (identical(other.timeFormat, timeFormat) ||
                other.timeFormat == timeFormat));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, language, timezone, timeFormat);

  /// Create a copy of ConfigUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigUpdateLanguageImplCopyWith<_$ConfigUpdateLanguageImpl>
      get copyWith =>
          __$$ConfigUpdateLanguageImplCopyWithImpl<_$ConfigUpdateLanguageImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigUpdateLanguageImplToJson(
      this,
    );
  }
}

abstract class _ConfigUpdateLanguage implements ConfigUpdateLanguage {
  const factory _ConfigUpdateLanguage(
          {required final ConfigUpdateLanguageType type,
          required final ConfigUpdateLanguageLanguage language,
          required final String timezone,
          @JsonKey(name: 'time_format')
          required final ConfigUpdateLanguageTimeFormat timeFormat}) =
      _$ConfigUpdateLanguageImpl;

  factory _ConfigUpdateLanguage.fromJson(Map<String, dynamic> json) =
      _$ConfigUpdateLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateLanguageType get type;

  /// Defines the language and region format.
  @override
  ConfigUpdateLanguageLanguage get language;

  /// Defines the time zone using the IANA time zone format.
  @override
  String get timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  ConfigUpdateLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigUpdateLanguageImplCopyWith<_$ConfigUpdateLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
