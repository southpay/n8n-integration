import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".svg") || entry.name.endsWith(".png")) {
      const dest = full.replace(/^nodes/, join("dist", "nodes"));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
      console.log("icon ->", dest);
    }
  }
}

walk("nodes");
