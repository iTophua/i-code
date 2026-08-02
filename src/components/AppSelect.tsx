import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "./Icons";
import "./ui/radix-theme.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  /** inline=true 时不使用 Portal(在 Radix Dialog 内使用, 避免 focus trap 冲突) */
  inline?: boolean;
}

export function AppSelect({ value, options, onChange, placeholder, title, inline }: Props) {
  const content = (
    <Select.Content className="app-select__content" position="popper" sideOffset={4}>
      <Select.ScrollUpButton />
      <Select.Viewport>
        {options.map((opt) => (
          <Select.Item key={opt.value} value={opt.value} className="app-select__item">
            <Select.ItemText>{opt.label}</Select.ItemText>
            <Select.ItemIndicator style={{ marginLeft: 8, display: "flex", alignItems: "center" }}>
              <Check size={12} />
            </Select.ItemIndicator>
          </Select.Item>
        ))}
      </Select.Viewport>
      <Select.ScrollDownButton />
    </Select.Content>
  );

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="app-select__trigger" title={title}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon style={{ display: "flex", alignItems: "center" }}>
          <ChevronDown size={12} />
        </Select.Icon>
      </Select.Trigger>
      {inline ? content : <Select.Portal>{content}</Select.Portal>}
    </Select.Root>
  );
}
