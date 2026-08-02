use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/**
 * 文件外部修改监听
 * 监听项目根目录, 变化时推送事件给前端
 */

pub struct FileWatcher {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileChangeEvent {
    path: String,
    kind: String, // "modified" | "created" | "removed" | "renamed"
}

/// 开始监听项目根目录
#[tauri::command]
pub fn start_file_watch(
    app: AppHandle,
    root: String,
) -> Result<(), String> {
    let manager = app.state::<FileWatcher>();
    let mut guard = manager.watcher.lock().map_err(|e| e.to_string())?;

    // 先停掉旧 watcher
    *guard = None;

    let app_clone = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            let kind = match event.kind {
                EventKind::Create(_) => "created",
                EventKind::Modify(_) => "modified",
                EventKind::Remove(_) => "removed",
                _ => return,
            };

            // 只推送文件/目录路径变化(过滤掉元数据变化等噪音)
            for path in &event.paths {
                // 跳过 .git 目录的变化
                if path.to_string_lossy().contains("/.git/") {
                    continue;
                }
                let _ = app_clone.emit(
                    "file-changed",
                    FileChangeEvent {
                        path: path.to_string_lossy().to_string(),
                        kind: kind.to_string(),
                    },
                );
            }
        }
    })
    .map_err(|e| format!("创建 watcher 失败: {}", e))?;

    let root_path = PathBuf::from(&root);
    watcher
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("监听失败: {}", e))?;

    *guard = Some(watcher);
    Ok(())
}

/// 停止监听
#[tauri::command]
pub fn stop_file_watch(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<FileWatcher>();
    let mut guard = manager.watcher.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
