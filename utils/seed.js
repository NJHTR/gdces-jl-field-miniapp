/**
 * 首屏种子数据。
 * 接后端后删掉这份，改成 interface 返回。
 */
module.exports = {
  msgs: [
      { id: "s1", type: "stamp", text: "今天 08:05" },
      { id: "p1", type: "photos", n: [1, 2], cap: "四号楼东侧外架 · 连墙件" },
      { id: "m1", type: "me", voice: true, dur: "0:05", time: "08:05", sync: true, text: "四号楼东侧外架，连墙件少了两根，让整改。" },
      {
        id: "a1", type: "agent", time: "08:05", src: "基于今天的记录",
        text: "记了。隐患已建档：连墙件缺失 · 未闭环。",
        sub: "通知单草稿晚上一起给你，现在不打断你。",
        traceSum: "读了 1 条语音 · 项目信息和 2 条记忆",
        ms: 940,
        trace: [
          { icon: "doc", text: "读取你刚发的语音（已转文字）" },
          { icon: "folder", text: "读取项目信息：云谷智造园 3期 / 中建八局" },
          { icon: "pen", text: "读取记忆 2 条：隐患描述要带部位、结论写「经检查符合要求」" },
          { icon: "search", text: "查规范 JGJ 130-2011 §6.4.3 连墙件设置间距" },
          { icon: "warn", text: "比对该部位历史：10-28 曾因连墙件被下过通知单" },
        ],
      },
      { id: "s2", type: "stamp", text: "今天 08:40" },
      { id: "m2", type: "me", voice: true, dur: "0:06", time: "08:40", sync: true, text: "三号楼五层顶板钢筋验收，顺便看下保护层。" },
      {
        id: "a2", type: "agent", time: "08:40", src: "引用了 10-28 的同部位记录",
        text: "收到，3#5F 顶板钢筋验收。",
        sub: "10-28 那次保护层偏薄（14mm），这次我把这项加进检查项。",
        traceSum: "读了 1 条语音 · 3 条历史记录 · 1 张照片",
        ms: 1180,
        trace: [
          { icon: "doc", text: "读取你刚发的语音（已转文字）" },
          { icon: "doc", text: "检索该部位历史记录 3 条（10-28 / 10-31 / 11-02）" },
          { icon: "cam", text: "读取 10-28 那次的现场照片 1 张" },
          { icon: "search", text: "查规范 GB 50204-2015 保护层厚度允许偏差" },
          { icon: "pen", text: "读取记忆：验收记录要写上次问题是否整改" },
        ],
      },
      { id: "s3", type: "stamp", text: "今天 09:12" },
      { id: "m3", type: "me", voice: true, dur: "0:04", text: "三号楼五层顶板浇筑旁站，开始。" },
      { id: "a3", type: "agent", text: "收到，3#5F 顶板旁站，09:12 开始。", sub: "上次这部位坍落度不合格（10-31），晚上提醒你复查。" },
      { id: "s4", type: "stamp", text: "今天 11:20" },
      { id: "m4", type: "me", voice: true, dur: "0:07", text: "四号楼东侧外架，让班组下午三点前把连墙件补齐。" },
      { id: "a4", type: "agent", text: "记了。整改要求：15:00 前补齐并回传照片。", sub: "我会在 15:00 提醒你复查。" },
    ],

  records: [
      {
        id: "r1",
        date: "11月3日",
        week: "今天 · 周二",
        count: 3,
        items: [
          { id: "d1", kind: "旁站记录", obj: "3#5F 顶板", time: "09:12–10:24", state: "待补", st: "wait", icon: "doc", tint: "b", tags: ["缺 2 项", "方量", "试块组数"] },
          { id: "d2", kind: "监理通知单", obj: "4#楼外架", time: "08:40", state: "待签", st: "sign", icon: "warn", tint: "y", tags: ["待签发", "附 2 张照片"] },
          { id: "d3", kind: "监理日志", obj: "11-03", time: "汇总 6 条", state: "待补", st: "wait", icon: "pen", tint: "g", tags: ["缺 2 项", "天气", "在场人数"] },
        ],
      },
      {
        id: "r2",
        date: "11月2日",
        week: "昨天 · 周一",
        count: 2,
        items: [
          { id: "d4", kind: "旁站记录", obj: "4#楼三层墙柱", time: "14:10–16:40", state: "已签", st: "ok", icon: "doc", tint: "b", tags: ["已签"] },
          { id: "d5", kind: "监理日志", obj: "11-02", time: "19:40", state: "已签", st: "ok", icon: "pen", tint: "g", tags: ["已签"] },
        ],
      },
    ],

  docs: [
      { id: "f1", kind: "图纸", name: "结构施工图 v3", meta: "11-01", state: "已归档", tone: "ok", icon: "folder", visual: true },
      { id: "f2", kind: "影像", name: "3#5F 顶板 · 现场影像", meta: "今天", state: "12 张", tone: "sign", icon: "cam", visual: true },
      { id: "f3", kind: "记录", name: "旁站记录 · 3#5F 顶板", meta: "今天 10:24", state: "待签", tone: "wait", icon: "doc", visual: false },
      { id: "f4", kind: "通知单", name: "监理通知单 NO-017", meta: "11-01", state: "未闭环", tone: "wait", icon: "warn", visual: false },
      { id: "f5", kind: "日志", name: "监理日志 · 11-02", meta: "11-02", state: "已签", tone: "ok", icon: "pen", visual: false },
      { id: "f6", kind: "方案", name: "高支模专项方案（报审）", meta: "10-28", state: "已审", tone: "ok", icon: "doc", visual: false },
    ],

  memos: [
      { id: "m1", text: "旁站结论写「经检查符合要求」", meta: "用了 23 次 · 来自我的习惯" },
      { id: "m2", text: "单位写 m³，不写「方」", meta: "用了 11 次 · 来自我的习惯" },
      { id: "m3", text: "日报先写部位、再写问题", meta: "用了 8 次 · 来自我的习惯" },
    ],

  projMemos: [
      { id: "p1", text: "沟槽开挖按危大工程巡视，不出旁站", meta: "依据 11-03 现场纠正 · 全项目" },
      { id: "p2", text: "整改回复必须附整改前后对比图", meta: "依据 10-21 会议纪要 · 甲方陈工" },
      { id: "p3", text: "每周三 9:00 监理例会", meta: "依据 项目惯例 · 已用 6 次" },
    ],
};
