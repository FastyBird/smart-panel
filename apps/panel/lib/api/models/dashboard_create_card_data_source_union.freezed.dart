// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_card_data_source_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCardDataSourceUnion _$DashboardCreateCardDataSourceUnionFromJson(
    Map<String, dynamic> json) {
  return DashboardCreateCardDataSourceUnionDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateCardDataSourceUnion {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel within the device.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated property within the channel.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// Specifies the type of data source as linked to a device channel.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateCardDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardDataSourceUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCardDataSourceUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCardDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardDataSourceUnionCopyWith<
          DashboardCreateCardDataSourceUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardDataSourceUnionCopyWith<$Res> {
  factory $DashboardCreateCardDataSourceUnionCopyWith(
          DashboardCreateCardDataSourceUnion value,
          $Res Function(DashboardCreateCardDataSourceUnion) then) =
      _$DashboardCreateCardDataSourceUnionCopyWithImpl<$Res,
          DashboardCreateCardDataSourceUnion>;
  @useResult
  $Res call(
      {String id,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class _$DashboardCreateCardDataSourceUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateCardDataSourceUnion>
    implements $DashboardCreateCardDataSourceUnionCopyWith<$Res> {
  _$DashboardCreateCardDataSourceUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCardDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWith<
    $Res> implements $DashboardCreateCardDataSourceUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWith(
          _$DashboardCreateCardDataSourceUnionDeviceChannelImpl value,
          $Res Function(_$DashboardCreateCardDataSourceUnionDeviceChannelImpl)
              then) =
      __$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardDataSourceUnionCopyWithImpl<$Res,
        _$DashboardCreateCardDataSourceUnionDeviceChannelImpl>
    implements
        _$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWith<$Res> {
  __$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWithImpl(
      _$DashboardCreateCardDataSourceUnionDeviceChannelImpl _value,
      $Res Function(_$DashboardCreateCardDataSourceUnionDeviceChannelImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateCardDataSourceUnionDeviceChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateCardDataSourceUnionDeviceChannelImpl
    implements DashboardCreateCardDataSourceUnionDeviceChannel {
  const _$DashboardCreateCardDataSourceUnionDeviceChannelImpl(
      {required this.id,
      required this.device,
      required this.channel,
      required this.property,
      this.icon,
      this.type = 'device-channel'});

  factory _$DashboardCreateCardDataSourceUnionDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardDataSourceUnionDeviceChannelImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The unique identifier of the associated channel within the device.
  @override
  final String channel;

  /// The unique identifier of the associated property within the channel.
  @override
  final String property;

  /// The icon representing the data source.
  @override
  final String? icon;

  /// Specifies the type of data source as linked to a device channel.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateCardDataSourceUnion.deviceChannel(id: $id, device: $device, channel: $channel, property: $property, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardDataSourceUnionDeviceChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, device, channel, property, icon, type);

  /// Create a copy of DashboardCreateCardDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardCreateCardDataSourceUnionDeviceChannelImpl>
      get copyWith =>
          __$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWithImpl<
                  _$DashboardCreateCardDataSourceUnionDeviceChannelImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) {
    return deviceChannel(id, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
  }) {
    return deviceChannel?.call(id, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(id, device, channel, property, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateCardDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) {
    return deviceChannel(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) {
    return deviceChannel?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardDataSourceUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateCardDataSourceUnionDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardDataSourceUnionDeviceChannel
    implements DashboardCreateCardDataSourceUnion {
  const factory DashboardCreateCardDataSourceUnionDeviceChannel(
          {required final String id,
          required final String device,
          required final String channel,
          required final String property,
          final String? icon,
          final String type}) =
      _$DashboardCreateCardDataSourceUnionDeviceChannelImpl;

  factory DashboardCreateCardDataSourceUnionDeviceChannel.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardDataSourceUnionDeviceChannelImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The unique identifier of the associated channel within the device.
  @override
  String get channel;

  /// The unique identifier of the associated property within the channel.
  @override
  String get property;

  /// The icon representing the data source.
  @override
  String? get icon;

  /// Specifies the type of data source as linked to a device channel.
  @override
  String get type;

  /// Create a copy of DashboardCreateCardDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardCreateCardDataSourceUnionDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
