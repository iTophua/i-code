mod fs_ops;
mod file_watcher;
mod git_ops;
mod log_viewer;
mod lsp;
mod search;
mod terminal;

use tauri::{Emitter, Manager};
use std::sync::Mutex;

/// 缓存 macOS 首次启动时通过 Apple Events 传入的文件路径。
/// 应用刚启动时前端还没注册监听, emit 会丢失; 前端 ready 后主动调 take_pending_files 拉取。
struct PendingFiles(Mutex<Vec<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:i-code.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "初始化便签表 + 全文索引",
                            sql: include_str!("../migrations/001_init.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "会话持久化键值表",
                            sql: include_str!("../migrations/002_session.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .manage(terminal::PtyManager::default())
        .manage(log_viewer::LogIndexCache::default())
        .manage(lsp::LspManager::default())
        .manage(file_watcher::FileWatcher::default())
        .manage(PendingFiles(Mutex::new(Vec::new())))
        .setup(|app| {
            // macOS: 设置标题栏为 overlay 模式(红绿灯保留, 标题栏区域可被 webview 覆盖)
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 文件系统
            fs_ops::list_directory,
            fs_ops::read_file,
            fs_ops::write_file,
            fs_ops::get_file_size,
            fs_ops::project_stats,
            fs_ops::create_file,
            fs_ops::create_dir,
            fs_ops::delete_path,
            fs_ops::rename_path,
            fs_ops::path_exists,
            fs_ops::copy_path,
            // 终端
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            // 搜索
            search::search_in_files,
            // 大文件查看器
            log_viewer::build_line_index,
            log_viewer::read_lines,
            log_viewer::search_large_file,
            // LSP
            lsp::detect_lsp_servers,
            lsp::lsp_start,
            lsp::lsp_write,
            lsp::lsp_stop,
            lsp::lsp_stop_all,
            // 文件监听
            file_watcher::start_file_watch,
            file_watcher::stop_file_watch,
            // Git
            git_ops::git_repo_root,
            git_ops::git_current_branch,
            git_ops::git_status,
            git_ops::git_file_diff,
            git_ops::git_diff_versions,
            git_ops::git_add,
            git_ops::git_restore_staged,
            git_ops::git_add_all,
            git_ops::git_commit,
            git_ops::git_log,
            git_ops::git_branches,
            git_ops::git_checkout,
            git_ops::git_create_branch,
            git_ops::git_checkout_new,
            git_ops::git_delete_branch,
            git_ops::git_merge,
            git_ops::git_rebase,
            git_ops::git_rebase_continue,
            git_ops::git_rebase_abort,
            git_ops::git_merge_abort,
            git_ops::git_cherry_pick,
            git_ops::git_cherry_pick_abort,
            git_ops::git_in_progress,
            git_ops::git_pull,
            git_ops::git_push,
            git_ops::git_fetch,
            git_ops::git_stash_list,
            git_ops::git_stash_push,
            git_ops::git_stash_pop,
            git_ops::git_blame,
            git_ops::git_file_history,
            git_ops::git_show_file,
            take_pending_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // macOS: 访达"打开方式 → iCode"时, 系统通过 Apple Events 传文件 URL。
            // Tauri 2 暴露为 RunEvent::Opened。
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    // 1. 缓存(首次启动时前端还没 ready, emit 会丢)
                    if let Some(pending) = app_handle.try_state::<PendingFiles>() {
                        if let Ok(mut guard) = pending.0.lock() {
                            guard.extend(paths.clone());
                        }
                    }
                    // 2. 同时 emit(应用已运行时前端能直接收到)
                    let _ = app_handle.emit("open-external-files", paths);
                }
            }
        });
}

/// 前端恢复完成后调用, 拉取启动时缓存的待打开文件(然后清空)
#[tauri::command]
fn take_pending_files(pending: tauri::State<'_, PendingFiles>) -> Vec<String> {
    let mut guard = pending.0.lock().unwrap_or_else(|e| e.into_inner());
    let files = guard.clone();
    guard.clear();
    files
}
