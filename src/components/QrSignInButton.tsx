import { useEffect, useRef, useState } from "react";

import { IconPhoneDownload } from "@/components/icons";
import { QrCodeModal } from "@/components/QrCodeModal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

import { t } from "@lingui/core/macro";
/**
 * "Đăng nhập trên điện thoại" affordance: calls the auth-qr
 * edge function (which mints a magic-link URL for the current
 * session's user without sending email), then displays the URL
 * as a QR that the user's phone camera can scan.
 *
 * Auto-rotates every 4 minutes (link TTL is 5) so a stale QR
 * left on screen can't be photographed and used hours later.
 * Closing the modal cancels rotation.
 */
export function QrSignInButton() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const rotateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchLink() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        url: string;
        ttl_seconds: number;
      }>("auth-qr", { method: "POST" });
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error(t`Không nhận được link`);
      setUrl(data.url);
      // Refresh ~1 min before TTL to keep the QR live.
      const ms = Math.max(60_000, (data.ttl_seconds - 60) * 1000);
      if (rotateRef.current) clearTimeout(rotateRef.current);
      rotateRef.current = setTimeout(() => void fetchLink(), ms);
    } catch (e) {
      toast.error(t`Không tạo được mã QR`, {
        description: (e as Error).message,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    setUrl(null);
    void fetchLink();
  }

  function closeModal() {
    setOpen(false);
    setUrl(null);
    if (rotateRef.current) {
      clearTimeout(rotateRef.current);
      rotateRef.current = null;
    }
  }

  useEffect(
    () => () => {
      if (rotateRef.current) clearTimeout(rotateRef.current);
    },
    [],
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={openModal}
        disabled={loading}
        title={t`Hiện mã QR — quét bằng điện thoại để đăng nhập cùng tài khoản này`}
        className="w-full sm:w-auto"
      >
        <IconPhoneDownload className="h-4 w-4 mr-1.5 shrink-0" />
        {t`Đăng nhập trên điện thoại`}
      </Button>
      <QrCodeModal
        open={open}
        loading={loading}
        onClose={closeModal}
        url={url ?? ""}
        title={t`Quét để đăng nhập trên điện thoại`}
        description={t`Mở camera điện thoại, quét mã QR. Mã hiệu lực ~5 phút và chỉ dùng được một lần. KHÔNG chia sẻ ảnh chụp màn hình.`}
      />
    </>
  );
}
