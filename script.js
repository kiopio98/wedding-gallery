const gallery = document.getElementById('gallery');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const fileCount = document.getElementById('fileCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');

let allImages = [];         // массив имён файлов
let currentPage = 1;
const limit = 24;
let totalPages = 0;
let isLoading = false;

// ---------- ЗАГРУЗКА СПИСКА ИЗ JSON ----------
async function loadImageList() {
    try {
        const response = await fetch('images.json');
        if (!response.ok) throw new Error('Не удалось загрузить images.json');
        allImages = await response.json();
        if (!Array.isArray(allImages) || allImages.length === 0) {
            fileCount.textContent = '❌ Нет изображений';
            return;
        }
        fileCount.textContent = `📸 ${allImages.length} фото`;
        currentPage = 1;
        renderGallery();
    } catch (err) {
        console.error(err);
        fileCount.textContent = '❌ Ошибка загрузки списка';
        gallery.innerHTML = '<div class="empty">Не удалось загрузить список фото. Проверьте файл images.json</div>';
    }
}

// ---------- ОТРИСОВКА ГАЛЕРЕИ ----------
function renderGallery() {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Загрузка...';

    totalPages = Math.ceil(allImages.length / limit);
    const start = (currentPage - 1) * limit;
    const end = Math.min(start + limit, allImages.length);
    const pageFiles = allImages.slice(start, end);

    if (currentPage === 1) {
        gallery.innerHTML = '';
    }

    if (allImages.length === 0) {
        gallery.innerHTML = '<div class="empty">Фотографии не найдены</div>';
        loadMoreBtn.style.display = 'none';
        isLoading = false;
        return;
    }

    pageFiles.forEach(filename => {
        const card = document.createElement('div');
        card.className = 'card';

        // Ссылка на полноразмерное фото (для лайтбокса)
        const link = document.createElement('a');
        link.href = filename;
        link.className = 'lightbox-link';
        link.target = '_blank';

        const img = document.createElement('img');
        img.src = filename;
        img.alt = filename;
        img.loading = 'lazy';

        link.appendChild(img);
        card.appendChild(link);

        // Кнопка скачивания отдельного фото
        const downloadBtn = document.createElement('a');
        downloadBtn.href = filename;
        downloadBtn.download = filename;
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = '⬇️';
        downloadBtn.title = 'Скачать фото';
        card.appendChild(downloadBtn);

        gallery.appendChild(card);
    });

    // Кнопка "Показать ещё"
    if (currentPage < totalPages) {
        loadMoreBtn.style.display = 'inline-block';
        loadMoreBtn.textContent = 'Показать ещё';
        loadMoreBtn.disabled = false;
    } else {
        loadMoreBtn.style.display = 'none';
    }

    isLoading = false;
}

// ---------- ПАГИНАЦИЯ ----------
loadMoreBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderGallery();
    }
});

// ---------- ЛАЙТБОКС ----------
document.addEventListener('click', (e) => {
    const link = e.target.closest('.lightbox-link');
    if (link) {
        e.preventDefault();
        const modal = document.getElementById('lightboxModal');
        const img = document.getElementById('lightboxImg');
        img.src = link.href;
        modal.style.display = 'flex';
    }
});

document.querySelector('.close-lightbox')?.addEventListener('click', () => {
    document.getElementById('lightboxModal').style.display = 'none';
});

document.getElementById('lightboxModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// ---------- СКАЧИВАНИЕ ВСЕХ ФОТО (ZIP) ----------
downloadAllBtn.addEventListener('click', async () => {
    if (allImages.length === 0) {
        alert('Нет фотографий для скачивания');
        return;
    }

    try {
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = '⏳ Создаём архив...';

        const zip = new JSZip();
        const folder = zip.folder('gallery');

        // Загружаем все изображения и добавляем в архив
        const fetchPromises = allImages.map(async (filename) => {
            const response = await fetch(filename);
            if (!response.ok) throw new Error(`Не удалось загрузить ${filename}`);
            const blob = await response.blob();
            folder.file(filename, blob);
        });

        await Promise.all(fetchPromises);

        // Генерируем zip и скачиваем
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'gallery.zip');

        downloadAllBtn.textContent = '📦 Скачать все';
        downloadAllBtn.disabled = false;
    } catch (err) {
        console.error(err);
        alert('Ошибка при создании архива: ' + err.message);
        downloadAllBtn.textContent = '📦 Скачать все';
        downloadAllBtn.disabled = false;
    }
});

// ---------- АНИМАЦИИ ПРИ СКРОЛЛЕ ----------
document.addEventListener('DOMContentLoaded', () => {
    const els = document.querySelectorAll('.gallery-grid .card, .hero-heading, .hero-sub');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.style.transition = 'opacity 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        observer.observe(el);
    });

    // Загружаем список фото
    loadImageList();
});
