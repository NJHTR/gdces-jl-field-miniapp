/**
 * 拍照离线队列。
 *
 * 为什么要有：现场（工地/地下室/塔楼里）信号经常断，拍照上传直接失败，
 * 以前失败是"什么都不发生"——照片就丢了。现在：存本地 + 恢复网络自动补传。
 *
 * 设计：
 *  - 只存"已经画好水印的本地文件路径 + 全部元数据"，不存二进制到 storage
 *  - 同一张图重复入队用一个稳定 id（时间戳+随机）防重
 *  - 补传成功才出队；失败保留，下次 onShow 再试
 *  - 后端 /upload 按 sha 去重，所以补传重复也不会多出照片
 */
const KEY = "jl_pending_photos";

function uid() {
  return "q" + Date.now() + Math.random().toString(36).slice(2, 6);
}

function list() {
  try {
    return wx.getStorageSync(KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveAll(arr) {
  try {
    wx.setStorageSync(KEY, arr || []);
  } catch (e) {}
}

function count() {
  return list().length;
}

/** 把临时文件转成持久文件（重启小程序后路径还有效）；失败就用原路径 */
function persist(tempPath) {
  return new Promise((resolve) => {
    try {
      wx.saveFile({
        tempFilePath: tempPath,
        success: (r) => resolve(r.savedFilePath || tempPath),
        fail: () => resolve(tempPath),
      });
    } catch (e) {
      resolve(tempPath);
    }
  });
}

/** 入队：返回队列长度 */
function enqueue(path, meta) {
  const arr = list();
  arr.push({ id: uid(), path, meta: meta || {}, at: Date.now() });
  saveAll(arr);
  return arr.length;
}

function remove(id) {
  const arr = list().filter((x) => x.id !== id);
  saveAll(arr);
  return arr.length;
}

/**
 * 补传：逐张上传，成功的出队，失败的留在队里。
 * uploadFn(path, kind, meta) 返回 Promise。
 * 返回 { ok, left }
 */
function drain(uploadFn) {
  const arr = list();
  if (!arr.length) return Promise.resolve({ ok: 0, left: 0 });
  let ok = 0;
  const left = [];
  const step = (i) => {
    if (i >= arr.length) {
      saveAll(left);
      return { ok, left: left.length };
    }
    const item = arr[i];
    return uploadFn(item.path, "photo", item.meta)
      .then(() => {
        ok += 1;
        return step(i + 1);
      })
      .catch(() => {
        left.push(item);
        return step(i + 1);
      });
  };
  return Promise.resolve(step(0));
}

module.exports = { list, count, enqueue, remove, persist, drain };
