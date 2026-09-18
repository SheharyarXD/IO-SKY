/**
 * Industry — searchable, alias-aware single-select (Discovery Call spec §3).
 * Not free text and not a scroll-only dropdown: typing filters immediately,
 * aliases (Dutch/English organisation terms) surface the right canonical
 * category, and only the confirmed canonical value is ever stored.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchIndustries, type IndustryOption } from "@/lib/industries";
import { cn } from "@/lib/utils";

export function IndustryField({
  value,
  onChange,
  placeholder = "Search or select industry",
}: {
  value: IndustryOption | "";
  onChange: (v: IndustryOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = searchIndustries(query);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="io-control-surface w-full h-11 px-3.5 rounded-md text-[14px] flex items-center justify-between"
        >
          <span className={value ? "" : "opacity-40"}>{value || placeholder}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[var(--card)] border-white/10">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No matching industry.</CommandEmpty>
            <CommandGroup>
              {matches.map((m) => (
                <CommandItem
                  key={m.option}
                  value={m.option}
                  onSelect={() => {
                    onChange(m.option);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === m.option ? "opacity-100" : "opacity-0")} />
                  {m.option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
