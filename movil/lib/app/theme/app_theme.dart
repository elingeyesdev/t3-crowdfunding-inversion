import 'package:flutter/material.dart';

abstract final class AppTheme {
  // Color provisional, conservado de la aplicación inicial.
  static final ThemeData light = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
    appBarTheme: const AppBarTheme(centerTitle: false),
  );
}
