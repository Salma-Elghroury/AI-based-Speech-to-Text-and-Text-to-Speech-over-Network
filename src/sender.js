import { blobToBase64, connectWebSocket } from "./common.js";

const socket = connectWebSocket();
const recordButton = document.getElementById("recordButton");
const recordButtonText = document.getElementById("recordButtonText");
const recordHint = document.getElementById("recordHint");
const recordTime = document.getElementById("recordTime");
const waveform = document.getElementById("waveform");
const transcriptPreview = document.getElementById("transcriptPreview");
const reviewDialog = document.getElementById("reviewDialog");
const reviewForm = document.getElementById("reviewForm");
const transcriptInput = document.getElementById("recognizedText");
const audioPreview = document.getElementById("audioPreview");
const sendAudioButton = document.getElementById("sendAudioButton");
const dialogError = document.getElementById("dialogError");

const imageInput = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const uploadConfirmation = document.getElementById("uploadConfirmation");
const selectedFile = document.getElementById("selectedFile");
const imageError = document.getElementById("imageError");
const sendImageButton = document.getElementById("sendImageButton");
const changeImageButton = document.getElementById("changeImageButton");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recorder;
let recognition;
let mediaStream;
let audioBlob;
let audioUrl;
let recordingStartedAt;
let timerInterval;
let transcript = "";
let transcriptWasEdited = false;

let selectedImage;
let imageSent = false;

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    recordTime.textContent = `${minutes}:${seconds}`;
}

function setRecordingState(isRecording) {
    recordButton.classList.toggle("is-recording", isRecording);
    recordButton.setAttribute("aria-pressed", String(isRecording));
    recordButtonText.textContent = isRecording ? "Stop recording" : "Start recording";
    waveform.classList.toggle("is-recording", isRecording);
}

function updateTranscript(text) {
    transcript = text.trim();
    transcriptPreview.textContent = transcript || "Your words will appear here as you speak.";
    if (reviewDialog.open && !transcriptWasEdited) {
        transcriptInput.value = transcript;
    }
}

function startRecognition() {
    if (!SpeechRecognition) {
        recordHint.textContent = "Recording audio. Live transcription is not supported in this browser.";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
        const words = Array.from(event.results, (result) => result[0].transcript);
        updateTranscript(words.join(" "));
    };
    recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            recordHint.textContent = "Audio is recording, but speech recognition permission was denied.";
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
            recordHint.textContent = "Audio is recording, but live transcription stopped.";
        }
    };

    try {
        recognition.start();
    } catch (error) {
        console.error("Could not start speech recognition:", error);
        recordHint.textContent = "Audio is recording, but live transcription could not start.";
    }
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        recordHint.textContent = "This browser cannot access a microphone. Open this page on localhost or HTTPS.";
        return;
    }

    if (!window.MediaRecorder) {
        recordHint.textContent = "Audio recording is not supported in this browser.";
        return;
    }

    recordButton.disabled = true;
    recordHint.textContent = "Waiting for microphone permission…";

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(mediaStream);
        const chunks = [];
        recorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        });
        recorder.addEventListener("stop", () => {
            mediaStream.getTracks().forEach((track) => track.stop());
            audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (audioBlob.size === 0) {
                recordHint.textContent = "No audio was captured. Please try recording again.";
                recordButton.disabled = false;
                return;
            }

            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audioUrl = URL.createObjectURL(audioBlob);
            audioPreview.src = audioUrl;
            transcriptInput.value = transcript;
            transcriptWasEdited = false;
            dialogError.textContent = "";
            reviewDialog.showModal();
            recordButton.disabled = false;
        }, { once: true });

        transcript = "";
        transcriptWasEdited = false;
        transcriptPreview.textContent = "Listening…";
        recorder.start();
        recordingStartedAt = Date.now();
        recordTime.textContent = "00:00";
        timerInterval = window.setInterval(updateRecordingTime, 250);
        setRecordingState(true);
        recordHint.textContent = SpeechRecognition
            ? "Recording and transcribing. Press stop when you’re finished."
            : "Recording audio. Press stop when you’re finished.";
        startRecognition();
    } catch (error) {
        console.error("Could not start audio recording:", error);
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = undefined;
        }
        recordHint.textContent = error.name === "NotAllowedError"
            ? "Microphone access was denied. Allow microphone access and try again."
            : "Could not access the microphone. Check your device and try again.";
    } finally {
        recordButton.disabled = false;
    }
}

function stopRecording() {
    if (!recorder || recorder.state !== "recording") return;

    setRecordingState(false);
    recordButton.disabled = true;
    recordHint.textContent = "Preparing your recording…";
    window.clearInterval(timerInterval);

    if (recognition) {
        try {
            recognition.stop();
        } catch (error) {
            console.error("Could not stop speech recognition:", error);
        }
    }
    recorder.stop();
}

recordButton.addEventListener("click", () => {
    if (recorder && recorder.state === "recording") {
        stopRecording();
    } else {
        startRecording();
    }
});

transcriptInput.addEventListener("input", () => {
    transcriptWasEdited = true;
});

reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    dialogError.textContent = "";

    if (!audioBlob) {
        dialogError.textContent = "There is no recording to send. Please record your message again.";
        return;
    }
    if (socket.readyState !== WebSocket.OPEN) {
        dialogError.textContent = "The server is not connected. Check the connection and try again.";
        return;
    }

    sendAudioButton.disabled = true;
    sendAudioButton.textContent = "Sending…";
    try {
        const mimeType = audioBlob.type || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
        const packet = {
            type: "audio",
            filename: `recording-${Date.now()}.${extension}`,
            mimeType,
            transcript: transcriptInput.value.trim(),
            sentAt: Date.now(),
            data: await blobToBase64(audioBlob)
        };
        socket.send(JSON.stringify(packet));
        recordHint.textContent = "Your audio message was sent.";
        reviewDialog.close();
    } catch (error) {
        console.error("Could not send audio message:", error);
        dialogError.textContent = "Could not send your message. Please try again.";
    } finally {
        sendAudioButton.disabled = false;
        sendAudioButton.innerHTML = 'Send message';
    }
});

function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = undefined;
    audioBlob = undefined;
    audioPreview.removeAttribute("src");
    audioPreview.load();
    dialogError.textContent = "";
    transcriptWasEdited = false;
}

document.getElementById("discardButton").addEventListener("click", () => reviewDialog.close());
document.getElementById("closeDialog").addEventListener("click", () => reviewDialog.close());
reviewDialog.addEventListener("close", discardRecording);

function selectImage(files) {
    imageError.textContent = "";
    if (files.length === 0) return;
    if (files.length > 1) {
        imageError.textContent = "Only one image can be added at a time.";
        imageInput.value = "";
        return;
    }

    const [file] = files;
    if (!file.type.startsWith("image/")) {
        imageError.textContent = "Please choose a valid image file.";
        imageInput.value = "";
        return;
    }

    selectedImage = file;
    imageSent = false;
    sendImageButton.innerHTML = 'Send image';
    dropzone.hidden = true;
    uploadConfirmation.hidden = false;
    selectedFile.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    sendImageButton.disabled = false;
}

imageInput.addEventListener("change", () => selectImage(imageInput.files));
changeImageButton.addEventListener("click", () => {
    imageInput.value = "";
    imageInput.click();
});

dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    selectImage(event.dataTransfer.files);
});

sendImageButton.addEventListener("click", async () => {
    imageError.textContent = "";
    if (!selectedImage) {
        imageError.textContent = "Choose an image before sending.";
        return;
    }
    if (socket.readyState !== WebSocket.OPEN) {
        imageError.textContent = "The server is not connected. Check the connection and try again.";
        return;
    }

    sendImageButton.disabled = true;
    sendImageButton.textContent = "Sending…";
    try {
        const packet = {
            type: "image",
            filename: selectedImage.name,
            mimeType: selectedImage.type,
            sentAt: Date.now(),
            data: await blobToBase64(selectedImage)
        };
        socket.send(JSON.stringify(packet));
        imageSent = true;
        sendImageButton.textContent = "Image sent";
        imageInput.value = "";
    } catch (error) {
        console.error("Could not send image:", error);
        imageError.textContent = "Could not send your image. Please try again.";
    } finally {
        sendImageButton.disabled = !selectedImage || imageSent;
        if (!imageSent) sendImageButton.innerHTML = 'Send image';
    }
});