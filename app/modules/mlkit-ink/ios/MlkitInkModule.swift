import ExpoModulesCore

// Shapes and error codes: docs/recognizer-contract.md. Must match the Android module.
// Expo derives the JS error code from the class name: FooException -> "ERR_FOO";
// the JS adapter strips the ERR_ prefix, so name exceptions after contract codes.

struct InkPoint: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var t: Double = 0
}

struct WritingArea: Record {
  @Field var width: Double = 0
  @Field var height: Double = 0
}

struct Candidate: Record {
  @Field var text: String = ""
  @Field var score: Double? = nil
}

final class NotImplementedException: GenericException<String> {
  override var reason: String {
    "mlkit-ink (iOS): \(param) is not implemented yet"
  }
}

public class MlkitInkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MlkitInk")

    AsyncFunction("isModelDownloaded") { (modelId: String) -> Bool in
      throw NotImplementedException("isModelDownloaded")
    }

    AsyncFunction("downloadModel") { (modelId: String, wifiOnly: Bool) in
      throw NotImplementedException("downloadModel")
    }

    AsyncFunction("deleteModel") { (modelId: String) in
      throw NotImplementedException("deleteModel")
    }

    AsyncFunction("recognize") { (modelId: String, strokes: [[InkPoint]], preContext: String?, writingArea: WritingArea?) -> [Candidate] in
      throw NotImplementedException("recognize")
    }
  }
}
