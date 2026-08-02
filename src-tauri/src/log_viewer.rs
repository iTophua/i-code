use serde::Serialize;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/**
 * 大文件/日志查看器后端
 * 行偏移索引在后端持有(避免大数组通过 IPC 传输)
 */

/// 后端持有的行索引
pub struct LogIndex {
    pub line_count: u64,
    pub offsets: Vec<u64>,
}

/// 全局索引缓存(文件路径 → 索引)
pub struct LogIndexCache(Mutex<std::collections::HashMap<String, LogIndex>>);

impl Default for LogIndexCache {
    fn default() -> Self {
        Self(Mutex::new(std::collections::HashMap::new()))
    }
}

/// 构建行偏移索引(扫描一次)
/// 返回行数, 偏移数组缓存在后端
#[tauri::command]
pub fn build_line_index(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<u64, String> {
    let path = PathBuf::from(&file_path);
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() < 20 * 1024 * 1024 {
        return Err("文件小于 20MB, 使用普通编辑器打开".into());
    }

    // 字节扫描, 记录每行偏移
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut offsets: Vec<u64> = vec![0];
    let mut offset: u64 = 0;
    let mut buf = [0u8; 65536];
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        for i in 0..n {
            if buf[i] == b'\n' {
                offsets.push(offset + i as u64 + 1);
            }
        }
        offset += n as u64;
    }

    // 去掉末尾空行
    if offsets.len() > 1 && *offsets.last().unwrap() == offset {
        offsets.pop();
    }

    let line_count = offsets.len() as u64;

    // 缓存到后端
    let cache = app.state::<LogIndexCache>();
    cache
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(file_path, LogIndex { line_count, offsets: offsets.clone() });

    Ok(line_count)
}

/// 分块读取: 返回 [start_line, end_line] 范围的行内容
#[tauri::command]
pub fn read_lines(
    app: tauri::AppHandle,
    file_path: String,
    start_line: u64,
    end_line: u64,
) -> Result<Vec<String>, String> {
    let cache = app.state::<LogIndexCache>();
    let guard = cache.0.lock().map_err(|e| e.to_string())?;
    let index = guard
        .get(&file_path)
        .ok_or_else(|| "索引未构建, 请先调用 build_line_index".to_string())?;

    if start_line as usize >= index.offsets.len() {
        return Ok(Vec::new());
    }
    let start = start_line as usize;
    let end = (end_line as usize + 1).min(index.offsets.len());

    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    let start_offset = index.offsets[start];
    let end_offset = if end < index.offsets.len() {
        index.offsets[end]
    } else {
        file.seek(SeekFrom::End(0)).map_err(|e| e.to_string())?
    };

    let length = end_offset.saturating_sub(start_offset);
    file.seek(SeekFrom::Start(start_offset)).map_err(|e| e.to_string())?;

    let mut buf = vec![0u8; length as usize];
    file.read_exact(&mut buf).map_err(|e| e.to_string())?;

    let content = String::from_utf8_lossy(&buf);
    let lines: Vec<String> = content
        .lines()
        .take(end - start)
        .map(|l| l.to_string())
        .collect();

    Ok(lines)
}

/// 流式搜索
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub line: u64,
    pub content: String,
    pub match_start: usize,
    pub match_len: usize,
}

#[tauri::command]
pub fn search_large_file(
    file_path: String,
    query: String,
    max_results: Option<u64>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(1000) as usize;
    let query_lower = query.to_lowercase();
    let file = File::open(&file_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    let mut results = Vec::new();
    for (line_num, line) in reader.lines().enumerate() {
        if results.len() >= max {
            break;
        }
        if let Ok(content) = line {
            let lower = content.to_lowercase();
            if let Some(pos) = lower.find(&query_lower) {
                results.push(SearchResult {
                    line: line_num as u64 + 1,
                    content,
                    match_start: pos,
                    match_len: query.len(),
                });
            }
        }
    }

    Ok(results)
}
