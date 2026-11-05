/**
 * 极简 Markdown 渲染模型。
 *
 * 为什么自己写：模型输出里有 `**加粗**`、`- 列表`、`### 小标题`、`代码`，
 * 之前全按纯文本显示，界面上就看见一堆星号和横杠。
 * 第三方组件（towxml / mp-html）在 Skyline 上支持参差，
 * 我们自己只需要四种块 + 三种行内样式，写起来比调库快。
 *
 * 输出结构（给 wxml 直接 for）：
 *   blocks = [
 *     { t: "p" | "h" | "ul" | "ol", lv: 1..3, items: [ { segs: [ { b, c, v } ] } ] }
 *   ]
 *   segs: b = 加粗, c = 行内代码, v = 文本
 */

/** 把一行里的 **加粗** 和 `代码` 拆成段 */
function inline(text) {
  const segs = [];
  const src = String(text || "");
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) {
      segs.push({ b: false, c: false, v: buf });
      buf = "";
    }
  };

  while (i < src.length) {
    // **加粗**
    if (src[i] === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        segs.push({ b: true, c: false, v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // `代码`
    if (src[i] === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        segs.push({ b: false, c: true, v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // 单个星号当普通字符（模型偶尔用 *强调*）
    if (src[i] === "*" && src[i + 1] && src[i + 1] !== "*") {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1 && end - i < 40) {
        flush();
        const t = src.slice(i + 1, end);
        if (t) segs.push({ b: false, c: false, v: t });
        i = end + 1;
        continue;
      }
    }
    buf += src[i];
    i += 1;
  }
  flush();
  return segs;
}

/** 解析全文 → blocks */
function parse(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return [];

  const blocks = [];
  const lines = raw.split("\n");
  let cur = null; // 当前列表块

  const pushP = (s) => {
    const segs = inline(s);
    if (segs.length) blocks.push({ t: "p", lv: 0, items: [{ segs: segs }] });
  };

  for (let n = 0; n < lines.length; n += 1) {
    const line = lines[n];
    const trimmed = line.trim();

    if (!trimmed) {
      cur = null;
      continue;
    }

    // 标题 ### / ## / #
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      cur = null;
      blocks.push({
        t: "h",
        lv: Math.min(3, h[1].length),
        items: [{ segs: inline(h[2]) }],
      });
      continue;
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      cur = null;
      blocks.push({ t: "hr", lv: 0, items: [] });
      continue;
    }

    // 无序列表 - / * / •
    const ul = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      if (!cur || cur.t !== "ul") {
        cur = { t: "ul", lv: 0, items: [] };
        blocks.push(cur);
      }
      cur.items.push({ segs: inline(ul[1]) });
      continue;
    }

    // 有序列表 1. 2)
    const ol = trimmed.match(/^(\d+)[.、)]\s+(.*)$/);
    if (ol) {
      if (!cur || cur.t !== "ol") {
        cur = { t: "ol", lv: 0, items: [] };
        blocks.push(cur);
      }
      cur.items.push({ segs: inline(ol[2]) });
      continue;
    }

    // 普通段落（连续行合并，模型常把一句话写断成两行）
    cur = null;
    const last = blocks[blocks.length - 1];
    if (last && last.t === "p" && !/[。！？：:]$/.test(trimmed)) {
      last.items[0].segs = last.items[0].segs.concat(inline(" " + trimmed));
    } else {
      pushP(trimmed);
    }
  }

  return blocks;
}

/** 有没有 Markdown 语法（没有的话前端还用原来的渲染） */
function hasMarkdown(text) {
  const s = String(text || "");
  return /\*\*[^*]+\*\*/.test(s) || /^\s*[-*•]\s+/m.test(s) || /^\s*#{1,4}\s+/m.test(s);
}

module.exports = { parse, hasMarkdown };
