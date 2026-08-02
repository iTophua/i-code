import { useEffect, useState } from "react";
import { useGitStore } from "../stores/gitStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "../stores/toastStore";
import { ChevronDown, ChevronRight } from "./Icons";
import "../styles/git.css";

/**
 * Stash 管理面板(可折叠)
 */
export function StashManager() {
  const { repoRoot, stashes, loadStashes, stashPush, stashPop } = useGitStore();
  const [expanded, setExpanded] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [msg, setMsg] = useState("");
  const [popTarget, setPopTarget] = useState<number | null>(null);

  useEffect(() => {
    if (expanded && repoRoot) loadStashes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, repoRoot]);

  const handleStash = async () => {
    try {
      await stashPush(msg.trim() || undefined);
      setMsg("");
      setShowInput(false);
      toast.success("已暂存当前改动");
    } catch (e) {
      toast.error(`暂存失败: ${e}`);
    }
  };

  const handlePop = async () => {
    if (popTarget === null) return;
    try {
      await stashPop(popTarget);
      setPopTarget(null);
      toast.success("已恢复暂存");
    } catch (e) {
      toast.error(`恢复失败: ${e}`);
    }
  };

  return (
    <div className="git-section">
      <div
        className="git-section__header"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span style={{ display: "flex", alignItems: "center", color: "var(--fg-muted)" }}>
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
        <span>暂存 (Stash)</span>
        <span className="branch-mgr__count">{stashes.length || ""}</span>
        <button
          className="git-section__action"
          style={{ marginLeft: "auto" }}
          onClick={(e) => {
            e.stopPropagation();
            setShowInput((s) => !s);
            setExpanded(true);
          }}
          title="暂存当前改动"
        >
          +
        </button>
      </div>

      {showInput && expanded && (
        <div className="branch-new">
          <input
            className="branch-new__input"
            placeholder="暂存描述(可选)..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStash()}
            autoFocus
          />
          <button
            className="btn btn--primary branch-new__btn"
            onClick={handleStash}
          >
            暂存
          </button>
        </div>
      )}

      {expanded && (
        <div className="branch-list">
          {stashes.length === 0 ? (
            <div className="git-section__empty">无暂存</div>
          ) : (
            stashes.map((s, i) => (
              <div key={i} className="stash-row" title={s}>
                <span className="stash-row__icon">📦</span>
                <span className="stash-row__msg">
                  {s.replace(/^stash@\{\d+\}:\s*/, "")}
                </span>
                <button
                  className="branch-row__action"
                  title="恢复(pop)"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopTarget(i);
                  }}
                >
                  ↑
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={popTarget !== null}
        title="恢复暂存"
        message="恢复(stash pop)会将暂存的改动应用回工作区，并删除该暂存。确认？"
        confirmLabel="恢复"
        onConfirm={handlePop}
        onCancel={() => setPopTarget(null)}
      />
    </div>
  );
}
