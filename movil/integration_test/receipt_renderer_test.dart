import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// PDF mínimo determinista; no contiene datos personales ni depende de la API.
Uint8List receiptPdfFixture() {
  const stream = 'BT /F1 18 Tf 20 100 Td (UniFundMe receipt) Tj ET';
  final objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ${stream.length} >>\nstream\n$stream\nendstream',
  ];
  final buffer = StringBuffer('%PDF-1.4\n');
  final offsets = <int>[0];
  for (var i = 0; i < objects.length; i++) {
    offsets.add(buffer.length);
    buffer.write('${i + 1} 0 obj\n${objects[i]}\nendobj\n');
  }
  final xref = buffer.length;
  buffer.write('xref\n0 6\n0000000000 65535 f \n');
  for (final offset in offsets.skip(1)) {
    buffer.write('${offset.toString().padLeft(10, '0')} 00000 n \n');
  }
  buffer.write('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n');
  return Uint8List.fromList(utf8.encode(buffer.toString()));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('unifundme/receipt');
  testWidgets(
    'Android renderiza PDF real y rechaza página o contenido inválidos',
    (tester) async {
      final result = await channel.invokeMapMethod<String, Object?>('render', {
        'bytes': receiptPdfFixture(),
        'page': 0,
        'width': 640,
      });
      expect(result?['pages'], 1);
      final png = result!['png'] as Uint8List;
      expect(png.take(8).toList(), [137, 80, 78, 71, 13, 10, 26, 10]);
      await expectLater(
        channel.invokeMethod<Object?>('render', {
          'bytes': receiptPdfFixture(),
          'page': 99,
          'width': 640,
        }),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        channel.invokeMethod<Object?>('render', {
          'bytes': Uint8List.fromList(utf8.encode('%PDF-invalid')),
          'page': 0,
        }),
        throwsA(isA<PlatformException>()),
      );
    },
  );
}
