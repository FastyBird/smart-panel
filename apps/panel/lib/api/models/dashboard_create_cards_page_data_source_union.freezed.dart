// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_cards_page_data_source_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCardsPageDataSourceUnion
    _$DashboardCreateCardsPageDataSourceUnionFromJson(
        Map<String, dynamic> json) {
  return DashboardCreateCardsPageDataSourceUnionDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateCardsPageDataSourceUnion {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel within the device.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated property within the channel.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String type, String device,
            String channel, String property, String? icon)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String type, String device, String channel,
            String property, String? icon)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String type, String device, String channel,
            String property, String? icon)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCardsPageDataSourceUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCardsPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardsPageDataSourceUnionCopyWith<
          DashboardCreateCardsPageDataSourceUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardsPageDataSourceUnionCopyWith<$Res> {
  factory $DashboardCreateCardsPageDataSourceUnionCopyWith(
          DashboardCreateCardsPageDataSourceUnion value,
          $Res Function(DashboardCreateCardsPageDataSourceUnion) then) =
      _$DashboardCreateCardsPageDataSourceUnionCopyWithImpl<$Res,
          DashboardCreateCardsPageDataSourceUnion>;
  @useResult
  $Res call(
      {String id,
      String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class _$DashboardCreateCardsPageDataSourceUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateCardsPageDataSourceUnion>
    implements $DashboardCreateCardsPageDataSourceUnionCopyWith<$Res> {
  _$DashboardCreateCardsPageDataSourceUnionCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCardsPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWith<
    $Res> implements $DashboardCreateCardsPageDataSourceUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWith(
          _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl value,
          $Res Function(
                  _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl)
              then) =
      __$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWithImpl<
        $Res>
    extends _$DashboardCreateCardsPageDataSourceUnionCopyWithImpl<$Res,
        _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl>
    implements
        _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWith<
            $Res> {
  __$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWithImpl(
      _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl _value,
      $Res Function(_$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardsPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl
    implements DashboardCreateCardsPageDataSourceUnionDeviceChannel {
  const _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl(
      {required this.id,
      required this.type,
      required this.device,
      required this.channel,
      required this.property,
      this.icon});

  factory _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

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

  @override
  String toString() {
    return 'DashboardCreateCardsPageDataSourceUnion.deviceChannel(id: $id, type: $type, device: $device, channel: $channel, property: $property, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, device, channel, property, icon);

  /// Create a copy of DashboardCreateCardsPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl>
      get copyWith =>
          __$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWithImpl<
                  _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String type, String device,
            String channel, String property, String? icon)
        deviceChannel,
  }) {
    return deviceChannel(id, type, device, channel, property, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String type, String device, String channel,
            String property, String? icon)?
        deviceChannel,
  }) {
    return deviceChannel?.call(id, type, device, channel, property, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String type, String device, String channel,
            String property, String? icon)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(id, type, device, channel, property, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) {
    return deviceChannel(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) {
    return deviceChannel?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(
            DashboardCreateCardsPageDataSourceUnionDeviceChannel value)?
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
    return _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardsPageDataSourceUnionDeviceChannel
    implements DashboardCreateCardsPageDataSourceUnion {
  const factory DashboardCreateCardsPageDataSourceUnionDeviceChannel(
          {required final String id,
          required final String type,
          required final String device,
          required final String channel,
          required final String property,
          final String? icon}) =
      _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl;

  factory DashboardCreateCardsPageDataSourceUnionDeviceChannel.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

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

  /// Create a copy of DashboardCreateCardsPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
