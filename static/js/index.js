function wsOnMessage(event) {
    const parsedData = JSON.parse(event.data);
    console.log("message:", parsedData.message);
}

const wsUrl = "ws://127.0.0.1:8000";

const usernameInput = document.querySelector("#username");
const joinButton = document.querySelector("#join-button");
const label = document.querySelector("#username-label");

joinButton.addEventListener("click", () => {
    const username = usernameInput.value;
    if (!username) {
        return;
    }
    console.log("username:", username);
    label.textContent = "Your username: " + username;
    usernameInput.value = "";
    usernameInput.style.visibility = "hidden";
    usernameInput.disabled = true;

    joinButton.disabled = true;
    joinButton.style.visibility = "hidden";

    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", (e) => {
        console.log("Open");

        const msg = JSON.stringify({
            message: "This is message",
        });
        ws.send(msg);
    });

    ws.addEventListener("message", wsOnMessage);
    ws.addEventListener("close", (e) => {
        console.log("Close");
    });
    ws.addEventListener("error", (e) => {
        console.log("Error");
    });
});

let localStream = new MediaStream();

const constraints = {
    video: true,
    audio: true,
};

let localVideo = document.querySelector("#local-video");

const userMedia = navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
        localVideo.srcObject = stream;
        localVideo.muted = true;
    })
    .catch((e) => {
        console.log("Error accessing media devices:", e);
    });
