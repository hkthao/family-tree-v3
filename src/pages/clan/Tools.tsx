import { Link } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import {
  IconCalendar,
  IconCopy,
  IconScroll,
  IconSettings,
  IconSparkles,
  IconUpload,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";

/**
 * "Công cụ" — lưới chọn mục, cùng kiểu với trang Quản trị nền tảng.
 *
 * Vì sao lưới ô vuông thay vì danh sách hàng ngang: cùng một cách bày
 * thì học một lần dùng được cả hai nơi, và ô vuông có icon to dễ nhắm
 * hơn trên điện thoại — đây là chỗ người lớn tuổi hay vào để nhập Excel
 * hoặc xem lịch.
 *
 * Chia hai nhóm theo NHỊP DÙNG, không theo kỹ thuật: "Tra cứu" là thứ mở
 * ra xem bất cứ lúc nào; "Nhập & dọn dữ liệu" là thứ đụng vào vài lần
 * lúc mới lập gia phả, và đụng nhầm thì phải đi sửa.
 */

interface Tool {
  to: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  editorOnly?: boolean;
}

export default function Tools() {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);
  const base = `/clans/${clan.id}`;
  const ic = "h-6 w-6";

  const allGroups: Array<{ title: string; hint: string; tools: Tool[] }> = [
    {
      title: "Tra cứu",
      hint: "Mở ra xem, không sửa gì.",
      tools: [
        {
          // Trang lịch trước nay chỉ vào được từ thẻ "Hôm nay" ở Tổng
          // quan — ai không để ý dòng chữ đó thì coi như app không có
          // lịch. Đưa vào đây là chỗ người ta sẽ đi tìm.
          to: `${base}/xem-ngay`,
          label: "Lịch âm dương",
          desc: "Lịch tháng, ngày tốt xấu, lễ tết, và xem chi tiết từng ngày.",
          icon: <IconCalendar className={ic} />,
        },
        {
          to: `${base}/audit`,
          label: "Nhật ký",
          desc: "Lịch sử thay đổi dữ liệu của dòng họ.",
          icon: <IconScroll className={ic} />,
        },
      ],
    },
    {
      title: "Nhập & dọn dữ liệu",
      hint: "Đụng vào vài lần lúc mới lập gia phả — và đụng nhầm thì phải đi sửa.",
      tools: [
        {
          to: `${base}/import`,
          label: "Nhập từ Excel",
          desc: "Thêm nhiều người cùng lúc từ file Excel.",
          icon: <IconUpload className={ic} />,
          editorOnly: true,
        },
        {
          to: `${base}/ai-generate`,
          label: "Sinh bằng AI",
          desc: "Mô tả gia đình bằng lời, AI dựng sẵn dữ liệu để bạn duyệt.",
          icon: <IconSparkles className={ic} />,
          editorOnly: true,
        },
        {
          to: `${base}/merge`,
          label: "Gộp người trùng",
          desc: "Tìm và gộp các bản ghi trùng một người.",
          icon: <IconCopy className={ic} />,
          editorOnly: true,
        },
      ],
    },
  ];

  const groups = allGroups
    .map((g) => ({
      ...g,
      tools: g.tools.filter((t) => canEdit || !t.editorOnly),
    }))
    // Người chỉ xem không còn mục nào trong nhóm nhập liệu → bỏ hẳn
    // nhóm, đừng để một tiêu đề trống lơ lửng.
    .filter((g) => g.tools.length > 0);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: clan.name, to: base }, { label: "Công cụ" }]} />
      <PageHeader
        icon={<IconSettings className="h-7 w-7" />}
        title="Công cụ"
        description="Chọn một mục để mở."
      />

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <p className="text-sm text-muted-foreground">{g.hint}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.tools.map((t) => (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className="flex h-full min-h-[124px] flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {t.icon}
                  </span>
                  <span className="font-medium leading-tight">{t.label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {t.desc}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
