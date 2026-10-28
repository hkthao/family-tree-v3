import { useEffect, useState } from "react";
import { openOutApp } from "zmp-sdk";

import { IconArrowRight, IconMapPin, IconScroll, IconX } from "@/components/icons";
import type { ClanSummary } from "@/lib/queries/clans";
import {
  getHeritageItem,
  HERITAGE_CATEGORY_LABEL,
  heritageDirectionsUrl,
  listHeritageItems,
  videoEmbedUrl,
  type HeritageCategory,
  type HeritageMedia,
} from "@/lib/queries/heritage";

import { usePhotoUrls, useSignedUrls } from "../photos";
import { useRev } from "../rev";
import { useAsync } from "../useAsync";

/**
 * Di sản dòng họ — CHỈ ĐỌC trong Mini App: danh sách (tìm, lọc theo loại)
 * và trang chi tiết (ảnh, ghi âm kể chuyện, video, nội dung nhiều đoạn,
 * nơi chốn + chỉ đường, người liên quan). Thêm/sửa, ghi âm, tải ảnh, mã QR
 * và thẻ chia sẻ làm trên web (chủ dự án chốt 24/10/2026). Tab "Sổ tay Văn
 * hoá" của trang web là nội dung chung, không thuộc dòng họ — không đưa vào.
 */
const CATEGORIES = Object.keys(HERITAGE_CATEGORY_LABEL) as HeritageCategory[];

function openUrl(url: string) {
  openOutApp({ url }).catch(() => window.open(url, "_blank"));
}

export function HeritageListScreen({ clan, openItem }: { clan: ClanSummary; openItem: (id: string) => void }) {
  const rev = useRev();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<HeritageCategory | "">("");
  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const items = useAsync(() => listHeritageItems(clan.id, { search: q, category: category || null }), [clan.id, q, category, rev]);
  const list = items.data ?? [];
  const thumb = useSignedUrls(list.map((i) => i.cover_media_path));

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Từ đường, tục lệ, giai thoại, tư liệu — gìn giữ giá trị tinh thần của dòng họ.</p>
      <div className="searchbar" style={{ position: "static", margin: "0 0 8px", padding: 0 }}>
        <input className="field" type="search" placeholder="Tìm di sản…" aria-label="Tìm di sản" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="todo-cats" role="tablist" aria-label="Loại di sản" style={{ marginTop: 0 }}>
        <button type="button" role="tab" aria-selected={category === ""} onClick={() => setCategory("")}>Tất cả</button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}>{HERITAGE_CATEGORY_LABEL[c]}</button>
        ))}
      </div>

      {items.loading && !items.data && [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 88, marginBottom: 8 }} />)}
      {items.error && <p className="error">{items.error}</p>}
      {items.data && list.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconScroll /></div>
          <p className="muted">{q || category ? "Không có mục nào khớp." : "Dòng họ chưa ghi di sản nào."}</p>
        </div>
      )}
      {list.map((it) => {
        const t = it.cover_external_url ?? thumb(it.cover_media_path);
        const counts = [
          it.photo_count && `${it.photo_count} ảnh`,
          it.audio_count && `${it.audio_count} ghi âm`,
          it.video_count && `${it.video_count} video`,
        ].filter(Boolean);
        return (
          <button key={it.id} type="button" className="card grave-card" onClick={() => openItem(it.id)}>
            <span className="grave-thumb">{t ? <img src={t} alt="" /> : <IconScroll />}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b className="ell">{it.title}</b>
              <span className="tiny ell" style={{ margin: 0 }}>{HERITAGE_CATEGORY_LABEL[it.category]}{it.location_name ? ` · ${it.location_name}` : ""}</span>
              {it.summary && <span className="post-body" style={{ fontSize: 13, color: "var(--muted)" }}>{it.summary}</span>}
              {counts.length > 0 && <span className="tiny" style={{ margin: 0 }}>{counts.join(" · ")}</span>}
            </span>
            <span className="go"><IconArrowRight /></span>
          </button>
        );
      })}
    </div>
  );
}

export function HeritageScreen({
  itemId,
  openPerson,
}: {
  itemId: string;
  openPerson: (id: string) => void;
}) {
  const rev = useRev();
  const q = useAsync(() => getHeritageItem(itemId), [itemId, rev]);
  const item = q.data;
  const signed = useSignedUrls((item?.media ?? []).map((m) => m.path));
  const avatar = usePhotoUrls([]);
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [viewing, setViewing] = useState<string | null>(null);

  if (q.loading && !item) return <div className="page"><div className="sk" style={{ height: 320 }} /></div>;
  if (q.error || !item) return <div className="center"><p className="error">{q.error ?? "Không tìm thấy."}</p></div>;

  const src = (m: HeritageMedia) => m.external_url ?? signed(m.path);
  const photos = item.media.filter((m) => m.kind === "photo");
  const audios = item.media.filter((m) => m.kind === "audio");
  const videos = item.media.filter((m) => m.kind === "video");
  const sections = item.sections ?? [];
  const dir = heritageDirectionsUrl(item.latitude, item.longitude);
  const hasInfo = item.location_name || item.address || item.built_year || dir;

  return (
    <div className="page">
      <header className="phead">
        <span className="grave-thumb lg"><IconScroll /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 20 }}>{item.title}</h2>
          <span className="tiny" style={{ margin: 0 }}>{HERITAGE_CATEGORY_LABEL[item.category]}</span>
        </span>
      </header>

      {photos.length > 0 && (
        <section className="card pane">
          <h3 className="serif">Hình ảnh ({photos.length})</h3>
          <div className="grave-photos">
            {photos.map((ph) => {
              const s = src(ph);
              return (
                <div key={ph.id} className="grave-photo">
                  {s ? (
                    <img src={s} alt={ph.caption ?? ""} onClick={() => setViewing(s)} />
                  ) : (
                    <span className="sk" style={{ display: "block", height: "100%" }} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {audios.length > 0 && (
        <section className="card pane">
          <h3 className="serif">Ghi âm kể chuyện ({audios.length})</h3>
          {audios.map((a) => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              {a.caption && <p className="tiny" style={{ margin: "0 0 4px" }}>{a.caption}</p>}
              {src(a) ? <audio controls preload="none" src={src(a)!} style={{ width: "100%" }} /> : <div className="sk" style={{ height: 40 }} />}
            </div>
          ))}
        </section>
      )}

      {videos.length > 0 && (
        <section className="card pane">
          <h3 className="serif">Video ({videos.length})</h3>
          {videos.map((v) => {
            const embed = videoEmbedUrl(v.external_url ?? "");
            return (
              <div key={v.id} style={{ marginBottom: 10 }}>
                {embed ? (
                  <div className="her-video">
                    <iframe src={embed} title="Video di sản" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  </div>
                ) : (
                  v.external_url && (
                    <button type="button" className="btn ghost block" onClick={() => openUrl(v.external_url!)}>Mở video</button>
                  )
                )}
                {v.caption && <p className="tiny" style={{ margin: "4px 0 0" }}>{v.caption}</p>}
              </div>
            );
          })}
        </section>
      )}

      {(item.summary || item.body || sections.length > 0) && (
        <section className="card pane">
          <h3 className="serif">Nội dung</h3>
          {item.summary && <p className="post-full" style={{ fontWeight: 500, marginBottom: 8 }}>{item.summary}</p>}
          {sections.length === 0 && item.body && <div className="post-full">{item.body}</div>}
          {sections.map((s, i) => (
            <div key={i} className="her-sec">
              <button
                type="button"
                className="her-sec-head"
                aria-expanded={open.has(i)}
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              >
                <span>{s.heading || `Đoạn ${i + 1}`}</span>
                <span className="her-chev">{open.has(i) ? "−" : "+"}</span>
              </button>
              {open.has(i) && <div className="post-full" style={{ padding: "4px 0 10px" }}>{s.body}</div>}
            </div>
          ))}
        </section>
      )}

      {hasInfo && (
        <section className="card pane">
          <h3 className="serif">Nơi chốn</h3>
          {item.location_name && <div className="drow"><span>Nơi</span><span>{item.location_name}</span></div>}
          {item.address && <div className="drow"><span>Địa chỉ</span><span>{item.address}</span></div>}
          {item.built_year && <div className="drow"><span>Năm xây / lập</span><span>{item.built_year}</span></div>}
          {dir && (
            <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => openUrl(dir)}>
              <IconMapPin /> Chỉ đường
            </button>
          )}
        </section>
      )}

      {item.people.length > 0 && (
        <section className="card pane">
          <h3 className="serif">Người liên quan ({item.people.length})</h3>
          {item.people.map((p) => (
            <button key={p.link_id} type="button" className="card relrow" onClick={() => openPerson(p.person_id)}>
              <img src={avatar(null, p.gender)} width={36} height={36} alt="" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <b className="ell">{p.full_name}</b>
                {p.role_note && <span className="tiny" style={{ margin: 0 }}>{p.role_note}</span>}
              </span>
              <span className="go"><IconArrowRight /></span>
            </button>
          ))}
        </section>
      )}

      {viewing && (
        <div className="lightbox" role="dialog" aria-label="Xem ảnh" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" />
          <button type="button" aria-label="Đóng"><IconX /></button>
        </div>
      )}
    </div>
  );
}
