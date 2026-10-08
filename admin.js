(() => {
  let token = localStorage.getItem('perkdrop_admin_token') || '';
  let allOffers = [];
  let allCategories = [];
  let editingId = null;
  let editingCatId = null;
  let stagedImageBase64 = null;
  let stagedImageFilename = null;
  let currentView = 'products';

  // DOM Elements
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const userDisplayEmail = document.getElementById('user-display-email');
  const backupBtn = document.getElementById('backup-btn');

  // Nav Tabs & Counts
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabViews = {
    products: document.getElementById('view-products'),
    categories: document.getElementById('view-categories'),
    analytics: document.getElementById('view-analytics')
  };
  const navCountProducts = document.getElementById('nav-count-products');
  const navCountCategories = document.getElementById('nav-count-categories');

  // Stats Elements
  const statTotalProducts = document.getElementById('stat-total-products');
  const statTotalClicks = document.getElementById('stat-total-clicks');
  const statTopCategory = document.getElementById('stat-top-category');
  const statTopItem = document.getElementById('stat-top-item');

  // Filters & Table
  const filterSearch = document.getElementById('filter-search');
  const filterCategory = document.getElementById('filter-category');
  const sortControl = document.getElementById('sort-control');
  const productsTbody = document.getElementById('products-tbody');

  // Product Modal Elements
  const productModal = document.getElementById('product-modal');
  const openCreateBtn = document.getElementById('open-create-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalForm = document.getElementById('product-modal-form');
  const modalTitle = document.getElementById('modal-title');
  const saveBtnText = document.getElementById('save-btn-text');

  // Product Modal Inputs
  const prodId = document.getElementById('prod-id');
  const prodTitle = document.getElementById('prod-title');
  const prodBrand = document.getElementById('prod-brand');
  const prodCategory = document.getElementById('prod-category');
  const prodCommission = document.getElementById('prod-commission');
  const prodUrl = document.getElementById('prod-url');
  const destinationBadge = document.getElementById('destination-badge');
  const prodImageUrl = document.getElementById('prod-image-url');
  const prodDescription = document.getElementById('prod-description');

  // Image Tabs & Dropzone
  const tabUpload = document.getElementById('tab-upload');
  const tabUrl = document.getElementById('tab-url');
  const dropzoneArea = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('file-input');
  const urlArea = document.getElementById('url-area');

  // Preview Elements
  const previewImg = document.getElementById('preview-img');
  const previewMonogram = document.getElementById('preview-monogram');
  const previewBrand = document.getElementById('preview-brand');
  const previewTitle = document.getElementById('preview-title');
  const previewCatBadge = document.getElementById('preview-cat-badge');
  const previewLinkBadge = document.getElementById('preview-link-badge');

  // Category Modal Elements
  const categoryModal = document.getElementById('category-modal');
  const openCreateCategoryBtn = document.getElementById('open-create-category-btn');
  const catModalCloseBtn = document.getElementById('cat-modal-close-btn');
  const catModalCancelBtn = document.getElementById('cat-modal-cancel-btn');
  const categoryModalForm = document.getElementById('category-modal-form');
  const categoryEditId = document.getElementById('category-edit-id');
  const catModalTitle = document.getElementById('cat-modal-title');
  const catName = document.getElementById('cat-name');
  const catIcon = document.getElementById('cat-icon');
  const catDesc = document.getElementById('cat-desc');
  const catSaveBtnText = document.getElementById('cat-save-btn-text');
  const categoriesGrid = document.getElementById('categories-grid');

  // Analytics Elements
  const platformBars = document.getElementById('platform-bars');
  const leaderboardList = document.getElementById('leaderboard-list');

  // Toast
  const toast = document.getElementById('toast');

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--accent-rose)' : 'var(--accent-gold)';
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3200);
  }

  // API Helper
  async function api(path, options = {}) {
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error(data.error || 'Session expired. Please log in.');
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function handleUnauthorized() {
    token = '';
    localStorage.removeItem('perkdrop_admin_token');
    dashboardView.style.display = 'none';
    loginView.style.display = 'flex';
  }

  // NAVIGATION TABS
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchView(view);
    });
  });

  function switchView(viewName) {
    currentView = viewName;
    navTabs.forEach(t => {
      t.classList.toggle('is-active', t.dataset.view === viewName);
    });
    for (const [name, el] of Object.entries(tabViews)) {
      if (el) {
        el.style.display = (name === viewName) ? 'block' : 'none';
      }
    }
    if (viewName === 'analytics') {
      renderAnalytics();
    }
  }

  // AUTHENTICATION LOGIC
  async function checkAuth() {
    if (!token) {
      loginView.style.display = 'flex';
      dashboardView.style.display = 'none';
      return;
    }
    try {
      const res = await api('/api/auth/me');
      if (res.authenticated) {
        userDisplayEmail.textContent = res.email || 'admin@gmail.com';
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        await Promise.all([loadCategories(), loadProducts()]);
      } else {
        handleUnauthorized();
      }
    } catch {
      handleUnauthorized();
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = loginEmail.value.trim();
    const password = loginPass.value.trim();
    const submitBtn = document.getElementById('login-btn');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid email or password');

      token = data.token;
      localStorage.setItem('perkdrop_admin_token', token);
      userDisplayEmail.textContent = data.user?.email || email;
      loginView.style.display = 'none';
      dashboardView.style.display = 'flex';
      showToast('Welcome to Perkdrop Studio Pro!');
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    handleUnauthorized();
    showToast('Signed out successfully.');
  });

  // CATEGORIES MANAGEMENT
  async function loadCategories() {
    try {
      const data = await api('/api/admin/categories');
      allCategories = data.categories || [];
      navCountCategories.textContent = allCategories.length;
      updateCategoryDropdowns();
      renderCategoriesGrid();
    } catch (err) {
      console.warn('Could not load categories:', err);
    }
  }

  function updateCategoryDropdowns() {
    // 1. Filter Category dropdown
    const currentFilterVal = filterCategory.value;
    filterCategory.innerHTML = `<option value="">All Categories</option>` +
      allCategories.map(c => `<option value="${escapeHtml(c.name)}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
    if (currentFilterVal && allCategories.some(c => c.name === currentFilterVal)) {
      filterCategory.value = currentFilterVal;
    }

    // 2. Product Form Category dropdown
    const currentProdCatVal = prodCategory.value;
    prodCategory.innerHTML = allCategories.map(c =>
      `<option value="${escapeHtml(c.name)}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`
    ).join('') + `<option value="Other">📦 Other</option>`;
    if (currentProdCatVal) {
      prodCategory.value = currentProdCatVal;
    }
  }

  function renderCategoriesGrid() {
    if (!categoriesGrid) return;
    if (allCategories.length === 0) {
      categoriesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-dim);">
          <p>No categories found. Click "+ Add New Category" to create one.</p>
        </div>
      `;
      return;
    }

    categoriesGrid.innerHTML = allCategories.map(cat => {
      const count = cat.product_count || 0;
      return `
        <div class="cat-admin-card" data-cat-id="${cat.id}">
          <div>
            <div class="cat-card-header">
              <div class="cat-card-icon-box">${cat.icon || '📦'}</div>
              <span class="cat-count-pill">${count} ${count === 1 ? 'product' : 'products'}</span>
            </div>
            <h3 class="cat-card-title">${escapeHtml(cat.name)}</h3>
            <p class="cat-card-slug">ID: ${escapeHtml(cat.id)}</p>
            <p class="cat-card-desc">${escapeHtml(cat.description || 'No description provided.')}</p>
          </div>
          <div class="cat-card-actions">
            <button class="btn btn-ghost btn-sm btn-cat-edit" data-id="${cat.id}">
              ✏️ Edit
            </button>
            <button class="btn btn-danger btn-sm btn-cat-delete" data-id="${cat.id}" title="Delete Category">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    categoriesGrid.querySelectorAll('.btn-cat-edit').forEach(b => {
      b.addEventListener('click', () => openEditCategoryModal(b.dataset.id));
    });

    categoriesGrid.querySelectorAll('.btn-cat-delete').forEach(b => {
      b.addEventListener('click', () => deleteCategory(b.dataset.id));
    });
  }

  function openCreateCategoryModal() {
    editingCatId = null;
    categoryModalForm.reset();
    categoryEditId.value = '';
    catModalTitle.textContent = 'Add New Category';
    catSaveBtnText.textContent = 'Save Category';
    categoryModal.style.display = 'flex';
    catName.focus();
  }

  function openEditCategoryModal(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    editingCatId = id;
    categoryEditId.value = id;
    catName.value = cat.name || '';
    catIcon.value = cat.icon || '🏷️';
    catDesc.value = cat.description || '';
    catModalTitle.textContent = 'Edit Category';
    catSaveBtnText.textContent = 'Update Category';
    categoryModal.style.display = 'flex';
    catName.focus();
  }

  function closeCategoryModal() {
    categoryModal.style.display = 'none';
  }

  openCreateCategoryBtn.addEventListener('click', openCreateCategoryModal);
  catModalCloseBtn.addEventListener('click', closeCategoryModal);
  catModalCancelBtn.addEventListener('click', closeCategoryModal);
  categoryModal.addEventListener('click', (e) => {
    if (e.target === categoryModal) closeCategoryModal();
  });

  categoryModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('cat-modal-save-btn');
    saveBtn.disabled = true;
    catSaveBtnText.textContent = 'Saving…';

    const payload = {
      name: catName.value.trim(),
      icon: catIcon.value.trim() || '🏷️',
      description: catDesc.value.trim()
    };

    try {
      if (editingCatId) {
        await api(`/api/admin/categories/${editingCatId}`, {
          method: 'PUT',
          body: payload
        });
        showToast('Category updated successfully!');
      } else {
        await api('/api/admin/categories', {
          method: 'POST',
          body: payload
        });
        showToast('New category added!');
      }
      notifyCatalogChanged();
      closeCategoryModal();
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      saveBtn.disabled = false;
      catSaveBtnText.textContent = editingCatId ? 'Update Category' : 'Save Category';
    }
  });

  async function deleteCategory(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    if (!confirm(`Delete category "${cat.name}"? Products in this category will remain in the catalog.`)) {
      return;
    }
    try {
      await api(`/api/admin/categories/${id}`, { method: 'DELETE' });
      showToast(`Category "${cat.name}" deleted.`);
      notifyCatalogChanged();
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // PRODUCTS FETCH & METRICS
  async function loadProducts() {
    try {
      const data = await api('/api/admin/offers');
      allOffers = data.offers || [];
      navCountProducts.textContent = allOffers.length;
      updateMetrics();
      renderTable();
      if (currentView === 'analytics') renderAnalytics();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function updateMetrics() {
    const total = allOffers.length;
    const clicks = allOffers.reduce((sum, o) => sum + (parseInt(o.click_count) || 0), 0);
    statTotalProducts.textContent = total;
    statTotalClicks.textContent = clicks;

    // Top Category
    const catCounts = {};
    allOffers.forEach(o => {
      const cat = o.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    let topCat = '—';
    let maxCatCount = 0;
    for (const [c, cnt] of Object.entries(catCounts)) {
      if (cnt > maxCatCount) {
        maxCatCount = cnt;
        topCat = c;
      }
    }
    statTopCategory.textContent = topCat;

    // Top Clicked Item
    let topItem = null;
    let maxClicks = -1;
    allOffers.forEach(o => {
      const c = parseInt(o.click_count) || 0;
      if (c > maxClicks) {
        maxClicks = c;
        topItem = o;
      }
    });
    statTopItem.textContent = (topItem && maxClicks > 0) ? `${topItem.brand} ${topItem.title}` : '—';
  }

  function getPlatformBadge(url = '') {
    const u = url.toLowerCase();
    if (u.includes('amazon.')) return { text: 'Amazon', class: 'dest-badge--amazon', color: '#ff9900' };
    if (u.includes('flipkart.')) return { text: 'Flipkart', class: 'dest-badge--flipkart', color: '#2874f0' };
    return { text: 'Direct Link', class: 'dest-badge--other', color: '#94a3b8' };
  }

  // RENDER TABLE
  function renderTable() {
    const search = filterSearch.value.trim().toLowerCase();
    const cat = filterCategory.value;
    const sort = sortControl.value;

    let filtered = allOffers.filter(o => {
      const matchSearch = !search ||
        (o.title || '').toLowerCase().includes(search) ||
        (o.brand || '').toLowerCase().includes(search) ||
        (o.url || '').toLowerCase().includes(search);
      const matchCat = !cat || o.category === cat;
      return matchSearch && matchCat;
    });

    if (sort === 'clicks') {
      filtered.sort((a, b) => (parseInt(b.click_count) || 0) - (parseInt(a.click_count) || 0));
    } else if (sort === 'title') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      // Newest first by default
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    if (filtered.length === 0) {
      productsTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 16px; color: var(--text-dim);">
            <p style="font-size: 15px; font-weight: 500;">No products match your filters.</p>
            <p style="font-size: 13px; margin-top: 4px;">Click "+ Add New Product" to create one.</p>
          </td>
        </tr>
      `;
      return;
    }

    productsTbody.innerHTML = filtered.map(o => {
      const platform = getPlatformBadge(o.url);
      const clicks = parseInt(o.click_count) || 0;
      const initial = (o.brand || o.title || 'P').charAt(0).toUpperCase();

      return `
        <tr data-id="${o.id}">
          <td>
            <div class="table-img">
              ${o.image_url ? `<img src="${o.image_url}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="table-monogram" style="display:none;">${initial}</span>` : `<span class="table-monogram">${initial}</span>`}
            </div>
          </td>
          <td>
            <div class="prod-meta-title">${escapeHtml(o.title)}</div>
            <div class="prod-meta-brand">${escapeHtml(o.brand)}</div>
          </td>
          <td>
            <span class="badge-cat">${escapeHtml(o.category || 'Other')}</span>
          </td>
          <td>
            <div class="dest-link-wrap">
              <span class="dest-badge ${platform.class}">${platform.text}</span>
              <a href="${escapeHtml(o.url)}" target="_blank" rel="noopener" class="dest-url-text" title="${escapeHtml(o.url)}">
                ${escapeHtml(o.url)} ↗
              </a>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="clicks-pill">${clicks} ${clicks === 1 ? 'click' : 'clicks'}</span>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-ghost btn-sm btn-edit" data-id="${o.id}" title="Edit Product">
                ✏️
              </button>
              <button class="btn btn-ghost btn-sm btn-clone" data-id="${o.id}" title="Duplicate / Clone Product">
                📋
              </button>
              <button class="btn btn-danger btn-sm btn-delete" data-id="${o.id}" title="Delete Product">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    productsTbody.querySelectorAll('.btn-edit').forEach(b => {
      b.addEventListener('click', () => openEditModal(b.dataset.id));
    });

    productsTbody.querySelectorAll('.btn-clone').forEach(b => {
      b.addEventListener('click', () => cloneProduct(b.dataset.id));
    });

    productsTbody.querySelectorAll('.btn-delete').forEach(b => {
      b.addEventListener('click', () => deleteProduct(b.dataset.id));
    });
  }

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // FILTER LISTENERS
  filterSearch.addEventListener('input', renderTable);
  filterCategory.addEventListener('change', renderTable);
  sortControl.addEventListener('change', renderTable);

  // CLONE PRODUCT
  function cloneProduct(id) {
    const item = allOffers.find(o => o.id === id);
    if (!item) return;

    openCreateModal();
    prodTitle.value = `Copy of ${item.title || ''}`;
    prodBrand.value = item.brand || '';
    prodCategory.value = item.category || 'Keyboards';
    prodCommission.value = item.commission || '';
    prodUrl.value = item.url || '';
    prodImageUrl.value = item.image_url || '';
    prodDescription.value = item.description || '';

    if (item.image_url && !item.image_url.startsWith('/uploads/')) {
      setTab('url');
    } else {
      setTab('upload');
    }

    updateLivePreview();
    showToast('Cloned product into form. Edit details and click Save!');
  }

  // MODAL CONTROLS
  function openCreateModal() {
    editingId = null;
    modalForm.reset();
    prodId.value = '';
    modalTitle.textContent = 'Add New Affiliate Product';
    saveBtnText.textContent = 'Save Product & Link';
    stagedImageBase64 = null;
    stagedImageFilename = null;
    setTab('upload');
    updateLivePreview();
    productModal.style.display = 'flex';
    prodTitle.focus();
  }

  function openEditModal(id) {
    const item = allOffers.find(o => o.id === id);
    if (!item) return;

    editingId = id;
    prodId.value = id;
    prodTitle.value = item.title || '';
    prodBrand.value = item.brand || '';
    prodCategory.value = item.category || 'Keyboards';
    prodCommission.value = item.commission || '';
    prodUrl.value = item.url || '';
    prodImageUrl.value = item.image_url || '';
    prodDescription.value = item.description || '';

    modalTitle.textContent = 'Edit Product & Link';
    saveBtnText.textContent = 'Update Product';
    stagedImageBase64 = null;
    stagedImageFilename = null;

    if (item.image_url && !item.image_url.startsWith('/uploads/')) {
      setTab('url');
    } else {
      setTab('upload');
    }

    updateLivePreview();
    productModal.style.display = 'flex';
  }

  function closeModal() {
    productModal.style.display = 'none';
  }

  openCreateBtn.addEventListener('click', openCreateModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeModal();
  });

  // TABS: UPLOAD VS URL
  function setTab(mode) {
    if (mode === 'upload') {
      tabUpload.classList.add('is-active');
      tabUrl.classList.remove('is-active');
      dropzoneArea.style.display = 'block';
      urlArea.style.display = 'none';
    } else {
      tabUrl.classList.add('is-active');
      tabUpload.classList.remove('is-active');
      urlArea.style.display = 'block';
      dropzoneArea.style.display = 'none';
    }
  }

  tabUpload.addEventListener('click', () => setTab('upload'));
  tabUrl.addEventListener('click', () => setTab('url'));

  // DROPZONE HANDLING
  dropzoneArea.addEventListener('click', () => fileInput.click());
  dropzoneArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneArea.classList.add('dragover');
  });
  dropzoneArea.addEventListener('dragleave', () => dropzoneArea.classList.remove('dragover'));
  dropzoneArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleSelectedFile(fileInput.files[0]);
    }
  });

  function handleSelectedFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP).', true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Image size exceeds 8MB.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      stagedImageBase64 = e.target.result;
      stagedImageFilename = file.name;
      dropzoneArea.querySelector('p').innerHTML = `Selected: <strong>${escapeHtml(file.name)}</strong>`;
      updateLivePreview();
      showToast('Photo loaded into preview!');
    };
    reader.readAsDataURL(file);
  }

  // LIVE PREVIEW UPDATER
  function updateLivePreview() {
    const brand = prodBrand.value.trim() || 'Brand Name';
    const title = prodTitle.value.trim() || 'Product Name';
    const cat = prodCategory.value || 'Keyboards';
    const url = prodUrl.value.trim();
    const manualImg = prodImageUrl.value.trim();

    previewBrand.textContent = brand;
    previewTitle.textContent = title;
    previewCatBadge.textContent = cat;
    previewMonogram.textContent = brand.charAt(0).toUpperCase();

    // Destination badge
    const platform = getPlatformBadge(url);
    if (url) {
      destinationBadge.textContent = platform.text;
      destinationBadge.style.display = 'block';
      previewLinkBadge.textContent = `Redirects to ${platform.text}`;
    } else {
      destinationBadge.style.display = 'none';
      previewLinkBadge.textContent = 'Redirects to Target';
    }

    // Image preview
    const imgSrc = stagedImageBase64 || manualImg;
    if (imgSrc) {
      previewImg.src = imgSrc;
      previewImg.style.display = 'block';
      previewMonogram.style.display = 'none';
      previewImg.onerror = () => {
        previewImg.style.display = 'none';
        previewMonogram.style.display = 'block';
      };
    } else {
      previewImg.style.display = 'none';
      previewMonogram.style.display = 'block';
    }
  }

  [prodTitle, prodBrand, prodCategory, prodUrl, prodImageUrl].forEach(input => {
    input.addEventListener('input', updateLivePreview);
  });

  // SUBMIT (CREATE OR EDIT)
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtnText.textContent = 'Saving…';

    try {
      let finalImageUrl = prodImageUrl.value.trim();

      // If user selected an image file to upload, upload it to backend first
      if (stagedImageBase64) {
        const uploadRes = await api('/api/admin/upload', {
          method: 'POST',
          body: {
            filename: stagedImageFilename || 'product.jpg',
            data: stagedImageBase64
          }
        });
        finalImageUrl = uploadRes.url;
      }

      const payload = {
        title: prodTitle.value.trim(),
        brand: prodBrand.value.trim(),
        category: prodCategory.value,
        commission: prodCommission.value.trim(),
        url: prodUrl.value.trim(),
        image_url: finalImageUrl,
        description: prodDescription.value.trim()
      };

      if (editingId) {
        await api(`/api/admin/offers/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        showToast('Product successfully updated!');
      } else {
        await api('/api/admin/offers', {
          method: 'POST',
          body: payload
        });
        showToast('New product added to storefront!');
      }

      notifyCatalogChanged();
      closeModal();
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      saveBtn.disabled = false;
      saveBtnText.textContent = editingId ? 'Update Product' : 'Save Product & Link';
    }
  });

  // DELETE PRODUCT
  async function deleteProduct(id) {
    const item = allOffers.find(o => o.id === id);
    const label = item ? `${item.brand} - ${item.title}` : 'this product';
    if (!confirm(`Are you sure you want to delete "${label}"? This will remove it from the storefront.`)) {
      return;
    }

    try {
      await api(`/api/admin/offers/${id}`, { method: 'DELETE' });
      showToast('Product deleted.');
      notifyCatalogChanged();
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ANALYTICS VIEW RENDERER
  function renderAnalytics() {
    if (!platformBars || !leaderboardList) return;

    let amazonClicks = 0;
    let flipkartClicks = 0;
    let otherClicks = 0;
    let totalClicks = 0;

    allOffers.forEach(o => {
      const c = parseInt(o.click_count) || 0;
      totalClicks += c;
      const u = (o.url || '').toLowerCase();
      if (u.includes('amazon.')) amazonClicks += c;
      else if (u.includes('flipkart.')) flipkartClicks += c;
      else otherClicks += c;
    });

    const getPct = (val) => totalClicks > 0 ? Math.round((val / totalClicks) * 100) : 0;

    platformBars.innerHTML = `
      <div class="platform-bar-row">
        <div class="platform-bar-label">
          <span style="color: #ff9900;">Amazon Outbound</span>
          <span>${amazonClicks} clicks (${getPct(amazonClicks)}%)</span>
        </div>
        <div class="platform-bar-track">
          <div class="platform-bar-fill" style="width: ${getPct(amazonClicks)}%; background: #ff9900;"></div>
        </div>
      </div>

      <div class="platform-bar-row">
        <div class="platform-bar-label">
          <span style="color: #5aa1ff;">Flipkart Outbound</span>
          <span>${flipkartClicks} clicks (${getPct(flipkartClicks)}%)</span>
        </div>
        <div class="platform-bar-track">
          <div class="platform-bar-fill" style="width: ${getPct(flipkartClicks)}%; background: #2874f0;"></div>
        </div>
      </div>

      <div class="platform-bar-row">
        <div class="platform-bar-label">
          <span style="color: #94a3b8;">Other / Direct</span>
          <span>${otherClicks} clicks (${getPct(otherClicks)}%)</span>
        </div>
        <div class="platform-bar-track">
          <div class="platform-bar-fill" style="width: ${getPct(otherClicks)}%; background: #64748b;"></div>
        </div>
      </div>
    `;

    // Leaderboard (Top 5)
    const sorted = [...allOffers].sort((a, b) => (parseInt(b.click_count) || 0) - (parseInt(a.click_count) || 0)).slice(0, 5);

    if (sorted.length === 0 || totalClicks === 0) {
      leaderboardList.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No click data recorded yet.</p>`;
    } else {
      leaderboardList.innerHTML = sorted.map((item, idx) => {
        const c = parseInt(item.click_count) || 0;
        return `
          <div class="leaderboard-item">
            <span class="leaderboard-rank">#${idx + 1}</span>
            <div class="leaderboard-info">
              <div class="leaderboard-title">${escapeHtml(item.title)}</div>
              <div class="leaderboard-brand">${escapeHtml(item.brand)} · ${escapeHtml(item.category)}</div>
            </div>
            <span class="clicks-pill">${c} clicks</span>
          </div>
        `;
      }).join('');
    }
  }

  // BACKUP DOWNLOAD
  if (backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        const data = await api('/api/admin/backup');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `perkdrop-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup JSON downloaded!');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Cross-tab and real-time synchronization
  const adminChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('perkdrop_catalog_channel') : null;

  function notifyCatalogChanged() {
    const v = String(Date.now());
    try {
      localStorage.setItem('perkdrop_catalog_version', v);
    } catch (_) {}
    if (adminChannel) {
      adminChannel.postMessage({ type: 'CATALOG_UPDATED', version: v });
    }
  }

  if (adminChannel) {
    adminChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'CATALOG_UPDATED') {
        if (token) {
          loadCategories();
          loadProducts();
        }
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'perkdrop_catalog_version') {
      if (token) {
        loadCategories();
        loadProducts();
      }
    }
  });

  // Background sync for admin metrics, categories and products
  let adminLastVersion = '';
  async function syncAdminVersion() {
    if (!token) return;
    try {
      const res = await fetch('/api/catalog-version', { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json();
      if (adminLastVersion && info.version && info.version !== adminLastVersion) {
        adminLastVersion = info.version;
        loadCategories();
        loadProducts();
      } else if (!adminLastVersion && info.version) {
        adminLastVersion = info.version;
      }
    } catch (_) {}
  }

  setInterval(syncAdminVersion, 3000);
  window.addEventListener('focus', syncAdminVersion);

  // Initialize Auth Check
  checkAuth();
})();
