Pod::Spec.new do |s|
  s.name           = 'MlkitInk'
  s.version        = '1.0.0'
  s.summary        = 'ML Kit Digital Ink recognition for OpenRecog'
  s.description    = 'Local Expo module implementing docs/recognizer-contract.md with Google ML Kit Digital Ink'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # ML Kit iOS 9.0.0 (release notes, 2025-06-27): https://developers.google.com/ml-kit/release-notes
  s.dependency 'GoogleMLKit/DigitalInkRecognition', '9.0.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
