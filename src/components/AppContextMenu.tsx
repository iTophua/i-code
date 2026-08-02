import * as ContextMenu from "@radix-ui/react-context-menu";
import "./ui/radix-theme.css";

export interface ContextMenuItem {
  id: string;
  label?: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean;
  danger?: boolean;
}

interface Props {
  children: React.ReactNode;
  items: ContextMenuItem[];
}

export function AppContextMenu({ children, items }: Props) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="radix-menu-content">
          {items.map((item) =>
            item.separator ? (
              <ContextMenu.Separator key={item.id} />
            ) : (
              <ContextMenu.Item
                key={item.id}
                disabled={item.disabled}
                onSelect={item.onSelect}
                style={item.danger ? { color: "var(--fg-error)" } : undefined}
              >
                {item.icon && (
                  <span style={{ display: "flex", width: 16 }}>{item.icon}</span>
                )}
                <span>{item.label}</span>
              </ContextMenu.Item>
            )
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
