/**
 * 覆盖引擎默认 first-screen：去掉 Cocos Logo / 进度条。
 * 注意：不要在这里 getContext('webgl')，否则会抢占 canvas，导致游戏黑屏。
 */

function start() {
    return Promise.resolve();
}

function setProgress() {
    return Promise.resolve();
}

function end() {
    return Promise.resolve();
}

module.exports = { start, end, setProgress };
