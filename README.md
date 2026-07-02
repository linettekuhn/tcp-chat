# TCP Chat App

The TCP Chat web app uses a React and TypeScript frontend with an Express.js backend to connect users in real time through a custom C++ TCP server.  
It enables fast, real time communication between authenticated users while tracking active clients and preserving message history.

---

## Demo

[👉 **Click here to see live demo**](https://chat.linettekuhn.com)

---

## Usage

To use the TCP Chat App, both the server and clients are connected through the web client interface. The process works as follows:

1. **Start as a server**
   - Open the web client and choose to create a server.
   - The app will start a TCP server using the selected IP address and port.
   - This instance becomes the active message host.

2. **Connect clients to the server**
   - On other devices or browser windows, open the web client.
   - Enter the server's IP address and port to connect as a client.
   - Use the help command to see all interactions.
   - Once authenticated, clients can send and receive messages through the C++ TCP server.

3. **Chat in real-time**
   - All messages are relayed through the TCP server.
   - The UI shows active users (server mode) and message history (client mode).

This setup allows the entire system (server and clients) to operate directly from the web client without requiring manual configuration in the terminal.

---

## Features

- Real time messaging between connected clients
- Message history storage and retrieval
- Active user tracking and presence indicators
- Express.js bridge between frontend and C++ TCP server
- User authentication and secure session handling
- Multithreaded C++ TCP server for scalable messaging
- Responsive web UI with modern UX

---

## Built With

- Frontend: React, TypeScript
- Backend: Express.js (Node.js)
- Networking: Custom C++ TCP Server with Sockets and Multithreading [managed in sister repository](https://github.com/linettekuhn/tcp-chat-server)

---
