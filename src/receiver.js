import { connectWebSocket, base64ToDataUrl, base64ToBlobUrl, formatBytes, log } from "./common.js";

const connectionStatus = document.getElementById("connectionStatus");
const connectionLabel = document.getElementById("connectionLabel");
const receivedTranscript = document.getElementById("receivedTranscript");
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const voiceSelect = document.getElementById("voiceSelect");
const rateInput = document.getElementById("rateInput");
const rateValue = document.getElementById("rateValue");
const pitchInput = document.getElementById("pitchInput");
const pitchValue = document.getElementById("pitchValue");
const originalRecordingWrap = document.getElementById("originalRecordingWrap");
const originalAudio = document.getElementById("originalAudio");
const ttsError = document.getElementById("ttsError");
const receivedImageWrap = document.getElementById("receivedImageWrap");
const receivedImage = document.getElementById("receivedImage");
const receivedImageMeta = document.getElementById("receivedImageMeta");
const imagePlaceholder = document.getElementById("imagePlaceholder");
const messageLog = document.getElementById("messageLog");
const statsSummary = document.getElementById("statsSummary");
const statsDetail = document.getElementById("statsDetail");

const synth = window.speechSynthesis;
const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let currentTranscript = "";
let currentVoice = null;
let lastOriginalAudioUrl = null;

const stats = {
    count: 0,
    bytes: 0,
    firstArrival: 0,
    lastArrival: 0,
    latencies: []
};

let socket;
let reconnectTimer;

function setStatus(state, detail) {
    connectionStatus.dataset.state = state;
    connectionLabel.textContent = detail ?? (
        state === "connected" ? "Connected to relay" :
            state === "connecting" ? "Connecting…" :
                state === "disconnected" ? "Disconnected — retrying…" :
                    "Connection error"
    );
}

function attachSocketHandlers(ws) {
    ws.addEventListener("open", () => setStatus("connected"));
    ws.addEventListener("close", () => {
        setStatus("disconnected");
        scheduleReconnect();
    });
    ws.addEventListener("error", () => {
        setStatus("error", "Connection error — retrying…");
    });
    ws.addEventListener("message", (event) => handleMessage(event));
}

function scheduleReconnect() {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
        connect();
    }, 2000);
}

function connect() {
    setStatus("connecting");
    try {
        socket = connectWebSocket();
    } catch (error) {
        console.error("Could not create socket:", error);
        setStatus("error", "Could not open socket — retrying…");
        scheduleReconnect();
        return;
    }
    attachSocketHandlers(socket);
}

function handleMessage(event) {
    const receivedAt = performance.now();

    let packet;
    try {
        packet = JSON.parse(event.data);
    } catch {
        log("Ignored non-JSON message");
        return;
    }

    stats.count += 1;
    stats.bytes += event.data.length;
    if (!stats.firstArrival) stats.firstArrival = receivedAt;

    let e2eLatency;
    if (typeof packet.sentAt === "number") {
        e2eLatency = Date.now() - packet.sentAt;
        stats.latencies.push(e2eLatency);
    }

    updateStats();

    if (packet.type === "audio") {
        handleAudioPacket(packet, e2eLatency);
    } else if (packet.type === "image") {
        handleImagePacket(packet, e2eLatency);
    } else {
        log(`Unknown message type: ${packet.type}`);
    }
}

function handleAudioPacket(packet, latencyMs) {
    currentTranscript = (packet.transcript || "").trim();

    if (currentTranscript) {
        receivedTranscript.textContent = currentTranscript;
        playButton.disabled = !speechSupported;
        stopButton.disabled = !speechSupported;
        if (!speechSupported) {
            ttsError.textContent = "Speech synthesis is not supported in this browser.";
        } else {
            ttsError.textContent = "";
        }
    } else {
        receivedTranscript.textContent =
            "(Sender did not transcribe this recording — play the original below.)";
        playButton.disabled = true;
        stopButton.disabled = true;
    }

    // Decode original recording (optional secondary control)
    if (packet.data && packet.mimeType) {
        if (lastOriginalAudioUrl) URL.revokeObjectURL(lastOriginalAudioUrl);
        lastOriginalAudioUrl = base64ToBlobUrl(packet.data, packet.mimeType);
        originalAudio.src = lastOriginalAudioUrl;
        originalRecordingWrap.hidden = false;
    } else {
        originalRecordingWrap.hidden = true;
    }

    log(
        `audio · ${packet.filename || "recording"} · ` +
        `${currentTranscript.length} chars · ${formatBytes(packet.data)}` +
        (latencyMs !== undefined ? ` · ${latencyMs.toFixed(0)} ms` : "")
    );
}

function handleImagePacket(packet, latencyMs) {
    if (!packet.data || !packet.mimeType) {
        log("Ignored image with missing data");
        return;
    }
    receivedImage.src = base64ToDataUrl(packet.data, packet.mimeType);
    receivedImageWrap.hidden = false;
    imagePlaceholder.hidden = true;
    receivedImageMeta.textContent = `${packet.filename || "image"} · ${packet.mimeType}`;
    log(
        `image · ${packet.filename || "image"} · ${formatBytes(packet.data)}` +
        (latencyMs !== undefined ? ` · ${latencyMs.toFixed(0)} ms` : "")
    );
}

let voicesLoaded = false;

function loadVoices() {
    if (!speechSupported) return;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return;
    voicesLoaded = true;

    voiceSelect.innerHTML = "";
    voices.forEach((voice, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? " — default" : ""}`;
        voiceSelect.appendChild(option);
    });

    const preferred =
        voices.find((v) => v.default) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
        voices[0];
    currentVoice = preferred;
    voiceSelect.value = String(voices.indexOf(preferred));
}

if (speechSupported) {
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    // Some browsers need an initial call after a tick
    window.setTimeout(loadVoices, 100);
    voiceSelect.addEventListener("change", () => {
        const voices = synth.getVoices();
        currentVoice = voices[Number(voiceSelect.value)] || null;
    });
    rateInput.addEventListener("input", () => {
        rateValue.textContent = Number(rateInput.value).toFixed(1);
    });
    pitchInput.addEventListener("input", () => {
        pitchValue.textContent = Number(pitchInput.value).toFixed(1);
    });

    playButton.addEventListener("click", () => {
        ttsError.textContent = "";
        if (!currentTranscript) return;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(currentTranscript);
        if (currentVoice) utterance.voice = currentVoice;
        utterance.rate = Number(rateInput.value);
        utterance.pitch = Number(pitchInput.value);
        utterance.onstart = () => { playButton.dataset.state = "playing"; };
        utterance.onend = () => { playButton.dataset.state = ""; };
        utterance.onerror = (event) => {
            playButton.dataset.state = "";
            if (event.error !== "interrupted" && event.error !== "canceled") {
                ttsError.textContent = `Speech synthesis failed (${event.error}).`;
            }
        };
        synth.speak(utterance);
    });

    stopButton.addEventListener("click", () => {
        if (synth.speaking || synth.pending) synth.cancel();
    });
} else {
    playButton.disabled = true;
    stopButton.disabled = true;
    voiceSelect.disabled = true;
    rateInput.disabled = true;
    pitchInput.disabled = true;
    ttsError.textContent = "Speech synthesis is not supported in this browser.";
}

function updateStats() {
    statsSummary.textContent = `${stats.count} message${stats.count === 1 ? "" : "s"}`;

    const totalKB = (stats.bytes / 1024).toFixed(1);
    const parts = [`${totalKB} KB received`];

    if (stats.count > 1) {
        const elapsedSec = (stats.lastArrival - stats.firstArrival) / 1000 || 0;
        stats.lastArrival = performance.now();
        const throughput = elapsedSec > 0 ? (stats.bytes / 1024 / elapsedSec).toFixed(1) : "—";
        parts.push(`≈ ${throughput} KB/s`);
    } else {
        stats.lastArrival = performance.now();
    }

    if (stats.latencies.length > 0) {
        const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
        parts.push(`avg E2E ${avg.toFixed(0)} ms`);
    }

    statsDetail.textContent = parts.join(" · ");
}

if (!speechSupported) {
    console.warn("Speech synthesis not supported — Play/Stop will be disabled.");
}

connect();