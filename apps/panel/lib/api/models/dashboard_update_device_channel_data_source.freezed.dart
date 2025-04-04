// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_device_channel_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateDeviceChannelDataSource
    _$DashboardUpdateDeviceChannelDataSourceFromJson(
        Map<String, dynamic> json) {
  return _DashboardUpdateDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateDeviceChannelDataSource {
  /// Specifies the type of data source.
  String get type => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel within the device.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated property within the channel.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateDeviceChannelDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateDeviceChannelDataSourceCopyWith<
          DashboardUpdateDeviceChannelDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateDeviceChannelDataSourceCopyWith<$Res> {
  factory $DashboardUpdateDeviceChannelDataSourceCopyWith(
          DashboardUpdateDeviceChannelDataSource value,
          $Res Function(DashboardUpdateDeviceChannelDataSource) then) =
      _$DashboardUpdateDeviceChannelDataSourceCopyWithImpl<$Res,
          DashboardUpdateDeviceChannelDataSource>;
  @useResult
  $Res call(
      {String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class _$DashboardUpdateDeviceChannelDataSourceCopyWithImpl<$Res,
        $Val extends DashboardUpdateDeviceChannelDataSource>
    implements $DashboardUpdateDeviceChannelDataSourceCopyWith<$Res> {
  _$DashboardUpdateDeviceChannelDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$DashboardUpdateDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardUpdateDeviceChannelDataSourceCopyWith<$Res> {
  factory _$$DashboardUpdateDeviceChannelDataSourceImplCopyWith(
          _$DashboardUpdateDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardUpdateDeviceChannelDataSourceImpl) then) =
      __$$DashboardUpdateDeviceChannelDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class __$$DashboardUpdateDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardUpdateDeviceChannelDataSourceCopyWithImpl<$Res,
        _$DashboardUpdateDeviceChannelDataSourceImpl>
    implements _$$DashboardUpdateDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardUpdateDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardUpdateDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardUpdateDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardUpdateDeviceChannelDataSourceImpl(
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
class _$DashboardUpdateDeviceChannelDataSourceImpl
    implements _DashboardUpdateDeviceChannelDataSource {
  const _$DashboardUpdateDeviceChannelDataSourceImpl(
      {required this.type,
      required this.device,
      required this.channel,
      required this.property,
      this.icon});

  factory _$DashboardUpdateDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardUpdateDeviceChannelDataSourceImplFromJson(json);

  /// Specifies the type of data source.
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
    return 'DashboardUpdateDeviceChannelDataSource(type: $type, device: $device, channel: $channel, property: $property, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateDeviceChannelDataSourceImpl &&
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
      Object.hash(runtimeType, type, device, channel, property, icon);

  /// Create a copy of DashboardUpdateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDeviceChannelDataSourceImplCopyWith<
          _$DashboardUpdateDeviceChannelDataSourceImpl>
      get copyWith =>
          __$$DashboardUpdateDeviceChannelDataSourceImplCopyWithImpl<
              _$DashboardUpdateDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateDeviceChannelDataSource
    implements DashboardUpdateDeviceChannelDataSource {
  const factory _DashboardUpdateDeviceChannelDataSource(
      {required final String type,
      required final String device,
      required final String channel,
      required final String property,
      final String? icon}) = _$DashboardUpdateDeviceChannelDataSourceImpl;

  factory _DashboardUpdateDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardUpdateDeviceChannelDataSourceImpl.fromJson;

  /// Specifies the type of data source.
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

  /// Create a copy of DashboardUpdateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDeviceChannelDataSourceImplCopyWith<
          _$DashboardUpdateDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
