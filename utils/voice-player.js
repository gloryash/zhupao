let audioContext = null;

function speakVoiceCue(text) {
  const content = String(text || '').replace(/\s+/g, ' ').trim();
  if (!content) return false;

  const plugin = getWechatSIPlugin();
  if (!plugin || typeof plugin.textToSpeech !== 'function') return false;

  try {
    plugin.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success(res) {
        const audioSrc = res && res.filename;
        playAudio(audioSrc);
      }
    });
    return true;
  } catch (err) {
    return false;
  }
}

function getWechatSIPlugin() {
  try {
    if (typeof requirePlugin !== 'function') return null;
    return requirePlugin('WechatSI');
  } catch (err) {
    return null;
  }
}

function playAudio(audioSrc) {
  if (!audioSrc) return false;
  if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') return false;

  try {
    if (!audioContext) {
      audioContext = wx.createInnerAudioContext();
    } else if (typeof audioContext.stop === 'function') {
      audioContext.stop();
    }

    audioContext.src = audioSrc;
    audioContext.play();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  speakVoiceCue
};
