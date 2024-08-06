const maxTimeDifference = 2;

var resourceName = "pmms";
var isRDR = true;
var audioVisualizations = {};
var currentServerEndpoint = "127.0.0.1:30120";

function sendMessage(name, params) {
  return fetch(`https://${resourceName}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

function applyPhonographFilter(player) {
  var context = new (window.AudioContext || window.webkitAudioContext)();

  var source;

  if (player.youTubeApi) {
    var html5Player = player.youTubeApi
      .getIframe()
      .contentWindow.document.querySelector(".html5-main-video");

    source = context.createMediaElementSource(html5Player);
  } else if (player.hlsPlayer) {
    source = context.createMediaElementSource(player.hlsPlayer.media);
  } else if (player.originalNode) {
    source = context.createMediaElementSource(player.originalNode);
  } else {
    source = context.createMediaElementSource(player);
  }

  if (source) {
    var splitter = context.createChannelSplitter(2);
    var merger = context.createChannelMerger(2);

    var gainNode = context.createGain();
    gainNode.gain.value = 0.5;

    var lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3000;
    lowpass.gain.value = -1;

    var highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 300;
    highpass.gain.value = -1;

    source.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 0);
    splitter.connect(merger, 0, 1);
    splitter.connect(merger, 1, 1);
    merger.connect(gainNode);
    gainNode.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(context.destination);
  }

  var noise = document.createElement("audio");
  noise.id = player.id + "_noise";
  noise.src = "https://redm.khzae.net/phonograph/noise.webm";
  noise.volume = 0;
  document.body.appendChild(noise);
  noise.play();

  player.style.filter = "sepia()";

  player.addEventListener("play", (event) => {
    noise.play();
  });
  player.addEventListener("pause", (event) => {
    noise.pause();
  });
  player.addEventListener("volumechange", (event) => {
    noise.volume = player.volume;
  });
  player.addEventListener("seeked", (event) => {
    noise.currentTime = player.currentTime;
  });
}

function applyRadioFilter(player) {
  var context = new (window.AudioContext || window.webkitAudioContext)();

  var source;

  if (player.youTubeApi) {
    var html5Player = player.youTubeApi
      .getIframe()
      .contentWindow.document.querySelector(".html5-main-video");

    source = context.createMediaElementSource(html5Player);
  } else if (player.hlsPlayer) {
    source = context.createMediaElementSource(player.hlsPlayer.media);
  } else if (player.originalNode) {
    source = context.createMediaElementSource(player.originalNode);
  } else {
    source = context.createMediaElementSource(player);
  }

  if (source) {
    var splitter = context.createChannelSplitter(2);
    var merger = context.createChannelMerger(2);

    var gainNode = context.createGain();
    gainNode.gain.value = 0.5;

    var lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 5000;
    lowpass.gain.value = -1;

    var highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 200;
    highpass.gain.value = -1;

    source.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 0);
    splitter.connect(merger, 0, 1);
    splitter.connect(merger, 1, 1);
    merger.connect(gainNode);
    gainNode.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(context.destination);
  }
}

function createAudioVisualization(player, visualization) {
  var waveCanvas = document.createElement("canvas");
  waveCanvas.id = player.id + "_visualization";
  waveCanvas.style.position = "absolute";
  waveCanvas.style.top = "0";
  waveCanvas.style.left = "0";
  waveCanvas.style.width = "100%";
  waveCanvas.style.height = "100%";

  player.appendChild(waveCanvas);

  var html5Player;

  if (player.youTubeApi) {
    html5Player = player.youTubeApi
      .getIframe()
      .contentWindow.document.querySelector(".html5-main-video");
  } else if (player.hlsPlayer) {
    html5Player = player.hlsPlayer.media;
  } else if (player.originalNode) {
    html5Player = player.originalNode;
  } else {
    html5Player = player;
  }

  if (!html5Player.id) {
    html5Player.id = player.id + "_html5Player";
  }

  html5Player.style.visibility = "hidden";

  var doc = player.youTubeApi
    ? player.youTubeApi.getIframe().contentWindow.document
    : document;

  if (player.youTubeApi) {
    player.youTubeApi.getIframe().style.visibility = "hidden";
  }

  var wave = new Wave();

  var options;

  if (visualization) {
    options = audioVisualizations[visualization] || {};

    if (options.type == undefined) {
      options.type = visualization;
    }
  } else {
    options = { type: "cubes" };
  }

  options.skipUserEventsWatcher = true;
  options.elementDoc = doc;

  wave.fromElement(html5Player.id, waveCanvas.id, options);
}

function showLoadingIcon() {
  document.getElementById("loading").style.display = "block";
}

function hideLoadingIcon() {
  document.getElementById("loading").style.display = "none";
}

function resolveUrl(url) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  } else {
    return "http://" + currentServerEndpoint + "/pmms/media/" + url;
  }
}

function initPlayer(id, handle, options) {
  var player = document.createElement("video");
  player.id = id;
  player.src = resolveUrl(options.url);
  document.body.appendChild(player);

  if (options.attenuation == null) {
    options.attenuation = { sameRoom: 0, diffRoom: 0 };
  }

  new MediaElement(id, {
    error: function (media) {
      hideLoadingIcon();

      sendMessage("initError", {
        url: options.url,
        message: media.error.message,
      });

      media.remove();
    },
    success: function (media, domNode) {
      media.className = "player";

      media.pmms = {};
      media.pmms.initialized = false;
      media.pmms.attenuationFactor = options.attenuation.diffRoom;
      media.pmms.volumeFactor = options.diffRoomVolume;

      media.volume = 0;

      media.addEventListener("error", (event) => {
        hideLoadingIcon();

        sendMessage("playError", {
          url: options.url,
          message: media.error.message,
        });

        if (!media.pmms.initialized) {
          media.remove();
        }
      });

      media.addEventListener("canplay", () => {
        if (media.pmms.initialized) {
          return;
        }

        hideLoadingIcon();

        var duration;

        if (
          media.duration == NaN ||
          media.duration == Infinity ||
          media.duration == 0 ||
          media.hlsPlayer
        ) {
          options.offset = 0;
          options.duration = false;
          options.loop = false;
        } else {
          options.duration = media.duration;
        }

        if (media.youTubeApi) {
          options.title = media.youTubeApi.getVideoData().title;

          const textAd = media.youTubeApi.getIframe().contentWindow.document.querySelector("[class^='video-ads']");
          const buttonTest = media.youTubeApi.getIframe().contentWindow.document.querySelector("[class^=ytp-skip-ad].ytp-skip-ad-button");
          const skipButton = media.youTubeApi.getIframe().contentWindow.document.querySelector("button.ytp-skip-ad-button, button.ytp-ad-skip-button-modern");
          const testHello = media.youTubeApi.getIframe().contentWindow.document.querySelector(".ytp-ad-player-overlay-layout__skip-or-preview-container .ytp-skip-ad-button")

          const A = domNode.querySelector("[class^='video-ads']");
          const B = domNode.querySelector("[class^=ytp-skip-ad].ytp-skip-ad-button");
          const C = domNode.querySelector("button.ytp-skip-ad-button, button.ytp-ad-skip-button-modern");
          const D = domNode.querySelector(".ytp-ad-player-overlay-layout__skip-or-preview-container .ytp-skip-ad-button")

          setInterval(() => {
            console.log(`Skip Button: ${skipButton}`)
            console.log(`Button Test: ${buttonTest}`)
            console.log(`Ads Text: ${textAd}`)
            console.log(`Hello Test: ${testHello}`)

            console.log(`A: ${A}`)
            console.log(`B: ${B}`)
            console.log(`C: ${C}`)
            console.log(`D: ${D}`)

            console.log(`Dom: ${JSON.stringify(domNode)}`)
          }, 500)

          media.videoTracks = { length: 1 };
        } else if (media.hlsPlayer) {
          media.videoTracks = media.hlsPlayer.videoTracks;
        } else if (media.twitchPlayer) {
          /* Auto-click Twitch mature content warning button. */
          let button =
            media.twitchPlayer._iframe.contentWindow.document.querySelector(
              'button[data-a-target="player-overlay-mature-accept"]'
            );

          if (button) {
            button.click();
          }
        } else {
          media.videoTracks = media.originalNode.videoTracks;
        }

        options.video = true;
        options.videoSize = 0;

        sendMessage("init", {
          handle: handle,
          options: options,
        });

        media.pmms.initialized = true;

        media.play();
      });

      media.addEventListener("playing", () => {
        setInterval(() => createAudioColor(handle, media), 500);
        setInterval(() => getAudioFrequency(media), 500);

        if (options.visualization && !media.pmms.visualizationAdded) {
          createAudioVisualization(media, options.visualization);
          media.pmms.visualizationAdded = true;
        }
      });

      media.addEventListener("ended", () => {
        sendMessage("ended", { handle: handle });
      });

      media.play();
    },
  });
}

function getPlayer(handle, options) {
  if (handle == undefined) {
    return;
  }

  var id = "player_" + handle.toString();

  var player = document.getElementById(id);

  if (!player && options && options.url) {
    player = initPlayer(id, handle, options);
  }

  return player;
}

function parseTimecode(timecode) {
  if (typeof timecode != "string") {
    return timecode;
  } else if (timecode.includes(":")) {
    var a = timecode.split(":");
    return parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseInt(a[2]);
  } else {
    return parseInt(timecode);
  }
}

function init(data) {
  if (data.url == "") {
    return;
  }

  showLoadingIcon();

  data.options.offset = parseTimecode(data.options.offset);

  if (!data.options.title) {
    data.options.title = data.options.url;
  }

  getPlayer(data.handle, data.options);
}

function stop(handle) {
  var player = getPlayer(handle);

  if (player) {
    var noise = document.getElementById(player.id + "_noise");
    if (noise) {
      noise.remove();
    }

    player.remove();
  }
}

function getAudioFrequency(player) {
  var context = new (window.AudioContext || window.webkitAudioContext)();

  var source;

  if (player.youTubeApi) {
    var html5Player = player.youTubeApi
      .getIframe()
      .contentWindow.document.querySelector(".html5-main-video");

    source = context.createMediaElementSource(html5Player);
  } else if (player.hlsPlayer) {
    source = context.createMediaElementSource(player.hlsPlayer.media);
  } else if (player.originalNode) {
    source = context.createMediaElementSource(player.originalNode);
  } else {
    source = context.createMediaElementSource(player);
  }

  console.log(`Source: ${source}`)

  if (source) {
    var analyser = context.createAnalyser()

    const nyquistFrequency = context.sampleRate / 2
    const frequencyData = new Uint8Array(analyser.frequencyBinCount)

    analyser.getByteFrequencyData(frequencyData)

    console.log(`Frequency: ${analyser.frequencyBinCount}`)
  }

}

function createAudioColor(handle, media) {
  var video = media.youTubeApi
    .getIframe()
    .contentDocument.getElementsByTagName("video")[0];
  var canvas = document.createElement("canvas");

  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

  const image = new Image();

  image.width = canvas.width;
  image.height = canvas.height;
  image.src = canvas.toDataURL();

  Vibrant.from(image.src)
    .quality(10)
    .maxDimension(10)
    .getPalette()
    .then((palette) => {
      sendMessage("colorData", {
        handle: handle,
        colors: {
          Vibrant: palette.Vibrant.rgb,
          DarkVibrant: palette.DarkVibrant.rgb,
          LightVibrant: palette.LightVibrant.rgb,
          Muted: palette.Muted.rgb,
          DarkMuted: palette.DarkMuted.rgb,
          LightMuted: palette.LightMuted.rgb,
        },
      });
    });
}

function setAttenuationFactor(player, target) {
  if (player.pmms.attenuationFactor > target) {
    player.pmms.attenuationFactor -= 0.1;
  } else {
    player.pmms.attenuationFactor += 0.1;
  }
}

function setVolumeFactor(player, target) {
  if (player.pmms.volumeFactor > target) {
    player.pmms.volumeFactor -= 0.01;
  } else {
    player.pmms.volumeFactor += 0.01;
  }
}

function setVolume(player, target) {
  if (Math.abs(player.volume - target) > 0.1) {
    if (player.volume > target) {
      player.volume -= 0.05;
    } else {
      player.volume += 0.05;
    }
  }
}

function update(data) {
  var player = getPlayer(data.handle, data.options);

  if (player) {
    if (
      data.options.paused ||
      data.distance < 0 ||
      data.distance > data.options.range
    ) {
      if (!player.paused) {
        player.pause();
      }
    } else {
      if (data.sameRoom) {
        setAttenuationFactor(player, data.options.attenuation.sameRoom);
        setVolumeFactor(player, 1.0);
      } else {
        setAttenuationFactor(player, data.options.attenuation.diffRoom);
        setVolumeFactor(player, data.options.diffRoomVolume);
      }

      if (player.readyState > 0) {
        var volume;

        if (data.options.muted || data.volume == 0) {
          volume = 0;
        } else {
          volume =
            ((100 - data.distance * player.pmms.attenuationFactor) / 100) *
            player.pmms.volumeFactor *
            (data.volume / 100);
        }

        if (volume > 0) {
          if (data.distance > 100) {
            setVolume(player, volume);
          } else {
            player.volume = volume;
          }
        } else {
          player.volume = 0;
        }

        if (data.options.duration) {
          var currentTime = data.options.offset % player.duration;

          if (Math.abs(currentTime - player.currentTime) > maxTimeDifference) {
            player.currentTime = currentTime;
          }
        }

        if (player.paused) {
          player.play();
        }
      }
    }
  }
}

function setResourceNameFromUrl() {
  var url = new URL(window.location);
  var params = new URLSearchParams(url.search);
  resourceName = params.get("resourceName") || resourceName;
}

window.addEventListener("message", (event) => {
  switch (event.data.type) {
    case "init":
      init(event.data);
      break;
    case "play":
      getPlayer(event.data.handle);
      break;
    case "stop":
      stop(event.data.handle);
      break;
    case "update":
      update(event.data);
      break;
    case "DuiBrowser:init":
      sendMessage("DuiBrowser:initDone", { handle: event.data.handle });
      break;
  }
});

window.addEventListener("load", () => {
  setResourceNameFromUrl();

  sendMessage("duiStartup", {})
    .then((resp) => resp.json())
    .then((resp) => {
      if (resp.isRDR != undefined) {
        isRDR = resp.isRDR;
      }
      if (resp.audioVisualizations != undefined) {
        audioVisualizations = resp.audioVisualizations;
      }
      if (resp.currentServerEndpoint != undefined) {
        currentServerEndpoint = resp.currentServerEndpoint;
      }
    });
});
