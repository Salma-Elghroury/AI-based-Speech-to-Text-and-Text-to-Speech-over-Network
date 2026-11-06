export function connectWebSocket({ retryDelay = 2000 } = {}) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const url = `${protocol}//${host}:8080`;
    const events = new EventTarget();
    let socket;
    let retryTimer;
    let stopped = false;

    function scheduleReconnect() {
        if (stopped) return;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(connect, retryDelay);
    }

    function connect() {
        if (stopped) return;
        let nextSocket;
        try {
            nextSocket = new WebSocket(url);
        } catch (error) {
            console.error("Could not create WebSocket connection:", error);
            events.dispatchEvent(new Event("error"));
            scheduleReconnect();
            return;
        }

        socket = nextSocket;
        socket.addEventListener("open", () => events.dispatchEvent(new Event("open")));
        socket.addEventListener("message", (event) => {
            events.dispatchEvent(new MessageEvent("message", {
                data: event.data,
                origin: event.origin,
                lastEventId: event.lastEventId
            }));
        });
        socket.addEventListener("error", () => {
            console.error("WebSocket connection error");
            events.dispatchEvent(new Event("error"));
        });
        socket.addEventListener("close", (event) => {
            events.dispatchEvent(new CloseEvent("close", {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            }));
            scheduleReconnect();
        });
    }

    const connection = {
        get readyState() {
            if (stopped) return WebSocket.CLOSED;
            return socket ? socket.readyState : WebSocket.CONNECTING;
        },
        get bufferedAmount() {
            return socket ? socket.bufferedAmount : 0;
        },
        addEventListener(type, listener, options) {
            events.addEventListener(type, listener, options);
        },
        removeEventListener(type, listener, options) {
            events.removeEventListener(type, listener, options);
        },
        send(data) {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                throw new DOMException("WebSocket is not open.", "InvalidStateError");
            }
            socket.send(data);
        },
        close(code, reason) {
            stopped = true;
            window.clearTimeout(retryTimer);
            if (socket && socket.readyState < WebSocket.CLOSING) {
                if (code === undefined) socket.close();
                else socket.close(code, reason);
            }
        }
    };

    connect();
    return connection;
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

const STATUS_LABELS = {
    connected: "Connected to relay",
    connecting: "Connecting…",
    disconnected: "Disconnected — retrying…",
    error: "Connection error"
};

// Attaches open/close/error handlers that drive one or more
// .connection-status pills. Every element found by `selector` (there can be
// one in the sender pane and one in the receiver pane on the combined page)
// mirrors the socket state.
export function attachConnectionStatus(socket, selector = "[data-connection-status]") {
    const pills = Array.from(document.querySelectorAll(selector));
    const setState = (state) => {
        pills.forEach((pill) => {
            pill.dataset.state = state;
            const label = pill.querySelector("[data-connection-label]");
            if (label) label.textContent = STATUS_LABELS[state];
        });
    };

    setState("connecting");
    socket.addEventListener("open", () => setState("connected"));
    socket.addEventListener("close", () => setState("disconnected"));
    socket.addEventListener("error", () => setState("error"));
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

// Logs an outgoing message on the sender side. Pages that don't have a
// sender-side log element (the separate sender pages) are silently skipped.
export function logSent(text, maxEntries = 25) {
    const listEl = document.getElementById("sentLog");
    if (!listEl) return;
    const li = document.createElement("li");
    const stamp = new Date().toLocaleTimeString();
    li.textContent = `${stamp} — ${text}`;
    listEl.prepend(li);
    while (listEl.children.length > maxEntries) listEl.lastChild.remove();

    const summary = document.getElementById("sentStatsSummary");
    if (summary) {
        const count = Number(listEl.dataset.count || "0") + 1;
        listEl.dataset.count = String(count);
        summary.textContent = `${count} sent`;
    }
}