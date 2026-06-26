import { Link } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import {
  IconCopy,
  IconScroll,
  IconSettings,
  IconSparkles,
  IconUpload,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";

/**
 * "Công cụ" — gom các công cụ ÍT DÙNG / thiết lập (nhập Excel, gộp người
 * trùng, sinh bằng AI, nhật ký) để menu trái gọn lại. Mỗi mục là 1 thẻ
 * dẫn tới trang công cụ tương ứng.
 */
export default function Tools() {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);

  const base = `/clans/${clan.id}`;
  const tools = [
    {
      to: `${base}/import`,
      label: "Nhập từ Excel",
      desc: "Thêm nhiều người cùng lúc từ file Excel — dùng khi mới lập gia phả.",
      icon: <IconUpload className="h-5 w-5" />,
      editorOnly: true,
    },
    {
      to: `${base}/ai-generate`,
      label: "Sinh bằng AI",
      desc: "Mô tả gia đình bằng lời, AI dựng sẵn dữ liệu để bạn duyệt.",
      icon: <IconSparkles className="h-5 w-5" />,
      editorOnly: true,
    },
    {
      to: `${base}/merge`,
      label: "Gộp người trùng",
      desc: "Tìm và gộp các bản ghi trùng một người.",
      icon: <IconCopy className="h-5 w-5" />,
      editorOnly: true,
    },
    {
      to: `${base}/audit`,
      label: "Nhật ký",
      desc: "Lịch sử thay đổi dữ liệu của dòng họ.",
      icon: <IconScroll className="h-5 w-5" />,
      editorOnly: false,
    },
  ].filter((t) => canEdit || !t.editorOnly);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: base },
          { label: "Công cụ" },
        ]}
      />
      <PageHeader
        icon={<IconSettings className="h-7 w-7" />}
        title="Công cụ"
        description="Các công cụ thiết lập và quản lý dữ liệu — ít dùng nên gom lại đây."
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary transition-colors h-full"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                {t.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{t.label}</span>
                <span className="block text-sm text-muted-foreground mt-0.5">{t.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
