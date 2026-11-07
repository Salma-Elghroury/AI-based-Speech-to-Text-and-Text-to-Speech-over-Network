# AI-based Speech-to-Text and Text-to-Speech over Network

A browser-based sender/receiver app for recording a voice message or selecting a single image and sending it over a WebSocket connection. The sender and receiver can run side by side in one combined workspace or as separate pages. Audio is recorded and transcribed in the sender's browser where speech recognition is supported; the sender can review and edit the transcript before sending. Only the transcript and the image are sent over the network — the recorded audio stays on the sender's device. The receiver reads the transcript back aloud using the Speech Synthesis Web API and displays received images.

## Requirements

- [Node.js](https://nodejs.org/) and npm
- Python 3 for the optional built-in static web server, or a static server such as the VS Code Live Server extension
- A modern browser; microphone recording requires `localhost` or HTTPS

## Install

Open a terminal in the project root and install the Node.js dependency:

```powershell
npm install
```

The only runtime npm dependency is `ws`, used by the WebSocket server. There are no frontend packages or build step.

## Run locally

Start the WebSocket server in one terminal:

```powershell
node src/server.js
```

It listens on port `8080`. Leave this terminal running.

In a second terminal, start a static web server from the project root. With Python 3:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

If the `python` command is unavailable on Windows, try:

```powershell
py -3 -m http.server 5500 --bind 127.0.0.1
```

Alternatively, open the project folder in VS Code and use the **Live Server** extension to serve `index.html`.

Open [http://localhost:5500](http://localhost:5500) (or the URL shown by Live Server). The landing page offers two starting points:

- **Combined workspace** — sender and receiver side by side in one browser window. The receiver half ignores messages sent from the same page.
- **Separate sender & receiver** — scroll to the standalone sender and receiver pages for two-window testing.

To try the full flow with separate pages, open **two browser windows**: one acting as the sender and one as the receiver.

To stop either server, press `Ctrl+C` in its terminal.

## Sender features and browser support

- Audio is recorded locally with the browser's `MediaRecorder` API for transcription and review; only the reviewed transcript is sent after you confirm in the dialog. The recording itself is never transmitted.
- Live transcription uses the browser's Web Speech API and depends on browser support and microphone permission. If live transcription is unavailable, you can type the transcript into the review dialog.
- Image selection accepts one image at a time. The page displays a file-added confirmation instead of a preview; press **Send image** to transmit it.
- The standalone sender page and the sender side of the combined workspace both support transcript and image sending.
- The sender connects to `ws://<page-host>:8080` over HTTP and `wss://<page-host>:8080` over HTTPS. The included server is plain WebSocket (not TLS); an HTTPS deployment needs a TLS-enabled WebSocket endpoint.
- Each outgoing packet includes a `sentAt` timestamp (milliseconds since epoch) so the receiver can compute end-to-end latency.

## Receiver features and browser support

- Connects to the same WebSocket server, reconnecting automatically every two seconds if the connection drops.
- For every `audio` message:
  - Displays the received transcript (the recorded audio is not sent).
  - Provides **Play speech**, **Stop**, a **voice** selector, and **rate** and **pitch** sliders using the Speech Synthesis Web API.
- For every `image` message: renders the image inline with its filename and MIME type.
- Logs each event (type, size or transcript length, end-to-end latency when `sentAt` is present) and shows running totals (message count, total image bytes, approximate throughput, average E2E latency).
- **Autoplay policy note:** browsers block speech synthesis before a user gesture. The receiver deliberately does not auto-speak; press **Play speech** after a message arrives.

## WebSocket message format

Image file data is Base64-encoded in JSON packets. Audio packets contain only
the reviewed transcript; the local recording is not included.

Audio (transcript only):

```json
{
  "type": "audio",
  "transcript": "Reviewed transcript text",
  "sentAt": 1731250000000
}
```

Image:

```json
{
  "type": "image",
  "filename": "photo.png",
  "mimeType": "image/png",
  "sentAt": 1731250000000,
  "data": "<base64-encoded image>"
}
```

The included server logs incoming messages and forwards each message to other WebSocket clients that belong to a different page. Each page load generates a client ID, so the combined workspace's receiver half does not receive messages sent from its own sender half, while other tabs and browsers still do. The server does not save messages.

## Project structure

```text
index.html          Landing page (combined workspace or separate pages)
src/
  app.html          Combined sender + receiver workspace
  sender.html       Standalone sender (voice recording, transcript review, image selection)
  sender.js         Audio capture, transcription, transcript and image sending, WebSocket output
  receiver.html     Receiver page (speech synthesis and image display)
  receiver.js       WebSocket handling, TTS, image rendering, stats
  common.js         Shared WebSocket and Base64 helpers
  styles.css        Shared page styles
  server.js         WebSocket server on port 8080
images/             Project images
```