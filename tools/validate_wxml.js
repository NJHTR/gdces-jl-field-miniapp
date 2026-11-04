/**
 * WXML 结构校验：标签是否配平、深度是否变负。
 * 用法：node tools/validate_wxml.js [目录]
 * 比起按行数 <view>，这里用整段正则，能正确处理跨行属性。
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || path.join(__dirname, "..", "pages");
const TAG = /<(\/?)(view|scroll-view|block|text|image|textarea)\b([^>]*)>/g;
const VOID = new Set(["image", "textarea"]);

let failed = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".wxml")) check(p);
  }
}

function check(file) {
  const src = fs.readFileSync(file, "utf8");
  TAG.lastIndex = 0;
  let m, depth = 0, min = 0, bad = null;
  while ((m = TAG.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    const closing = m[1] === "/";
    const selfClose = /\/\s*$/.test(m[3]) || VOID.has(m[2]);
    if (closing) depth--;
    else if (!selfClose) depth++;
    if (depth < min) {
      min = depth;
      if (bad === null) bad = line;
    }
  }
  const ok = depth === 0 && min === 0;
  if (!ok) failed++;
  console.log(
    (ok ? "  ok  " : "  FAIL") + "  " + path.basename(file).padEnd(14) +
    " 结束深度=" + depth + " 最小=" + min + (bad ? " 首次负深度行=" + bad : "")
  );
}

walk(root);
process.exit(failed ? 1 : 0);