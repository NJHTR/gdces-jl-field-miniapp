/**
 * 两块地址，分别对应两种跑法：
 *
 * API_BASE —— 后端接口。留空 = 演示模式（不请求服务器，直接放行）。
 *
 * H5_BASE  —— 原型/H5 版本地址，web-view 直接加载它。
 *              必须带结尾斜杠，否则 nginx 的 location /lab/ 匹配不上。
 */
module.exports = {
  API_BASE: "",
  // 试验版挂在你们已备案的正式域名下（和 /mobile/ 同一台源站，独立目录）
  H5_BASE: "https://www.baize.gdces.cn/lab/",
};
