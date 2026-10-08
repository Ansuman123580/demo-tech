(() => {
  const labels = {
    keyboards: 'Keyboards',
    mice: 'Mice',
    watches: 'Watches',
    audio: 'Audio',
    'desk-gear': 'Desk Gear'
  };
  const categoryNav = document.querySelector('.category-selectors');
  const grid = document.getElementById('product-grid');
  const gridSection = document.getElementById('category-grid');
  const title = document.getElementById('product-list-title');
  const description = document.getElementById('product-list-description');
  const count = document.getElementById('product-count');
  const form = document.getElementById('product-form');
  const formStatus = document.getElementById('product-form-status');
  const formDetails = document.getElementById('submit-product');
  const offers = [];
  let currentCategories = [];
  let selectedCategory = '';

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function render() {
    const targetCategoryName = labels[selectedCategory] || selectedCategory;
    const visible = selectedCategory
      ? offers.filter((offer) => (offer.category || '').toLowerCase() === targetCategoryName.toLowerCase())
      : offers;
    title.textContent = selectedCategory ? `${targetCategoryName}.` : 'All finds.';
    description.textContent = selectedCategory
      ? `Every ${targetCategoryName.toLowerCase()} find shared by the community.`
      : 'Products shared by the community, gathered in one place.';
    count.textContent = `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`;

    window.dispatchEvent(new Event('perkdrop:grid-before-update'));
    grid.replaceChildren();

    if (!visible.length) {
      const empty = make('div', 'grid-empty');
      empty.append(make('span', 'product-empty__mark', '✳'));
      empty.append(make('h3', '', selectedCategory ? `No ${targetCategoryName.toLowerCase()} finds yet.` : 'The edit is just getting started.'));
      empty.append(make('p', '', 'Share a product to add the first find to this grid.'));
      const add = make('button', 'product-empty__button', 'Share a product');
      add.type = 'button';
      add.addEventListener('click', () => {
        if (form && form.elements.category) {
          form.elements.category.value = selectedCategory ? targetCategoryName : 'Keyboards';
        }
        formDetails.open = true;
        if (form && form.elements.title) form.elements.title.focus();
      });
      empty.append(add);
      grid.append(empty);
    } else {
      for (const offer of visible) {
        const tile = make('a', 'grid__item product-grid__item');
        const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
        tile.href = isStaticHost ? (offer.url || '#') : `/go/${encodeURIComponent(offer.id)}`;
        tile.target = '_blank';
        tile.rel = 'noopener noreferrer sponsored';
        tile.setAttribute('aria-label', `${offer.brand}: ${offer.title}, view affiliate product`);

        const cover = make('div', 'grid__item-img product-grid__cover');
        if (offer.image_url) {
          const image = make('img', 'product-grid__image');
          image.src = offer.image_url;
          image.alt = '';
          image.loading = 'lazy';
          image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => cover.classList.add('product-grid__cover--empty'), { once: true });
          cover.append(image);
        } else {
          cover.classList.add('product-grid__cover--empty');
          cover.append(make('span', 'product-grid__monogram', (offer.brand || 'P').slice(0, 1).toUpperCase()));
        }
        cover.append(make('span', 'product-grid__view', 'View find ↗'));
        tile.append(cover);

        const brand = make('span', 'product-grid__brand', offer.brand);
        tile.append(brand);
        tile.append(make('span', 'grid__item-caption product-grid__title', offer.title));
        const meta = [offer.is_demo ? 'Demo pick' : offer.category, !offer.is_demo && offer.publisher ? `Shared by ${offer.publisher}` : ''].filter(Boolean).join(' · ');
        if (meta) tile.append(make('span', 'product-grid__meta', meta));
        grid.append(tile);
      }
    }

    window.dispatchEvent(new Event('perkdrop:grid-updated'));
  }

  function selectCategory(category, scrollToGrid = true) {
    selectedCategory = category;
    if (categoryNav) {
      categoryNav.querySelectorAll('.category-filter').forEach((item) => {
        const active = item.dataset.category === category;
        item.classList.toggle('is-selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
    }
    if (category && labels[category] && form && form.elements.category) {
      form.elements.category.value = labels[category];
    }
    render();
    if (scrollToGrid && gridSection) gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderCategoryNav(categories) {
    if (!categoryNav) return;
    categoryNav.replaceChildren();

    // 00 All finds button
    const allBtn = make('button', 'category-filter' + (selectedCategory === '' ? ' is-selected' : ''));
    allBtn.type = 'button';
    allBtn.dataset.category = '';
    allBtn.setAttribute('aria-pressed', String(selectedCategory === ''));
    allBtn.append(make('span', 'category-filter__number', '00'));
    allBtn.append(make('span', '', 'All finds'));
    allBtn.addEventListener('click', () => selectCategory(''));
    categoryNav.append(allBtn);

    // Dynamic Category tabs
    categories.forEach((cat, idx) => {
      labels[cat.id] = cat.name;
      const num = String(idx + 1).padStart(2, '0');
      const active = selectedCategory === cat.id;
      const btn = make('button', 'category-filter' + (active ? ' is-selected' : ''));
      btn.type = 'button';
      btn.dataset.category = cat.id;
      btn.setAttribute('aria-pressed', String(active));
      btn.append(make('span', 'category-filter__number', num));
      btn.append(make('span', '', cat.name));
      btn.addEventListener('click', () => selectCategory(cat.id));
      categoryNav.append(btn);
    });

    // Populate submit form select if present
    if (form && form.elements.category) {
      form.elements.category.innerHTML = categories.map(c => 
        `<option value="${c.name}">${c.name}</option>`
      ).join('') + `<option value="Other">Other</option>`;
    }
  }

  async function loadCategories() {
    try {
      let data = null;
      try {
        const res = await fetch('/api/categories', { cache: 'no-store' });
        if (res.ok) data = await res.json();
      } catch (_) {}
      if (!data) {
        const staticRes = await fetch('categories.json');
        if (staticRes.ok) data = await staticRes.json();
      }
      if (Array.isArray(data) && data.length) {
        currentCategories = data;
        renderCategoryNav(data);
      }
    } catch (_) {}
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      submit.disabled = true;
      formStatus.textContent = 'Posting your product…';
      formStatus.classList.remove('is-error');
      try {
        let result;
        try {
          const response = await fetch('/api/offers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (response.ok) {
            result = await response.json();
          }
        } catch (err) {
          // Fallback for static hosts
        }
        if (!result || !result.offer) {
          result = {
            offer: {
              ...data,
              id: 'demo-' + Date.now().toString(36),
              created_at: new Date().toISOString(),
              click_count: 0
            }
          };
        }
        offers.unshift(result.offer);
        form.reset();
        formDetails.open = false;
        const categoryKey = Object.keys(labels).find((key) => labels[key].toLowerCase() === (result.offer.category || '').toLowerCase()) || '';
        selectCategory(categoryKey);
      } catch (error) {
        formStatus.textContent = error.message;
        formStatus.classList.add('is-error');
      } finally {
        submit.disabled = false;
      }
    });
  }

  let currentCatalogVersion = '';

  async function loadOffers(isAutoRefresh = false) {
    try {
      let data = null;
      try {
        const response = await fetch('/api/offers', { cache: 'no-store' });
        if (response.ok) {
          data = await response.json();
        }
      } catch (e) {
        // Fallback to static offers.json
      }
      if (!data) {
        const staticResponse = await fetch('offers.json');
        if (staticResponse.ok) {
          data = await staticResponse.json();
        }
      }
      if (!data || !Array.isArray(data)) throw new Error('Products could not be loaded.');
      offers.length = 0;
      offers.push(...data);
      render();
      if (isAutoRefresh) {
        console.log('[perkdrop] Auto-refreshed storefront: ' + offers.length + ' products');
      }
    } catch (error) {
      count.textContent = 'Unavailable';
      grid.replaceChildren(make('div', 'grid-empty', `${error.message} Refresh the page and try again.`));
      window.dispatchEvent(new Event('perkdrop:grid-updated'));
    }
  }

  // Real-time synchronization
  const catalogChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('perkdrop_catalog_channel') : null;
  if (catalogChannel) {
    catalogChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'CATALOG_UPDATED') {
        loadCategories();
        loadOffers(true);
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'perkdrop_catalog_version') {
      loadCategories();
      loadOffers(true);
    }
  });

  async function syncCatalogVersion() {
    try {
      const res = await fetch('/api/catalog-version', { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json();
      if (currentCatalogVersion && info.version && info.version !== currentCatalogVersion) {
        currentCatalogVersion = info.version;
        loadCategories();
        loadOffers(true);
      } else if (!currentCatalogVersion && info.version) {
        currentCatalogVersion = info.version;
      }
    } catch (_) {}
  }

  // Poll for background changes every 2.5 seconds
  setInterval(syncCatalogVersion, 2500);

  // Sync on tab visibility change or focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncCatalogVersion();
    }
  });
  window.addEventListener('focus', syncCatalogVersion);

  // Wire up footer category links and back to top
  document.querySelectorAll('[data-cat-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.dataset.catNav;
      selectCategory(cat);
    });
  });

  const backToTopBtn = document.getElementById('footer-top-btn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  render();
  loadCategories();
  loadOffers();
  syncCatalogVersion();
})();
