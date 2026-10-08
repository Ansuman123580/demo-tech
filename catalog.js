(() => {
  const labels = {
    keyboards: 'Keyboards',
    mice: 'Mice',
    watches: 'Watches',
    audio: 'Audio',
    'desk-gear': 'Desk Gear'
  };
  const categoryItems = [...document.querySelectorAll('.category-filter[data-category]')];
  const grid = document.getElementById('product-grid');
  const gridSection = document.getElementById('category-grid');
  const title = document.getElementById('product-list-title');
  const description = document.getElementById('product-list-description');
  const count = document.getElementById('product-count');
  const form = document.getElementById('product-form');
  const formStatus = document.getElementById('product-form-status');
  const formDetails = document.getElementById('submit-product');
  const offers = [];
  let selectedCategory = '';

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function render() {
    const visible = selectedCategory
      ? offers.filter((offer) => offer.category === labels[selectedCategory])
      : offers;
    title.textContent = selectedCategory ? `${labels[selectedCategory]}.` : 'All finds.';
    description.textContent = selectedCategory
      ? `Every ${labels[selectedCategory].toLowerCase()} find shared by the community.`
      : 'Products shared by the community, gathered in one place.';
    count.textContent = `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`;

    window.dispatchEvent(new Event('perkdrop:grid-before-update'));
    grid.replaceChildren();

    if (!visible.length) {
      const empty = make('div', 'grid-empty');
      empty.append(make('span', 'product-empty__mark', '✳'));
      empty.append(make('h3', '', selectedCategory ? `No ${labels[selectedCategory].toLowerCase()} finds yet.` : 'The edit is just getting started.'));
      empty.append(make('p', '', 'Share a product to add the first find to this grid.'));
      const add = make('button', 'product-empty__button', 'Share a product');
      add.type = 'button';
      add.addEventListener('click', () => {
        form.elements.category.value = selectedCategory ? labels[selectedCategory] : 'Keyboards';
        formDetails.open = true;
        form.elements.title.focus();
      });
      empty.append(add);
      grid.append(empty);
    } else {
      for (const offer of visible) {
        const tile = make('a', 'grid__item product-grid__item');
        tile.href = `/go/${encodeURIComponent(offer.id)}`;
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
          cover.append(make('span', 'product-grid__monogram', offer.brand.slice(0, 1).toUpperCase()));
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
    categoryItems.forEach((item) => {
      const active = item.dataset.category === category;
      item.classList.toggle('is-selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    if (category && labels[category]) form.elements.category.value = labels[category];
    render();
    if (scrollToGrid) gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  categoryItems.forEach((item) => item.addEventListener('click', () => selectCategory(item.dataset.category)));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    formStatus.textContent = 'Posting your product…';
    formStatus.classList.remove('is-error');
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not post this product.');
      offers.unshift(result.offer);
      form.reset();
      formDetails.open = false;
      const category = Object.keys(labels).find((key) => labels[key] === result.offer.category) || '';
      selectCategory(category);
    } catch (error) {
      formStatus.textContent = error.message;
      formStatus.classList.add('is-error');
    } finally {
      submit.disabled = false;
    }
  });

  async function loadOffers() {
    try {
      const response = await fetch('/api/offers', { cache: 'no-store' });
      if (!response.ok) throw new Error('Products could not be loaded.');
      const data = await response.json();
      offers.push(...(Array.isArray(data) ? data : []));
      render();
    } catch (error) {
      count.textContent = 'Unavailable';
      grid.replaceChildren(make('div', 'grid-empty', `${error.message} Refresh the page and try again.`));
      window.dispatchEvent(new Event('perkdrop:grid-updated'));
    }
  }

  render();
  loadOffers();
})();
