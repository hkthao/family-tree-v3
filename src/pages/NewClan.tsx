import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/components/Toast";
import { IconCheck, IconX } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { createClan } from "@/lib/queries/clans";

export default function NewClan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const mutation = useMutation({
    mutationFn: () =>
      createClan({ name, description: description || undefined, visibility }, user!.id),
    onSuccess: async (clan) => {
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "clans",
      });
      toast.success("Đã tạo dòng họ", { description: name });
      navigate(`/clans/${clan.id}`);
    },
    onError: (e) =>
      toast.error("Không tạo được", { description: (e as Error).message }),
  });

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link to="/clans" className="hover:underline">← Dòng họ của tôi</Link>
        </nav>

        <h1 className="clan-name text-3xl font-semibold mb-6">Tạo dòng họ mới</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mutation.mutate();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Tên dòng họ</Label>
            <Input
              id="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Họ Nguyễn Hữu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
            <Input
              id="description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vài dòng giới thiệu về dòng họ"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium mb-2">Chế độ hiển thị</legend>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
                className="mt-1.5 h-4 w-4 accent-primary"
              />
              <div>
                <p className="font-medium">Riêng tư</p>
                <p className="text-sm text-muted-foreground">
                  Chỉ thành viên được mời mới xem được.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
                className="mt-1.5 h-4 w-4 accent-primary"
              />
              <div>
                <p className="font-medium">Công khai</p>
                <p className="text-sm text-muted-foreground">
                  Mọi tài khoản đã đăng nhập đều xem được (thông tin nhạy cảm
                  của người còn sống vẫn ẩn).
                </p>
              </div>
            </label>
          </fieldset>

          {mutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {(mutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" size="lg" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? (
                "Đang tạo…"
              ) : (
                <>
                  <IconCheck className="h-5 w-5 mr-2" />
                  Tạo dòng họ
                </>
              )}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/clans">
                <IconX className="h-5 w-5 mr-2" />
                Hủy
              </Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
