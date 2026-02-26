"use client";

import { CalendarDays } from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

import { parseDateKey, toDateKey } from "@/lib/date-time";
import { cn } from "@/lib/utils";

type PersianDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaInvalid?: boolean;
  className?: string;
};

const baseInputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ps-10 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function PersianDateInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  required,
  ariaInvalid,
  className,
}: PersianDateInputProps) {
  const selected = value ? parseDateKey(value) : null;

  return (
    <div className={cn("relative", className)}>
      <DatePicker
        id={id}
        value={selected ?? undefined}
        onChange={(nextValue) => {
          if (!nextValue || Array.isArray(nextValue)) {
            onChange("");
            return;
          }

          onChange(toDateKey(nextValue.toDate()));
        }}
        calendar={persian}
        locale={persianFa}
        format="YYYY/MM/DD"
        calendarPosition="bottom-right"
        editable={false}
        portal
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        inputClass={cn(baseInputClassName, ariaInvalid ? "border-destructive focus-visible:ring-destructive/50" : undefined)}
      />
      <CalendarDays className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
    </div>
  );
}
