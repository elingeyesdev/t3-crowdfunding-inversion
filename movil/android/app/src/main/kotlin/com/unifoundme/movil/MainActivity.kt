package com.unifoundme.movil

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMethodCodec
import java.io.File
import java.io.ByteArrayOutputStream
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import kotlin.math.min
import kotlin.math.roundToInt

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Cola nativa serial: parsear y renderizar PDF nunca bloquea el hilo de UI.
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        MethodChannel(messenger, "unifundme/receipt", StandardMethodCodec.INSTANCE, messenger.makeBackgroundTaskQueue())
            .setMethodCallHandler { call, result ->
                if (call.method != "render") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                var temporary: File? = null
                try {
                    val bytes = call.argument<ByteArray>("bytes")
                        ?: throw IllegalArgumentException()
                    val index = call.argument<Int>("page") ?: 0
                    val width = (call.argument<Int>("width") ?: 1400).coerceIn(320, 1600)
                    require(bytes.size in 5..(10 * 1024 * 1024))
                    require(bytes.take(5).toByteArray().contentEquals("%PDF-".toByteArray()))
                    temporary = File.createTempFile("unifundme-receipt-", ".pdf", cacheDir)
                    temporary.writeBytes(bytes)
                    val descriptor = ParcelFileDescriptor.open(temporary, ParcelFileDescriptor.MODE_READ_ONLY)
                    descriptor.use {
                        PdfRenderer(it).use { renderer ->
                            require(renderer.pageCount in 1..200 && index in 0 until renderer.pageCount)
                            renderer.openPage(index).use { page ->
                                require(page.width > 0 && page.height > 0)
                                val scale = min(width.toDouble() / page.width, 3200.0 / page.height)
                                val bitmap = Bitmap.createBitmap(
                                    (page.width * scale).roundToInt().coerceAtLeast(1),
                                    (page.height * scale).roundToInt().coerceAtLeast(1),
                                    Bitmap.Config.ARGB_8888
                                )
                                try {
                                    bitmap.eraseColor(Color.WHITE)
                                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                    val output = ByteArrayOutputStream()
                                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
                                    result.success(mapOf("png" to output.toByteArray(), "pages" to renderer.pageCount))
                                } finally { bitmap.recycle() }
                            }
                        }
                    }
                } catch (_: Exception) {
                    // No enviar rutas, contenido de recibos ni excepciones nativas a Dart.
                    result.error("receipt_unavailable", "No se pudo mostrar el comprobante.", null)
                } finally {
                    temporary?.delete()
                }
            }
    }
}
