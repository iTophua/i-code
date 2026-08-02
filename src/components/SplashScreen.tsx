import { useEffect, useState } from "react";

/**
 * 启动动画: 应用初始化(session 恢复、文件树加载)期间显示的品牌闪屏。
 * restored 变 true 后播放淡出动画再卸载。
 */
export function SplashScreen({ done }: { done: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!done) return;
    setLeaving(true);
    // 等淡出动画播完再移除
    const t = setTimeout(() => setRemoved(true), 400);
    return () => clearTimeout(t);
  }, [done]);

  if (removed) return null;

  return (
    <div className={`splash ${leaving ? "splash--leaving" : ""}`}>
      <div className="splash__logo">
        {/* </> 符号(和图标一致) */}
        <svg width="64" height="64" viewBox="0 0 1024 1024" className="splash__svg">
          <defs>
            <linearGradient id="splash-accent" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2a9be8" />
              <stop offset="100%" stopColor="#007acc" />
            </linearGradient>
          </defs>
          <circle cx="512" cy="248" r="54" fill="url(#splash-accent)" />
          <g fill="none" stroke="url(#splash-accent)" strokeWidth="64"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M 350 372 L 230 512 L 350 652" />
            <line x1="600" y1="372" x2="424" y2="652" />
            <path d="M 674 372 L 794 512 L 674 652" />
          </g>
        </svg>
      </div>
      <div className="splash__name">iCode</div>
      <div className="splash__spinner" />
    </div>
  );
}
