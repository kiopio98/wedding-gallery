const gallery = document.getElementById('gallery');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const selectToggleBtn = document.getElementById('selectToggleBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

let currentPage = 1;
const limit = 24;
let totalPages = 0;
let isLoading = false;
let isSelectMode = false;

loadGallery(1);

// ---------- ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ВЫБОРА ----------
selectToggleBtn.addEventListener('click', () => {
    isSelectMode = !isSelectMode;
    document.querySelectorAll('.card').forEach(card => {
        card.classList.toggle('in-select-mode', isSelectMode);
    });
    downloadSelectedBtn.style.display = isSelectMode ? 'inline-block' : 'none';
    deleteSelectedBtn.style.display = isSelectMode ? 'inline-block' : 'none';
    selectToggleBtn.classList.toggle('active', isSelectMode);
    selectToggleBtn.textContent = isSelectMode ? 'Отменить выбор' : 'Выбрать фотографии';
});

// ---------- ЗАГРУЗКА ГАЛЕРЕИ ----------
async function loadGallery(page) {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Загрузка...';

    try {
        const res = await fetch(`/api/images?page=${page}&limit=${limit}`);
        const data = await res.json();

        totalPages = data.totalPages;
        currentPage = data.page;

        if (page === 1) {
            gallery.innerHTML = '';
        }

        if (data.images.length === 0) {
            if (page === 1) {
                gallery.innerHTML = '<div class="empty">Пока нет изображений. Загрузите CR3 или JPG файлы.</div>';
            }
            return;
        }

        data.images.forEach(img => {
            const card = document.createElement('div');
            card.className = 'card';
            if (isSelectMode) card.classList.add('in-select-mode');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'card-checkbox';
            checkbox.dataset.filename = img.name;

            const link = document.createElement('a');
            link.href = img.url;
            link.className = 'lightbox-link';
            link.target = '_blank';
            const image = document.createElement('img');
            image.src = img.url + '?t=' + Date.now();
            image.alt = img.name;
            image.loading = 'lazy';
            link.appendChild(image);

            card.appendChild(checkbox);
            card.appendChild(link);
            gallery.appendChild(card);
        });

        if (currentPage < totalPages) {
            loadMoreBtn.style.display = 'inline-block';
            loadMoreBtn.textContent = 'Показать ещё';
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.style.display = 'none';
        }

    } catch (err) {
        console.error('Ошибка загрузки:', err);
    } finally {
        isLoading = false;
    }
}

// ---------- ЗАГРУЗКА ФАЙЛОВ ----------
uploadBtn.addEventListener('click', async () => {
    const files = fileInput.files;
    if (files.length === 0) {
        uploadStatus.textContent = 'Выберите хотя бы один файл';
        return;
    }

    uploadBtn.disabled = true;
    uploadStatus.textContent = 'Загрузка...';

    let uploadedCount = 0;
    let errorCount = 0;

    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                uploadedCount++;
            } else {
                errorCount++;
            }
        } catch (err) {
            errorCount++;
        }
    }

    if (errorCount === 0 && uploadedCount > 0) {
        uploadStatus.textContent = '✅ Фотографии успешно загружены';
    } else if (uploadedCount > 0 && errorCount > 0) {
        uploadStatus.textContent = `✅ Загружено: ${uploadedCount}, ошибок: ${errorCount}`;
    } else {
        uploadStatus.textContent = '❌ Ошибка загрузки';
    }

    uploadBtn.disabled = false;
    fileInput.value = '';
    currentPage = 1;
    loadGallery(1);
});

// ---------- СКАЧИВАНИЕ ВСЕХ ----------
document.getElementById('downloadAllBtn').addEventListener('click', () => {
    window.location.href = '/api/download-all';
});

// ---------- СКАЧИВАНИЕ ВЫБРАННЫХ ----------
downloadSelectedBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.card-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Выберите хотя бы одно фото');
        return;
    }
    const selectedFiles = [];
    checkboxes.forEach(cb => selectedFiles.push(cb.dataset.filename));

    try {
        const response = await fetch('/api/download-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: selectedFiles })
        });
        if (!response.ok) {
            const err = await response.json();
            alert('Ошибка: ' + (err.error || 'Неизвестная ошибка'));
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected_photos.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
});

// ---------- УДАЛЕНИЕ ВЫБРАННЫХ ----------
deleteSelectedBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.card-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Выберите хотя бы одно фото');
        return;
    }
    if (!confirm(`Удалить ${checkboxes.length} фото?`)) return;

    const filesToDelete = [];
    checkboxes.forEach(cb => filesToDelete.push(cb.dataset.filename));

    try {
        const response = await fetch('/api/images', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filesToDelete })
        });
        const result = await response.json();
        if (response.ok) {
            alert(`✅ Удалено: ${result.totalDeleted} файлов`);
            if (isSelectMode) {
                isSelectMode = false;
                selectToggleBtn.classList.remove('active');
                selectToggleBtn.textContent = 'Выбрать фотографии';
                downloadSelectedBtn.style.display = 'none';
                deleteSelectedBtn.style.display = 'none';
                document.querySelectorAll('.card').forEach(c => c.classList.remove('in-select-mode'));
            }
            currentPage = 1;
            loadGallery(1);
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
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
});