import {
    connectWebSocket,
    base64ToBlobUrl,
    formatBytes,
    log
} from "./common.js";

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
let userChoseVoice = false;
let lastImageBlobUrl = null;

const LATENCY_SAMPLE_CAP = 200;

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
        log(messageLog, "Ignored non-JSON message");
        return;
    }

    const base64 = typeof packet.data === "string" ? packet.data : "";
    const approxBytes = base64 ? Math.floor((base64.length * 3) / 4) : 0;

    stats.count += 1;
    stats.bytes += approxBytes;
    if (!stats.firstArrival) stats.firstArrival = receivedAt;
    stats.lastArrival = receivedAt;

    let e2eLatency;
    if (typeof packet.sentAt === "number") {
        e2eLatency = Date.now() - packet.sentAt;
        if (e2eLatency >= 0) {
            stats.latencies.push(e2eLatency);
            if (stats.latencies.length > LATENCY_SAMPLE_CAP) {
                stats.latencies.shift();
            }
        }
    }

    updateStats();

    if (packet.type === "audio") {
        handleAudioPacket(packet, e2eLatency);
    } else if (packet.type === "image") {
        handleImagePacket(packet, e2eLatency);
    } else {
        log(messageLog, `Unknown message type: ${packet.type}`);
    }
}

function handleAudioPacket(packet, latencyMs) {
    currentTranscript = (packet.transcript || "").trim();

    if (currentTranscript) {
        receivedTranscript.textContent = currentTranscript;
        playButton.disabled = !speechSupported;
        stopButton.disabled = !speechSupported;
        ttsError.textContent = speechSupported
            ? ""
            : "Speech synthesis is not supported in this browser.";
    } else {
        receivedTranscript.textContent = "(No transcript was included with this message.)";
        playButton.disabled = true;
        stopButton.disabled = true;
    }

    const latencyText = latencyMs !== undefined
        ? ` · ${latencyMs < 0 ? "clock skew" : `${latencyMs.toFixed(0)} ms`}`
        : "";
    log(
        messageLog,
        `audio · transcript · ${currentTranscript.length} chars${latencyText}`
    );
}

function handleImagePacket(packet, latencyMs) {
    if (!packet.data || !packet.mimeType) {
        log(messageLog, "Ignored image with missing data");
        return;
    }
    if (!String(packet.mimeType).toLowerCase().startsWith("image/")) {
        log(messageLog, `Ignored non-image mimeType: ${packet.mimeType}`);
        return;
    }

    const newUrl = base64ToBlobUrl(packet.data, packet.mimeType);
    if (lastImageBlobUrl) URL.revokeObjectURL(lastImageBlobUrl);
    lastImageBlobUrl = newUrl;

    receivedImage.src = newUrl;
    receivedImageWrap.hidden = false;
    receivedImage.hidden = false;
    imagePlaceholder.hidden = true;
    receivedImageMeta.textContent = `${packet.filename || "image"} · ${packet.mimeType}`;

    const latencyText = latencyMs !== undefined
        ? ` · ${latencyMs < 0 ? "clock skew" : `${latencyMs.toFixed(0)} ms`}`
        : "";
    log(
        messageLog,
        `image · ${packet.filename || "image"} · ${formatBytes(packet.data)}${latencyText}`
    );
}

function loadVoices() {
    if (!speechSupported) return;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return;

    voiceSelect.innerHTML = "";
    voices.forEach((voice, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? " — default" : ""}`;
        voiceSelect.appendChild(option);
    });

    if (!userChoseVoice) {
        const preferred =
            voices.find((v) => v.default) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
            voices[0];
        currentVoice = preferred;
        voiceSelect.value = String(voices.indexOf(preferred));
    } else if (currentVoice) {
        const idx = voices.indexOf(currentVoice);
        if (idx >= 0) voiceSelect.value = String(idx);
    }
}

if (speechSupported) {
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    window.setTimeout(loadVoices, 100);

    voiceSelect.addEventListener("change", () => {
        const voices = synth.getVoices();
        currentVoice = voices[Number(voiceSelect.value)] || null;
        userChoseVoice = true;
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

    stopButton.addEventListener("click", () => synth.cancel());
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

    const parts = [`${formatBytes(stats.bytes)} received`];

    if (stats.count > 1 && stats.lastArrival > stats.firstArrival) {
        const elapsedSec = (stats.lastArrival - stats.firstArrival) / 1000;
        const throughput = elapsedSec > 0
            ? (stats.bytes / 1024 / elapsedSec).toFixed(1)
            : "—";
        parts.push(`≈ ${throughput} KB/s`);
    }

    if (stats.latencies.length > 0) {
        const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
        parts.push(`avg E2E ${avg.toFixed(0)} ms`);
    }

    statsDetail.textContent = parts.join(" · ");
}

window.addEventListener("pagehide", () => {
    if (lastImageBlobUrl) URL.revokeObjectURL(lastImageBlobUrl);
});

if (!speechSupported) {
    console.warn("Speech synthesis not supported — Play/Stop will be disabled.");
}

connect();