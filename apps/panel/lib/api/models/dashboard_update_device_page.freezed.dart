// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_device_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateDevicePage _$DashboardUpdateDevicePageFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateDevicePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateDevicePage {
  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// Indicates that this is a tiles dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateDevicePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateDevicePageCopyWith<DashboardUpdateDevicePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateDevicePageCopyWith<$Res> {
  factory $DashboardUpdateDevicePageCopyWith(DashboardUpdateDevicePage value,
          $Res Function(DashboardUpdateDevicePage) then) =
      _$DashboardUpdateDevicePageCopyWithImpl<$Res, DashboardUpdateDevicePage>;
  @useResult
  $Res call(
      {String title, int order, String device, String type, String? icon});
}

/// @nodoc
class _$DashboardUpdateDevicePageCopyWithImpl<$Res,
        $Val extends DashboardUpdateDevicePage>
    implements $DashboardUpdateDevicePageCopyWith<$Res> {
  _$DashboardUpdateDevicePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateDevicePageImplCopyWith<$Res>
    implements $DashboardUpdateDevicePageCopyWith<$Res> {
  factory _$$DashboardUpdateDevicePageImplCopyWith(
          _$DashboardUpdateDevicePageImpl value,
          $Res Function(_$DashboardUpdateDevicePageImpl) then) =
      __$$DashboardUpdateDevicePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String title, int order, String device, String type, String? icon});
}

/// @nodoc
class __$$DashboardUpdateDevicePageImplCopyWithImpl<$Res>
    extends _$DashboardUpdateDevicePageCopyWithImpl<$Res,
        _$DashboardUpdateDevicePageImpl>
    implements _$$DashboardUpdateDevicePageImplCopyWith<$Res> {
  __$$DashboardUpdateDevicePageImplCopyWithImpl(
      _$DashboardUpdateDevicePageImpl _value,
      $Res Function(_$DashboardUpdateDevicePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardUpdateDevicePageImpl(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
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
class _$DashboardUpdateDevicePageImpl implements _DashboardUpdateDevicePage {
  const _$DashboardUpdateDevicePageImpl(
      {required this.title,
      required this.order,
      required this.device,
      this.type = 'device',
      this.icon});

  factory _$DashboardUpdateDevicePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateDevicePageImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardUpdateDevicePage(title: $title, order: $order, device: $device, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateDevicePageImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, title, order, device, type, icon);

  /// Create a copy of DashboardUpdateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDevicePageImplCopyWith<_$DashboardUpdateDevicePageImpl>
      get copyWith => __$$DashboardUpdateDevicePageImplCopyWithImpl<
          _$DashboardUpdateDevicePageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDevicePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateDevicePage implements DashboardUpdateDevicePage {
  const factory _DashboardUpdateDevicePage(
      {required final String title,
      required final int order,
      required final String device,
      final String type,
      final String? icon}) = _$DashboardUpdateDevicePageImpl;

  factory _DashboardUpdateDevicePage.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateDevicePageImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardUpdateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDevicePageImplCopyWith<_$DashboardUpdateDevicePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
