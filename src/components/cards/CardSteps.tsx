import type { ReactNode } from "react";

import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { t } from "@lingui/core/macro";

export type CardStep = 1 | 2 | 3;

const STEPS: { n: CardStep; label: () => string }[] = [
  { n: 1, label: () => t`Chọn kiểu` },
  { n: 2, label: () => t`Tuỳ chỉnh` },
  { n: 3, label: () => t`Chia sẻ` },
];

/** Thanh ba bước ① Chọn kiểu → ② Tuỳ chỉnh → ③ Chia sẻ — dùng chung cho thiệp khoe và thiệp mời góp để hai tab giống hệt nhau. */
export function CardStepper({ step, onStep }: { step: CardStep; onStep: (s: CardStep) => void }) {
  return (
    <ol aria-label={t`Các bước`} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {STEPS.map((s) => (
        <li key={s.n}>
          <button
            type="button"
            onClick={() => onStep(s.n)}
            aria-current={step === s.n ? "step" : undefined}
            className="inline-flex min-h-11 items-center gap-2"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${step >= s.n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {s.n}
            </span>
            <span className={step === s.n ? "font-semibold" : "text-muted-foreground"}>{s.label()}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Chân cố định: Quay lại / Tiếp (bước 3 chỉ còn Quay lại). */
export function CardStepFooter({ step, onStep }: { step: CardStep; onStep: (s: CardStep) => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-5">
      {step > 1 ? (
        <Button size="sm" variant="outline" className="px-3 text-sm" onClick={() => onStep((step - 1) as CardStep)}>
          <IconArrowLeft className="mr-1.5 h-4 w-4" />
          {t`Quay lại`}
        </Button>
      ) : (
        <span />
      )}
      {step < 3 && (
        <Button size="sm" className="px-3 text-sm" onClick={() => onStep((step + 1) as CardStep)}>
          {step === 1 ? t`Tiếp: Tuỳ chỉnh` : t`Tiếp: Chia sẻ`}
          <IconArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function CardStepPanel({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div className="space-y-4">{children}</div> : null;
}
