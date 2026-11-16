import { useState } from "react";

import { IconCheck, IconCopy } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { SegmentedButton, SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mcpUrl } from "@/lib/queries/api-tokens";

import { t } from "@lingui/core/macro";

type Client = "claude-code" | "claude-desktop" | "chatgpt" | "other";

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

/** Ngăn kéo hướng dẫn nối từng loại AI (Claude Code, Claude Desktop, ChatGPT, công cụ khác) với server MCP. */
export function McpGuidePanel({ open, onClose, admin = false }: { open: boolean; onClose: () => void; admin?: boolean }) {
  const [client, setClient] = useState<Client>("claude-code");
  const [custom, setCustom] = useState("");
  const url = custom.trim().replace(/\/+$/, "") || mcpUrl();
  const local = /^https?:\/\/(localhost|127\.|\[::1\])/.test(url);
  const tok = "<TOKEN>";

  const desktopCfg = JSON.stringify(
    {
      mcpServers: {
        "dong-ho-viet": {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${AUTH}"],
          env: { AUTH: `Bearer ${tok}` },
        },
      },
    },
    null,
    2,
  );
  const curl = `curl -s ${url} \\\n  -H "Authorization: Bearer ${tok}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  return (
    <SidePanel open={open} title={t`Hướng dẫn kết nối AI`} subtitle={t`Chọn loại AI bạn đang dùng`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <SegmentedControl ariaLabel={t`Loại AI`} className="w-fit max-w-full self-start overflow-x-auto">
          <SegmentedButton active={client === "claude-code"} onClick={() => setClient("claude-code")}>Claude Code</SegmentedButton>
          <SegmentedButton active={client === "claude-desktop"} onClick={() => setClient("claude-desktop")}>Claude Desktop</SegmentedButton>
          <SegmentedButton active={client === "chatgpt"} onClick={() => setClient("chatgpt")}>ChatGPT</SegmentedButton>
          <SegmentedButton active={client === "other"} onClick={() => setClient("other")}>{t`Khác`}</SegmentedButton>
        </SegmentedControl>

        <div className="space-y-1.5">
          <Label htmlFor="mcp-url">{t`Địa chỉ máy chủ MCP`}</Label>
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
              ? t`Đang là địa chỉ máy bạn (localhost), AI bên ngoài không truy cập được. Sửa thành địa chỉ công khai của máy chủ MCP rồi chép lệnh bên dưới.`
              : t`Mặc định theo tên miền bạn đang dùng. Sửa lại nếu máy chủ MCP nằm ở địa chỉ khác; các lệnh bên dưới đổi theo.`}
          </P>
        </div>

        <P>
          {t`Cả bốn cách đều cần token: bấm nút "+" để tạo, chép token ngay (chỉ hiện một lần), rồi thay ${tok} trong các lệnh dưới đây.`}
        </P>

        {client === "claude-code" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Mở terminal, chạy một lần`}>
              <Code text={`claude mcp add --transport http dong-ho-viet ${url} --header "Authorization: Bearer ${tok}"`} />
              <P>{t`Thêm cờ --scope user nếu muốn dùng ở mọi thư mục.`}</P>
            </Step>
            <Step n={2} title={t`Khởi động lại Claude Code rồi kiểm tra`}>
              <Code text="/mcp" />
              <P>{t`Thấy dong-ho-viet ở trạng thái connected là xong.`}</P>
            </Step>
          </ol>
        )}

        {client === "claude-desktop" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Cài Node.js (để chạy cầu nối mcp-remote)`}>
              <P>{t`Tải ở nodejs.org, bản LTS. Máy đã có Node thì bỏ qua bước này.`}</P>
            </Step>
            <Step n={2} title={t`Mở Claude Desktop → Settings → Developer → Edit Config`}>
              <P>{t`Dán đoạn sau vào file claude_desktop_config.json (gộp vào mục mcpServers nếu đã có).`}</P>
              <Code text={desktopCfg} />
            </Step>
            <Step n={3} title={t`Thoát hẳn rồi mở lại Claude Desktop`}>
              <P>{t`Biểu tượng công cụ ở ô chat sẽ liệt kê các tool của dong-ho-viet.`}</P>
            </Step>
          </ol>
        )}

        {client === "chatgpt" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Bật chế độ nhà phát triển`}>
              <P>{t`ChatGPT → Settings → Connectors → Advanced → Developer mode (cần gói trả phí hỗ trợ MCP tuỳ chỉnh).`}</P>
            </Step>
            <Step n={2} title={t`Thêm máy chủ MCP`}>
              <P>{t`Chọn tạo connector mới, nhập địa chỉ:`}</P>
              <Code text={url} />
            </Step>
            <Step n={3} title={t`Xác thực bằng token`}>
              <P>{t`Nếu giao diện cho nhập header, đặt Authorization = Bearer <token>. Nếu ChatGPT chỉ cho OAuth hoặc không xác thực thì chưa nối thẳng được; dùng Claude Code/Desktop hoặc cách "Khác".`}</P>
              <Code text={`Authorization: Bearer ${tok}`} />
            </Step>
          </ol>
        )}

        {client === "other" && (
          <ol className="space-y-4">
            <Step n={1} title={t`Client MCP bất kỳ hỗ trợ HTTP`}>
              <P>{t`Địa chỉ và header cần nhập:`}</P>
              <Code text={`${url}\nAuthorization: Bearer ${tok}`} />
            </Step>
            <Step n={2} title={t`Thử bằng curl hoặc script`}>
              <Code text={curl} />
              <P>{t`Giao thức JSON-RPC 2.0 qua POST; trả danh sách tool theo quyền của token.`}</P>
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
