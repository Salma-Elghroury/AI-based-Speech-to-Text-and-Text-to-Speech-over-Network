const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function (ws) {

    console.log("Client connected");

    ws.on("message", function (message) {

        console.log("Received:", message.toString());

        // Forward message to other connected clients

        wss.clients.forEach(function (client) {

            if (client !== ws && client.readyState === WebSocket.OPEN) {

                client.send(message.toString());
            }

        });

    });

});

console.log("WebSocket server running on port 8080");