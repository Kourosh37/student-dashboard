import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input/90 bg-background/90 px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow,background-color] file:me-3 file:rounded-md file:border file:border-border file:bg-muted/60 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground placeholder:text-muted-foreground/80 hover:border-primary/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

