let mapPeers = {};

let labelUsername = document.querySelector("#username-label");
let usernameInput = document.querySelector("#username");

let btnJoin = document.querySelector("#join-button");

let username;

let ws;

let messageList = document.querySelector("#message-list");
let messageInput = document.querySelector("#message-input");

function webSocketOnMessage(event) {
  let parsedData = JSON.parse(event.data);
  let peerUsername = parsedData.peer;
  let action = parsedData.action;

  console.log("WS message received:", parsedData);

  if (username === peerUsername) {
    return;
  }
  let receiver_channel_name = parsedData.message.receiver_channel_name;

  if (action === "new-peer") {
    createOfferer(peerUsername, receiver_channel_name);
    return;
  }

  if (action === "new-offer") {
    let offer = parsedData.message.sdp;

    createAnswerer(offer, peerUsername, receiver_channel_name);
    return;
  }

  if (action == "new-answer") {
    let answer = parsedData.message.sdp;

    let peer = mapPeers[peerUsername][0];

    peer.setRemoteDescription(answer);
    return;
  }
}

btnJoin.addEventListener("click", () => {
  username = usernameInput.value;

  if (username === "") {
    return;
  }
  console.log("Username:", username);

  usernameInput.value = "";
  usernameInput.disabled = true;
  usernameInput.style.visibility = "hidden";

  btnJoin.disabled = true;
  btnJoin.style.visibility = "hidden";

  labelUsername.innerHTML = username;

  ws = new WebSocket("ws://127.0.0.1:8000/");

  ws.addEventListener("open", (e) => {
    console.log("WS connection opened");

    sendSignal("new-peer", {});
  });
  ws.addEventListener("message", webSocketOnMessage);
  ws.addEventListener("close", (e) => {
    console.log("WS connection closed");
  });
  ws.addEventListener("error", (e) => {
    console.log("Error during ws connection:", e);
  });
});

let localStream = new MediaStream();

const constraints = {
  audio: true,
  video: true,
};

let localVideo = document.querySelector("#local-video");

let btnToggleAudio = document.querySelector("#button-toggle-audio");
let btnToggleVideo = document.querySelector("#button-toggle-video");

let userMedia = navigator.mediaDevices
  .getUserMedia(constraints)
  .then((stream) => {
    localStream = stream;
    localVideo.srcObject = localStream;
    localVideo.muted = true;

    let audioTracks = stream.getAudioTracks();
    let videoTracks = stream.getVideoTracks();

    audioTracks[0].enabled = true;
    videoTracks[0].enabled = true;

    btnToggleAudio.addEventListener("click", () => {
      audioTracks[0].enabled = !audioTracks[0].enabled;

      if (audioTracks[0].enabled) {
        btnToggleAudio.innerHTML = '<img src="/static/img/mic.svg"/>';
        return;
      }
      btnToggleAudio.innerHTML = '<img src="/static/img/mic_off.svg"/>';
    });

    btnToggleVideo.addEventListener("click", () => {
      videoTracks[0].enabled = !videoTracks[0].enabled;

      if (videoTracks[0].enabled) {
        btnToggleVideo.innerHTML = '<img src="/static/img/webcam.svg"/>';
        return;
      }

      btnToggleVideo.innerHTML = '<img src="/static/img/webcam_off.svg"/>';
    });
  })
  .catch((error) => {
    console.log("Error during accessing local video and audio");
  });

let btnSendMessage = document.querySelector("#button-send-message");

btnSendMessage.addEventListener("click", sendMessageOnClick);

function sendMessageOnClick() {
  let message = messageInput.value;

  let li = document.createElement("li");
  li.appendChild(document.createTextNode("Me: " + message));
  messageList.appendChild(li);

  let dataChannels = getDataChannels();

  message = username + ": " + message;

  for (index in dataChannels) {
    dataChannels[index].send(message);
  }

  messageInput.value = "";
}

function sendSignal(action, message) {
  let jsonString = JSON.stringify({
    peer: username,
    action: action,
    message: message,
  });

  ws.send(jsonString);
}

function createOfferer(peerUsername, receiver_channel_name) {
  let peer = new RTCPeerConnection(null);

  addLocalTracks(peer);

  let dc = peer.createDataChannel("channel");
  dc.addEventListener("open", () => {
    console.log("Open data channel");
  });

  dc.addEventListener("message", dcOnMessage);

  let remoteVideo = createVideo(peerUsername);
  setOnTrack(peer, remoteVideo);

  mapPeers[peerUsername] = [peer, dc];

  peer.addEventListener("iceconnectionstatechange", () => {
    let iceConnectionState = peer.iceConnectionState;
    if (
      iceConnectionState === "failed" ||
      iceConnectionState === "disconnected" ||
      iceConnectionState === "closed"
    ) {
      delete mapPeers[peerUsername];
      if (iceConnectionState != "closed") {
        peer.close();
      }

      removeVideo(remoteVideo);
    }
  });

  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      console.log("New ice candidate:", JSON.stringify(peer.localDescription));
      return;
    }

    sendSignal("new-offer", {
      sdp: peer.localDescription,
      receiver_channel_name: receiver_channel_name,
    });
  });

  peer
    .createOffer()
    .then((o) => {
      peer.setLocalDescription(o);
    })
    .then(() => {
      console.log("Local description set successfully");
    });
}

function createAnswerer(offer, peerUsername, receiver_channel_name) {
  let peer = new RTCPeerConnection(null);

  addLocalTracks(peer);

  let remoteVideo = createVideo(peerUsername);
  setOnTrack(peer, remoteVideo);

  peer.addEventListener("datachannel", (e) => {
    peer.dc = e.channel;
    peer.dc.addEventListener("open", () => {
      console.log("Open data channel");
    });

    peer.dc.addEventListener("message", dcOnMessage);

    mapPeers[peerUsername] = [peer, peer.dc];
  });

  peer.addEventListener("iceconnectionstatechange", () => {
    let iceConnectionState = peer.iceConnectionState;
    if (
      iceConnectionState === "failed" ||
      iceConnectionState === "disconnected" ||
      iceConnectionState === "closed"
    ) {
      delete mapPeers[peerUsername];
      if (iceConnectionState != "closed") {
        peer.close();
      }

      removeVideo(remoteVideo);
    }
  });

  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      console.log("New ice candidate:", JSON.stringify(peer.localDescription));
      return;
    }

    sendSignal("new-answer", {
      sdp: peer.localDescription,
      receiver_channel_name: receiver_channel_name,
    });
  });

  peer
    .setRemoteDescription(offer)
    .then(() => {
      console.log("Remote descriptio set successfully for", peerUsername);

      return peer.createAnswer();
    })
    .then((a) => {
      console.log("Answer created");

      peer.setLocalDescription(a);
    });
}

function addLocalTracks(peer) {
  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  return;
}

function dcOnMessage(event) {
  let message = event.data;

  let li = document.createElement("li");
  li.appendChild(document.createTextNode(message));
  messageList.appendChild(li);
}

function createVideo(peerUsername) {
  let videoContainer = document.querySelector("#video-container");

  let remoteVideo = document.createElement("video");

  remoteVideo.id = peerUsername + "-video";
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;

  let videoWrapper = document.createElement("div");

  videoContainer.appendChild(videoWrapper);
  videoWrapper.appendChild(remoteVideo);

  return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
  let remoteStream = new MediaStream();

  remoteVideo.srcObject = remoteStream;

  peer.addEventListener("track", async (event) => {
    remoteStream.addTrack(event.track, remoteStream);
  });
}

function removeVideo(video) {
  let videoWrapper = video.parentNode;

  videoWrapper.parentNode.removeChild(videoWrapper);
}

function getDataChannels() {
  let dataChannels = [];

  for (peerUsername in mapPeers) {
    let dataChannel = mapPeers[peerUsername][1];
    dataChannels.push(dataChannel);
  }

  return dataChannels;
}
