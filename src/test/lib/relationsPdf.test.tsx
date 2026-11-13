import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { pdf } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { RelationsPdf } from "@/lib/pdf/RelationsPdf";
import { setPdfAssets } from "@/lib/pdf/pdfAssets";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import {
  buildRelationsIndex,
  buildRelationsReport,
  type RelFamily,
  type RelPerson,
} from "@/lib/relations";

// RELATIONS_PDF_BASE_URL: nạp phông / hình qua địa chỉ web (giống trình duyệt) thay vì đọc tệp.
const pub = (p: string) =>
  process.env.RELATIONS_PDF_BASE_URL
    ? `${process.env.RELATIONS_PDF_BASE_URL}/${p}`
    : join(process.cwd(), "public", p);

const person = (
  id: string,
  name: string,
  over: Partial<RelPerson> = {},
): RelPerson => ({
  id,
  full_name: name,
  gender: "M",
  is_living: true,
  is_root: false,
  birth_date: null,
  death_date: null,
  generation: null,
  birth_family_id: null,
  birth_order: null,
  birth_place: null,
  burial_place: null,
  lifespan_years: null,
  ...over,
});
const fam = (id: string, h: string | null, w: string | null): RelFamily => ({
  id,
  husband_id: h,
  wife_id: w,
  spouse_order: null,
  created_at: null,
});

describe("PDF Tra cứu quan hệ", () => {
  it("dựng được tệp PDF cho một người có đủ quan hệ", async () => {
    // Trong Node, phông / hình nền đọc thẳng từ thư mục public.
    setPdfAssets({
      font400: pub("fonts/be-vietnam-pro-400.ttf"),
      font600: pub("fonts/be-vietnam-pro-600.ttf"),
      nameFonts: {
        playfair: [
          pub("fonts/name-playfair-600.ttf"),
          pub("fonts/name-playfair-700.ttf"),
        ],
      },
      logo: pub("icons/app-icon-192.png"),
      watermarks: { phoenix: pub("watermarks/phoenix.png") },
    });

    const persons = [
      person("ong", "Trần Văn Ông", {
        generation: 1,
        birth_date: "1890-01-01",
        death_date: "1960-01-01",
        is_living: false,
      }),
      person("cha", "Trần Văn Cha", {
        generation: 2,
        birth_family_id: "f-ong",
        birth_date: "1920-05-05",
        birth_place: "Nghĩa Đàn",
      }),
      person("me", "Lê Thị Mẹ", { gender: "F", generation: 2 }),
      person("a", "Trần Văn Ất", {
        generation: 3,
        birth_family_id: "f-cha",
        birth_order: 2,
        birth_date: "1950-01-01",
        burial_place: "Nghĩa trang họ",
      }),
      person("anh", "Trần Văn Giáp", {
        generation: 3,
        birth_family_id: "f-cha",
        birth_order: 1,
      }),
      person("bac", "Trần Thị Bác", {
        gender: "F",
        generation: 2,
        birth_family_id: "f-ong",
      }),
      person("vo", "Nguyễn Thị Vợ", {
        gender: "F",
        birth_date: "1952-02-02",
        birth_place: "Quỳnh Lưu",
      }),
      ...Array.from({ length: 30 }, (_, i) =>
        person(`c${i}`, `Con ${i + 1} Trần Văn`, {
          generation: 4,
          birth_family_id: "f-a",
          birth_order: i + 1,
          birth_date: `${1975 + i}-01-01`,
        }),
      ),
    ];
    const families = [
      fam("f-ong", "ong", null),
      fam("f-cha", "cha", "me"),
      fam("f-a", "a", "vo"),
    ];
    const idx = buildRelationsIndex(persons, families);
    const report = buildRelationsReport(idx, idx.byId.get("a")!, 0);

    const clan = {
      id: "c",
      name: "Họ Trần (Nghĩa Đàn)",
    } as unknown as ClanDetail;
    const buf = await pdf(
      <RelationsPdf
        clan={clan}
        report={report}
        genOffset={0}
        generatedAt={new Date("2026-11-13")}
      />,
    ).toBuffer();
    const bytes = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      (buf as unknown as NodeJS.ReadableStream)
        .on("data", (c: Buffer) => chunks.push(c))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
    if (process.env.RELATIONS_PDF_OUT)
      writeFileSync(process.env.RELATIONS_PDF_OUT, bytes);
  });
});
