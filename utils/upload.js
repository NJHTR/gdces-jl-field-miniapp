/**
 * 上传：图片和音频都走这里。
 *
 * 后端 /api/v1/upload 返回 { code, data: { sha256, size, url, ... } }，
 * 发消息时要的是 sha256 —— 它当 parts 里的 blob 用。
 *
 * 踩过的坑：
 *   wx.uploadFile 的 res.data 在部分基础库/渲染器下**已经是对象**，
 *   直接 JSON.parse 会抛错，被 catch 吞掉后 sha 变空，
 *   表现就是"有 N 个附件没传上去"，但服务端日志明明是 200。
 *   所以这里两种形态都接，并且把真实原因打出来。
 */

const { API_BASE } = require("./config");
const session = require("./session");

const MOCK = !API_BASE;

function token() {
  const s = session.get();
  return (s && s.token) || "";
}

function projectId() {
  try {
    const p = wx.getStorageSync("jl_project");
    if (p && typeof p === "object" && p.id) return p.id;
    if (typeof p === "string" && p) return p;
  } catch (e) {}
  return "yun-gu-3qi";
}

function userId() {
  const app = getApp();
  const u = (app && app.globalData && app.globalData.user) || {};
  return u.id || 1;
}

/** 把 uploadFile 的返回值统一成对象（字符串就 parse） */
function toBody(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.log("[upload] 返回不是 JSON:", String(raw).slice(0, 120));
    return {};
  }
}

/**
 * 上传一个文件。
 * resolve { sha, url, path } —— sha 为空表示没传成功，调用方要能降级。
 */
function uploadFile(localPath, kind) {
  if (!localPath) return Promise.resolve({ sha: "", url: "", path: "" });

  if (MOCK) {
    return Promise.resolve({ sha: "", url: localPath, path: localPath });
  }

  return new Promise((resolve) => {
    wx.uploadFile({
      url: API_BASE + "/api/v1/upload",
      filePath: localPath,
      name: "file",
      timeout: 60000,
      formData: {
        projectId: projectId(),
        userId: String(userId()),
        kind: kind || "photo",
      },
      header: {
        authorization: token() ? "Bearer " + token() : "",
      },
      success(res) {
        const body = toBody(res && res.data);
        const data = (body && body.data) || body || {};
        const sha = data.sha256 || "";
        if (!sha) {
          console.log(
            "[upload] 没拿到 sha | status:",
            res && res.statusCode,
            "| body:",
            JSON.stringify(body).slice(0, 200)
          );
        }
        resolve({
          sha: sha,
          url: data.url || localPath,
          path: localPath,
        });
      },
      fail(err) {
        console.log("[upload] 失败:", (err && err.errMsg) || err);
        resolve({ sha: "", url: localPath, path: localPath });
      },
    });
  });
}

/** 批量上传，顺序不变 */
function uploadAll(paths, kind) {
  const list = paths || [];
  return Promise.all(list.map((p) => uploadFile(p, kind)));
}

/** 老接口留着，免得别处调用报错 */
function upload(localPath) {
  return uploadFile(localPath, "photo").then((r) => r.url || localPath);
}

module.exports = { uploadFile, uploadAll, upload, MOCK };
