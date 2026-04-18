# ⚙️ SyncChat – Backend

This is the backend for a real-time chat application built with the **MERN stack**. It provides RESTful APIs and WebSocket (Socket.io) services for authentication, messaging, group chats, file uploads, push notifications, and more.

---

## 🔗 Links

* 🚀 **Live Demo:**
  https://chat-app-frontend-gules-one.vercel.app/

* 🐙 **GitHub Repository:**
  https://github.com/MuhammadShoaib20/Chat-App-Backend

* 🖥️ **Backend API:**
  https://chat-app-backend-production-13f7.up.railway.app/api

---

## 🚀 Features

* 🔐 **User Authentication**
  → JWT-based login/register with bcrypt hashing

* ⚡ **Real-time Messaging**
  → Socket.io, typing indicators, read receipts

* 👥 **Group Chats**
  → Create/manage groups, assign admins

* 📁 **File Uploads**
  → Cloudinary support + local fallback

* 🔔 **Push Notifications (Optional)**
  → Web push with VAPID keys

* 💬 **Conversation Management**
  → List, hide, delete, search

* ✏️ **Message Actions**
  → Edit, delete, reactions

* 🚫 **Block/Unblock Users**

* 🚀 **Performance Optimization**
  → Redis caching (optional)

* 🛡️ **Security**
  → Helmet, CORS, validation, rate limiting

---

## 🛠️ Tech Stack

| Technology         | Purpose                 |
| ------------------ | ----------------------- |
| Node.js + Express  | Backend Framework       |
| MongoDB + Mongoose | Database + ODM          |
| Socket.io          | Real-time Communication |
| Redis              | Caching (optional)      |
| Cloudinary         | File Storage (optional) |
| JWT                | Authentication          |
| bcryptjs           | Password Hashing        |
| Multer             | File Uploads            |
| Web-Push           | Notifications           |
| Helmet + CORS      | Security                |
| Express Rate Limit | API Protection          |

---

## 📦 Prerequisites

* Node.js **v18+**
* MongoDB (Local / Atlas)
* Redis (optional)
* Cloudinary (optional)

---

## 🔧 Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/MuhammadShoaib20/Chat-App-Backend.git
cd Chat-App-Backend
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Environment Variables

Create `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=30d

# Frontend URL (CORS)
CLIENT_URL=http://localhost:5173,https://chat-app-frontend-gules-one.vercel.app

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Redis (optional)
REDIS_URL=

# Push Notifications (optional)
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### 📌 Notes

* If Cloudinary is not configured → files saved locally (`/uploads`)
* Redis is optional but recommended for scaling
* Use **MongoDB Atlas** for production
* `CLIENT_URL` must match frontend domain (CORS)

---

### 4️⃣ Run Services

* Start MongoDB → `mongod`
* Start Redis (if used) → `redis-server`

---

### 5️⃣ Run Server

```bash
npm run dev   # development
npm start     # production
```

👉 Server runs on: **http://localhost:5000**

---

## 🌍 Environment Variables

| Variable     | Description               | Required |
| ------------ | ------------------------- | -------- |
| PORT         | Server port               | ❌ No     |
| NODE_ENV     | Environment               | ❌ No     |
| MONGO_URI    | MongoDB connection string | ✅ Yes    |
| JWT_SECRET   | JWT signing key           | ✅ Yes    |
| JWT_EXPIRE   | Token expiry              | ❌ No     |
| CLIENT_URL   | Frontend URL(s) for CORS  | ✅ Yes    |
| CLOUDINARY_* | Cloudinary credentials    | ❌ No     |
| REDIS_URL    | Redis connection          | ❌ No     |
| VAPID_*      | Push notification keys    | ❌ No     |

---

## 📁 Project Structure

```bash
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   └── utils/
├── uploads/
├── .env
├── server.js
└── package.json
```

---

## 📡 API Overview

### 🔐 Auth (`/api/auth`)

| Method | Endpoint  | Description   |
| ------ | --------- | ------------- |
| POST   | /register | Register user |
| POST   | /login    | Login user    |
| GET    | /profile  | Get profile   |
| POST   | /logout   | Logout        |

---

### 👤 Users (`/api/users`)

* Profile management
* Search users
* Block / Unblock
* Push subscription

---

### 💬 Conversations (`/api/conversations`)

* Create chat / group
* Manage participants
* Hide / delete

---

### 📨 Messages (`/api/messages`)

* Send / edit / delete
* Reactions
* Search messages

---

### 📁 Upload (`/api/upload`)

* Upload images/documents

---

### ❤️ Health Check (`/api/test`)

* `GET /health`

---

## 🔌 Socket.io Events

### 📤 Client → Server

* join-conversation
* leave-conversation
* typing-start / stop
* send-message
* edit-message
* delete-message
* add-reaction

### 📥 Server → Client

* new-message
* message-updated
* messages-read
* user-typing
* user-stopped-typing
* conversation-updated
* user-online / offline
* online-users

---

## 🚀 Deployment (Railway)

### Steps:

1. Push code to GitHub
2. Create Web Service on Railway
3. Build command → `npm install`
4. Start command → `npm start`
5. Add environment variables
6. Deploy

⚠️ **Important:**

* Set `NODE_ENV=production`
* Use MongoDB Atlas
* Ensure `CLIENT_URL` is correct

---

## 🤝 Contributing

Contributions are welcome!

* Open an issue
* Submit a PR
* Discuss major changes first

---

## 📄 License

MIT License

---

<div align="center">

❤️ Built with passion by
**Muhammad Shoaib**

</div>
