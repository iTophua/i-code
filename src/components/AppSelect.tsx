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
}

export function AppSelect({ value, options, onChange, placeholder, title }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="app-select__trigger" title={title}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon style={{ display: "flex", alignItems: "center" }}>
          <ChevronDown size={12} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={undefined}>
        <Select.Content className="app-select__content" position="popper" sideOffset={4} style={{ zIndex: 10010 }}>
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
      </Select.Portal>
    </Select.Root>
  );
}
