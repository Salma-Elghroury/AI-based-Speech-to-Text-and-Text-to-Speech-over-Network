const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function (ws, req) {

    console.log("Client connected");

    ws.on("message", function (message) {

        console.log("Received:", message.toString());

        // Broadcast to every other socket, including the receiver in a
        // combined sender/receiver workspace on the same page.
        wss.clients.forEach(function (client) {

            if (client !== ws &&
                client.readyState === WebSocket.OPEN) {

                client.send(message.toString());
            }

        });

    });

});

console.log("WebSocket server running on port 8080");