mod fs_ops;
mod git_ops;
mod log_viewer;
mod search;
mod terminal;

use tauri::Manager;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
