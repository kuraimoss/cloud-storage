const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const os = require('os');
const crypto = require('crypto');
const morgan = require('morgan');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 2996;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan('combined'));

// Pastikan direktori uploads ada
const uploadDir = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Created uploads directory');
    }
} catch (err) {
    console.error('Error creating uploads directory:', err);
    process.exit(1);
}

// Path untuk file JSON
const fileOwnershipPath = path.join(__dirname, 'fileOwnership.json');
const sharedFilesPath = path.join(__dirname, 'sharedFiles.json');

// Inisialisasi fileOwnership dan sharedFiles
let fileOwnership = [];
let sharedFiles = [];

// Fungsi untuk membaca data dari file JSON
function loadDataFromFile() {
    try {
        if (fs.existsSync(fileOwnershipPath)) {
            const data = fs.readFileSync(fileOwnershipPath, 'utf8');
            fileOwnership = JSON.parse(data);
        } else {
            fileOwnership = [];
            fs.writeFileSync(fileOwnershipPath, JSON.stringify(fileOwnership, null, 2));
        }

        if (fs.existsSync(sharedFilesPath)) {
            const data = fs.readFileSync(sharedFilesPath, 'utf8');
            sharedFiles = JSON.parse(data);
        } else {
            sharedFiles = [];
            fs.writeFileSync(sharedFilesPath, JSON.stringify(sharedFiles, null, 2));
        }
    } catch (err) {
        console.error('Error loading data from JSON files:', err);
        fileOwnership = [];
        sharedFiles = [];
    }
}

// Fungsi untuk menyimpan data ke file JSON
function saveDataToFile() {
    try {
        fs.writeFileSync(fileOwnershipPath, JSON.stringify(fileOwnership, null, 2));
        fs.writeFileSync(sharedFilesPath, JSON.stringify(sharedFiles, null, 2));
    } catch (err) {
        console.error('Error saving data to JSON files:', err);
    }
}

// Load data saat server dimulai
loadDataFromFile();

// Multer setup untuk upload file
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const filename = file.originalname;
        cb(null, filename);
    }
});
const upload = multer({
    storage: storage,
}).array('file');

// Route publik untuk testing
app.get('/test-public', (req, res) => {
    res.send('This is a public test route');
});

// Route untuk mengakses file dengan pengecekan izin (bisa diakses tanpa login jika ada token)
app.get('/file-access/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    const token = req.query.token;
    const currentUser = req.cookies.username || 'unknown';

    console.log(`Request for file: ${filename}`);
    console.log(`Token provided: ${token}`);
    console.log(`File exists: ${fs.existsSync(filePath)}`);
    console.log(`Shared files: ${JSON.stringify(sharedFiles)}`);

    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    const ownership = fileOwnership.find(f => f.filename === filename);
    if (ownership && ownership.owner === currentUser && req.cookies.userToken) {
        console.log(`Access granted to owner: ${currentUser}`);
        return res.sendFile(filePath);
    }

    const sharedFile = sharedFiles.find(f => f.filename === filename && f.token === token && f.isShared);
    if (sharedFile) {
        console.log(`Access granted via token: ${token}`);
        return res.sendFile(filePath);
    }

    console.log(`Access denied: Invalid token or not shared`);
    res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

// Middleware untuk autentikasi
function authMiddleware(req, res, next) {
    if (!req.cookies.userToken) {
        return res.redirect('/home');
    }
    next();
}

// Middleware untuk mencegah akses ke halaman login/home saat sudah login
function preventLoggedInAccess(req, res, next) {
    if (req.cookies.userToken) {
        return res.redirect('/');
    }
    next();
}

// Middleware untuk membatasi akses hanya ke /home dan /login saat belum login
function restrictUnloggedAccess(req, res, next) {
    if (!req.cookies.userToken) {
        const allowedPaths = ['/home', '/login'];
        if (!allowedPaths.includes(req.path)) {
            return res.redirect('/home');
        }
    }
    next();
}

// Terapkan middleware setelah route publik
app.use(restrictUnloggedAccess);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Route untuk halaman home (hanya bisa diakses saat belum login)
app.get('/home', preventLoggedInAccess, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route untuk login
const loginRoute = require('./Routes/login');
app.use('/', loginRoute);

// Route untuk halaman login (hanya bisa diakses saat belum login)
app.get('/login', preventLoggedInAccess, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route untuk logout
app.get('/logout', (req, res) => {
    res.clearCookie('userToken');
    res.clearCookie('username');
    res.redirect('/home');
});

// Route untuk halaman utama (memerlukan autentikasi)
app.get('/', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Menangani halaman dinamis (memerlukan autentikasi)
app.get('/:page', authMiddleware, (req, res) => {
    const page = req.params.page;
    const validPages = ['dashboard', 'upload', 'files'];

    if (validPages.includes(page)) {
        res.sendFile(path.join(__dirname, 'public', `${page}.html`));
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }
});

// Route untuk memeriksa konflik nama file sebelum upload
app.post('/check-file-conflict', authMiddleware, (req, res) => {
    const { filenames } = req.body;
    const conflicts = [];

    filenames.forEach(filename => {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
            conflicts.push(filename);
        }
    });

    res.json({ conflicts });
});

// Route upload file
app.post('/upload', authMiddleware, (req, res, next) => {
    upload(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'Failed to upload files: ' + err.message });
        }

        const { action, applyToAll } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        files.forEach(file => {
            fileOwnership.push({ filename: file.filename, owner: req.cookies.username || 'unknown' });
        });
        saveDataToFile();

        res.json({ message: 'Files uploaded successfully!' });
    });
});

// Route untuk menangani konflik file
app.post('/handle-conflict', authMiddleware, (req, res) => {
    const { filename, action } = req.body;
    const filePath = path.join(uploadDir, filename);

    if (action === 'cancel') {
        res.json({ status: 'cancelled' });
        return;
    }

    if (action === 'overwrite') {
        res.json({ status: 'overwrite' });
        return;
    }

    if (action === 'copy') {
        let newFilename = filename;
        let counter = 1;
        const ext = path.extname(filename);
        const basename = path.basename(filename, ext);

        while (fs.existsSync(path.join(uploadDir, newFilename))) {
            newFilename = `${basename}_${counter}${ext}`;
            counter++;
        }

        res.json({ newFilename });
        return;
    }

    res.status(400).json({ error: 'Invalid action' });
});

// Route untuk mendapatkan daftar file (API untuk halaman My Files)
app.get('/api/files', authMiddleware, (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('Error reading uploads directory:', err);
            return res.status(500).json({ error: 'Unable to fetch files' });
        }

        const currentUser = req.cookies.username || 'unknown';
        let totalSize = 0;
        const fileDetails = files
            .filter(file => {
                const ownership = fileOwnership.find(f => f.filename === file);
                return ownership && ownership.owner === currentUser;
            })
            .map(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                const sharedFile = sharedFiles.find(f => f.filename === file);
                const isShared = sharedFile ? sharedFile.isShared : false;
                return {
                    name: file,
                    size: stats.size,
                    sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    uploaded: stats.birthtime.toISOString().split('T')[0],
                    url: `/file-access/${file}`,
                    isShared: isShared
                };
            });

        const usedStorage = (totalSize / 1024 / 1024).toFixed(2);
        const maxStorage = 50;
        const storageUsage = `${usedStorage} MB of ${maxStorage} MB used`;

        res.json({ files: fileDetails, storageUsage });
    });
});

// Route untuk mendapatkan informasi storage (untuk Dashboard)
app.get('/api/storage', authMiddleware, (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('Error reading uploads directory:', err);
            return res.status(500).json({ error: 'Unable to fetch storage info' });
        }

        const currentUser = req.cookies.username || 'unknown';
        let totalSize = 0;
        const fileDetails = files
            .filter(file => {
                const ownership = fileOwnership.find(f => f.filename === file);
                return ownership && ownership.owner === currentUser;
            })
            .map(file => {
                const stats = fs.statSync(path.join(uploadDir, file));
                totalSize += stats.size;
                return {
                    name: file,
                    size: stats.size,
                    uploaded: stats.birthtime.toISOString()
                };
            });

        const totalStorage = os.totalmem() / 1024 / 1024;
        const usedStorage = (totalSize / 1024 / 1024).toFixed(2);
        const storageUsage = `${usedStorage} MB of ${totalStorage.toFixed(2)} MB used`;
        const totalFiles = fileDetails.length;
        const sharedFilesCount = sharedFiles.filter(f => {
            const ownership = fileOwnership.find(o => o.filename === f.filename);
            return ownership && ownership.owner === currentUser && f.isShared;
        }).length;
        const recentFiles = fileDetails
            .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
            .slice(0, 3);
        const lastUpload = recentFiles.length > 0 ? new Date(recentFiles[0].uploaded) : null;
        const lastUploadTime = lastUpload ? getTimeDifference(lastUpload) : 'N/A';
        const username = req.cookies.username || 'Guest';

        res.json({
            username: username,
            totalFiles,
            sharedFiles: sharedFilesCount,
            usedStorage: parseFloat(usedStorage),
            maxStorage: totalStorage,
            storageUsage,
            recentFiles,
            lastUpload: lastUploadTime
        });
    });
});

// Fungsi untuk menghitung selisih waktu
function getTimeDifference(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Route untuk download file
app.get('/download/:filename', authMiddleware, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    const currentUser = req.cookies.username || 'unknown';

    if (!fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    const ownership = fileOwnership.find(f => f.filename === filename);
    if (ownership && ownership.owner === currentUser) {
        return res.download(filePath);
    }

    res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

// Route untuk menghapus file
app.delete('/delete/:filename', authMiddleware, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    const currentUser = req.cookies.username || 'unknown';

    if (!fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    const ownership = fileOwnership.find(f => f.filename === filename);
    if (ownership && ownership.owner === currentUser) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return res.status(500).json({ error: 'Unable to delete file' });
            }
            fileOwnership = fileOwnership.filter(f => f.filename !== filename);
            sharedFiles = sharedFiles.filter(f => f.filename !== filename);
            saveDataToFile();
            res.json({ message: 'File deleted successfully' });
        });
    } else {
        res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }
});

// Route untuk mengelola share file (on/off)
app.post('/share/:filename', authMiddleware, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    const currentUser = req.cookies.username || 'unknown';
    const { enable } = req.body;

    if (!fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    const ownership = fileOwnership.find(f => f.filename === filename);
    if (!ownership || ownership.owner !== currentUser) {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    let sharedFile = sharedFiles.find(f => f.filename === filename);
    if (!sharedFile) {
        const token = crypto.randomBytes(16).toString('hex');
        sharedFile = { filename, token, isShared: false };
        sharedFiles.push(sharedFile);
        saveDataToFile();
    }

    sharedFile.isShared = enable;
    saveDataToFile();

    if (enable) {
        const host = req.headers.host || HOST;
        const isIp = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host);
        const protocol = isIp ? 'http' : 'https';
        const shareLink = `${protocol}://${host}/file-access/${filename}?token=${sharedFile.token}`;
        res.json({ shareLink, isShared: true });
    } else {
        res.json({ shareLink: null, isShared: false });
    }
});

// Route untuk rename file
app.post('/rename', authMiddleware, (req, res) => {
    const { oldName, newName } = req.body;
    const currentUser = req.cookies.username || 'unknown';

    if (!oldName || !newName) {
        return res.status(400).json({ error: 'Old name and new name are required' });
    }

    const invalidChars = /[<>:"\/\\|?*]/;
    if (invalidChars.test(newName)) {
        return res.status(400).json({ error: 'New name contains invalid characters' });
    }

    const oldFilePath = path.join(uploadDir, oldName);
    const newFilePath = path.join(uploadDir, newName);

    if (!fs.existsSync(oldFilePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    const ownership = fileOwnership.find(f => f.filename === oldName);
    if (!ownership || ownership.owner !== currentUser) {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
    }

    if (fs.existsSync(newFilePath)) {
        return res.status(400).json({ error: 'A file with the new name already exists' });
    }

    fs.rename(oldFilePath, newFilePath, (err) => {
        if (err) {
            console.error('Error renaming file:', err);
            return res.status(500).json({ error: 'Unable to rename file' });
        }
        const ownershipIndex = fileOwnership.findIndex(f => f.filename === oldName);
        if (ownershipIndex !== -1) {
            fileOwnership[ownershipIndex].filename = newName;
        }
        const sharedIndex = sharedFiles.findIndex(f => f.filename === oldName);
        if (sharedIndex !== -1) {
            sharedFiles[sharedIndex].filename = newName;
        }
        saveDataToFile();
        res.json({ message: 'File renamed successfully' });
    });
});

// Error handling middleware untuk route yang tidak ditemukan
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

// Error handling middleware untuk server error
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

// Graceful shutdown
function shutdown() {
    console.log('Shutting down server...');
    saveDataToFile();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Jalankan server (HTTP biasa)
app.listen(PORT, HOST, () => {
    console.log(`Aplikasi berjalan pada http://${HOST}:${PORT}`);
});

// Opsional: Jalankan dengan HTTPS
// const sslOptions = {
//     key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
//     cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
// };

// https.createServer(sslOptions, app).listen(PORT, HOST, () => {
//     console.log(`Aplikasi berjalan pada https://${HOST}:${PORT}`);
// });