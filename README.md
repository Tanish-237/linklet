# 🔗 Linklet

<div align="center">
  <p><strong>The Exclusive Social & Academic Hub for MNNIT Students</strong></p>
</div>

---

## 🚀 Overview

**Linklet** is a modern, full-stack community platform built specifically for students of Motilal Nehru National Institute of Technology (MNNIT). It serves as a centralized hub for academic resources, peer-to-peer knowledge sharing, real-time communication, and community engagement. 

Designed with a premium glassmorphism UI, Linklet offers an intuitive and responsive experience across all devices.

## ✨ Key Features

- 🔐 **Exclusive Access:** Strict `@mnnit.ac.in` email verification ensures a trusted, student-only environment.
- 👤 **Customizable Profiles:** Personalize your presence with dynamic Avatars (curated DiceBear presets) or custom Cloudinary image uploads.
- 💬 **Real-time Chat:** Instant messaging and community chat rooms powered by Socket.io and Redis.
- 📚 **Resource Hub:** Share, discover, and download academic materials, study notes, and important documents.
- ❓ **Help Forum (Q&A):** Ask questions, share knowledge, and help peers overcome academic challenges.
- 📝 **Community Posts:** Share updates, achievements, and announcements with the entire college network.
- 🎮 **Entertainment:** Take a break with integrated games and video content.
- 🛡️ **Role-Based Access:** Dedicated management controls and permissions for Admins and standard Users.

## 🛠️ Technology Stack

Linklet is built using a modern, scalable JavaScript stack:

### Frontend (Client)
- **Framework:** React 19 + Vite
- **Styling:** TailwindCSS v4 & Custom CSS (Glassmorphism design)
- **State Management:** Zustand
- **Routing:** React Router v7
- **Data Visualization:** Chart.js
- **Real-time:** Socket.io-client

### Backend (Server)
- **Runtime:** Node.js + Express
- **Database:** MongoDB (with Mongoose ODM)
- **Caching & Scaling:** Redis (Socket.io Redis Adapter)
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **Media Storage:** Cloudinary & Multer
- **Security:** Helmet, Express Rate Limit, CORS

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB instance (local or Atlas)
- Redis server (for real-time scaling)
- Cloudinary Account (for image uploads)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shashankk007/linklet.git
   cd linklet
   ```

2. **Setup the Backend:**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` directory with the following variables:
   ```env
   PORT=5001
   MONGODB_URI=your_mongo_connection_string
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   # Add any other required Redis/SMTP credentials
   ```
   Start the backend development server:
   ```bash
   npm run dev
   ```

3. **Setup the Frontend:**
   ```bash
   cd ../frontend
   npm install
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

## 🤝 Contributing

Contributions are welcome! Whether it's reporting a bug, suggesting a feature, or submitting a Pull Request, your help is appreciated in making Linklet better for the MNNIT community.

1. Fork the project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and intended for use by the MNNIT student community.