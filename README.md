# AI-based Speech-to-Text and Text-to-Speech over Network

The sender interface lets you record and review an audio message or select an
image, then send it to the WebSocket server. The receiver is intentionally not
implemented here.

## Run the sender

1. Install the project dependencies with `npm install`.
2. Start the WebSocket server from the project root:

   ```sh
   node src/server.js
   ```

3. In a second terminal, serve the project root over HTTP using VS Code Live
   Server or another static HTTP server. If Python is installed, you can use:

   ```sh
   python -m http.server 5500
   ```

4. Open [http://localhost:5500](http://localhost:5500) and choose **Send audio**
   or **Send an image**. Allow microphone access to record. The audio transcript
   can be edited in the review dialog before sending.

Microphone recording requires a secure browser context; `localhost` and HTTPS
are supported. Live speech transcription depends on browser support for the Web
Speech API. If it is unavailable, you can still record and type the transcript
yourself in the review dialog.

## Sender WebSocket messages

The sender connects to `ws://<current-host>:8080` when served over HTTP and
expects `wss` on that host and port when served over HTTPS. The included
WebSocket server is plain (non-TLS), so an HTTPS deployment requires a
TLS-enabled WebSocket server. It sends JSON packets in the following shapes:

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

Design reference: https://dribbble.com/shots/27362551-Supporty-AI-Website
