// script.js
const socket = io();
let myStream;
let peerConnection;
const videoGrid = document.getElementById('videoGrid');
const roomIdInput = document.getElementById('roomId');
let myVideo = null;
let myId = Math.random().toString(36).substring(7);

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function joinRoom() {
  const roomId = roomIdInput.value.trim();
  if (!roomId) return alert("Room ID daal pehle!");

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      myStream = stream;
      myVideo = addVideoStream(stream, true);
      
      socket.emit('join-room', roomId, myId);

      socket.on('user-connected', (userId) => {
        console.log('Naya user join hua:', userId);
        connectToNewUser(userId, stream);
      });

      socket.on('user-disconnected', () => {
        if (peerConnection) peerConnection.close();
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) remoteVideo.remove();
      });
    })
    .catch(err => console.error("Camera error:", err));
}

function addVideoStream(stream, isMe) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = isMe;
  video.autoplay = true;
  video.playsInline = true;
  if (!isMe) video.id = 'remote-video'; // Sirf dusre ka video
  videoGrid.appendChild(video);
  return video;
}

function connectToNewUser(userId, stream) {
  peerConnection = new RTCPeerConnection(configuration);

  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = (event) => {
    if (document.getElementById('remote-video')) return;
    addVideoStream(event.streams[0], false);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, userId);
    }
  };

  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', peerConnection.localDescription, userId);
    });
}

// Signaling events
socket.on('offer', (offer, userId) => {
  if (!peerConnection) connectToNewUser(userId, myStream);
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => socket.emit('answer', peerConnection.localDescription, userId));
});

socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', (candidate) => {
  if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Controls
function toggleMute() {
  const audioTrack = myStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  const btn = document.getElementById('muteBtn');
  btn.classList.toggle('muted');
  btn.textContent = audioTrack.enabled ? 'Mute' : 'Unmute';
}

function toggleVideo() {
  const videoTrack = myStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  const btn = document.getElementById('videoBtn');
  btn.classList.toggle('off');
  btn.textContent = videoTrack.enabled ? 'Camera' : 'Camera Off';
}

function endCall() {
  myStream.getTracks().forEach(track => track.stop());
  if (peerConnection) peerConnection.close();
  window.location.reload();
}