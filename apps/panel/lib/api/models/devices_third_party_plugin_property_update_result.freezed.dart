// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_plugin_property_update_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyPluginPropertyUpdateResult
    _$DevicesThirdPartyPluginPropertyUpdateResultFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyPluginPropertyUpdateResult.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyPluginPropertyUpdateResult {
  /// Unique identifier of the device for which the update was requested.
  String get device => throw _privateConstructorUsedError;

  /// Unique identifier of the channel that was updated.
  String get channel => throw _privateConstructorUsedError;

  /// Unique identifier of the property that was updated.
  String get property => throw _privateConstructorUsedError;

  /// Status code indicating the outcome of the update request. A value of 0 indicates success, while negative values indicate errors.
  DevicesThirdPartyPluginErrorCode get status =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyPluginPropertyUpdateResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyPluginPropertyUpdateResultCopyWith<
          DevicesThirdPartyPluginPropertyUpdateResult>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyPluginPropertyUpdateResultCopyWith<$Res> {
  factory $DevicesThirdPartyPluginPropertyUpdateResultCopyWith(
          DevicesThirdPartyPluginPropertyUpdateResult value,
          $Res Function(DevicesThirdPartyPluginPropertyUpdateResult) then) =
      _$DevicesThirdPartyPluginPropertyUpdateResultCopyWithImpl<$Res,
          DevicesThirdPartyPluginPropertyUpdateResult>;
  @useResult
  $Res call(
      {String device,
      String channel,
      String property,
      DevicesThirdPartyPluginErrorCode status});
}

/// @nodoc
class _$DevicesThirdPartyPluginPropertyUpdateResultCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyPluginPropertyUpdateResult>
    implements $DevicesThirdPartyPluginPropertyUpdateResultCopyWith<$Res> {
  _$DevicesThirdPartyPluginPropertyUpdateResultCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? status = null,
  }) {
    return _then(_value.copyWith(
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as DevicesThirdPartyPluginErrorCode,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWith<$Res>
    implements $DevicesThirdPartyPluginPropertyUpdateResultCopyWith<$Res> {
  factory _$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWith(
          _$DevicesThirdPartyPluginPropertyUpdateResultImpl value,
          $Res Function(_$DevicesThirdPartyPluginPropertyUpdateResultImpl)
              then) =
      __$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String device,
      String channel,
      String property,
      DevicesThirdPartyPluginErrorCode status});
}

/// @nodoc
class __$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyPluginPropertyUpdateResultCopyWithImpl<$Res,
        _$DevicesThirdPartyPluginPropertyUpdateResultImpl>
    implements
        _$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWith<$Res> {
  __$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWithImpl(
      _$DevicesThirdPartyPluginPropertyUpdateResultImpl _value,
      $Res Function(_$DevicesThirdPartyPluginPropertyUpdateResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? status = null,
  }) {
    return _then(_$DevicesThirdPartyPluginPropertyUpdateResultImpl(
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as DevicesThirdPartyPluginErrorCode,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesThirdPartyPluginPropertyUpdateResultImpl
    implements _DevicesThirdPartyPluginPropertyUpdateResult {
  const _$DevicesThirdPartyPluginPropertyUpdateResultImpl(
      {required this.device,
      required this.channel,
      required this.property,
      required this.status});

  factory _$DevicesThirdPartyPluginPropertyUpdateResultImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyPluginPropertyUpdateResultImplFromJson(json);

  /// Unique identifier of the device for which the update was requested.
  @override
  final String device;

  /// Unique identifier of the channel that was updated.
  @override
  final String channel;

  /// Unique identifier of the property that was updated.
  @override
  final String property;

  /// Status code indicating the outcome of the update request. A value of 0 indicates success, while negative values indicate errors.
  @override
  final DevicesThirdPartyPluginErrorCode status;

  @override
  String toString() {
    return 'DevicesThirdPartyPluginPropertyUpdateResult(device: $device, channel: $channel, property: $property, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyPluginPropertyUpdateResultImpl &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, device, channel, property, status);

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWith<
          _$DevicesThirdPartyPluginPropertyUpdateResultImpl>
      get copyWith =>
          __$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWithImpl<
                  _$DevicesThirdPartyPluginPropertyUpdateResultImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyPluginPropertyUpdateResultImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyPluginPropertyUpdateResult
    implements DevicesThirdPartyPluginPropertyUpdateResult {
  const factory _DevicesThirdPartyPluginPropertyUpdateResult(
          {required final String device,
          required final String channel,
          required final String property,
          required final DevicesThirdPartyPluginErrorCode status}) =
      _$DevicesThirdPartyPluginPropertyUpdateResultImpl;

  factory _DevicesThirdPartyPluginPropertyUpdateResult.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyPluginPropertyUpdateResultImpl.fromJson;

  /// Unique identifier of the device for which the update was requested.
  @override
  String get device;

  /// Unique identifier of the channel that was updated.
  @override
  String get channel;

  /// Unique identifier of the property that was updated.
  @override
  String get property;

  /// Status code indicating the outcome of the update request. A value of 0 indicates success, while negative values indicate errors.
  @override
  DevicesThirdPartyPluginErrorCode get status;

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyPluginPropertyUpdateResultImplCopyWith<
          _$DevicesThirdPartyPluginPropertyUpdateResultImpl>
      get copyWith => throw _privateConstructorUsedError;
}
