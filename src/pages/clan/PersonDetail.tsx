import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import { deletePerson, getPerson, type PersonDetail as PersonDetailT } from "@/lib/queries/persons";
import { getClanDetail } from "@/lib/queries/clan-detail";

export default function PersonDetail() {
  const { clanId, personId } = useParams<{ clanId: string; personId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clan } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId),
    queryFn: () => getClanDetail(clanId!, userId),
    enabled: !!clanId && !!userId,
  });
  const { data: person, isLoading } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePerson(personId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "persons" &&
          q.queryKey[1] === clanId,
      });
      navigate(`/clans/${clanId}/people`);
    },
  });

  if (!clanId || !personId) return null;

  const canEdit = clan?.myRole === "admin" || clan?.myRole === "editor";

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4 space-y-6">
        <nav className="text-sm text-muted-foreground">
          <Link to={`/clans/${clanId}/people`} className="hover:underline">
            ← Danh bạ
          </Link>
        </nav>

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        {!isLoading && !person && (
          <Alert variant="destructive">
            <AlertDescription>Không tìm thấy người này.</AlertDescription>
          </Alert>
        )}

        {person && (
          <>
            <header className="space-y-2">
              <h1 className="clan-name text-3xl font-semibold">
                {person.full_name}
              </h1>
              <p className="text-base text-muted-foreground">
                {person.is_root && (
                  <span className="text-accent font-medium">Thuỷ tổ • </span>
                )}
                {person.generation !== null && <>Đời {person.generation}</>}
                {!person.is_living && (
                  <span>
                    {person.generation !== null && " • "}
                    đã mất
                    {person.death_date?.slice(0, 4) &&
                      ` • ${person.death_date.slice(0, 4)}`}
                  </span>
                )}
              </p>
            </header>

            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base">
                <DetailRow label="Giới tính" value={person.gender === "M" ? "Nam" : "Nữ"} />
                <DetailRow label="Ngày sinh" value={person.birth_date} />
                {!person.is_living && (
                  <DetailRow label="Ngày mất" value={person.death_date} />
                )}
                <DetailRow label="Tên tự" value={person.courtesy_name} />
                <DetailRow label="Tên húy" value={person.nickname} />
                <DetailRow label="Tên thụy" value={person.posthumous_name} />
                <DetailRow label="Nơi sinh" value={person.birth_place} />
                <DetailRow label="Nơi an táng" value={person.burial_place} />
                {person.bio && (
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-1">Tiểu sử</p>
                    <p className="whitespace-pre-wrap">{person.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {canEdit && (
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={`/clans/${clanId}/people/${personId}/edit`}>
                    Sửa
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (
                      confirm(
                        `Xoá ${person.full_name}? Có thể khôi phục từ nhật ký.`,
                      )
                    ) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Đang xoá…" : "Xoá"}
                </Button>
              </div>
            )}

            {deleteMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(deleteMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export type { PersonDetailT };
