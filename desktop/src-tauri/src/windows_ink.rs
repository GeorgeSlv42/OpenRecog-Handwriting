//! Windows Ink behind the shared recognizer contract (docs/recognizer-contract.md).
//! The JS side calls these through `invoke`; Tauri maps camelCase JS args to snake_case params.
//! Errors must serialize as `{ code, message }` with a code from the contract.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct RecognizerError {
    code: &'static str,
    message: String,
}

impl RecognizerError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }

    fn not_implemented(function: &str) -> Self {
        Self::new(
            "NOT_IMPLEMENTED",
            format!("windows-ink: {function} is not implemented yet (see desktop/src-tauri/TODO.md)"),
        )
    }
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct InkPoint {
    pub x: f64,
    pub y: f64,
    pub t: f64,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct WritingArea {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
pub struct Candidate {
    pub text: String,
    pub score: Option<f64>,
}

#[allow(unused_variables)]
#[tauri::command]
pub async fn is_model_downloaded(model_id: String) -> Result<bool, RecognizerError> {
    Err(RecognizerError::not_implemented("is_model_downloaded"))
}

/// Windows handwriting recognizers come from OS language packs; the app can't install them.
#[allow(unused_variables)]
#[tauri::command]
pub async fn download_model(model_id: String, wifi_only: bool) -> Result<(), RecognizerError> {
    Err(RecognizerError::new(
        "DOWNLOAD_UNSUPPORTED",
        format!("Install handwriting for {model_id} in Windows Settings > Time & language > Language"),
    ))
}

#[allow(unused_variables)]
#[tauri::command]
pub async fn delete_model(model_id: String) -> Result<(), RecognizerError> {
    Err(RecognizerError::new(
        "DOWNLOAD_UNSUPPORTED",
        "Windows handwriting recognizers are removed in Windows Settings, not by the app",
    ))
}

#[allow(unused_variables)]
#[tauri::command]
pub async fn recognize(
    model_id: String,
    strokes: Vec<Vec<InkPoint>>,
    pre_context: Option<String>,
    writing_area: Option<WritingArea>,
) -> Result<Vec<Candidate>, RecognizerError> {
    Err(RecognizerError::not_implemented("recognize"))
}
