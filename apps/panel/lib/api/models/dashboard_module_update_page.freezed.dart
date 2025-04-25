// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_update_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleUpdatePage _$DashboardModuleUpdatePageFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleUpdatePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleUpdatePage {
  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleUpdatePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleUpdatePageCopyWith<DashboardModuleUpdatePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleUpdatePageCopyWith<$Res> {
  factory $DashboardModuleUpdatePageCopyWith(DashboardModuleUpdatePage value,
          $Res Function(DashboardModuleUpdatePage) then) =
      _$DashboardModuleUpdatePageCopyWithImpl<$Res, DashboardModuleUpdatePage>;
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class _$DashboardModuleUpdatePageCopyWithImpl<$Res,
        $Val extends DashboardModuleUpdatePage>
    implements $DashboardModuleUpdatePageCopyWith<$Res> {
  _$DashboardModuleUpdatePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardModuleUpdatePageImplCopyWith<$Res>
    implements $DashboardModuleUpdatePageCopyWith<$Res> {
  factory _$$DashboardModuleUpdatePageImplCopyWith(
          _$DashboardModuleUpdatePageImpl value,
          $Res Function(_$DashboardModuleUpdatePageImpl) then) =
      __$$DashboardModuleUpdatePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class __$$DashboardModuleUpdatePageImplCopyWithImpl<$Res>
    extends _$DashboardModuleUpdatePageCopyWithImpl<$Res,
        _$DashboardModuleUpdatePageImpl>
    implements _$$DashboardModuleUpdatePageImplCopyWith<$Res> {
  __$$DashboardModuleUpdatePageImplCopyWithImpl(
      _$DashboardModuleUpdatePageImpl _value,
      $Res Function(_$DashboardModuleUpdatePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardModuleUpdatePageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleUpdatePageImpl implements _DashboardModuleUpdatePage {
  const _$DashboardModuleUpdatePageImpl(
      {required this.type,
      required this.title,
      required this.order,
      this.icon});

  factory _$DashboardModuleUpdatePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardModuleUpdatePageImplFromJson(json);

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardModuleUpdatePage(type: $type, title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleUpdatePageImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, title, order, icon);

  /// Create a copy of DashboardModuleUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleUpdatePageImplCopyWith<_$DashboardModuleUpdatePageImpl>
      get copyWith => __$$DashboardModuleUpdatePageImplCopyWithImpl<
          _$DashboardModuleUpdatePageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleUpdatePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleUpdatePage implements DashboardModuleUpdatePage {
  const factory _DashboardModuleUpdatePage(
      {required final String type,
      required final String title,
      required final int order,
      final String? icon}) = _$DashboardModuleUpdatePageImpl;

  factory _DashboardModuleUpdatePage.fromJson(Map<String, dynamic> json) =
      _$DashboardModuleUpdatePageImpl.fromJson;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardModuleUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleUpdatePageImplCopyWith<_$DashboardModuleUpdatePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
