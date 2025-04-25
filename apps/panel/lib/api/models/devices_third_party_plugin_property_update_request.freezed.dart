// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_plugin_property_update_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyPluginPropertyUpdateRequest
    _$DevicesThirdPartyPluginPropertyUpdateRequestFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyPluginPropertyUpdateRequest.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyPluginPropertyUpdateRequest {
  /// Unique identifier of the target device.
  String get device => throw _privateConstructorUsedError;

  /// Unique identifier of the target device channel.
  String get channel => throw _privateConstructorUsedError;

  /// Unique identifier of the property being updated.
  String get property => throw _privateConstructorUsedError;

  /// New value to be applied to the property.
  dynamic get value => throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyPluginPropertyUpdateRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyPluginPropertyUpdateRequestCopyWith<
          DevicesThirdPartyPluginPropertyUpdateRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyPluginPropertyUpdateRequestCopyWith<$Res> {
  factory $DevicesThirdPartyPluginPropertyUpdateRequestCopyWith(
          DevicesThirdPartyPluginPropertyUpdateRequest value,
          $Res Function(DevicesThirdPartyPluginPropertyUpdateRequest) then) =
      _$DevicesThirdPartyPluginPropertyUpdateRequestCopyWithImpl<$Res,
          DevicesThirdPartyPluginPropertyUpdateRequest>;
  @useResult
  $Res call({String device, String channel, String property, dynamic value});
}

/// @nodoc
class _$DevicesThirdPartyPluginPropertyUpdateRequestCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyPluginPropertyUpdateRequest>
    implements $DevicesThirdPartyPluginPropertyUpdateRequestCopyWith<$Res> {
  _$DevicesThirdPartyPluginPropertyUpdateRequestCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateRequest
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
abstract class _$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWith<$Res>
    implements $DevicesThirdPartyPluginPropertyUpdateRequestCopyWith<$Res> {
  factory _$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWith(
          _$DevicesThirdPartyPluginPropertyUpdateRequestImpl value,
          $Res Function(_$DevicesThirdPartyPluginPropertyUpdateRequestImpl)
              then) =
      __$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String device, String channel, String property, dynamic value});
}

/// @nodoc
class __$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyPluginPropertyUpdateRequestCopyWithImpl<$Res,
        _$DevicesThirdPartyPluginPropertyUpdateRequestImpl>
    implements
        _$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWith<$Res> {
  __$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWithImpl(
      _$DevicesThirdPartyPluginPropertyUpdateRequestImpl _value,
      $Res Function(_$DevicesThirdPartyPluginPropertyUpdateRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? value = freezed,
  }) {
    return _then(_$DevicesThirdPartyPluginPropertyUpdateRequestImpl(
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
class _$DevicesThirdPartyPluginPropertyUpdateRequestImpl
    implements _DevicesThirdPartyPluginPropertyUpdateRequest {
  const _$DevicesThirdPartyPluginPropertyUpdateRequestImpl(
      {required this.device,
      required this.channel,
      required this.property,
      required this.value});

  factory _$DevicesThirdPartyPluginPropertyUpdateRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyPluginPropertyUpdateRequestImplFromJson(json);

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
    return 'DevicesThirdPartyPluginPropertyUpdateRequest(device: $device, channel: $channel, property: $property, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyPluginPropertyUpdateRequestImpl &&
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

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWith<
          _$DevicesThirdPartyPluginPropertyUpdateRequestImpl>
      get copyWith =>
          __$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWithImpl<
                  _$DevicesThirdPartyPluginPropertyUpdateRequestImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyPluginPropertyUpdateRequestImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyPluginPropertyUpdateRequest
    implements DevicesThirdPartyPluginPropertyUpdateRequest {
  const factory _DevicesThirdPartyPluginPropertyUpdateRequest(
          {required final String device,
          required final String channel,
          required final String property,
          required final dynamic value}) =
      _$DevicesThirdPartyPluginPropertyUpdateRequestImpl;

  factory _DevicesThirdPartyPluginPropertyUpdateRequest.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyPluginPropertyUpdateRequestImpl.fromJson;

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

  /// Create a copy of DevicesThirdPartyPluginPropertyUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyPluginPropertyUpdateRequestImplCopyWith<
          _$DevicesThirdPartyPluginPropertyUpdateRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
