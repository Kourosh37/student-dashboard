import { AlertTriangle } from "lucide-react";

type Props = {
  title?: string;
  message: string;
  code?: string;
  details?: string[];
  className?: string;
};

export function ErrorBanner({ title = "Request Failed", message, code, details = [], className }: Props) {
  return (
    <div
      className={`rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive ${className ?? ""}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <p>{message}</p>
          {code && <p className="text-xs uppercase opacity-85">Code: {code}</p>}
          {details.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">
              {details.slice(0, 4).map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
