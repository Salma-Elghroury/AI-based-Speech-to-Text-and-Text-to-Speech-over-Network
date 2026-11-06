function createClientId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const clientId = createClientId();

export function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const socket = new WebSocket(
        `${protocol}//${host}:8080?clientId=${encodeURIComponent(clientId)}`
    );

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

export function base64ToBlobUrl(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function formatBytes(input) {
    let bytes;
    if (typeof input === "number") {
        bytes = input;
    } else if (typeof input === "string" && input.length > 0) {
        bytes = Math.floor((input.length * 3) / 4);
    } else {
        return "0 KB";
    }
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function log(listEl, text, maxEntries = 25) {
    if (!listEl) return;
    const li = document.createElement("li");
    const stamp = new Date().toLocaleTimeString();
    li.textContent = `${stamp} — ${text}`;
    listEl.prepend(li);
    while (listEl.children.length > maxEntries) listEl.lastChild.remove();
}