import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

import type { TimelineIconKey } from "@/lib/timeline/eras";

/**
 * Mẫu mốc dựng sẵn cho những sự kiện quen thuộc của một gia đình / dòng họ. Người dùng chọn một mẫu thì
 * tiêu đề + mô tả + hình tự điền, chỉ cần nhập năm (và sửa chữ nếu muốn) — gần như không phải gõ.
 * Thêm mẫu mới = thêm một phần tử vào `RAW`.
 */
export interface MilestoneTemplate {
  id: string;
  title: string;
  body: string;
  iconKey: TimelineIconKey;
}

interface Raw {
  id: string;
  title: ReturnType<typeof msg>;
  body: ReturnType<typeof msg>;
  iconKey: TimelineIconKey;
}

const RAW: Raw[] = [
  {
    id: "lap-gia-dinh",
    title: msg`Lập gia đình`,
    body: msg`Hai người nên duyên vợ chồng, bắt đầu một mái ấm mới.`,
    iconKey: "ring",
  },
  {
    id: "con-dau-long",
    title: msg`Đón con đầu lòng`,
    body: msg`Gia đình đón thành viên mới chào đời.`,
    iconKey: "cradle",
  },
  {
    id: "sum-hop",
    title: msg`Sum họp nhiều thế hệ`,
    body: msg`Ông bà, cha mẹ, con cháu cùng quây quần một nhà.`,
    iconKey: "family",
  },
  {
    id: "dung-nha",
    title: msg`Dựng nhà mới`,
    body: msg`Gia đình dựng được căn nhà riêng sau bao năm cần cù.`,
    iconKey: "citadel",
  },
  {
    id: "tu-duong",
    title: msg`Xây dựng, tu bổ từ đường`,
    body: msg`Con cháu góp công góp của dựng lại từ đường của dòng họ.`,
    iconKey: "citadel",
  },
  {
    id: "hop-ho",
    title: msg`Họp họ, giỗ Tổ`,
    body: msg`Con cháu khắp nơi về họp mặt, cùng tưởng nhớ tổ tiên.`,
    iconKey: "candle",
  },
  {
    id: "tien-biet",
    title: msg`Tiễn biệt người đáng kính`,
    body: msg`Cả họ tiễn đưa một người đã có công vun đắp cho gia đình.`,
    iconKey: "candle",
  },
  {
    id: "gia-pha",
    title: msg`Biên soạn gia phả`,
    body: msg`Dòng họ ghi chép lại cội nguồn và các đời để con cháu nhớ.`,
    iconKey: "scroll",
  },
  {
    id: "ky-niem",
    title: msg`Lễ kỷ niệm của dòng họ`,
    body: msg`Dòng họ tổ chức lễ lớn, con cháu về dự đông đủ.`,
    iconKey: "banner",
  },
  {
    id: "di-cu",
    title: msg`Di cư, lập nghiệp nơi mới`,
    body: msg`Gia đình rời quê cũ để tìm cuộc sống mới ở nơi khác.`,
    iconKey: "boat",
  },
  {
    id: "hoi-huong",
    title: msg`Trở về quê cũ`,
    body: msg`Cả nhà trở về quê hương sau nhiều năm xa cách.`,
    iconKey: "boat",
  },
  {
    id: "tong-quan",
    title: msg`Tòng quân, lên đường nhập ngũ`,
    body: msg`Người con của gia đình lên đường làm nghĩa vụ với đất nước.`,
    iconKey: "sword",
  },
  {
    id: "chien-tranh",
    title: msg`Thời chiến loạn, tản cư`,
    body: msg`Gia đình trải qua mất mát, phải rời nhà lánh nạn.`,
    iconKey: "sword",
  },
  {
    id: "do-dat",
    title: msg`Con cháu học hành, đỗ đạt`,
    body: msg`Con cháu trong nhà tốt nghiệp, đỗ đạt, làm rạng danh dòng họ.`,
    iconKey: "book",
  },
  {
    id: "lam-an",
    title: msg`Gây dựng cơ nghiệp, làm ăn`,
    body: msg`Gia đình bắt đầu làm ăn, từng bước gây dựng cơ nghiệp.`,
    iconKey: "rice",
  },
  {
    id: "xe-dap",
    title: msg`Sắm chiếc xe đầu tiên`,
    body: msg`Gia đình sắm được chiếc xe đầu tiên, đi lại đỡ vất vả.`,
    iconKey: "bicycle",
  },
  {
    id: "radio-tivi",
    title: msg`Có chiếc radio, ti vi đầu tiên`,
    body: msg`Cả xóm kéo đến xem chung chiếc ti vi đầu tiên của nhà.`,
    iconKey: "radio",
  },
  {
    id: "hien-dai",
    title: msg`Cuộc sống hiện đại`,
    body: msg`Điện thoại, mạng xã hội giúp con cháu xa nhà vẫn gần nhau.`,
    iconKey: "phone",
  },
];

/** Các mẫu mốc, đã dịch theo ngôn ngữ hiện tại. Gọi lúc render. */
export function getMilestoneTemplates(): MilestoneTemplate[] {
  return RAW.map((r) => ({
    id: r.id,
    iconKey: r.iconKey,
    title: i18n._(r.title),
    body: i18n._(r.body),
  }));
}
