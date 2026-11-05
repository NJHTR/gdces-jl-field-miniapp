// 用真实文书 JSON 验证 draft 页的映射逻辑（不是 mock）
// 跑法：node tools/check-draft-map.js <doc.json>

const fs = require("fs");

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const d = raw.data || raw;

// ↓↓↓ 与 pages/draft/draft.js 的 _loadDoc 保持一致 ↓↓↓
const fields = d.fields || {};
const missing = d.missing || [];

const filled = Object.keys(fields)
  .filter((k) => String(fields[k] == null ? "" : fields[k]).trim())
  .map((k) => ({ k: k, v: String(fields[k]) }));

const groups = [];
if (filled.length) groups.push({ label: "基本信息", rows: filled });
if (missing.length) {
  groups.push({
    label: "待补",
    rows: missing.map((k) => ({ k: k, v: "", missing: true })),
  });
}

const bases = (d.bases || []).map((b) => ({
  ic: "search",
  kind: b.kind || "rule",
  t: b.ref || b.kind || "依据",
  body: b.text || "",
}));
// ↑↑↑ 保持一致到此 ↑↑↑

const view = {
  title: d.kind,
  sub: [d.obj, d.state].filter(Boolean).join(" · "),
  missingCount: missing.length,
  groups,
  bases,
};

console.log(JSON.stringify(view, null, 2));

// 断言：页面至少要有一个分组，否则会显示"还没内容"
if (!view.groups.length) {
  console.error("❌ 没有任何分组，页面会是空的");
  process.exit(1);
}
console.log("\n✅ 分组", view.groups.length, "个 / 依据", view.bases.length, "条");
