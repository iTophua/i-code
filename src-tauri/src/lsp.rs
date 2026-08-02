use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout};
use tokio::sync::Mutex;

/**
 * LSP server 管理
 * 探测 + 异步进程管理(tokio 管道双向中转)
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

/// LSP 进程 + stdin 管道
struct LspProcess {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
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

/// LSP 消息(前端 → 后端 → server stdin)
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LspInput {
    id: String,
    data: String,
}

/// 启动 LSP server, 读 stdout 推送事件给前端
#[tauri::command]
pub async fn lsp_start(
    app: tauri::AppHandle,
    id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().await;

    if procs.contains_key(&id) {
        return Ok(());
    }

    let mut cmd = tokio::process::Command::new(&command);
    cmd.args(&args);
    if let Some(dir) = &cwd {
        cmd.current_dir(dir);
    }
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("启动 {} 失败: {}", command, e))?;
    let stdin = child.stdin.take().ok_or("无法获取 stdin")?;
    let stdout = child.stdout.take().ok_or("无法获取 stdout")?;

    // 读 stdout 线程, 按 Content-Length 分包, 推送给前端
    let app_clone = app.clone();
    let id_clone = id.clone();
    tokio::spawn(async move {
        read_lsp_stdout(stdout, app_clone, id_clone).await;
    });

    procs.insert(id, LspProcess {
        child,
        stdin: Arc::new(Mutex::new(stdin)),
    });
    Ok(())
}

/// 读取 LSP stdout, 按 LSP 协议(Content-Length)分包, 推送给前端
async fn read_lsp_stdout(
    stdout: ChildStdout,
    app: tauri::AppHandle,
    id: String,
) {
    let mut reader = BufReader::new(stdout);
    let mut header_buf = String::new();

    loop {
        header_buf.clear();
        // 读 header 直到空行
        loop {
            header_buf.clear();
            match reader.read_line(&mut header_buf).await {
                Ok(0) => return, // EOF
                Ok(_) => {
                    let trimmed = header_buf.trim();
                    if trimmed.is_empty() {
                        break; // 空行 = header 结束
                    }
                }
                Err(_) => return,
            }
        }

        // 解析 Content-Length
        let content_length: usize = header_buf
            .lines()
            .filter_map(|l| {
                if l.to_lowercase().starts_with("content-length:") {
                    l.split(':').nth(1).and_then(|v| v.trim().parse().ok())
                } else {
                    None
                }
            })
            .next()
            .unwrap_or(0);

        if content_length == 0 {
            continue;
        }

        // 读 body
        let mut body = vec![0u8; content_length];
        if reader.read_exact(&mut body).await.is_err() {
            return;
        }

        let message = String::from_utf8_lossy(&body).to_string();
        let _ = app.emit("lsp-message", serde_json::json!({
            "id": id,
            "data": message,
        }));
    }
}

/// 向 LSP server stdin 写入(前端通过 IPC 发来)
#[tauri::command]
pub async fn lsp_write(
    app: tauri::AppHandle,
    id: String,
    data: String,
) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let procs = manager.processes.lock().await;
    let proc = procs.get(&id).ok_or("LSP 进程不存在")?;

    // LSP 协议: Content-Length: N\r\n\r\n + body
    let framed = format!("Content-Length: {}\r\n\r\n{}", data.len(), data);
    let mut stdin = proc.stdin.lock().await;
    stdin.write_all(framed.as_bytes()).await.map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 停止 LSP server
#[tauri::command]
pub async fn lsp_stop(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().await;
    if let Some(mut proc) = procs.remove(&id) {
        let _ = proc.child.kill().await;
    }
    Ok(())
}

/// 停止所有
#[tauri::command]
pub async fn lsp_stop_all(app: tauri::AppHandle) -> Result<(), String> {
    let manager = app.state::<LspManager>();
    let mut procs = manager.processes.lock().await;
    for (_, mut proc) in procs.drain() {
        let _ = proc.child.kill().await;
    }
    Ok(())
}
