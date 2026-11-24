import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { CATEGORY_SLUGS } from "./taxonomy";

/**
 * Nguồn DUY NHẤT của Sổ tay Văn hoá: trang SEO (donghoviet) + dữ liệu cho app (so-tay-data/*.json).
 * Sửa schema ở đây thì sửa cả src/lib/queries/customs.ts (app) và supabase/functions/publish-so-tay/core.ts (danh mục).
 */
const soTay = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/so-tay" }),
  schema: z.object({
    status: z.enum(["draft", "needs_review", "published"]).default("needs_review"),
    title: z.string().max(140),
    short: z.string().optional(),
    description: z.string().min(20).max(320),
    updated: z.coerce.date(),
    category: z.enum(CATEGORY_SLUGS),
    tags: z.array(z.string()).default([]),
    aliases: z.array(z.string()).default([]),
    regions: z.array(z.string()).default([]),
    lunar_month: z.number().int().min(1).max(12).nullable().optional(),
    timing: z.string().optional(),
    scope: z.enum(["gia_dinh", "dong_ho", "lang_xa", "ton_giao"]).nullable().optional(),
    mandatory_level: z.enum(["bat_buoc", "khuyen_khich", "dia_phuong"]).nullable().optional(),
    origins: z.array(z.enum(["nho_giao", "phat_giao", "dao_mau", "dan_gian", "trung_hoa", "dia_phuong"])).default([]),
    reliability: z.number().int().min(1).max(5).nullable().optional(),
    applicable_to: z.string().optional(),
    cover_image_url: z.string().optional(),
    // Riêng các bài lễ hội (tuỳ chọn)
    minutes: z.number().int().positive().optional(),
    when: z.string().optional(),
    where: z.string().optional(),
    lead: z.string().optional(),
    infobox: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    images: z
      .array(z.object({ file: z.string(), alt: z.string(), caption: z.string(), credit: z.string(), w: z.number(), h: z.number() }))
      .default([]),
    heritage: z.string().optional(),
    soTay: z.string().optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    related: z.array(z.string()).default([]),
    sources: z.array(z.object({ name: z.string(), url: z.string().url().optional() })).default([]),
  }),
});

export const collections = { soTay };
