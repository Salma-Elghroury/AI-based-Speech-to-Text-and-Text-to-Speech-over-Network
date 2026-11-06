export function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const socket = new WebSocket(`${protocol}//${host}:8080`);

    socket.addEventListener("error", () => console.error("WebSocket connection error"));

    return socket;
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("Could not read the selected file."));
                return;
            }

            const separator = reader.result.indexOf(",");
            if (separator < 0) {
                reject(new Error("Could not encode the selected file."));
                return;
            }

            resolve(reader.result.slice(separator + 1));
        };
        reader.onerror = () => reject(reader.error || new Error("Could not read the selected file."));
        reader.readAsDataURL(blob);
    });
}

export function base64ToDataUrl(base64, mimeType) {
    return `data:${mimeType};base64,${base64}`;
}

export function base64ToBlobUrl(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function formatBytes(base64) {
    if (!base64) return "0 KB";
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes < 1024) return `${approxBytes} B`;
    if (approxBytes < 1024 * 1024) return `${(approxBytes / 1024).toFixed(1)} KB`;
    return `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function log(text) {
    const li = document.createElement("li");
    const stamp = new Date().toLocaleTimeString();
    li.textContent = `${stamp} — ${text}`;
    messageLog.prepend(li);
    while (messageLog.children.length > 25) messageLog.lastChild.remove();
}