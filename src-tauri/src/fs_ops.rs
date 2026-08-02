use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 目录条目
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// 子条目(仅目录展开时有)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<DirEntry>>,
}

/// .gitignore 简易解析(只处理项目根的)
fn load_ignore_patterns(root: &Path) -> Vec<String> {
    let gitignore = root.join(".gitignore");
    let mut patterns: Vec<String> = vec![];
    // 默认忽略
    patterns.push(".git".into());
    patterns.push("node_modules".into());
    if let Ok(content) = fs::read_to_string(gitignore) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            // 去掉路径前缀的 ./ 和末尾 /
            let mut p = trimmed.trim_start_matches("./").to_string();
            if p.ends_with('/') {
                p.pop();
            }
            patterns.push(p);
        }
    }
    patterns
}

/// 判断路径是否被忽略
fn is_ignored(name: &str, path: &Path, root: &Path, patterns: &[String]) -> bool {
    // 隐藏文件(.开头)默认不忽略,由前端控制显示
    for p in patterns {
        // 精确名匹配
        if name == p {
            return true;
        }
        // 通配 *.xxx
        if p.starts_with("*.") {
            let ext = &p[2..];
            if path
                .extension()
                .map(|e| e == ext)
                .unwrap_or(false)
            {
                return true;
            }
        }
        // 路径片段包含
        if let Ok(rel) = path.strip_prefix(root) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if rel_str.contains(p) {
                return true;
            }
        }
    }
    false
}

/// 列出目录的直接子条目(单层,前端懒加载展开)
#[tauri::command]
pub fn list_directory(dir_path: String, show_hidden: Option<bool>, sort_by: Option<String>) -> Result<Vec<DirEntry>, String> {
    let root = PathBuf::from(&dir_path);
    if !root.is_dir() {
        return Err(format!("不是目录: {}", dir_path));
    }
    let patterns = load_ignore_patterns(&root);
    let show_hidden = show_hidden.unwrap_or(false);

    let mut entries: Vec<DirEntry> = Vec::new();
    let read = fs::read_dir(&root).map_err(|e| e.to_string())?;

    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        // .git/node_modules 始终忽略(即使 show_hidden=true)
        if name == ".git" || name == "node_modules" {
            continue;
        }
        // show_hidden=false 时: 过滤 ignore patterns + 隐藏文件(.开头)
        // show_hidden=true 时: 显示隐藏文件 + .gitignore 里的文件(仅 .git/node_modules 排除)
        if !show_hidden {
            if is_ignored(&name, &path, &root, &patterns) {
                continue;
            }
            if name.starts_with('.') && name != "." && name != ".." {
                continue;
            }
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: if meta.is_file() { meta.len() } else { 0 },
            children: None,
        });
    }

    // 排序: 文件夹优先, 各自按选定方式
    let sort = sort_by.unwrap_or_else(|| "name".to_string());
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => {
            if sort == "modified" {
                // 按修改时间降序(最近在上)
                let a_time = std::fs::metadata(&a.path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let b_time = std::fs::metadata(&b.path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                b_time.cmp(&a_time)
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        }
    });

    Ok(entries)
}

/// 读取文件(自动检测编码,转 UTF-8)
/// 返回 (内容, 检测到的编码名)
#[tauri::command]
pub fn read_file(file_path: String) -> Result<(String, String), String> {
    let bytes = fs::read(&file_path).map_err(|e| e.to_string())?;

    // 检测编码
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);
    let label = encoding.name().to_string();

    // 解码
    let (cow, _, had_errors) = encoding.decode(&bytes);
    if had_errors {
        // 降级:强制 utf-8 lossy
        Ok((String::from_utf8_lossy(&bytes).to_string(), label))
    } else {
        Ok((cow.into_owned(), label))
    }
}

/// 写入文件(UTF-8)
#[tauri::command]
pub fn write_file(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

/// 新建文件(若已存在则报错)
#[tauri::command]
pub fn create_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        return Err(format!("文件已存在: {}", file_path));
    }
    // 确保父目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

/// 新建文件夹
#[tauri::command]
pub fn create_dir(dir_path: String) -> Result<(), String> {
    let path = PathBuf::from(&dir_path);
    if path.exists() {
        return Err(format!("目录已存在: {}", dir_path));
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// 删除文件/文件夹(文件夹递归删除)
#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&p).map_err(|e| e.to_string())
    }
}

/// 重命名/移动
#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// 判断路径是否存在
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

/// 复制文件/目录
#[tauri::command]
pub fn copy_path(src: String, dest: String) -> Result<(), String> {
    let src_path = PathBuf::from(&src);
    let dest_path = PathBuf::from(&dest);
    if src_path.is_dir() {
        copy_dir_recursive(&src_path, &dest_path)?;
    } else {
        fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let src_item = entry.path();
        let dest_item = dest.join(entry.file_name());
        if src_item.is_dir() {
            copy_dir_recursive(&src_item, &dest_item)?;
        } else {
            fs::copy(&src_item, &dest_item).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 获取文件大小(用于大文件分档判断)
#[tauri::command]
pub fn get_file_size(file_path: String) -> Result<u64, String> {
    let meta = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    Ok(meta.len())
}

/// 简易项目统计(文件数/总大小,供欢迎页)
#[tauri::command]
pub fn project_stats(dir_path: String) -> Result<(usize, u64), String> {
    let root = PathBuf::from(&dir_path);
    let patterns = load_ignore_patterns(&root);
    let mut count = 0usize;
    let mut total = 0u64;

    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !is_ignored(&name, e.path(), &root, &patterns)
        })
        .flatten()
    {
        if entry.file_type().is_file() {
            count += 1;
            if let Ok(m) = entry.metadata() {
                total += m.len();
            }
        }
    }
    Ok((count, total))
}
