const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// Setup express app
const app = express();
const PORT = 2996;

// Middleware untuk parsing request body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Set storage engine menggunakan multer untuk menyimpan file yang di-upload
const storage = multer.diskStorage({
  destination: './uploads/', // Menyimpan file di folder uploads
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Menyimpan dengan nama unik
  }
});

// Initialize multer untuk upload file
const upload = multer({ storage: storage });

// Middleware untuk autentikasi (memeriksa apakah user sudah login)
function authMiddleware(req, res, next) {
  if (!req.cookies.userToken) {
    return res.redirect('/login');
  }
  next();
}

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Halaman Login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Halaman Dashboard
app.get('/dashboard', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Halaman Home
app.get('/', (req, res) => {
  if (!req.cookies.userToken) {
    return res.sendFile(path.join(__dirname, 'public', 'home.html'));
  }
  return res.redirect('/dashboard');
});

// Route untuk logout
app.get('/logout', (req, res) => {
  res.clearCookie('userToken');
  res.redirect('/login');
});

// Route untuk upload file
app.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  res.send('File uploaded successfully!');
});

// Route untuk menampilkan file yang di-upload
app.get('/files', authMiddleware, (req, res) => {
  fs.readdir('./uploads/', (err, files) => {
    if (err) {
      return res.status(500).send('Unable to fetch files');
    }
    res.json(files);  // Mengirim daftar file yang ada di folder uploads
  });
});

// Route untuk download file
app.get('/download/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);  // Mengunduh file
  } else {
    res.status(404).send('File not found');
  }
});

// Route untuk menghapus file
app.get('/delete/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).send('Unable to delete file');
      }
      res.send('File deleted successfully');
    });
  } else {
    res.status(404).send('File not found');
  }
});

// Mulai server di port 2996
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
