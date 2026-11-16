import { useState } from "react";

import { IconCheck, IconCopy } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { SegmentedButton, SegmentedControl } from "@/components/ui/segmented-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mcpUrl } from "@/lib/queries/api-tokens";

import { t } from "@lingui/core/macro";

type Client = "claude" | "chatgpt" | "claude-code" | "other";

function Code({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-11 font-mono text-xs leading-relaxed">{text}</pre>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1 h-8 w-8"
        aria-label={t`Chép`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            /* chép tay */
          }
        }}
      >
        {done ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Ngăn kéo hướng dẫn người dùng nối từng ứng dụng AI (Claude, ChatGPT, Claude Code, khác) với gia phả. */
export function McpGuidePanel({ open, onClose, admin = false }: { open: boolean; onClose: () => void; admin?: boolean }) {
  const [client, setClient] = useState<Client>("claude");
  const [custom, setCustom] = useState("");
  const url = custom.trim().replace(/\/+$/, "") || mcpUrl();
  const local = /^https?:\/\/(localhost|127\.|\[::1\])/.test(url);
  const tok = "<TOKEN>";

  return (
    <SidePanel open={open} title={t`Hướng dẫn kết nối AI`} subtitle={t`Chọn ứng dụng AI bạn đang dùng`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <SegmentedControl ariaLabel={t`Ứng dụng AI`} className="w-fit max-w-full self-start overflow-x-auto">
          <SegmentedButton active={client === "claude"} onClick={() => setClient("claude")}>Claude</SegmentedButton>
          <SegmentedButton active={client === "chatgpt"} onClick={() => setClient("chatgpt")}>ChatGPT</SegmentedButton>
          <SegmentedButton active={client === "claude-code"} onClick={() => setClient("claude-code")}>Claude Code</SegmentedButton>
          <SegmentedButton active={client === "other"} onClick={() => setClient("other")}>{t`Khác`}</SegmentedButton>
        </SegmentedControl>

        <div className="space-y-1.5">
          <Label htmlFor="mcp-url">{t`Địa chỉ kết nối`}</Label>
          <Input
            id="mcp-url"
            className="font-mono text-xs"
            value={custom || url}
            onChange={(e) => setCustom(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
          />
          <P>
            {local
              ? t`Đây là địa chỉ máy bạn (localhost), ứng dụng AI trên mạng không truy cập được. Hãy sửa thành địa chỉ công khai của hệ thống.`
              : t`Địa chỉ này dùng cho các bước bên dưới. Thường bạn không cần sửa.`}
          </P>
        </div>

        {client === "claude" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Mở Claude (claude.ai hoặc ứng dụng máy tính) → Customize → Connectors`} />
            <Step n={2} title={t`Bấm Add → đưa chuột vào Custom → chọn Web`} />
            <Step n={3} title={t`Đặt tên, dán địa chỉ kết nối rồi bấm Continue`}>
              <Code text={url} />
            </Step>
            <Step n={4} title={t`Giữ nguyên Authentication; ở OAuth client chọn "Register automatically"`}>
              <P>{t`Bấm Add. Claude sẽ mở trang của hệ thống này để bạn đăng nhập và bấm "Cho phép".`}</P>
            </Step>
            <Step n={5} title={t`Chọn dòng họ và quyền cho AI, bấm "Cho phép"`}>
              <P>{t`Chỉ quản trị dòng họ mới cấp được (admin hệ thống có thêm lựa chọn dùng cho mọi dòng họ). Kết nối hiện trong Cài đặt dòng họ → Kết nối AI, thu hồi ở đó bất cứ lúc nào.`}</P>
            </Step>
            <Step n={6} title={t`Dùng trong cuộc trò chuyện`}>
              <P>{t`Bấm "+" ở góc dưới bên trái ô chat (hoặc gõ "/"), chọn Connectors rồi bật kết nối vừa thêm.`}</P>
            </Step>
          </ol>
        )}

        {client === "chatgpt" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Mở ChatGPT trên web → Plugins (chatgpt.com/plugins)`} />
            <Step n={2} title={t`Bấm nút "+" → Add custom MCP server`} />
            <Step n={3} title={t`Nhập tên, dán địa chỉ kết nối vào ô Server URL`}>
              <Code text={url} />
            </Step>
            <Step n={4} title={t`Ở Authentication chọn "OAuth"`}>
              <P>{t`Đọc cảnh báo rủi ro, chọn "I understand and want to continue" rồi "Create as a plugin".`}</P>
            </Step>
            <Step n={5} title={t`Cài plugin vừa tạo và đăng nhập khi được hỏi`}>
              <P>{t`ChatGPT mở trang của hệ thống này: chọn dòng họ, chọn quyền cho AI và bấm "Cho phép".`}</P>
            </Step>
            <Step n={6} title={t`Dùng trong cuộc trò chuyện`}>
              <P>{t`Gõ "@" rồi chọn plugin; nên nói rõ tên plugin trong câu hỏi. Với thao tác ghi, kiểm tra nội dung trước khi xác nhận.`}</P>
            </Step>
          </ol>
        )}

        {(client === "claude-code" || client === "other") && (
          <Alert>
            <AlertDescription>
              {t`Cách này dùng token: bấm nút "+" để tạo token và chép lại ngay (chỉ hiện một lần). Ở các bước dưới, ${tok} là token đó.`}
            </AlertDescription>
          </Alert>
        )}

        {client === "claude-code" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Dành cho người dùng Claude Code (công cụ dòng lệnh)`}>
              <P>{t`Mở terminal và chạy một lần:`}</P>
              <Code text={`claude mcp add --transport http dong-ho-viet ${url} --header "Authorization: Bearer ${tok}"`} />
            </Step>
            <Step n={2} title={t`Khởi động lại Claude Code, gõ /mcp để kiểm tra`}>
              <P>{t`Thấy dong-ho-viet ở trạng thái connected là xong.`}</P>
            </Step>
          </ol>
        )}

        {client === "other" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Ứng dụng AI khác có hỗ trợ MCP từ xa`}>
              <P>{t`Tìm mục thêm máy chủ / connector MCP tuỳ chỉnh và nhập hai thông tin:`}</P>
              <Code text={`${url}\nAuthorization: Bearer ${tok}`} />
            </Step>
            <Step n={2} title={t`Nếu ứng dụng không có ô nhập header`}>
              <P>{t`Nếu ứng dụng hỗ trợ đăng nhập OAuth, chỉ cần nhập địa chỉ kết nối rồi làm theo màn hình "Cho phép".`}</P>
            </Step>
          </ol>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">{t`Thử hỏi AI`}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t`"Cho tôi xem thông tin dòng họ."`}</li>
            <li>{t`"Tìm ông Huỳnh Văn A và cho biết con cháu."`}</li>
            <li>{t`"Tuần này có ngày giỗ nào?"`}</li>
            <li>{t`"Cập nhật nơi sinh của … là …" (cần gói ghi trực tiếp).`}</li>
            <li>{t`"Xuất sổ gia phả PDF."`}</li>
            {admin && <li>{t`"Liệt kê các đóng góp đang chờ duyệt trên toàn hệ thống."`}</li>}
          </ul>
        </div>

        <div className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t`Lưu ý an toàn`}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t`Token như mật khẩu: không gửi vào nhóm chat hay dán lên mạng. Nghi lộ thì thu hồi ngay.`}</li>
            <li>{t`Chọn gói quyền nhỏ nhất đủ dùng; AI không bao giờ vượt quá vai trò hiện tại của người tạo token.`}</li>
            {admin && <li>{t`Token Admin hệ thống rất mạnh: nên đặt hạn ngắn, mọi lệnh được ghi nhật ký.`}</li>}
          </ul>
        </div>
      </div>
    </SidePanel>
  );
}
