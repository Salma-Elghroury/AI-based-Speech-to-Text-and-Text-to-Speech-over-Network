import { blobToBase64, connectWebSocket, attachConnectionStatus, formatBytes, logSent } from "./common.js";

const socket = connectWebSocket();
attachConnectionStatus(socket);
const imageInput = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const uploadConfirmation = document.getElementById("uploadConfirmation");
const selectedFile = document.getElementById("selectedFile");
const imageError = document.getElementById("imageError");
const sendImageButton = document.getElementById("sendImageButton");
const changeImageButton = document.getElementById("changeImageButton");

let selectedImage;
let imageSent = false;

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
    dropzone.closest(".image-card")?.classList.add("has-confirmation");
    selectedFile.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    sendImageButton.disabled = false;
}

imageInput.addEventListener("change", () => selectImage(imageInput.files));
changeImageButton.addEventListener("click", () => {
    imageInput.value = "";
    dropzone.closest(".image-card")?.classList.remove("has-confirmation");
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
        logSent(`sent · image · ${packet.filename} · ${formatBytes(packet.data)}`);
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