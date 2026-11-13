// Tiếng Việt là ngôn ngữ nguồn: kích hoạt sẵn để mọi chuỗi qua `t` ra đúng tiếng Việt như trước.
import "@/lib/i18n";
import { config } from "dotenv";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Load .env.local for SUPABASE_URL + keys
config({ path: ".env.local" });
config({ path: ".env" });

expect.extend(matchers);
