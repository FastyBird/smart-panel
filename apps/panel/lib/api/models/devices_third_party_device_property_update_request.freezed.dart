// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_device_property_update_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyDevicePropertyUpdateRequest
    _$DevicesThirdPartyDevicePropertyUpdateRequestFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyDevicePropertyUpdateRequest.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyDevicePropertyUpdateRequest {
  /// Unique identifier of the target device.
  String get device => throw _privateConstructorUsedError;

  /// Unique identifier of the target device channel.
  String get channel => throw _privateConstructorUsedError;

  /// Unique identifier of the property being updated.
  String get property => throw _privateConstructorUsedError;

  /// New value to be applied to the property.
  dynamic get value => throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyDevicePropertyUpdateRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyDevicePropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyDevicePropertyUpdateRequestCopyWith<
          DevicesThirdPartyDevicePropertyUpdateRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyDevicePropertyUpdateRequestCopyWith<$Res> {
  factory $DevicesThirdPartyDevicePropertyUpdateRequestCopyWith(
          DevicesThirdPartyDevicePropertyUpdateRequest value,
          $Res Function(DevicesThirdPartyDevicePropertyUpdateRequest) then) =
      _$DevicesThirdPartyDevicePropertyUpdateRequestCopyWithImpl<$Res,
          DevicesThirdPartyDevicePropertyUpdateRequest>;
  @useResult
  $Res call({String device, String channel, String property, dynamic value});
}

/// @nodoc
class _$DevicesThirdPartyDevicePropertyUpdateRequestCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyDevicePropertyUpdateRequest>
    implements $DevicesThirdPartyDevicePropertyUpdateRequestCopyWith<$Res> {
  _$DevicesThirdPartyDevicePropertyUpdateRequestCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyDevicePropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? value = freezed,
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
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWith<$Res>
    implements $DevicesThirdPartyDevicePropertyUpdateRequestCopyWith<$Res> {
  factory _$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWith(
          _$DevicesThirdPartyDevicePropertyUpdateRequestImpl value,
          $Res Function(_$DevicesThirdPartyDevicePropertyUpdateRequestImpl)
              then) =
      __$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String device, String channel, String property, dynamic value});
}

/// @nodoc
class __$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyDevicePropertyUpdateRequestCopyWithImpl<$Res,
        _$DevicesThirdPartyDevicePropertyUpdateRequestImpl>
    implements
        _$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWith<$Res> {
  __$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWithImpl(
      _$DevicesThirdPartyDevicePropertyUpdateRequestImpl _value,
      $Res Function(_$DevicesThirdPartyDevicePropertyUpdateRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyDevicePropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? value = freezed,
  }) {
    return _then(_$DevicesThirdPartyDevicePropertyUpdateRequestImpl(
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
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesThirdPartyDevicePropertyUpdateRequestImpl
    implements _DevicesThirdPartyDevicePropertyUpdateRequest {
  const _$DevicesThirdPartyDevicePropertyUpdateRequestImpl(
      {required this.device,
      required this.channel,
      required this.property,
      required this.value});

  factory _$DevicesThirdPartyDevicePropertyUpdateRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyDevicePropertyUpdateRequestImplFromJson(json);

  /// Unique identifier of the target device.
  @override
  final String device;

  /// Unique identifier of the target device channel.
  @override
  final String channel;

  /// Unique identifier of the property being updated.
  @override
  final String property;

  /// New value to be applied to the property.
  @override
  final dynamic value;

  @override
  String toString() {
    return 'DevicesThirdPartyDevicePropertyUpdateRequest(device: $device, channel: $channel, property: $property, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyDevicePropertyUpdateRequestImpl &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            const DeepCollectionEquality().equals(other.value, value));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, device, channel, property,
      const DeepCollectionEquality().hash(value));

  /// Create a copy of DevicesThirdPartyDevicePropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWith<
          _$DevicesThirdPartyDevicePropertyUpdateRequestImpl>
      get copyWith =>
          __$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWithImpl<
                  _$DevicesThirdPartyDevicePropertyUpdateRequestImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyDevicePropertyUpdateRequestImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyDevicePropertyUpdateRequest
    implements DevicesThirdPartyDevicePropertyUpdateRequest {
  const factory _DevicesThirdPartyDevicePropertyUpdateRequest(
          {required final String device,
          required final String channel,
          required final String property,
          required final dynamic value}) =
      _$DevicesThirdPartyDevicePropertyUpdateRequestImpl;

  factory _DevicesThirdPartyDevicePropertyUpdateRequest.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyDevicePropertyUpdateRequestImpl.fromJson;

  /// Unique identifier of the target device.
  @override
  String get device;

  /// Unique identifier of the target device channel.
  @override
  String get channel;

  /// Unique identifier of the property being updated.
  @override
  String get property;

  /// New value to be applied to the property.
  @override
  dynamic get value;

  /// Create a copy of DevicesThirdPartyDevicePropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyDevicePropertyUpdateRequestImplCopyWith<
          _$DevicesThirdPartyDevicePropertyUpdateRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
