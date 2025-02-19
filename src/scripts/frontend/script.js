/* eslint-disable no-undef */
import { generatePrediction } from './predictions.js';
import { spawnHeart } from './spawn-hearts.js';

// Get available voices
const voices = window.speechSynthesis.getVoices();

const video = document.getElementById('camera');
const start = document.getElementById('start-button');
const capture = document.getElementById('camera-box');
const backdrop = document.getElementById('backdrop');

let isCapturing = false;

capture.onclick = _ => captureImage();


function captureImage() {
  isCapturing = true;

  setTimeout(() => {
    window.ipcRenderer.invoke('save-to-desktop')
        .then(_ => {
          backdrop.classList.add('show');

          setTimeout(() => {
            backdrop.classList.remove('show');
            isCapturing = false;
          }, 300);
        });
  }, 500);
};

start.onmouseover = _ => start.firstElementChild.src = '../src/assets/images/button2.png';
start.onmouseout = _ => start.firstElementChild.src = '../src/assets/images/button1.png';

let videoWidth = video.clientWidth;
let videoHeight = video.clientHeight;

function updateVideoSize() {
  videoWidth = video.clientWidth;
  videoHeight = video.clientHeight;
}

// Update on window resize
window.addEventListener('resize', updateVideoSize);

const cameraBox = document.getElementById('content-camera');

const predictingPopup = document.getElementById('predicting-popup');
const predictingPopupText = document.getElementById('predicting-popup-text');

let showHearts = false;

let stopActions = true;
let detectedFaces = 0;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('scripts/frontend/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('scripts/frontend/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('scripts/frontend/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('scripts/frontend/models')
])
    .then(() => {
      stopActions = false;

      navigator.getUserMedia(
          { video: {} },
          stream => video.srcObject = stream,
          error => console.error(error)
      );
    });

video.onplay = event => {
  const canvas = faceapi.createCanvasFromMedia(video);
  cameraBox.append(canvas);

  const size = { width: videoWidth, height: videoHeight };
  faceapi.matchDimensions(canvas, size);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions()
    )
        .withFaceLandmarks()
        .withFaceExpressions();

    const resizedDetections = faceapi.resizeResults(detections, size);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Set custom color for bounding box
    const drawOptions = {
      label: '',
      boxColor: 'red', // Change this to your desired color
      lineWidth: 5
    };

    if (!isCapturing) {
      resizedDetections.forEach(det => {
        const box = det.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, drawOptions);
        drawBox.draw(canvas);
      });
    }

    detectedFaces = resizedDetections.length;
  }, 100);
};

setInterval(() => {
  if (showHearts) spawnHeart();
}, 50);

function predict() {
  if (stopActions) return;
  capture.style.display = 'none';

  // check number of people in the camera
  if (detectedFaces <= 0) {
    document.getElementById('prediction').textContent = 'No face detected';
    predictingPopup.classList.remove('show');
    document.getElementById('loading-gif').style.display = 'none';
    predictingPopupText.style.display = 'grid'; // Show text again
    predictingPopupText.textContent = 'Predicting';
    stopActions = false;
    return;
  }

  stopActions = true;
  showHearts = true;
  predictingPopup.classList.add('show');

  // Show loading GIF and hide text
  document.getElementById('loading-gif').style.display = 'grid';
  document.getElementById('prediction').textContent = 'Predicting';
  predictingPopupText.style.display = 'none';

  let countdown = 5;

  const interval = setInterval(() => {
    countdown--;

    // Stop hearts early
    if (countdown <= 3) showHearts = false;

    if (countdown < 0) {
      clearInterval(interval);

      // Hide loading GIF and show result text
      document.getElementById('loading-gif').style.display = 'none';
      predictingPopupText.style.display = 'grid';
      predictingPopup.classList.remove('show');

      const predicted = generatePrediction(detectedFaces);
      document.getElementById('prediction').textContent = predicted;
      capture.style.display = 'grid';

      const speech = new SpeechSynthesisUtterance(predicted);

      // Select a specific voice (change the name to your preference)
      speech.voice = voices.find(voice =>
        voice.lang('tl-PH')
      ) || voices[0];

      window.speechSynthesis.speak(speech);

      // Wait for speech to finish before allowing actions again
      speech.onend = () => {
        stopActions = false;
      };
    }
  }, 1000);
}


start.onclick = _ => predict();

window.onkeydown = event => {
  if (event.key === 'p') {
    window.ipcRenderer.invoke('print');
  }

  if (event.key === ' ') {
    predict();
  }
  if (event.key === 'c') {
    captureImage();
  }
};
