use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// 终端输出事件(payload)
#[derive(Serialize, Clone)]
struct TerminalOutput {
    id: String,
    data: String,
}

/// 终端退出事件
#[derive(Serialize, Clone)]
struct TerminalExit {
    id: String,
    code: Option<i32>,
}

/// 终端实例(存 writer + master)
struct TerminalInstance {
    writer: Box<dyn std::io::Write + Send>,
    master: Box<dyn MasterPty + Send>,
}

/// 全局 PTY 管理器(存所有活跃终端)
pub struct PtyManager {
    terminals: Mutex<HashMap<String, TerminalInstance>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }
}

impl PtyManager {
    /// 创建新终端
    pub fn spawn(
        &self,
        app: &AppHandle,
        id: String,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();

        // 创建 PTY 对
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("创建 PTY 失败: {}", e))?;

        // 构建 shell 命令(跨平台)
        let cmd = build_shell_command(&cwd);

        // 启动子进程
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("启动 shell 失败: {}", e))?;

        // 克隆 master reader(读到子进程输出, 推送给前端)
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("克隆 reader 失败: {}", e))?;

        // 取 writer(用于写输入)
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("取 writer 失败: {}", e))?;

        // 后台线程: 持续读取子进程输出, 通过 event 推送前端
        let app_clone = app.clone();
        let id_clone = id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF, 子进程关闭
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_clone.emit(
                            "terminal-output",
                            TerminalOutput {
                                id: id_clone.clone(),
                                data,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
            // 子进程结束
            let _ = app_clone.emit(
                "terminal-exit",
                TerminalExit {
                    id: id_clone,
                    code: None,
                },
            );
        });

        // 存储实例(writer + master)
        // drop slave 让 master 能感知子进程退出
        drop(pair.slave);
        self.terminals.lock().map_err(|e| e.to_string())?.insert(
            id,
            TerminalInstance {
                writer,
                master: pair.master,
            },
        );

        Ok(())
    }

    /// 写入终端(用户键盘输入)
    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        let inst = terminals
            .get_mut(id)
            .ok_or_else(|| format!("终端不存在: {}", id))?;
        inst.writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("写入失败: {}", e))?;
        inst.writer.flush().ok();
        Ok(())
    }

    /// 调整终端尺寸
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        let inst = terminals
            .get(id)
            .ok_or_else(|| format!("终端不存在: {}", id))?;
        inst.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("resize 失败: {}", e))
    }

    /// 关闭终端(杀子进程)
    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        terminals.remove(id); // drop 会关闭 PTY, 子进程收到 SIGHUP 退出
        Ok(())
    }
}

/// 跨平台构建 shell 命令
fn build_shell_command(cwd: &Option<String>) -> CommandBuilder {
    #[cfg(target_os = "windows")]
    {
        // Windows: 默认 PowerShell, 降级 cmd
        let shell = std::env::var("PSModulePath").map(|_| "powershell.exe").unwrap_or("cmd.exe");
        let mut cmd = CommandBuilder::new(shell);
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        cmd
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix: 读 $SHELL, 默认 /bin/zsh (mac) 或 /bin/bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| {
            if cfg!(target_os = "macos") {
                "/bin/zsh".to_string()
            } else {
                "/bin/bash".to_string()
            }
        });

        // 用 login + interactive 模式, 确保 zsh 加载 .zprofile/.zshrc 完整环境
        // (alias / PATH / 提示符 / 补全 等都依赖这些配置)
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l"); // login shell: 加载 .zprofile/.zlogin
        cmd.arg("-i"); // interactive: 加载 .zshrc

        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("LANG", "en_US.UTF-8");
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        cmd
    }
}

// ============ Tauri 命令封装 ============

#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    id: String,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    let manager = app.state::<PtyManager>();
    manager.spawn(&app, id, cwd, cols.unwrap_or(80), rows.unwrap_or(24))
}

#[tauri::command]
pub fn terminal_write(app: AppHandle, id: String, data: String) -> Result<(), String> {
    let manager = app.state::<PtyManager>();
    manager.write(&id, &data)
}

#[tauri::command]
pub fn terminal_resize(app: AppHandle, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let manager = app.state::<PtyManager>();
    manager.resize(&id, cols, rows)
}

#[tauri::command]
pub fn terminal_kill(app: AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<PtyManager>();
    manager.kill(&id)
}
