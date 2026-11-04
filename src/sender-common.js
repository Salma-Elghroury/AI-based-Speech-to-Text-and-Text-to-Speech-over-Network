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
