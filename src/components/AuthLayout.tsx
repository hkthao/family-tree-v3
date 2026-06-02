import type { ReactNode } from "react";

import { AppLogo } from "@/components/AppLogo";
import { AppVersion } from "@/components/AppVersion";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-3">
          <AppLogo size={72} className="rounded-2xl mx-auto shadow-sm" />
          <h1 className="clan-name text-4xl font-semibold">Gia phả</h1>
          <h2 className="text-2xl">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </header>
        {children}
      </div>
      <AppVersion className="mt-8 text-center" />
    </main>
  );
}
