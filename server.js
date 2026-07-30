const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { processFile } = require('./converter');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

const INPUT_DIR = path.join(__dirname, 'cr3_files');
const OUTPUT_DIR = path.join(__dirname, 'jpg_output');
fs.ensureDirSync(INPUT_DIR);
fs.ensureDirSync(OUTPUT_DIR);

app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(OUTPUT_DIR));

// ---------- НАСТРОЙКА MULTER (CR3 + JPG) ----------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, INPUT_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.cr3' || ext === '.jpg' || ext === '.jpeg') {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только CR3, JPG и JPEG'));
        }
    }
});

// ---------- API: СПИСОК С ПАГИНАЦИЕЙ ----------
app.get('/api/images', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const start = (page - 1) * limit;
    const end = start + limit;

    fs.readdir(OUTPUT_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const images = files
            .filter(f => /\.(jpg|jpeg)$/i.test(f))
            .map(f => ({
                name: f,
                url: `/images/${f}`,
                path: path.join(OUTPUT_DIR, f)
            }))
            .sort((a, b) => {
                const statA = fs.statSync(a.path);
                const statB = fs.statSync(b.path);
                return statB.birthtimeMs - statA.birthtimeMs;
            });

        const total = images.length;
        const paginated = images.slice(start, end);
        res.json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            images: paginated
        });
    });
});

// ---------- API: ЗАГРУЗКА (CR3 → конвертация, JPG → копирование) ----------
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
        let resultFile = null;
        if (ext === '.cr3') {
            resultFile = await processFile(filePath, OUTPUT_DIR);
        } else if (ext === '.jpg' || ext === '.jpeg') {
            const baseName = path.basename(req.file.originalname, ext);
            const newName = `${Date.now()}-${baseName}${ext}`;
            const destPath = path.join(OUTPUT_DIR, newName);
            await fs.copy(filePath, destPath);
            resultFile = destPath;
        } else {
            throw new Error('Неподдерживаемый формат');
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (resultFile && fs.existsSync(resultFile)) {
            res.json({ success: true, file: path.basename(resultFile) });
        } else {
            res.status(500).json({ error: 'Не удалось обработать файл' });
        }
    } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: err.message });
    }
});

// ---------- СКАЧИВАНИЕ ВСЕХ ----------
app.get('/api/download-all', (req, res) => {
    const archive = archiver('zip', { zlib: { level: 0 } });
    res.attachment('gallery.zip');
    archive.pipe(res);

    const files = fs.readdirSync(OUTPUT_DIR).filter(f => /\.(jpg|jpeg)$/i.test(f));
    for (const file of files) {
        archive.file(path.join(OUTPUT_DIR, file), { name: file });
    }
    archive.finalize();
});

// ---------- СКАЧИВАНИЕ ВЫБРАННЫХ ----------
app.post('/api/download-selected', express.json(), (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Не выбрано ни одного файла' });
    }

    const archive = archiver('zip', { zlib: { level: 0 } });
    res.attachment('selected_photos.zip');
    archive.pipe(res);

    for (const filename of files) {
        const filepath = path.join(OUTPUT_DIR, filename);
        if (fs.existsSync(filepath)) {
            archive.file(filepath, { name: filename });
        }
    }
    archive.finalize();
});

// ---------- УДАЛЕНИЕ ВЫБРАННЫХ ----------
app.delete('/api/images', express.json(), (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Не указаны файлы для удаления' });
    }

    const deleted = [];
    const errors = [];

    for (const filename of files) {
        const safeName = path.basename(filename);
        const filepath = path.join(OUTPUT_DIR, safeName);
        if (fs.existsSync(filepath)) {
            try {
                fs.unlinkSync(filepath);
                deleted.push(safeName);
            } catch (err) {
                errors.push({ file: safeName, error: err.message });
            }
        } else {
            errors.push({ file: safeName, error: 'Файл не найден' });
        }
    }
    res.json({ deleted, errors, totalDeleted: deleted.length, totalErrors: errors.length });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});