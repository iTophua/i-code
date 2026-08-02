use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

/**
 * Git 命令封装层
 * 统一 shell out 调用系统 git, 处理路径/编码/分页
 */

/// git 执行结果
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

/// 在指定目录执行 git 命令
fn git(cwd: &str, args: &[&str]) -> GitResult {
    let output = Command::new("git")
        .current_dir(cwd)
        .arg("--no-pager") // 全局选项, 必须在子命令前
        .arg("-c") // 禁用分页器
        .arg("core.pager=cat")
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "en_US.UTF-8")
        .output();

    match output {
        Ok(o) => GitResult {
            success: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            code: o.status.code().unwrap_or(-1),
        },
        Err(e) => GitResult {
            success: false,
            stdout: String::new(),
            stderr: format!("git 执行失败: {}", e),
            code: -1,
        },
    }
}

/// 检测路径是否在 git 仓库内, 返回仓库根
#[tauri::command]
pub fn git_repo_root(path: String) -> Result<String, String> {
    let r = git(&path, &["rev-parse", "--show-toplevel"]);
    if r.success {
        Ok(r.stdout.trim().to_string())
    } else {
        Err("不是 git 仓库".into())
    }
}

/// 当前分支名
#[tauri::command]
pub fn git_current_branch(path: String) -> Result<String, String> {
    let r = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"]);
    if r.success {
        Ok(r.stdout.trim().to_string())
    } else {
        Err(r.stderr)
    }
}

/// git status (porcelain v2, 机器可读格式)
/// 返回原始输出, 前端解析
#[tauri::command]
pub fn git_status(path: String) -> Result<String, String> {
    let r = git(&path, &["status", "--porcelain=v2", "-b", "-z"]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 单文件 diff (工作区 vs HEAD 或暂存 vs HEAD)
/// staged=true: 已暂存的改动; false: 工作区改动
#[tauri::command]
pub fn git_file_diff(path: String, file: String, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(&file);
    let r = git(&path, &args);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 获取文件的两个版本内容(供 DiffEditor 用)
/// oldRef: 如 "HEAD" 或某 commit; 返回 (旧内容, 新内容)
/// mode: "worktree"(HEAD vs 工作区) | "staged"(HEAD vs 暂存区)
#[tauri::command]
pub fn git_diff_versions(
    path: String,
    file: String,
    mode: String,
) -> Result<(String, String), String> {
    // 旧版本: HEAD 的内容
    let old = git(&path, &["show", &format!("HEAD:{}", file)]);
    let old_content = if old.success {
        old.stdout
    } else {
        String::new() // 新文件, 旧版本为空
    };

    // 新版本
    let new_content = match mode.as_str() {
        "staged" => {
            // 暂存区的内容
            let r = git(&path, &["show", &format!(":{}", file)]);
            if r.success { r.stdout } else { old_content.clone() }
        }
        _ => {
            // 工作区的内容(直接读文件)
            let full = PathBuf::from(&path).join(&file);
            std::fs::read_to_string(&full).unwrap_or_default()
        }
    };

    Ok((old_content, new_content))
}

/// 暂存文件
#[tauri::command]
pub fn git_add(path: String, files: Vec<String>) -> Result<(), String> {
    let files_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    let mut args = vec!["add"];
    args.extend(files_refs);
    let r = git(&path, &args);
    if r.success {
        Ok(())
    } else {
        Err(r.stderr)
    }
}

/// 取消暂存
#[tauri::command]
pub fn git_restore_staged(path: String, files: Vec<String>) -> Result<(), String> {
    let files_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    let mut args = vec!["restore", "--staged"];
    args.extend(files_refs);
    let r = git(&path, &args);
    if r.success {
        Ok(())
    } else {
        Err(r.stderr)
    }
}

/// 全部暂存
#[tauri::command]
pub fn git_add_all(path: String) -> Result<(), String> {
    let r = git(&path, &["add", "-A"]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// 提交
#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    let r = git(&path, &["commit", "-m", &message]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// git log (图形化 + 格式化)
#[tauri::command]
pub fn git_log(path: String, limit: Option<u32>) -> Result<String, String> {
    let n = limit.unwrap_or(100).to_string();
    let r = git(
        &path,
        &[
            "log",
            "--graph",
            "--format=%H|%h|%an|%ae|%at|%s|%D",
            "-n",
            &n,
        ],
    );
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 分支列表
#[tauri::command]
pub fn git_branches(path: String) -> Result<String, String> {
    let r = git(
        &path,
        &["branch", "--list", "--all", "--format=%(HEAD) %(refname:short) %(objectname:short) %(upstream:short)"],
    );
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 切换分支
#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let r = git(&path, &["checkout", &branch]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// 创建分支
#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<(), String> {
    let r = git(&path, &["branch", &name]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// 创建并切换分支
#[tauri::command]
pub fn git_checkout_new(path: String, name: String) -> Result<(), String> {
    let r = git(&path, &["checkout", "-b", &name]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// 删除分支
#[tauri::command]
pub fn git_delete_branch(path: String, name: String, force: Option<bool>) -> Result<(), String> {
    let flag = if force.unwrap_or(false) { "-D" } else { "-d" };
    let r = git(&path, &["branch", flag, &name]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// merge
#[tauri::command]
pub fn git_merge(path: String, branch: String) -> Result<String, String> {
    let r = git(&path, &["merge", &branch, "--no-edit"]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(format!("{}\n{}", r.stdout, r.stderr))
    }
}

/// rebase(将当前分支变基到目标分支)
#[tauri::command]
pub fn git_rebase(path: String, branch: String) -> Result<String, String> {
    let r = git(&path, &["rebase", &branch]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(format!("{}\n{}", r.stdout, r.stderr))
    }
}

/// rebase --continue(解决冲突后继续)
#[tauri::command]
pub fn git_rebase_continue(path: String) -> Result<String, String> {
    let r = git(&path, &["rebase", "--continue"]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// rebase --abort(中止 rebase)
#[tauri::command]
pub fn git_rebase_abort(path: String) -> Result<(), String> {
    let r = git(&path, &["rebase", "--abort"]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// merge --abort(中止 merge)
#[tauri::command]
pub fn git_merge_abort(path: String) -> Result<(), String> {
    let r = git(&path, &["merge", "--abort"]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// cherry-pick(将指定 commit 应用到当前分支)
#[tauri::command]
pub fn git_cherry_pick(path: String, hash: String) -> Result<String, String> {
    let r = git(&path, &["cherry-pick", &hash]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(format!("{}\n{}", r.stdout, r.stderr))
    }
}

/// cherry-pick --abort
#[tauri::command]
pub fn git_cherry_pick_abort(path: String) -> Result<(), String> {
    let r = git(&path, &["cherry-pick", "--abort"]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// 判断是否处于 rebase/merge 冲突中
#[tauri::command]
pub fn git_in_progress(path: String) -> Result<String, String> {
    let root = PathBuf::from(&path);
    if root.join(".git/rebase-merge").exists() || root.join(".git/rebase-apply").exists() {
        return Ok("rebase".into());
    }
    if root.join(".git/MERGE_HEAD").exists() {
        return Ok("merge".into());
    }
    if root.join(".git/CHERRY_PICK_HEAD").exists() {
        return Ok("cherry-pick".into());
    }
    Ok("none".into())
}

/// pull
#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let r = git(&path, &["pull", "--no-edit"]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(format!("{}\n{}", r.stdout, r.stderr))
    }
}

/// push
#[tauri::command]
pub fn git_push(path: String, set_upstream: Option<bool>) -> Result<String, String> {
    let mut args = vec!["push"];
    if set_upstream.unwrap_or(false) {
        args.push("-u");
    }
    args.push("origin");
    let r = git(&path, &args);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// fetch
#[tauri::command]
pub fn git_fetch(path: String) -> Result<String, String> {
    let r = git(&path, &["fetch", "--all", "--prune"]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// stash 列表
#[tauri::command]
pub fn git_stash_list(path: String) -> Result<String, String> {
    let r = git(&path, &["stash", "list"]);
    if r.success { Ok(r.stdout) } else { Err(r.stderr) }
}

/// stash push
#[tauri::command]
pub fn git_stash_push(path: String, message: Option<String>) -> Result<(), String> {
    let mut args = vec!["stash", "push"];
    if let Some(m) = &message {
        args.push("-m");
        args.push(m);
    }
    let r = git(&path, &args);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// stash pop
#[tauri::command]
pub fn git_stash_pop(path: String, index: Option<u32>) -> Result<(), String> {
    let idx = index.unwrap_or(0);
    let stash_ref = format!("stash@{{{}}}", idx);
    let r = git(&path, &["stash", "pop", &stash_ref]);
    if r.success { Ok(()) } else { Err(r.stderr) }
}

/// blame (某文件的行级历史)
/// 返回原始 porcelain 输出
#[tauri::command]
pub fn git_blame(path: String, file: String) -> Result<String, String> {
    let r = git(&path, &["blame", "--porcelain", "--", &file]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 文件历史(该文件的所有 commit)
#[tauri::command]
pub fn git_file_history(path: String, file: String) -> Result<String, String> {
    let r = git(
        &path,
        &[
            "log",
            "--follow",
            "--format=%H|%h|%an|%at|%s",
            "--",
            &file,
        ],
    );
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}

/// 获取某文件在某 commit 的内容(供文件历史对比)
#[tauri::command]
pub fn git_show_file(path: String, ref_name: String, file: String) -> Result<String, String> {
    let target = format!("{}:{}", ref_name, file);
    let r = git(&path, &["show", &target]);
    if r.success {
        Ok(r.stdout)
    } else {
        Err(r.stderr)
    }
}
