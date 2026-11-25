import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { IconUser } from "@/components/icons";
import { ShareTree } from "@/components/share/ShareTree";
import { Button } from "@/components/ui/button";
import { sitePagePath } from "@/lib/siteSections";

import { useSite } from "./siteContext";

/**
 * Cây gia phả của trang dòng họ: dùng nguyên khối cây của màn Share (chọn người trung tâm, Tuỳ chọn cây, 2D/3D,
 * hướng dẫn, xuất ảnh, toàn màn hình) + nút "Xem hồ sơ" của người đang chọn. Khung có chiều cao cố định vì cây tự
 * kéo/phóng trong khung.
 */
export default function SiteTree() {
  const { data, base } = useSite();
  const [sp] = useSearchParams();
  const [focal, setFocal] = useState<string | null>(null);
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[34rem] flex-col">
      <ShareTree
        data={data}
        initialFocal={sp.get("p")}
        onFocalChange={setFocal}
        toolbarExtra={
          focal ? (
            <Button asChild size="sm" variant="outline" className="shrink-0 px-3 text-sm">
              <Link to={sitePagePath(base, "person", focal)}>
                <IconUser className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">{t`Xem hồ sơ`}</span>
                <span className="sm:hidden">{t`Hồ sơ`}</span>
              </Link>
            </Button>
          ) : null
        }
      />
    </div>
  );
}
