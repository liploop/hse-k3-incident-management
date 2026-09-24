# 🛡️ HSE / K3 Incident Management System (RESTful API)

Backend RESTful API untuk Sistem Manajemen Pelaporan Insiden Keselamatan dan Kesehatan Kerja (K3 / HSE System) yang dirancang untuk membantu monitoring, inspeksi, dan penanganan insiden kerja secara otomatis.

---

## 🚀 Fitur Utama
- **Authentication & Authorization (RBAC)**: Autentikasi berbasis JWT dengan role (`ADMIN_K3`, `INSPECTOR`, `EMPLOYEE`).
- **Incident Reporting Module**: Penginputan dan manajemen status laporan insiden K3.
- **Database Query & Management**: Dirancang dengan arsitektur scalable dan efisiensi query.
- **Dockerized & Deployment Ready**: Dilengkapi dengan `Dockerfile` dan `docker-compose.yml` untuk integrasi CI/CD.

---

## 🛠️ Tech Stack & Dependencies
- **Runtime**: Node.js
- **Framework**: Express.js
- **Security**: JSON Web Token (JWT), bcrypt.js, CORS, RBAC Middleware
- **Containerization**: Docker, Docker Compose