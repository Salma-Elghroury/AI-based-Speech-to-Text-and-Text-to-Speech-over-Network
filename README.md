# AI-based Speech-to-Text and Text-to-Speech over Network

A browser-based sender interface for recording an audio message or selecting a
single image and sending it over a WebSocket connection. Audio is transcribed
in the browser where speech recognition is supported; you can review and edit
the transcript before sending.

This guide covers running the sender. The WebSocket server listens for sender
messages and forwards them to other connected clients. Receiver behavior is
outside the scope of this guide.

## Requirements

- [Node.js](https://nodejs.org/) and npm
- Python 3 for the optional built-in static web server, or a static server such
  as the VS Code Live Server extension
- A modern browser; microphone recording requires `localhost` or HTTPS

## Install

Open a terminal in the project root and install the Node.js dependency:

```powershell
npm install
```

The only runtime npm dependency is `ws`, used by the WebSocket server. There
are no frontend packages or build step.

## Run locally

Start the WebSocket server in one terminal:

```powershell
node src/server.js
```

It listens on port `8080`. Leave this terminal running.

In a second terminal, start a static web server from the project root. With
Python 3:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

If the `python` command is unavailable on Windows, try:

```powershell
py -3 -m http.server 5500 --bind 127.0.0.1
```

Alternatively, open the project folder in VS Code and use the **Live Server**
extension to serve `index.html`.

Open [http://localhost:5500](http://localhost:5500) (or the URL shown by Live
Server). Choose **Send audio** to record, review, and send an audio message, or
choose **Send an image** to select and send one image.

To stop either server, press `Ctrl+C` in its terminal.

## Sender features and browser support

- Audio is recorded with the browser's `MediaRecorder` API and sent only after
  you confirm in the review dialog.
- Live transcription uses the browser's Web Speech API and depends on browser
  support and microphone permission. If live transcription is unavailable, you
  can type the transcript into the review dialog.
- Image selection accepts one image at a time. The page displays a file-added
  confirmation instead of a preview; press **Send image** to transmit it.
- The sender connects to `ws://<page-host>:8080` over HTTP and
  `wss://<page-host>:8080` over HTTPS. The included server is plain WebSocket
  (not TLS); an HTTPS deployment needs a TLS-enabled WebSocket endpoint.

## WebSocket message format

Audio and image file data are Base64-encoded in JSON packets:

```json
{
  "type": "audio",
  "filename": "recording-....webm",
  "mimeType": "audio/webm",
  "transcript": "Reviewed transcript text",
  "data": "<base64-encoded audio>"
}
```

```json
{
  "type": "image",
  "filename": "photo.png",
  "mimeType": "image/png",
  "data": "<base64-encoded image>"
}
```

The included server logs incoming messages and forwards each message to other
connected WebSocket clients. It does not save messages.

## Project structure

```text
index.html          Sender landing page
src/
  sender.html       Audio recording and transcript review
  sender.js         Audio capture, transcription, and sending
  image.html        Single-image selection and sending
  image.js          Image selection and WebSocket sending
  sender-common.js  Shared WebSocket and Base64 helpers
  styles.css        Shared page styles
  server.js         WebSocket server on port 8080
  receiver.html     Receiver page
  receiver.js       Receiver-side script
images/             Project images
```

Design reference: https://dribbble.com/shots/27362551-Supporty-AI-Website
