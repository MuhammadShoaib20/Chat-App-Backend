# SyncChat – Backend

This is the backend for a real-time chat application built with the **MERN stack**. It provides RESTful APIs and WebSocket (Socket.io) services for user authentication, messaging, group chats, file uploads, push notifications, and more.

🔗 **Live Demo:** [https://chat-app-theta-seven-44.vercel.app/](https://chat-app-theta-seven-44.vercel.app/)
🐙 **GitHub:** [https://github.com/MuhammadShoaib20/chat-app](https://github.com/MuhammadShoaib20/chat-app)
🖥️ **Backend API:** [https://chat-app-14ut.onrender.com/api](https://chat-app-14ut.onrender.com/api)

---

## 🚀 Features

- **User Authentication** – JWT-based login/register with password hashing (bcryptjs)
- **Real-time Messaging** – Socket.io for instant delivery, typing indicators, read receipts
- **Group Chats** – Create groups, add/remove members, assign admins, update group info
- **File Uploads** – Cloudinary integration with local fallback; supports images & documents
- **Push Notifications** – Web push notifications for offline users (optional VAPID keys)
- **Conversation Management** – List, hide, delete, and search conversations
- **Message Actions** – Edit, delete, and react to messages
- **Block/Unblock Users** – Prevent messages from blocked users
- **Rate Limiting** – Protect endpoints from abuse
- **Redis Caching** – Cache user and conversation data for performance (optional)
- **Security** – Helmet, CORS, input validation, and secure headers

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js + Express | Backend framework |
| MongoDB + Mongoose | Database and ODM |
| Socket.io | Real-time WebSocket communication |
| Redis | Caching and socket.io adapter (optional) |
| Cloudinary | File storage (optional) |
| JWT | Authentication tokens |
| bcryptjs | Password hashing |
| Multer | File upload handling |
| Web-Push | Push notifications |
| Helmet, CORS | Security middleware |
| Express Rate Limit | Rate limiting |

---

## 📦 Prerequisites

- Node.js **v18 or higher**
- MongoDB (local or Atlas)
- Redis (optional – for production scaling)
- Cloudinary account (optional – for cloud file storage)

---

## 🔧 Installation & Setup

**1. Clone the repository:**

```bash
git clone https://github.com/MuhammadShoaib20/chat-app.git
cd chat-app/backend
```

**2. Install dependencies:**

```bash
npm install
```

**3. Set up environment variables:**

Create a `.env` file in the root of the `backend/` folder:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d

# Client URL (CORS) – comma separated if multiple
CLIENT_URL=http://localhost:5173,https://your-frontend-domain.com

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis (optional)
REDIS_URL=redis://:your_password@host:port

# VAPID Keys (for push notifications, optional)
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

> **Notes:**
> - If Cloudinary keys are not set, files will be saved locally in the `uploads/` folder.
> - Redis is optional but recommended for scaling Socket.io and caching.
> - For production, use MongoDB Atlas and set `MONGO_URI` accordingly.
> - Set `CLIENT_URL` to your actual frontend domain(s) (comma-separated if multiple).

**4. Start MongoDB and Redis** (if using locally):

- MongoDB: ensure `mongod` is running.
- Redis: start `redis-server` (or use your Redis Cloud URL).

**5. Run the server:**

```bash
npm run dev    # development with nodemon
# or
npm start      # production
```

The server will start on `http://localhost:5000`.

---

## 🌍 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port the server listens on | No (default 5000) |
| `NODE_ENV` | `development` or `production` | No |
| `MONGO_URI` | MongoDB connection string | ✅ Yes |
| `JWT_SECRET` | Secret for signing JWT tokens | ✅ Yes |
| `JWT_EXPIRE` | JWT expiration (e.g., `30d`) | No |
| `CLIENT_URL` | Frontend URL(s) for CORS (comma-separated) | ✅ Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | No |
| `CLOUDINARY_API_KEY` | Cloudinary API key | No |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | No |
| `REDIS_URL` | Redis connection URL | No |
| `VAPID_SUBJECT` | Email address for VAPID | No |
| `VAPID_PUBLIC_KEY` | VAPID public key | No |
| `VAPID_PRIVATE_KEY` | VAPID private key | No |

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── cloudinary.js
│   │   ├── db.js
│   │   ├── redis.js
│   │   ├── socket.js
│   │   └── webpush.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── conversationController.js
│   │   ├── messageController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── Conversation.js
│   │   ├── Message.js
│   │   ├── PushSubscription.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── conversationRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── testRoutes.js
│   │   ├── uploadRoutes.js
│   │   └── userRoutes.js
│   ├── sockets/
│   │   └── index.js
│   └── utils/
│       ├── generateToken.js
│       └── notificationHelper.js
├── uploads/
├── .env
├── server.js
├── package.json
└── README.md
```

---

## 📡 API Endpoints

All endpoints are prefixed with `/api`. Authentication via `Authorization: Bearer <token>` header.

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/register` | Register a new user | No |
| POST | `/login` | Login user | No |
| GET | `/profile` | Get current user profile | Yes |
| POST | `/logout` | Logout user | Yes |

### Users (`/api/users`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/profile` | Get user profile | Yes |
| PUT | `/profile` | Update profile (avatar) | Yes |
| GET | `/search` | Search users by username/email | Yes |
| POST | `/block/:id` | Block a user | Yes |
| POST | `/unblock/:id` | Unblock a user | Yes |
| GET | `/block-status/:id` | Get block status with user | Yes |
| POST | `/subscribe` | Save push subscription | Yes |

### Conversations (`/api/conversations`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/` | Get all conversations | Yes |
| POST | `/` | Create conversation (1:1 or group) | Yes |
| GET | `/:id` | Get conversation details | Yes |
| PUT | `/:id` | Update group info | Yes |
| DELETE | `/:id` | Delete conversation | Yes |
| POST | `/:id/participants` | Add participants | Yes |
| DELETE | `/:id/participants/:userId` | Remove participant | Yes |
| POST | `/:id/hide` | Hide conversation | Yes |
| POST | `/:id/unhide` | Unhide conversation | Yes |

### Messages (`/api/messages`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/conversations/:conversationId` | Get paginated messages | Yes |
| POST | `/` | Send a message (REST) | Yes |
| POST | `/read` | Mark messages as read | Yes |
| PUT | `/:id` | Edit a message | Yes |
| DELETE | `/:id` | Delete a message (soft) | Yes |
| POST | `/:id/reactions` | Add/remove reaction | Yes |
| GET | `/search` | Search messages | Yes |

### Uploads (`/api/upload`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/` | Upload a file (image/document) | Yes |

### Test (`/api/test`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/health` | Health check | No |

---

## 🔌 Socket.io Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-conversation` | `conversationId` | Join a conversation room |
| `leave-conversation` | `conversationId` | Leave conversation room |
| `typing-start` | `{ conversationId }` | User is typing |
| `typing-stop` | `{ conversationId }` | User stopped typing |
| `send-message` | `{ conversationId, content, type, mediaUrl }` | Send a new message |
| `edit-message` | `{ messageId, content }` | Edit a message |
| `delete-message` | `{ messageId }` | Soft delete a message |
| `add-reaction` | `{ messageId, emoji }` | Toggle reaction |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `new-message` | `Message` object | New message in conversation |
| `message-updated` | `Message` object | Message edited or deleted |
| `messages-read` | `{ userId, messageIds, conversationId }` | Messages marked as read |
| `user-typing` | `{ userId, username, conversationId }` | Typing indicator |
| `user-stopped-typing` | `{ userId, conversationId }` | Stop typing |
| `conversation-updated` | `Conversation` object | Conversation changed |
| `participant-added` | `{ conversationId, participants }` | New member added |
| `participant-removed` | `{ conversationId, userId }` | Member removed |
| `user-online` | `userId` | User came online |
| `user-offline` | `userId` | User went offline |
| `online-users` | `[userId]` | List of online users on connect |
| `error` | `{ message }` | Error message |

---

## 🚀 Deployment (Render)

1. Push code to GitHub
2. Create a new **Web Service** on Render, connect your repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all environment variables from your `.env`
6. Deploy

> ⚠️ Set `NODE_ENV=production`, ensure MongoDB Atlas URI is correct, and `CLIENT_URL` matches your frontend domain.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

<div align="center">Built with ❤️ by <a href="https://github.com/MuhammadShoaib20">Muhammad Shoaib</a></div>