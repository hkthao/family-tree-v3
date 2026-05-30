import { config } from "dotenv";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Load .env.local for SUPABASE_URL + keys
config({ path: ".env.local" });
config({ path: ".env" });

expect.extend(matchers);
