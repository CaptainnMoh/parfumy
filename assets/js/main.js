// Helpers
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Year in footer
document.addEventListener('DOMContentLoaded', () => {
	const yearEl = $('#year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();
	// Adjust body padding based on header height
	const adjustOffset = () => {
		const header = $('.site-header');
		if (!header) return;
		const h = header.getBoundingClientRect().height;
		document.body.style.paddingTop = `${Math.ceil(h)}px`;
	};
	adjustOffset();
	window.addEventListener('resize', adjustOffset);
});

// Mobile nav toggle
(() => {
	const toggle = $('.nav-toggle');
	const nav = $('.nav');
	if (!toggle || !nav) return;
	toggle.addEventListener('click', () => {
		const isOpen = nav.classList.toggle('open');
		toggle.setAttribute('aria-expanded', String(isOpen));
	});
	$$('.nav-link').forEach(link => link.addEventListener('click', () => {
		nav.classList.remove('open');
		toggle.setAttribute('aria-expanded', 'false');
	}));
})();

// Smooth scroll for anchors with .js-scroll
(() => {
	$$('.js-scroll, .nav a[href^="#"]').forEach(link => {
		link.addEventListener('click', (e) => {
			const href = link.getAttribute('href');
			if (!href || !href.startsWith('#')) return;
			e.preventDefault();
			const target = $(href);
			if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	});
})();

// Reveal on scroll
(() => {
	const toReveal = $$('.reveal');
	if (!toReveal.length) return;
	const io = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('visible');
				io.unobserve(entry.target);
			}
		});
	}, { threshold: 0.2 });
	toReveal.forEach(el => io.observe(el));
})();

// Product details modal
(() => {
	const modal = $('#product-modal');
	if (!modal) return;
	const titleEl = $('.modal-title', modal);
	const descEl = $('.modal-desc', modal);
	const priceEl = $('.modal-price', modal);
	const openModal = ({ title, desc, price }) => {
		titleEl.textContent = title || 'Perfume';
		descEl.textContent = desc || '';
		priceEl.textContent = price ? `Price: ${price}` : '';
		modal.classList.add('show');
		modal.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	};
	const closeModal = () => {
		modal.classList.remove('show');
		modal.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = '';
	};
	$$('.js-details').forEach(btn => {
		btn.addEventListener('click', () => {
			const card = btn.closest('.product-card');
			if (!card) return;
			const data = card.getAttribute('data-product');
			try {
				openModal(JSON.parse(data || '{}'));
			} catch (e) {
				openModal({ title: 'Perfume', desc: '', price: '' });
			}
		});
	});
	modal.addEventListener('click', (e) => {
		if (e.target.matches('[data-close]') || e.target.classList.contains('modal-backdrop')) closeModal();
	});
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
})();

// Order buttons -> WhatsApp prefill
(() => {
	$$('.js-order').forEach(btn => {
		btn.addEventListener('click', () => {
			const card = btn.closest('.product-card');
			const product = card ? JSON.parse(card.getAttribute('data-product') || '{}') : {};
			const message = encodeURIComponent(`Hello Parfumy, I would like to order: ${product.title || 'Perfume'}`);
			window.open(`https://wa.me/254713400220?text=${message}`, '_blank');
		});
	});
})();

// Testimonials slider
(() => {
	const slider = $('.slider');
	if (!slider) return;
	const slides = $('.slides', slider);
	const panels = $$('.testimonial', slides);
	const prev = $('.prev', slider);
	const next = $('.next', slider);
	let index = 0; let timer;
	const go = (i) => {
		index = (i + panels.length) % panels.length;
		slides.style.transform = `translateX(-${index * 100}%)`;
	};
	const start = () => { stop(); timer = setInterval(() => go(index + 1), 5000); };
	const stop = () => { if (timer) clearInterval(timer); };
	prev && prev.addEventListener('click', () => { go(index - 1); start(); });
	next && next.addEventListener('click', () => { go(index + 1); start(); });
	slider.addEventListener('mouseenter', stop);
	slider.addEventListener('mouseleave', start);
	start();
})();

// Contact form validation
(() => {
	const form = $('.contact-form');
	if (!form) return;
	const fields = {
		name: $('#name', form),
		email: $('#email', form),
		message: $('#message', form)
	};
	const errors = {
		name: $('[data-for="name"]', form),
		email: $('[data-for="email"]', form),
		message: $('[data-for="message"]', form)
	};
	const statusEl = $('.form-status', form);
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
	const setError = (key, msg) => { if (errors[key]) errors[key].textContent = msg || ''; };
	const validate = () => {
		let ok = true;
		if (!fields.name.value.trim()) { setError('name', 'Please enter your name'); ok = false; } else setError('name');
		if (!emailRegex.test(fields.email.value.trim())) { setError('email', 'Enter a valid email'); ok = false; } else setError('email');
		if (fields.message.value.trim().length < 10) { setError('message', 'Message must be at least 10 characters'); ok = false; } else setError('message');
		return ok;
	};
	Object.values(fields).forEach(input => input.addEventListener('input', () => validate()));
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		statusEl.textContent = '';
		if (!validate()) return;
		// Simulate successful submit
		setTimeout(() => {
			statusEl.textContent = 'Thank you! We will be in touch shortly.';
			form.reset();
			Object.keys(errors).forEach(k => setError(k));
		}, 400);
	});
})();

// Search and dynamic categories/products
(() => {
	const searchInput = $('#product-search');
	const productGrid = $('.product-grid');
	const categoryNav = $('.category-nav');
	const categorySelect = $('#category-select');
	if (!productGrid || !categoryNav) return;

	const getProducts = () => { try { return JSON.parse(localStorage.getItem('parfumy_products') || '[]'); } catch { return []; } };
	const getCategories = () => { try { return JSON.parse(localStorage.getItem('parfumy_categories') || '[]'); } catch { return []; } };

	let currentCategory = 'all';
	let currentQuery = '';
	let cards = $$('.product-card', productGrid);

	const renderCategoryNav = () => {
		const cats = getCategories();
		const catsWithAll = ['all', ...cats];
		const prev = currentCategory;
		categoryNav.innerHTML = '';
		const fragment = document.createDocumentFragment();
		catsWithAll.forEach((c, i) => {
			const btn = document.createElement('button');
			btn.className = 'category-link';
			btn.type = 'button';
			btn.setAttribute('data-category', c.toLowerCase());
			btn.textContent = c === 'all' ? 'All' : c.replace('-', ' ');
			fragment.appendChild(btn);
		});
		categoryNav.appendChild(fragment);
		if (categorySelect) {
			categorySelect.innerHTML = catsWithAll.map(c => `<option value="${c.toLowerCase()}">${c==='all'?'All':c.replace('-', ' ')}</option>`).join('');
		}
		// restore previous selection if still valid; else default to 'all'
		const validCats = new Set(catsWithAll.map(c => c.toLowerCase()));
		currentCategory = validCats.has((prev || '').toLowerCase()) ? prev.toLowerCase() : 'all';
		bindCategoryClicks();
		// mark active
		$$('.category-link', categoryNav).forEach(l => l.classList.toggle('active', l.getAttribute('data-category') === currentCategory));
		if (categorySelect) categorySelect.value = currentCategory;
	};

	const bindCategoryClicks = () => {
		const links = $$('.category-link', categoryNav);
		links.forEach(link => {
			link.addEventListener('click', () => {
				links.forEach(l => l.classList.remove('active'));
				link.classList.add('active');
				currentCategory = (link.getAttribute('data-category') || '').toLowerCase();
				if (categorySelect) categorySelect.value = currentCategory;
				applyFilter();
			});
		});
		if (categorySelect) {
			categorySelect.addEventListener('change', () => {
				currentCategory = categorySelect.value;
				$$('.category-link', categoryNav).forEach(l => l.classList.toggle('active', l.getAttribute('data-category') === currentCategory));
				applyFilter();
			});
		}
	};

	const matches = (card) => {
		const cats = getCategories().map(c => c.toLowerCase());
		const category = (card.getAttribute('data-category') || '').toLowerCase();
		if (!cats.includes(category)) return false; // hide if category removed
		if (currentCategory !== 'all' && currentCategory && category !== currentCategory) return false;
		const text = `${$('.product-title', card)?.textContent || ''} ${$('.product-desc', card)?.textContent || ''}`.toLowerCase();
		if (currentQuery && !text.includes(currentQuery)) return false;
		return true;
	};

	const applyFilter = () => {
		cards.forEach(card => {
			card.style.display = matches(card) ? '' : 'none';
		});
		const anyVisible = cards.some(card => card.style.display !== 'none');
		const emptyEl = document.getElementById('grid-empty');
		if (emptyEl) emptyEl.classList.toggle('show', !anyVisible);
	};

	const bindOrderAndDetails = () => {
		// Wire up Details for dynamically added cards
		$$('.js-details').forEach(btn => {
			if (btn.dataset.bound === '1') return;
			btn.dataset.bound = '1';
			btn.addEventListener('click', () => {
				const card = btn.closest('.product-card');
				const modal = document.getElementById('product-modal');
				if (!card || !modal) return;
				const data = card.getAttribute('data-product') || '{}';
				let p = {};
				try { p = JSON.parse(data); } catch {}
				const titleEl = modal.querySelector('.modal-title');
				const descEl = modal.querySelector('.modal-desc');
				const priceEl = modal.querySelector('.modal-price');
				if (titleEl) titleEl.textContent = p.title || 'Perfume';
				if (descEl) descEl.textContent = p.desc || '';
				if (priceEl) priceEl.textContent = p.price ? `Price: ${p.price}` : '';
				modal.classList.add('show');
				modal.setAttribute('aria-hidden', 'false');
				document.body.style.overflow = 'hidden';
			});
		});
		$$('.js-order').forEach(btn => {
			if (btn.dataset.bound === '1') return;
			btn.dataset.bound = '1';
			btn.addEventListener('click', () => {
				const card = btn.closest('.product-card');
				const product = card ? JSON.parse(card.getAttribute('data-product') || '{}') : {};
				const message = encodeURIComponent(`Hello Parfumy, I would like to order: ${product.title || 'Perfume'}`);
				window.open(`https://wa.me/254713400220?text=${message}`, '_blank');
			});
		});
	};

	const renderDynamicProducts = () => {
		const products = getProducts();
		$$('.product-card.dynamic', productGrid).forEach(el => el.remove());
		const fragment = document.createDocumentFragment();
		const seen = new Set();
		products.forEach(p => {
			if (seen.has(p.id)) return; seen.add(p.id);
			const article = document.createElement('article');
			article.className = 'product-card dynamic';
			article.setAttribute('data-id', String(p.id || ''));
			article.setAttribute('data-category', (p.category || '').toLowerCase());
			article.setAttribute('data-product', JSON.stringify({ title: p.title, price: p.price || '', desc: p.desc }));
			article.innerHTML = `
				<div class="product-media">
					<img src="${p.image}" alt="${p.title}" />
				</div>
				<div class="product-body">
					<h3 class="product-title">${p.title}</h3>
					<p class="product-desc">${p.desc}</p>
					<p class="product-price">${p.price || ''}</p>
					<div class="product-actions">
						<button class="btn btn-primary js-order">Order Now</button>
						<button class="btn btn-ghost js-details">View Details</button>
					</div>
				</div>`;
			fragment.appendChild(article);
		});
		productGrid.prepend(fragment);
		bindOrderAndDetails();
		cards = $$('.product-card', productGrid);
		applyFilter();
	};

	renderCategoryNav();
	renderDynamicProducts();
	applyFilter();

	if (searchInput) {
		searchInput.addEventListener('input', () => {
			currentQuery = searchInput.value.trim().toLowerCase();
			applyFilter();
		});
	}

	window.addEventListener('storage', (e) => {
		if (e.key === 'parfumy_products') { renderDynamicProducts(); }
		if (e.key === 'parfumy_categories') { renderCategoryNav(); applyFilter(); }
	});
})();

// Secret triple-click to open admin
(() => {
	const logo = document.querySelector('.brand-logo');
	if (!logo) return;
	let clicks = 0;
	let timer = null;
	const reset = () => { clicks = 0; if (timer) { clearTimeout(timer); timer = null; } };
	logo.addEventListener('click', (e) => {
		clicks += 1;
		if (timer) clearTimeout(timer);
		// reset if no 3 clicks within 1.2s
		timer = setTimeout(reset, 1200);
		if (clicks >= 3) {
			reset();
			window.open('./admin.html', '_blank');
		}
	});
})();


