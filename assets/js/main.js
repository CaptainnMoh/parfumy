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

// Search and category filtering
(() => {
    const searchInput = $('#product-search');
    const productGrid = $('.product-grid');
    if (!productGrid) return;
    const cards = $$('.product-card', productGrid);
    const categoryLinks = $$('.category-link');

    let currentCategory = 'all';
    let currentQuery = '';

    const matches = (card) => {
        const category = (card.getAttribute('data-category') || '').toLowerCase();
        const text = `${$('.product-title', card)?.textContent || ''} ${$('.product-desc', card)?.textContent || ''}`.toLowerCase();
        const categoryOk = currentCategory === 'all' || category === currentCategory;
        const queryOk = !currentQuery || text.includes(currentQuery);
        return categoryOk && queryOk;
    };

    const applyFilter = () => {
        cards.forEach(card => {
            card.style.display = matches(card) ? '' : 'none';
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentQuery = searchInput.value.trim().toLowerCase();
            applyFilter();
        });
    }

    categoryLinks.forEach(link => {
        link.addEventListener('click', () => {
            categoryLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentCategory = (link.getAttribute('data-category') || 'all').toLowerCase();
            applyFilter();
        });
    });
})();


