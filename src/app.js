const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Datastore = require('nedb-promises');

const app = express();
// Menggunakan Port 5001 agar aman jika Port 5000 terkunci oleh Windows
const PORT = process.env.PORT || 5001;
const JWT_SECRET = 'k3_fokus_jasa_mitra_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. EMBEDDED DATABASE (nedb-promises)
// ==========================================
// File database tersimpan otomatis di folder './data/'
const usersDb = Datastore.create({ filename: './data/users.db', autoload: true });
const incidentsDb = Datastore.create({ filename: './data/incidents.db', autoload: true });

// Auto Seed User Admin Default
(async () => {
  try {
    const admin = await usersDb.findOne({ username: 'admin' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await usersDb.insert({ 
        username: 'admin', 
        password: hashedPassword, 
        role: 'ADMIN_K3' 
      });
      console.log('👤 Akun Admin Default Dibuat: [admin] / [admin123]');
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
})();

// ==========================================
// 2. JWT MIDDLEWARE AUTHENTICATION
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Akses Ditolak: Silakan Login Terlebih Dahulu' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token Kadaluwarsa atau Tidak Valid' });
    req.user = user;
    next();
  });
};

// ==========================================
// 3. API ENDPOINTS (BACKEND)
// ==========================================

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username & Password wajib diisi' });

  try {
    const existingUser = await usersDb.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username sudah digunakan!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'ADMIN_K3' ? 'ADMIN_K3' : 'EMPLOYEE';

    await usersDb.insert({ username, password: hashedPassword, role: userRole });
    res.status(201).json({ message: 'Registrasi Berhasil! Silakan Login.' });
  } catch (error) {
    res.status(500).json({ message: 'Error Server' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await usersDb.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Username atau Password Salah' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Username atau Password Salah' });

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Error Server' });
  }
});

// Get Incidents
app.get('/api/incidents', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'EMPLOYEE') {
      query = { reported_by: req.user.username };
    }
    const incidents = await incidentsDb.find(query).sort({ createdAt: -1 });
    res.json({ count: incidents.length, data: incidents, currentUser: req.user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Incident
app.post('/api/incidents', authenticateToken, async (req, res) => {
  const { title, location, severity, description } = req.body;
  try {
    const newIncident = await incidentsDb.insert({
      title,
      location,
      severity: severity || 'MEDIUM',
      status: 'OPEN',
      description,
      reported_by: req.user.username,
      createdAt: new Date().toLocaleString('id-ID')
    });
    res.status(201).json({ message: 'Laporan Insiden Berhasil Dibuat', data: newIncident });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Status (Khusus Admin K3)
app.patch('/api/incidents/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'ADMIN_K3') {
    return res.status(403).json({ message: 'Hanya Admin K3 yang dapat merubah status laporan!' });
  }
  const { status } = req.body;
  try {
    await incidentsDb.update({ _id: req.params.id }, { $set: { status } });
    res.json({ message: 'Status laporan berhasil diperbarui' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. FRONT-END INTERFACE (HTML + TAILWIND)
// ==========================================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K3 Incident Management System (NoSQL Embedded)</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800 font-sans min-h-screen">

  <nav class="bg-blue-900 text-white px-8 py-4 flex justify-between items-center shadow-md">
    <div>
      <h1 class="text-xl font-bold">🛡️ K3 incident Management System</h1>
      <p class="text-xs text-blue-200">PT QWERTY</p>
    </div>
    <div id="userNav" class="hidden flex items-center gap-4">
      <span id="userInfo" class="text-xs bg-blue-800 px-3 py-1 rounded-full border border-blue-600"></span>
      <button onclick="logout()" class="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition">Logout</button>
    </div>
  </nav>

  <div class="max-w-5xl mx-auto my-8 px-4">
    
    <div id="authSection" class="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <div class="flex border-b mb-4">
        <button id="tabLoginBtn" onclick="switchAuthTab('login')" class="w-1/2 py-2 font-bold border-b-2 border-blue-600 text-blue-600">Login</button>
        <button id="tabRegBtn" onclick="switchAuthTab('register')" class="w-1/2 py-2 font-bold text-slate-400">Register</button>
      </div>

      <form id="loginForm" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold uppercase text-slate-600">Username</label>
          <input type="text" id="loginUsername" required class="w-full border p-2 text-sm rounded outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-slate-600">Password</label>
          <input type="password" id="loginPassword" required class="w-full border p-2 text-sm rounded outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Masuk</button>
        <p class="text-xs text-slate-500 text-center mt-2">Akun Admin Default: <b>admin</b> | Password: <b>admin123</b></p>
      </form>

      <form id="registerForm" class="space-y-4 hidden">
        <div>
          <label class="block text-xs font-semibold uppercase text-slate-600">Username Baru</label>
          <input type="text" id="regUsername" required class="w-full border p-2 text-sm rounded outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-slate-600">Password</label>
          <input type="password" id="regPassword" required class="w-full border p-2 text-sm rounded outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-slate-600">Daftar Sebagai Role</label>
          <select id="regRole" class="w-full border p-2 text-sm rounded outline-none">
            <option value="EMPLOYEE">Karyawan / Employee</option>
            <option value="ADMIN_K3">Admin / Petugas K3</option>
          </select>
        </div>
        <button type="submit" class="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Daftar Akun</button>
      </form>
    </div>

    <div id="dashboardSection" class="hidden grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-5 rounded-xl shadow border border-slate-200 md:col-span-1">
        <h2 class="font-bold text-slate-800 mb-3 border-b pb-2">+ Buat Laporan K3</h2>
        <form id="incidentForm" class="space-y-3">
          <div>
            <label class="text-xs font-semibold text-slate-600">Judul Insiden</label>
            <input type="text" id="title" required class="w-full border p-2 text-sm rounded">
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600">Lokasi</label>
            <input type="text" id="location" required class="w-full border p-2 text-sm rounded">
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600">Tingkat Bahaya</label>
            <select id="severity" class="w-full border p-2 text-sm rounded">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600">Deskripsi</label>
            <textarea id="description" rows="2" required class="w-full border p-2 text-sm rounded"></textarea>
          </div>
          <button type="submit" class="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Kirim Laporan</button>
        </form>
      </div>

      <div class="bg-white p-5 rounded-xl shadow border border-slate-200 md:col-span-2">
        <h2 class="font-bold text-slate-800 mb-3 border-b pb-2">📋 Database Laporan K3</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-100 text-xs text-slate-600 uppercase">
              <tr>
                <th class="p-2">Judul & Lokasi</th>
                <th class="p-2">Pelapor</th>
                <th class="p-2">Severity</th>
                <th class="p-2">Status & Aksi</th>
              </tr>
            </thead>
            <tbody id="incidentTable" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

  <script>
    let token = localStorage.getItem('k3_token');

    function switchAuthTab(tab) {
      if(tab === 'login') {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('tabLoginBtn').className = "w-1/2 py-2 font-bold border-b-2 border-blue-600 text-blue-600";
        document.getElementById('tabRegBtn').className = "w-1/2 py-2 font-bold text-slate-400";
      } else {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('tabRegBtn').className = "w-1/2 py-2 font-bold border-b-2 border-green-600 text-green-600";
        document.getElementById('tabLoginBtn').className = "w-1/2 py-2 font-bold text-slate-400";
      }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('loginUsername').value,
          password: document.getElementById('loginPassword').value
        })
      });
      const data = await res.json();
      if(res.ok) {
        localStorage.setItem('k3_token', data.token);
        token = data.token;
        initDashboard();
      } else {
        alert(data.message);
      }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('regUsername').value,
          password: document.getElementById('regPassword').value,
          role: document.getElementById('regRole').value
        })
      });
      const data = await res.json();
      alert(data.message);
      if(res.ok) switchAuthTab('login');
    });

    function logout() {
      localStorage.removeItem('k3_token');
      location.reload();
    }

    async function initDashboard() {
      if(!token) return;

      const res = await fetch('/api/incidents', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if(!res.ok) {
        logout();
        return;
      }

      const { data, currentUser } = await res.json();

      document.getElementById('authSection').classList.add('hidden');
      document.getElementById('dashboardSection').classList.remove('hidden');
      document.getElementById('userNav').classList.remove('hidden');
      document.getElementById('userInfo').innerText = currentUser.username + ' (' + currentUser.role + ')';

      const tbody = document.getElementById('incidentTable');
      tbody.innerHTML = data.map(item => {
        let actionBtn = \`<span class="px-2 py-1 text-xs rounded font-bold \${item.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}">\${item.status}</span>\`;
        
        if(currentUser.role === 'ADMIN_K3' && item.status === 'OPEN') {
          actionBtn = \`<button onclick="updateStatus('\${item._id}', 'RESOLVED')" class="bg-emerald-600 text-white text-xs px-2 py-1 rounded hover:bg-emerald-700">Tandai Selesai</button>\`;
        }

        return \`<tr class="hover:bg-slate-50">
          <td class="p-2"><b>\${item.title}</b><div class="text-xs text-slate-500">📍 \${item.location} - \${item.createdAt}</div></td>
          <td class="p-2 text-xs font-semibold">\${item.reported_by}</td>
          <td class="p-2 text-xs font-bold">\${item.severity}</td>
          <td class="p-2 text-xs">\${actionBtn}</td>
        </tr>\`;
      }).join('');
    }

    document.getElementById('incidentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          title: document.getElementById('title').value,
          location: document.getElementById('location').value,
          severity: document.getElementById('severity').value,
          description: document.getElementById('description').value,
        })
      });
      document.getElementById('incidentForm').reset();
      initDashboard();
    });

    async function updateStatus(id, status) {
      await fetch('/api/incidents/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ status })
      });
      initDashboard();
    }

    initDashboard();
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan mulus tanpa error binding di http://localhost:${PORT}`);
});