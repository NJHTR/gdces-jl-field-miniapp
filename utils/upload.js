/**
 * 上传：图片和音频都走这里。
 *
 * 后端 /api/v1/upload 返回 { photoId, sha256, size, commit }，
 * 发消息时要的是 sha256 —— 它当 parts 里的 blob 用。
 * 后端还要求 projectId（必填），所以 formData 带上。
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

/**
 * 上传一个文件。
 * resolve { sha, url, path } —— sha 为空表示没传成功，调用方要能降级。
 */
function uploadFile(localPath, kind) {
  if (!localPath) return Promise.resolve({ sha: "", url: "", path: "" });

  if (MOCK) {
    // 演示模式：没有后端，也就没有 sha，只留本地路径显示用
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
        try {
          const body = JSON.parse(res.data || "{}");
          const data = (body && body.data) || {};
          resolve({
            sha: data.sha256 || "",
            url: data.url || localPath,
            path: localPath,
          });
        } catch (e) {
          resolve({ sha: "", url: localPath, path: localPath });
        }
      },
      fail() {
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
