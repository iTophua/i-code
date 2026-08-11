/**
 * 缩进自动检测
 * 基于文件内容的前导空白统计,判断使用 tab 还是空格,以及空格缩进宽度。
 * 算法参考 VSCode detectIndentation。
 */

export interface IndentInfo {
  /** true = 空格缩进, false = Tab 缩进 */
  insertSpaces: boolean;
  /** 缩进宽度(2/4/8 等) */
  tabSize: number;
}

const DEFAULT_INDENT: IndentInfo = { insertSpaces: true, tabSize: 2 };

/** GCD 辅助 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * 检测文件内容的缩进风格。
 * @param content 文件全文
 * @param defaultTabSize 全局默认缩进宽度(无足够样本时回退)
 * @returns { insertSpaces, tabSize }
 */
export function detectIndent(content: string, defaultTabSize = 2): IndentInfo {
  const lines = content.split("\n");
  const maxLines = Math.min(lines.length, 1000);

  // 统计: 空格缩进行的空格数, Tab 缩进行的次数, 混合缩进行次数
  const spacesHistogram = new Map<number, number>(); // 空格数 → 出现行数
  let tabLines = 0;
  let spaceLines = 0;

  for (let i = 0; i < maxLines; i++) {
    const line = lines[i];
    // 跳过空行和纯空白行
    if (!line || line.trim().length === 0) continue;

    let leadingSpaces = 0;
    let leadingTabs = 0;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === " ") leadingSpaces++;
      else if (line[j] === "\t") leadingTabs++;
      else break;
    }

    // 无缩进
    if (leadingSpaces === 0 && leadingTabs === 0) continue;

    if (leadingTabs > 0 && leadingSpaces === 0) {
      // 纯 Tab 缩进
      tabLines++;
    } else if (leadingSpaces > 0 && leadingTabs === 0) {
      // 纯空格缩进
      spaceLines++;
      spacesHistogram.set(leadingSpaces, (spacesHistogram.get(leadingSpaces) ?? 0) + 1);
    }
    // 混合缩进(Tab+空格)不参与投票, 忽略
  }

  // 无足够样本 → 默认
  if (spaceLines === 0 && tabLines === 0) {
    return { ...DEFAULT_INDENT, tabSize: defaultTabSize };
  }

  // Tab 胜出
  if (tabLines > spaceLines) {
    return { insertSpaces: false, tabSize: defaultTabSize };
  }

  // 空格胜出: 取所有空格数的 GCD 作为 tabSize
  // (例: 文件有 2空格行和4空格行 → GCD=2 → tabSize=2)
  const spaceCounts = Array.from(spacesHistogram.keys());
  if (spaceCounts.length === 0) {
    return { insertSpaces: true, tabSize: defaultTabSize };
  }

  let commonGcd = spaceCounts[0];
  for (let i = 1; i < spaceCounts.length; i++) {
    commonGcd = gcd(commonGcd, spaceCounts[i]);
  }

  // GCD 结果归一到常见值(2/4/8), 避免 1 或奇数
  let tabSize = commonGcd;
  if (tabSize < 2) tabSize = defaultTabSize;
  if (tabSize > 8) tabSize = 8;
  // 常见值优先: 如果 GCD 是 3/5/6/7, 取众数中最近的 2/4/8
  if (![2, 4, 8].includes(tabSize)) {
    // 取出现次数最多的空格数, 试图映射到 2/4/8
    let bestCount = 0;
    let bestSize = defaultTabSize;
    for (const [size, count] of spacesHistogram) {
      if (count > bestCount && [2, 4, 8].includes(size)) {
        bestCount = count;
        bestSize = size;
      }
    }
    tabSize = bestCount > 0 ? bestSize : defaultTabSize;
  }

  return { insertSpaces: true, tabSize };
}
