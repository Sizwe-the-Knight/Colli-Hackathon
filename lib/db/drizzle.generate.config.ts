import { defineConfig } from "drizzle-kit";
import path from "path";

// Offline generation/checking only. No environment loading, credentials or DB import.
export default defineConfig({
  // Drizzle treats schema paths as globs; forward slashes also work on Windows.
  schema: path.join(__dirname, "./src/schema/index.ts").replace(/\\/g, "/"),
  // This Drizzle release joins snapshot paths to cwd, so out must be relative.
  out: path.relative(process.cwd(), path.join(__dirname, "./drizzle")).replace(/\\/g, "/") || ".",
  dialect: "postgresql",
});
