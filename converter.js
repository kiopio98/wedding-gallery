const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

// Конфигурация (можно менять)
const QUALITY = 92;
const RESIZE = null;
const KEEP_TEMP = false;

// Проверка инструментов (один раз при загрузке модуля)
function checkTool(name, command) {
    try {
        // Просто пытаемся вызвать команду с параметром -ver
        // Это работает и на Windows, и на Linux/macOS
        execSync(`${command} -ver`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const hasExifTool = checkTool('ExifTool', 'exiftool');
const hasMagick = checkTool('ImageMagick', 'magick');

if (!hasExifTool) {
    console.error('❌ ExifTool не установлен! Установите: https://exiftool.org/');
    process.exit(1);
}
if (!hasMagick) {
    console.warn('⚠️ ImageMagick не найден – сжатие/ресайз недоступны.');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function processFile(cr3Path, outputDir) {
    ensureDir(outputDir);

    const baseName = path.basename(cr3Path, '.cr3');
    const tempJpg = path.join(outputDir, `${baseName}.temp.jpg`);
    const finalJpg = path.join(outputDir, `${baseName}.jpg`);

    console.log(`📸 Обработка: ${path.basename(cr3Path)}`);

    // 1. Извлечение встроенного JPEG через exiftool (с перенаправлением через shell)
    try {
        await new Promise((resolve, reject) => {
            exec(`exiftool -b -JpgFromRaw "${cr3Path}" > "${tempJpg}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve();
            });
        });
    } catch (err) {
        console.error(`  ❌ Ошибка извлечения JPG: ${err.message}`);
        return null;
    }

    // 2. (Опционально) обработка через ImageMagick
    if (hasMagick && (QUALITY || RESIZE)) {
        try {
            const args = [tempJpg];
            if (RESIZE) args.push('-resize', RESIZE);
            if (QUALITY) args.push('-quality', String(QUALITY));
            args.push(finalJpg);
            await new Promise((resolve, reject) => {
                exec(`magick ${args.join(' ')}`, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            if (!KEEP_TEMP && fs.existsSync(tempJpg)) fs.unlinkSync(tempJpg);
        } catch (err) {
            console.error(`  ❌ Ошибка ImageMagick: ${err.message}`);
            if (fs.existsSync(tempJpg)) {
                fs.renameSync(tempJpg, finalJpg);
            }
        }
    } else {
        // Просто переименовываем
        if (fs.existsSync(tempJpg)) {
            fs.renameSync(tempJpg, finalJpg);
        }
    }

    // 3. Копирование метаданных из CR3 в итоговый JPG
    if (fs.existsSync(finalJpg)) {
        try {
            await new Promise((resolve, reject) => {
                exec(`exiftool -TagsFromFile "${cr3Path}" -all:all --overwrite_original "${finalJpg}"`, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            console.log(`  ✅ Успешно: ${path.basename(finalJpg)}`);
            return finalJpg;
        } catch (err) {
            console.error(`  ⚠️ Не удалось скопировать метаданные: ${err.message}`);
            return finalJpg; // всё равно возвращаем файл
        }
    } else {
        console.error(`  ❌ Финальный JPG не создан`);
        return null;
    }
}

module.exports = { processFile };