import ExpoModulesCore

#if canImport(MLKit)
import MLKit
#elseif canImport(MLKitDigitalInkRecognition)
import MLKitCommon
import MLKitDigitalInkRecognition
#endif

// Shapes and error codes: docs/recognizer-contract.md. Must match the Android module.
// Expo derives the JS error code from the class name: FooException -> "ERR_FOO";
// the JS adapter strips the ERR_ prefix, so name exceptions after contract codes.

struct InkPoint: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var t: Double = 0
}

struct InkWritingArea: Record {
  @Field var width: Double = 0
  @Field var height: Double = 0
}

struct Candidate: Record {
  @Field var text: String = ""
  @Field var score: Double? = nil
}

final class ModelNotDownloadedException: GenericException<String> {
  override var reason: String {
    "Recognition model \"\(param)\" is not downloaded. Download it first, then try again."
  }
}

final class InvalidModelIdException: GenericException<String> {
  override var reason: String {
    "Unknown recognition model \"\(param)\". Use a BCP-47 language tag ML Kit supports (for example en-US) or a gesture id such as en-US-x-gesture."
  }
}

final class DownloadFailedException: GenericException<String> {
  override var reason: String { param }
}

final class RecognitionFailedException: GenericException<String> {
  override var reason: String { param }
}

public class MlkitInkModule: Module {
  private let modelManager = ModelManager.modelManager()
  private let stateQueue = DispatchQueue(label: "com.openrecog.mlkit-ink")
  private let downloadTimeout: TimeInterval = 120
  private var recognizers: [String: DigitalInkRecognizer] = [:]
  private var downloadWaiters: [String: [(Promise, DispatchWorkItem)]] = [:]
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("MlkitInk")

    OnCreate {
      self.registerDownloadObservers()
    }

    OnDestroy {
      self.teardown()
    }

    AsyncFunction("isModelDownloaded") { (modelId: String) -> Bool in
      let model = try self.model(for: modelId)
      return self.modelManager.isModelDownloaded(model)
    }

    AsyncFunction("downloadModel") { (modelId: String, wifiOnly: Bool, promise: Promise) in
      self.downloadModel(modelId: modelId, wifiOnly: wifiOnly, promise: promise)
    }

    AsyncFunction("deleteModel") { (modelId: String, promise: Promise) in
      self.deleteModel(modelId: modelId, promise: promise)
    }

    AsyncFunction("recognize") { (modelId: String, strokes: [[InkPoint]], preContext: String?, writingArea: InkWritingArea?, promise: Promise) in
      self.recognize(modelId: modelId, strokes: strokes, preContext: preContext, writingArea: writingArea, promise: promise)
    }
  }

  private func model(for modelId: String) throws -> DigitalInkRecognitionModel {
    guard let identifier = DigitalInkRecognitionModelIdentifier(forLanguageTag: modelId) else {
      throw InvalidModelIdException(modelId)
    }
    return DigitalInkRecognitionModel(modelIdentifier: identifier)
  }

  private func downloadModel(modelId: String, wifiOnly: Bool, promise: Promise) {
    let model: DigitalInkRecognitionModel
    do {
      model = try self.model(for: modelId)
    } catch {
      reject(promise, error)
      return
    }

    if modelManager.isModelDownloaded(model) {
      promise.resolve()
      return
    }

    let key = model.modelIdentifier.languageTag
    let timeout = DispatchWorkItem { [weak self] in
      self?.finishDownload(
        key: key,
        result: .failure(DownloadFailedException("Timed out downloading recognition model \"\(modelId)\". Check the network and try again."))
      )
    }

    var shouldStart = false
    stateQueue.sync {
      if downloadWaiters[key] == nil {
        downloadWaiters[key] = []
      }
      shouldStart = downloadWaiters[key]?.isEmpty ?? true
      downloadWaiters[key]?.append((promise, timeout))
    }

    DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + downloadTimeout, execute: timeout)

    if shouldStart {
      let conditions = ModelDownloadConditions(
        allowsCellularAccess: !wifiOnly,
        allowsBackgroundDownloading: true
      )
      modelManager.download(model, conditions: conditions)
    }
  }

  private func deleteModel(modelId: String, promise: Promise) {
    let model: DigitalInkRecognitionModel
    do {
      model = try self.model(for: modelId)
    } catch {
      reject(promise, error)
      return
    }

    dropRecognizer(modelId: modelId)

    if !modelManager.isModelDownloaded(model) {
      promise.resolve()
      return
    }

    modelManager.deleteDownloadedModel(model) { error in
      if let error {
        promise.reject(DownloadFailedException("Could not delete recognition model \"\(modelId)\": \(error.localizedDescription)"))
        return
      }
      promise.resolve()
    }
  }

  private func recognize(
    modelId: String,
    strokes: [[InkPoint]],
    preContext: String?,
    writingArea: InkWritingArea?,
    promise: Promise
  ) {
    let model: DigitalInkRecognitionModel
    do {
      model = try self.model(for: modelId)
    } catch {
      reject(promise, error)
      return
    }

    guard modelManager.isModelDownloaded(model) else {
      promise.reject(ModelNotDownloadedException(modelId))
      return
    }

    let inkStrokes: [Stroke] = strokes.compactMap { points in
      guard !points.isEmpty else { return nil }
      let strokePoints = points.map { point in
        StrokePoint(x: Float(point.x), y: Float(point.y), t: Int(point.t.rounded()))
      }
      return Stroke(points: strokePoints)
    }

    if inkStrokes.isEmpty {
      promise.resolve([Candidate]())
      return
    }

    let recognizer = cachedRecognizer(modelId: modelId, model: model)
    let ink = Ink(strokes: inkStrokes)

    Task {
      do {
        let result: DigitalInkRecognitionResult
        if preContext != nil || writingArea != nil {
          var area: WritingArea?
          if let writingArea {
            area = WritingArea(width: Float(writingArea.width), height: Float(writingArea.height))
          }
          let context = DigitalInkRecognitionContext(preContext: preContext, writingArea: area)
          result = try await recognizer.recognize(ink: ink, context: context)
        } else {
          result = try await recognizer.recognize(ink: ink)
        }
        let candidates = result.candidates.map { item -> Candidate in
          var candidate = Candidate()
          candidate.text = item.text
          candidate.score = item.score?.doubleValue
          return candidate
        }
        promise.resolve(candidates)
      } catch {
        promise.reject(RecognitionFailedException(error.localizedDescription))
      }
    }
  }

  private func cachedRecognizer(modelId: String, model: DigitalInkRecognitionModel) -> DigitalInkRecognizer {
    stateQueue.sync {
      if let existing = recognizers[modelId] {
        return existing
      }
      let created = DigitalInkRecognizer.digitalInkRecognizer(options: DigitalInkRecognizerOptions(model: model))
      recognizers[modelId] = created
      return created
    }
  }

  private func dropRecognizer(modelId: String) {
    stateQueue.sync {
      recognizers.removeValue(forKey: modelId)
    }
  }

  private func registerDownloadObservers() {
    let success = NotificationCenter.default.addObserver(
      forName: .mlkitModelDownloadDidSucceed,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let key = self?.modelKey(from: notification) else { return }
      self?.finishDownload(key: key, result: .success(()))
    }
    let failure = NotificationCenter.default.addObserver(
      forName: .mlkitModelDownloadDidFail,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let self, let key = self.modelKey(from: notification) else { return }
      let nsError = notification.userInfo?[ModelDownloadUserInfoKey.error.rawValue] as? NSError
      let detail = nsError?.localizedDescription ?? "the download failed"
      self.finishDownload(
        key: key,
        result: .failure(DownloadFailedException("Could not download recognition model: \(detail)"))
      )
    }
    observers = [success, failure]
  }

  private func modelKey(from notification: Notification) -> String? {
    let remote = notification.userInfo?[ModelDownloadUserInfoKey.remoteModel.rawValue] as? DigitalInkRecognitionModel
    return remote?.modelIdentifier.languageTag
  }

  private func finishDownload(key: String, result: Result<Void, Exception>) {
    let waiters: [(Promise, DispatchWorkItem)] = stateQueue.sync {
      let pending = downloadWaiters.removeValue(forKey: key) ?? []
      return pending
    }
    for (promise, timeout) in waiters {
      timeout.cancel()
      switch result {
      case .success:
        promise.resolve()
      case .failure(let error):
        promise.reject(error)
      }
    }
  }

  private func teardown() {
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    stateQueue.sync {
      recognizers.removeAll()
      let pending = downloadWaiters
      downloadWaiters.removeAll()
      for waiters in pending.values {
        for (promise, timeout) in waiters {
          timeout.cancel()
          promise.reject(DownloadFailedException("Recognition module was unloaded before the model finished downloading."))
        }
      }
    }
  }

  private func reject(_ promise: Promise, _ error: Error) {
    if let exception = error as? Exception {
      promise.reject(exception)
    } else {
      promise.reject(UnexpectedException(error))
    }
  }
}
