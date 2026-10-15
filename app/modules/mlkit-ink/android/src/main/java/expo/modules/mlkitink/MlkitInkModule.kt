package expo.modules.mlkitink

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// Shapes and error codes: docs/recognizer-contract.md. Must match ios/MlkitInkModule.swift.

class InkPoint : Record {
  @Field val x: Double = 0.0
  @Field val y: Double = 0.0
  @Field val t: Double = 0.0
}

class WritingArea : Record {
  @Field val width: Double = 0.0
  @Field val height: Double = 0.0
}

private fun <T> notImplemented(function: String): T =
  throw CodedException("NOT_IMPLEMENTED", "mlkit-ink (Android): $function is not implemented yet", null)

class MlkitInkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MlkitInk")

    AsyncFunction("isModelDownloaded") { modelId: String ->
      notImplemented<Boolean>("isModelDownloaded")
    }

    AsyncFunction("downloadModel") { modelId: String, wifiOnly: Boolean ->
      notImplemented<Unit>("downloadModel")
    }

    AsyncFunction("deleteModel") { modelId: String ->
      notImplemented<Unit>("deleteModel")
    }

    // Returns [{ text, score }] best-first; score is null when the engine has none.
    AsyncFunction("recognize") { modelId: String, strokes: List<List<InkPoint>>, preContext: String?, writingArea: WritingArea? ->
      notImplemented<List<Map<String, Any?>>>("recognize")
    }
  }
}
