/**
 * 触觉与听觉反馈。
 * 原则：只在"状态真的变了"的时候给反馈，不要每次点击都震。
 *   tap()     轻 —— 切换、吸附、开合
 *   bump()    中 —— 开始录音、发送
 *   success() 重 —— 登录成功、保存成功
 */

let soundOn = true;
let hapticOn = true;
let audio = null;

function vibrate(type) {
  try {
    // type 在低版本基础库上会被忽略，不影响调用
    wx.vibrateShort({ type });
  } catch (e) {
    try {
      wx.vibrateShort();
    } catch (e2) {}
  }
}

function tap() {
  if (hapticOn) vibrate("light");
}

function bump() {
  if (hapticOn) vibrate("medium");
}

function success() {
  if (hapticOn) vibrate("heavy");
}

/** 极轻的"嗒"，只用在发送 / 切换这类确认性动作上 */
function tick() {
  if (!soundOn) return;
  try {
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = "/assets/sounds/tick.wav";
      audio.volume = 0.35;
      audio.obeyMuteSwitch = true;
    }
    audio.stop();
    audio.play();
  } catch (e) {}
}

function setSound(on) {
  soundOn = !!on;
}

function setHaptic(on) {
  hapticOn = !!on;
}

/** 启动时恢复用户的开关 */
function load() {
  try {
    const v = wx.getStorageSync("jl_feedback") || {};
    hapticOn = v.haptic !== false;
    soundOn = v.sound !== false;
  } catch (e) {}
  return { haptic: hapticOn, sound: soundOn };
}

function save(haptic, sound) {
  hapticOn = !!haptic;
  soundOn = !!sound;
  try {
    wx.setStorageSync("jl_feedback", { haptic: hapticOn, sound: soundOn });
  } catch (e) {}
}

module.exports = { tap, bump, success, tick, setSound, setHaptic, load, save };
