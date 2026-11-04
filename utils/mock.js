/**
 * 假接口：后端没上之前，让页面按真实节奏跑起来。
 * 接后端时删掉这个文件，request.js 里 MOCK 会自动关掉。
 */

/** 登录态校验：token 为空就当作未登录 */
function authed() {
  const s = require("./session").get();
  return !!(s && s.token);
}

function resolve(method, path, data) {
  // 统一：需要登录的接口
  const open = ["/api/v1/auth/wx-login", "/api/v1/weather", "/api/v1/geo/reverse", "/api/v1/bootstrap"];
  const needAuth = !open.some((o) => path.indexOf(o) === 0);

  if (needAuth && !authed()) {
    return { status: 401, data: null };
  }

  if (path === "/api/v1/bootstrap" && method === "GET") {
    const seed = require("./seed");
    return {
      status: 200,
      data: {
        msgs: seed.msgs,
        records: seed.records,
        docs: seed.docs,
        memos: seed.memos,
        projMemos: seed.projMemos,
        project: require("./store").project(),
      },
    };
  }

  if (path.indexOf("/api/v1/geo/reverse") === 0 && method === "GET") {
    const p = require("./store").project();
    return { status: 200, data: { address: p.addr } };
  }

  if (path.indexOf("/api/v1/weather") === 0 && method === "GET") {
    return {
      status: 200,
      data: {
        text: "多云",
        temp: 26,
        wind: "东南风 2 级",
        updated: Date.now(),
      },
    };
  }

  if (path === "/api/v1/docs" && method === "GET") {
    return { status: 200, data: require("./seed").docs };
  }

  if (path === "/api/v1/docs" && method === "POST") {
    return { status: 200, data: { id: "d" + Date.now(), ok: true } };
  }

  if (path === "/api/v1/project" && method === "GET") {
    return { status: 200, data: require("./store").project() };
  }

  if (path === "/api/v1/project" && method === "PUT") {
    return { status: 200, data: require("./store").saveProject(data || {}) };
  }

  return null;
}

module.exports = { resolve };
