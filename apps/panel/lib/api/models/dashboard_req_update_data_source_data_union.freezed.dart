// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_data_source_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdateDataSourceDataUnion
    _$DashboardReqUpdateDataSourceDataUnionFromJson(Map<String, dynamic> json) {
  return DashboardReqUpdateDataSourceDataUnionDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqUpdateDataSourceDataUnion {
  /// The unique identifier of the associated tile.
  String get tile => throw _privateConstructorUsedError;

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
    required TResult Function(String tile, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String tile, String device, String channel,
            String property, String? icon, String type)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String tile, String device, String channel,
            String property, String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateDataSourceDataUnionDeviceChannel value)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateDataSourceDataUnionDeviceChannel value)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateDataSourceDataUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdateDataSourceDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdateDataSourceDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdateDataSourceDataUnionCopyWith<
          DashboardReqUpdateDataSourceDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdateDataSourceDataUnionCopyWith<$Res> {
  factory $DashboardReqUpdateDataSourceDataUnionCopyWith(
          DashboardReqUpdateDataSourceDataUnion value,
          $Res Function(DashboardReqUpdateDataSourceDataUnion) then) =
      _$DashboardReqUpdateDataSourceDataUnionCopyWithImpl<$Res,
          DashboardReqUpdateDataSourceDataUnion>;
  @useResult
  $Res call(
      {String tile,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class _$DashboardReqUpdateDataSourceDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqUpdateDataSourceDataUnion>
    implements $DashboardReqUpdateDataSourceDataUnionCopyWith<$Res> {
  _$DashboardReqUpdateDataSourceDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdateDataSourceDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tile = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      tile: null == tile
          ? _value.tile
          : tile // ignore: cast_nullable_to_non_nullable
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
abstract class _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWith<
    $Res> implements $DashboardReqUpdateDataSourceDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWith(
          _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl value,
          $Res Function(
                  _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl)
              then) =
      __$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String tile,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWithImpl<
        $Res>
    extends _$DashboardReqUpdateDataSourceDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl>
    implements
        _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWith<
            $Res> {
  __$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWithImpl(
      _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl _value,
      $Res Function(_$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateDataSourceDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tile = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl(
      tile: null == tile
          ? _value.tile
          : tile // ignore: cast_nullable_to_non_nullable
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
class _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl
    implements DashboardReqUpdateDataSourceDataUnionDeviceChannel {
  const _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl(
      {required this.tile,
      required this.device,
      required this.channel,
      required this.property,
      this.icon,
      this.type = 'device-channel'});

  factory _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplFromJson(json);

  /// The unique identifier of the associated tile.
  @override
  final String tile;

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
    return 'DashboardReqUpdateDataSourceDataUnion.deviceChannel(tile: $tile, device: $device, channel: $channel, property: $property, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl &&
            (identical(other.tile, tile) || other.tile == tile) &&
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
      Object.hash(runtimeType, tile, device, channel, property, icon, type);

  /// Create a copy of DashboardReqUpdateDataSourceDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWith<
          _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl>
      get copyWith =>
          __$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWithImpl<
                  _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String tile, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) {
    return deviceChannel(tile, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String tile, String device, String channel,
            String property, String? icon, String type)?
        deviceChannel,
  }) {
    return deviceChannel?.call(tile, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String tile, String device, String channel,
            String property, String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(tile, device, channel, property, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateDataSourceDataUnionDeviceChannel value)
        deviceChannel,
  }) {
    return deviceChannel(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateDataSourceDataUnionDeviceChannel value)?
        deviceChannel,
  }) {
    return deviceChannel?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateDataSourceDataUnionDeviceChannel value)?
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
    return _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdateDataSourceDataUnionDeviceChannel
    implements DashboardReqUpdateDataSourceDataUnion {
  const factory DashboardReqUpdateDataSourceDataUnionDeviceChannel(
          {required final String tile,
          required final String device,
          required final String channel,
          required final String property,
          final String? icon,
          final String type}) =
      _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl;

  factory DashboardReqUpdateDataSourceDataUnionDeviceChannel.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl.fromJson;

  /// The unique identifier of the associated tile.
  @override
  String get tile;

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

  /// Create a copy of DashboardReqUpdateDataSourceDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplCopyWith<
          _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
