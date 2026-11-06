const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function (ws, req) {

    const requestUrl = new URL(req.url, "http://localhost");
    ws.clientId = requestUrl.searchParams.get("clientId");

    console.log("Client connected", ws.clientId || "(no client id)");

    ws.on("message", function (message) {

        console.log("Received:", message.toString());

        wss.clients.forEach(function (client) {

            if (client !== ws &&
                client.readyState === WebSocket.OPEN &&
                (!ws.clientId || client.clientId !== ws.clientId)) {

                client.send(message.toString());
            }

        });

    });

});

console.log("WebSocket server running on port 8080");