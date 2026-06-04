import type { ReactNode } from "react";

/**
 * Tiny prose primitives so each article reads like a markdown file
 * without bringing in @tailwindcss/typography. Every element bakes in
 * the spacing + size we want for documentation reading, so individual
 * articles stay terse.
 */

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-xl font-semibold mt-8 mb-3 scroll-mt-20">
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-20">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 leading-relaxed">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-base text-muted-foreground leading-relaxed">
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="leading-relaxed">{children}</li>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono">
      {children}
    </code>
  );
}

/**
 * Highlighted callout box. `kind` controls the colour: info (default,
 * muted), tip (accent green-ish), warn (destructive border). Use
 * sparingly so they stand out.
 */
export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "tip" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const classes =
    kind === "warn"
      ? "border-destructive/40 bg-destructive/5"
      : kind === "tip"
        ? "border-accent/40 bg-accent/5"
        : "border-muted-foreground/30 bg-muted/30";
  return (
    <div className={`my-4 rounded-md border-l-4 px-4 py-3 ${classes}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 mb-3 space-y-2">{children}</ol>;
}
