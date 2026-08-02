use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

/**
 * LSP server 管理
 * 探测系统已装的 server + 进程管理
 */

/// 探测结果
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerDetectResult {
    pub language: String,
    pub command: String,
    pub installed: bool,
    pub version: Option<String>,
}

/// 探测单个 server 是否已安装
fn detect_command(cmd: &str, args: &[&str]) -> (bool, Option<String>) {
    let output = Command::new(cmd).args(args).output();
    match output {
        Ok(o) => {
            let installed = o.status.success();
            let version = String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .map(|s| s.trim().to_string());
            (installed, version)
        }
        Err(_) => (false, None),
    }
}

/// 探测所有已知 LSP server
#[tauri::command]
pub fn detect_lsp_servers() -> Vec<ServerDetectResult> {
    let servers: Vec<(&str, &str, &[&str])> = vec![
        ("go", "gopls", &["version"]),
        ("python", "pyright-langserver", &["--version"]),
        ("rust", "rust-analyzer", &["--version"]),
        ("java", "jdtls", &[]),
        ("c", "clangd", &["--version"]),
    ];

    servers
        .iter()
        .map(|(lang, cmd, args)| {
            let (installed, version) = detect_command(cmd, args);
            ServerDetectResult {
                language: lang.to_string(),
                command: cmd.to_string(),
                installed,
                version,
            }
        })
        .collect()
}

/// LSP 进程句柄(存活跃的 server 子进程)
struct LspProcess {
    child: std::process::Child,
}

pub struct LspManager {
    processes: Mutex<HashMap<String, LspProcess>>,
}

impl Default for LspManager {
    fn default() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

/// 启动 LSP server 子进程
/// 返回 stdin/stdout 的可用性(前端通过 IPC 中转 JSON-RPC)
#[tauri::command]
pub fn lsp_start(
    app: tauri::AppHandle,
    id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().map_err(|e| e.to_string())?;

    // 已存在则跳过
    if procs.contains_key(&id) {
        return Ok(());
    }

    let mut cmd = Command::new(&command);
    cmd.args(&args);
    if let Some(dir) = &cwd {
        cmd.current_dir(dir);
    }
    cmd.env("LSP", "1");

    let child = cmd.spawn().map_err(|e| format!("启动 {} 失败: {}", command, e))?;

    procs.insert(id, LspProcess { child });
    Ok(())
}

/// 向 LSP server 的 stdin 写入数据
#[tauri::command]
pub fn lsp_write(app: tauri::AppHandle, id: String, data: String) -> Result<(), String> {
    // NOTE: 真正的 LSP 需要持续的 stdin pipe
    // 这里先做骨架, 实际通信通过 PTY 或 socket
    let _ = (app, id, data);
    Ok(())
}

/// 停止 LSP server
#[tauri::command]
pub fn lsp_stop(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().map_err(|e| e.to_string())?;
    if let Some(mut proc) = procs.remove(&id) {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}

/// 停止所有 LSP server
#[tauri::command]
pub fn lsp_stop_all(app: tauri::AppHandle) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().map_err(|e| e.to_string())?;
    for (_, mut proc) in procs.drain() {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}
