use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

/// 单条搜索结果
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub file_name: String,
    pub line: u32,
    pub column: u32,
    pub line_content: String,
    pub match_start: u32,
    pub match_len: u32,
}

/// 搜索结果批次事件(流式推送)
#[derive(Serialize, Clone)]
struct SearchResultsEvent {
    query: String,
    hits: Vec<SearchHit>,
    done: bool,
    total: usize,
}

/// 默认忽略目录(避免搜 node_modules 等)
fn default_ignore_patterns() -> Vec<String> {
    vec![
        ".git".into(),
        "node_modules".into(),
        "target".into(),
        "dist".into(),
        ".next".into(),
        "__pycache__".into(),
        ".venv".into(),
        "venv".into(),
    ]
}

fn is_ignored(path: &Path, patterns: &[String]) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let path_str = path.to_string_lossy().replace('\\', "/");
    for p in patterns {
        if name == *p {
            return true;
        }
        if name.starts_with('.') && path.is_dir() && name != "." && name != ".." {
            return true;
        }
        if p.starts_with("*.") {
            let ext = &p[2..];
            if path.extension().map(|e| e == ext).unwrap_or(false) {
                return true;
            }
        }
        if path_str.contains(p) {
            return true;
        }
    }
    false
}

/// 跳过的二进制/媒体扩展名
const SKIP_EXTS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "mp3", "mp4", "webm", "avi", "mov", "wav",
    "flac", "zip", "gz", "tar", "rar", "7z", "pdf", "exe", "dll", "so", "dylib", "o", "a", "class",
    "jar", "woff", "woff2", "ttf", "otf", "eot",
];

const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024; // 5MB

/// 单文件搜索
fn search_in_file(
    path: &Path,
    file_name: &str,
    query_lower: &str,
    case_sensitive: bool,
    max_hits_per_file: usize,
) -> Vec<SearchHit> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut hits = Vec::new();
    let needle = if case_sensitive {
        query_lower.to_string()
    } else {
        query_lower.to_lowercase()
    };

    for (line_idx, line) in content.lines().enumerate() {
        let search_line = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };

        let mut from = 0;
        while let Some(idx) = search_line[from..].find(&needle) {
            let abs_col = from + idx;
            hits.push(SearchHit {
                path: path.to_string_lossy().to_string(),
                file_name: file_name.to_string(),
                line: (line_idx + 1) as u32,
                column: (abs_col + 1) as u32,
                line_content: line.to_string(),
                match_start: abs_col as u32,
                match_len: needle.len() as u32,
            });
            from = abs_col + needle.len();
            if from >= search_line.len() || hits.len() >= max_hits_per_file {
                break;
            }
        }
        if hits.len() >= max_hits_per_file {
            break;
        }
    }
    hits
}

/// 全局搜索(递归 + 流式分批推送)
#[tauri::command]
pub fn search_in_files(
    app: AppHandle,
    root: String,
    query: String,
    case_sensitive: Option<bool>,
    is_regex: Option<bool>,
    max_results: Option<usize>,
) -> Result<(), String> {
    let _ = is_regex; // M2 暂只做子串, 正则预留
    if query.trim().is_empty() {
        return Err("搜索词为空".into());
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let max_results = max_results.unwrap_or(2000);
    let query_lower = query.to_lowercase();
    let root_path = PathBuf::from(&root);
    let patterns = default_ignore_patterns();

    let mut total = 0usize;
    let mut batch: Vec<SearchHit> = Vec::new();
    const BATCH_SIZE: usize = 50;

    let walk = walkdir::WalkDir::new(&root_path)
        .into_iter()
        .filter_entry(|e| !is_ignored(e.path(), &patterns));

    for entry in walk.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Some(ext) = entry.path().extension() {
            if SKIP_EXTS.contains(&ext.to_string_lossy().as_ref()) {
                continue;
            }
        }
        if let Ok(meta) = entry.metadata() {
            if meta.len() > MAX_FILE_SIZE {
                continue;
            }
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        let hits = search_in_file(
            entry.path(),
            &file_name,
            &query_lower,
            case_sensitive,
            100,
        );

        for hit in hits {
            batch.push(hit);
            total += 1;
            if batch.len() >= BATCH_SIZE {
                let _ = app.emit(
                    "search-results",
                    SearchResultsEvent {
                        query: query.clone(),
                        hits: std::mem::take(&mut batch),
                        done: false,
                        total,
                    },
                );
            }
            if total >= max_results {
                break;
            }
        }
        if total >= max_results {
            break;
        }
    }

    let _ = app.emit(
        "search-results",
        SearchResultsEvent {
            query: query.clone(),
            hits: std::mem::take(&mut batch),
            done: true,
            total,
        },
    );

    Ok(())
}

/// 单文件替换结果
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub path: String,
    pub replaced: usize,
}

/// 全局替换(纯子串, 不支持正则 — 与 search_in_files 行为一致)
/// 逐文件读取(UTF-8)→ 替换所有匹配 → 写回
#[tauri::command]
pub fn replace_in_files(
    root: String,
    query: String,
    replacement: String,
    case_sensitive: Option<bool>,
) -> Result<Vec<ReplaceResult>, String> {
    if query.trim().is_empty() {
        return Err("搜索词为空".into());
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let root_path = PathBuf::from(&root);
    let patterns = default_ignore_patterns();
    let needle = if case_sensitive {
        query.clone()
    } else {
        query.to_lowercase()
    };
    let mut results = Vec::new();

    let walk = walkdir::WalkDir::new(&root_path)
        .into_iter()
        .filter_entry(|e| !is_ignored(e.path(), &patterns));

    for entry in walk.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Some(ext) = entry.path().extension() {
            if SKIP_EXTS.contains(&ext.to_string_lossy().as_ref()) {
                continue;
            }
        }
        if let Ok(meta) = entry.metadata() {
            if meta.len() > MAX_FILE_SIZE {
                continue;
            }
        }

        let path = entry.path();
        // read_to_string 只能读 UTF-8, 非 UTF-8 自动跳过(不破坏编码)
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let replaced = if case_sensitive {
            content.matches(&needle).count()
        } else {
            content.to_lowercase().matches(&needle).count()
        };
        if replaced == 0 {
            continue;
        }

        // 逐处替换: 大小写不敏感时手动匹配 lower 对应的原串
        let new_content = if case_sensitive {
            content.replace(&needle, &replacement)
        } else {
            replace_ci(&content, &needle, &replacement)
        };

        match fs::write(path, &new_content) {
            Ok(_) => results.push(ReplaceResult {
                path: path.to_string_lossy().to_string(),
                replaced,
            }),
            Err(e) => eprintln!("写入失败 {}: {}", path.display(), e),
        }
    }

    Ok(results)
}

/// 大小写不敏感替换: 保留原串中匹配到的片段大小写信息进行替换
fn replace_ci(content: &str, needle_lower: &str, replacement: &str) -> String {
    let content_lower = content.to_lowercase();
    let mut result = String::with_capacity(content.len());
    let mut last_end = 0;
    let mut from = 0;
    while let Some(idx) = content_lower[from..].find(needle_lower) {
        let abs = from + idx;
        // 推进原始切片
        result.push_str(&content[last_end..abs]);
        result.push_str(replacement);
        last_end = abs + needle_lower.len();
        from = last_end;
    }
    result.push_str(&content[last_end..]);
    result
}
