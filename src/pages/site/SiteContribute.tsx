import { t } from "@lingui/core/macro";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { CommunitySharePanel, CommunityStatsLine } from "@/components/community/CommunitySharePanel";
import { IconCamera, IconPencil, IconScroll } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useSite } from "./siteContext";

/**
 * Cùng góp + Hỏi & trả lời. Cùng khung với các trang khác (container max-w-6xl): băng đầu trang (chào + giới thiệu +
 * thống kê), rồi hai cột — khối đóng góp thật của màn Share (chọn người, 3 cách góp, câu hỏi, những gì đã góp) bên trái,
 * giải thích ba cách góp bên phải. Chỉ link có token và còn cho phép đóng góp mới tới được trang này.
 */
export default function SiteContribute() {
  const { access, data } = useSite();
  const [sp, setSp] = useSearchParams();
  const community = data.community;
  const hasQuestions = (community?.questions?.length ?? 0) > 0;
  // Link trả lời câu hỏi (?q=) và ?tab=hoi mở thẳng tab Hỏi & trả lời.
  const mode: "gop" | "hoi" = hasQuestions && (sp.get("tab") === "hoi" || !!sp.get("q")) ? "hoi" : "gop";
  if (!community || !access.token) return null;
  const setMode = (m: "gop" | "hoi") => {
    const next = new URLSearchParams(sp);
    next.delete("q");
    if (m === "hoi") next.set("tab", "hoi");
    else next.delete("tab");
    setSp(next, { replace: true });
  };
  const hello = community.recipient_label;
  const title = hello
    ? mode === "hoi"
      ? t`Chào ${hello}! Cả nhà muốn hỏi bạn`
      : t`Chào ${hello}! Cả nhà nhờ bạn đóng góp giúp`
    : mode === "hoi"
      ? t`Cả nhà cùng hỏi, ông bà cùng kể`
      : t`Cả nhà cùng đóng góp chuyện ông bà`;

  return (
    <>
      <section className="border-b bg-card">
        <div className="container max-w-6xl py-12">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t`Cùng góp`}</div>
          <h1 className="clan-name my-3 break-words text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-tight [text-wrap:balance]">{title}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {mode === "hoi"
              ? t`Chọn một câu hỏi, bấm Trả lời rồi viết (hoặc nói bằng micro trên bàn phím điện thoại). Không cần đăng ký.`
              : t`Bạn nhớ một câu chuyện, có một tấm ảnh cũ, hay thấy thông tin nào chưa đúng? Góp một chút nhé — chỉ vài phút, không cần đăng ký.`}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <CommunityStatsLine community={community} />
          </p>
        </div>
      </section>

      <div className="container max-w-6xl py-10">
        {hasQuestions && (
          <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label={t`Cùng góp`}>
            {(["gop", "hoi"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", mode === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
              >
                {m === "gop" ? t`Cùng góp` : t`Hỏi & trả lời`}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-start gap-x-10 gap-y-8">
          <div className="min-w-0 flex-[3_1_26rem]">
            <CommunitySharePanel
              key={mode}
              embedded
              mode={mode}
              community={community}
              persons={data.persons}
              token={access.token}
              clanId={data.clan_id}
              clanName={data.clan_name ?? null}
              initialQuestionId={sp.get("q")}
              initialPersonId={sp.get("p")}
            />
          </div>
          <aside className="flex min-w-0 flex-[2_1_18rem] flex-col gap-3">
            <Way icon={<IconScroll className="h-6 w-6" />} title={t`Kể chuyện ông bà`}>
              {t`Một kỷ niệm, một câu nói, một thói quen của người đã khuất.`}
            </Way>
            <Way icon={<IconCamera className="h-6 w-6" />} title={t`Góp ảnh cũ`}>
              {t`Ảnh chụp ngày trước — kèm vài dòng cho biết chụp ở đâu, có những ai.`}
            </Way>
            <Way icon={<IconPencil className="h-6 w-6" />} title={t`Sửa thông tin`}>
              {t`Thấy ngày tháng hay tên chưa đúng? Báo để người quản lý họ xem lại.`}
            </Way>
            <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              {t`Người quản lý dòng họ sẽ xem trước khi đăng; tên bạn được ghi là người đóng góp.`}
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}

function Way({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-4 rounded-2xl border bg-card p-5">
      <span className="shrink-0 text-primary">{icon}</span>
      <div className="min-w-0">
        <h2 className="clan-name mb-1 text-lg font-semibold leading-snug">{title}</h2>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
