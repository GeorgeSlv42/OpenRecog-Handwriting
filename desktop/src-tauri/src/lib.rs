mod windows_ink;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            windows_ink::is_model_downloaded,
            windows_ink::download_model,
            windows_ink::delete_model,
            windows_ink::recognize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
