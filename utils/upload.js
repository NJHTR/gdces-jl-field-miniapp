/**
 * 图片上传。
 *
 * 现在后端没上：直接把本地路径当"已上传"用（临时文件已落盘，能显示）。
 * 接了后端只改 MOCK 这一段，调用方不用动。
 */

const { API_BASE } = require("./config");
const session = require("./session");

const MOCK = !API_BASE;

function token() {
  const s = session.get();
  return (s && s.token) || "";
}

/**
 * 上传一张图，resolve 一个可长期使用的地址。
 * 失败时 resolve 回本地路径，保证照片不丢。
 */
function upload(localPath) {
  if (!localPath) return Promise.resolve("");

  if (MOCK) {
    // 演示模式：本地路径就是"地址"
    return Promise.resolve(localPath);
  }

  return new Promise((resolve) => {
    wx.uploadFile({
      url: API_BASE + "/api/v1/upload",
      filePath: localPath,
      name: "file",
      timeout: 30000,
      header: {
        authorization: token() ? "Bearer " + token() : "",
      },
      success(res) {
        try {
          const body = JSON.parse(res.data || "{}");
          resolve(body.url || localPath);
        } catch (e) {
          resolve(localPath);
        }
      },
      fail() {
        resolve(localPath);
      },
    });
  });
}

/** 批量上传，返回地址数组（顺序不变） */
function uploadAll(paths) {
  const list = paths || [];
  return Promise.all(list.map((p) => upload(p)));
}

module.exports = { upload, uploadAll, MOCK };
