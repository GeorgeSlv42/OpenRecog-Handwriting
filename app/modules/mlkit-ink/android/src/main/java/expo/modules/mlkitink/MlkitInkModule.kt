package expo.modules.mlkitink

import com.google.android.gms.tasks.Task
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions
import com.google.mlkit.vision.digitalink.recognition.Ink
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext
import com.google.mlkit.vision.digitalink.recognition.WritingArea as MlKitWritingArea
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// Shapes and error codes: docs/recognizer-contract.md. Must match ios/MlkitInkModule.swift.

class InkPoint : Record {
  @Field val x: Double = Double.NaN
  @Field val y: Double = Double.NaN
  @Field val t: Double = Double.NaN
}

class WritingArea : Record {
  @Field val width: Double = 0.0
  @Field val height: Double = 0.0
}

class MlkitInkModule : Module() {
  private val modelManager by lazy { RemoteModelManager.getInstance() }
  // Serialize model deletion/download with recognition so a model cannot disappear mid-call.
  private val operations = Mutex()
  private val lifecycleLock = Any()
  private val recognizers = mutableMapOf<String, DigitalInkRecognizer>()
  private var destroyed = false

  override fun definition() = ModuleDefinition {
    Name("MlkitInk")

    AsyncFunction("isModelDownloaded") Coroutine { modelId: String ->
      operation("RECOGNITION_FAILED", "Could not check model '$modelId'") {
        modelManager.isModelDownloaded(model(modelId)).awaitResult()
      }
    }

    AsyncFunction("downloadModel") Coroutine { modelId: String, wifiOnly: Boolean ->
      operation("DOWNLOAD_FAILED", "Could not download '$modelId'. Check your connection and free storage") {
        val conditions = DownloadConditions.Builder().apply {
          if (wifiOnly) requireWifi()
        }.build()
        modelManager.download(model(modelId), conditions).awaitResult()
        Unit
      }
    }

    AsyncFunction("deleteModel") Coroutine { modelId: String ->
      // The shared contract has no DELETE_FAILED code; use its general engine failure.
      operation("RECOGNITION_FAILED", "Could not delete model '$modelId'") {
        val target = model(modelId)
        synchronized(lifecycleLock) { recognizers.remove(modelId)?.close() }
        modelManager.deleteDownloadedModel(target).awaitResult()
        Unit
      }
    }

    // Returns [{ text, score }] best-first; score is null when the engine has none.
    AsyncFunction("recognize") Coroutine { modelId: String, strokes: List<List<InkPoint>>, preContext: String?, writingArea: WritingArea? ->
      operation("RECOGNITION_FAILED", "Could not recognize ink with '$modelId'") {
        val target = model(modelId)
        val ink = buildInk(strokes)
        val context = RecognitionContext.builder().apply {
          // ML Kit 19 requires this builder property even for the first line of ink.
          setPreContext(preContext ?: "")
          if (writingArea != null) {
            require(writingArea.width.toFloat().isFinite() && writingArea.width > 0 &&
              writingArea.height.toFloat().isFinite() && writingArea.height > 0) {
              "Writing area must have finite, positive dimensions"
            }
            setWritingArea(MlKitWritingArea(writingArea.width.toFloat(), writingArea.height.toFloat()))
          }
        }.build()
        if (!modelManager.isModelDownloaded(target).awaitResult()) {
          throw CodedException("MODEL_NOT_DOWNLOADED", "Download model '$modelId' before recognizing ink", null)
        }
        // Starting a task and destroying the module must not race to create a leaked client.
        val task = synchronized(lifecycleLock) {
          check(!destroyed) { "Recognition module has been destroyed" }
          val recognizer = recognizers.getOrPut(modelId) {
            DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(target).build())
          }
          recognizer.recognize(ink, context)
        }
        task.awaitResult().candidates.map { candidate ->
          mapOf<String, Any?>("text" to candidate.text, "score" to candidate.score)
        }
      }
    }

    OnDestroy {
      synchronized(lifecycleLock) {
        destroyed = true
        recognizers.values.forEach { it.close() }
        recognizers.clear()
      }
    }
  }

  private fun model(modelId: String): DigitalInkRecognitionModel {
    val identifier = try {
      DigitalInkRecognitionModelIdentifier.fromLanguageTag(modelId)
    } catch (error: Exception) {
      throw CodedException("INVALID_MODEL_ID", "Invalid recognition model '$modelId'", error)
    } ?: throw CodedException("INVALID_MODEL_ID", "No ML Kit model supports '$modelId'", null)
    return DigitalInkRecognitionModel.builder(identifier).build()
  }

  private fun buildInk(strokes: List<List<InkPoint>>): Ink {
    require(strokes.isNotEmpty()) { "Ink must contain at least one stroke" }
    val ink = Ink.builder()
    strokes.forEach { points ->
      require(points.isNotEmpty()) { "Ink strokes must not be empty" }
      var previousTime = -1.0
      val stroke = Ink.Stroke.builder()
      points.forEach { point ->
        require(point.x.toFloat().isFinite() && point.y.toFloat().isFinite()) {
          "Ink coordinates must be finite"
        }
        require(point.t.isFinite() && point.t >= 0 && point.t < Long.MAX_VALUE.toDouble() && point.t >= previousTime) {
          "Ink timestamps must be nonnegative milliseconds in drawing order"
        }
        previousTime = point.t
        stroke.addPoint(Ink.Point.create(point.x.toFloat(), point.y.toFloat(), point.t.toLong()))
      }
      ink.addStroke(stroke.build())
    }
    return ink.build()
  }

  private suspend fun <T> operation(code: String, message: String, block: suspend () -> T): T =
    withContext(Dispatchers.Default) {
      operations.withLock {
        try {
          synchronized(lifecycleLock) { check(!destroyed) { "Recognition module has been destroyed" } }
          block()
        } catch (error: CancellationException) {
          throw error
        } catch (error: CodedException) {
          throw error
        } catch (error: Exception) {
          throw CodedException(code, "$message: ${error.localizedMessage ?: "unknown error"}", error)
        }
      }
    }
}

// Suspend without blocking a thread or adding kotlinx-coroutines-play-services.
// Expo cancels the module scope on teardown; ML Kit tasks may finish after cancellation.
private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
  addOnCompleteListener { task ->
    if (task.isCanceled) continuation.resumeWithException(IllegalStateException("ML Kit task was canceled"))
    else if (task.isSuccessful) continuation.resume(task.result)
    else continuation.resumeWithException(task.exception ?: IllegalStateException("ML Kit task failed"))
  }
}
