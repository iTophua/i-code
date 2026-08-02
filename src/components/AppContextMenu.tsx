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
              <ContextMenu.Separator key={item.id} className="radix-menu-sep" />
            ) : (
              <ContextMenu.Item
                key={item.id}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={`radix-menu-item ${item.danger ? "radix-menu-item--danger" : ""}`}
              >
                {item.icon && (
                  <span className="radix-menu-item__icon">{item.icon}</span>
                )}
                <span className="radix-menu-item__label">{item.label}</span>
              </ContextMenu.Item>
            )
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
