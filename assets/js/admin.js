// Simple client-side admin system (no backend). For real security use a server.
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const ADMIN_DEFAULT_USERNAME = 'Ruth';
const ADMIN_DEFAULT_PASSWORD = 'Ruth123';

const SESSION_KEY = 'parfumy_admin';
const SESSION_LAST_ACTIVE = 'parfumy_admin_last_active';
const INACTIVITY_LIMIT_MS = 3 * 60 * 1000; // 3 minutes

function isAuthed() { return localStorage.getItem(SESSION_KEY) === '1'; }
function setAuthed(v) { if (v) localStorage.setItem(SESSION_KEY, '1'); else localStorage.removeItem(SESSION_KEY); }
function touchActivity() { localStorage.setItem(SESSION_LAST_ACTIVE, String(Date.now())); }
function isSessionExpired() {
	const last = parseInt(localStorage.getItem(SESSION_LAST_ACTIVE) || '0', 10);
	return !last || (Date.now() - last) > INACTIVITY_LIMIT_MS;
}

function enforceAuthGuard() {
	const authSection = document.getElementById('auth');
	const dashSection = document.getElementById('dashboard');
	const logoutBtn = document.getElementById('logout-btn');
	const authed = isAuthed() && !isSessionExpired();
	if (!authed) {
		setAuthed(false);
		if (dashSection) dashSection.hidden = true;
		if (authSection) authSection.hidden = false;
		if (logoutBtn) logoutBtn.style.display = 'none';
	} else {
		if (authSection) authSection.hidden = true;
		if (dashSection) dashSection.hidden = false;
		if (logoutBtn) logoutBtn.style.display = '';
	}
}

function startInactivityWatcher() {
	let timer = null;
	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			if (isSessionExpired()) {
				setAuthed(false);
				window.location.href = './admin.html';
			}
		}, INACTIVITY_LIMIT_MS + 250);
	};
	['click','keydown','mousemove','scroll','touchstart'].forEach(evt => {
		document.addEventListener(evt, () => { if (isAuthed()) { touchActivity(); schedule(); } }, { passive: true });
	});
	schedule();
}

async function sha256Hex(text) {
	const enc = new TextEncoder().encode(text);
	const buf = await crypto.subtle.digest('SHA-256', enc);
	return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getProducts() {
	try { return JSON.parse(localStorage.getItem('parfumy_products') || '[]'); } catch { return []; }
}
function setProducts(products) {
	localStorage.setItem('parfumy_products', JSON.stringify(products));
	// Notify other tabs (landing page) to re-render
	try { window.dispatchEvent(new StorageEvent('storage', { key: 'parfumy_products', newValue: JSON.stringify(products) })); } catch {}
}

function renderAdminList() {
	const list = $('#admin-product-list');
	if (!list) return;
	const products = getProducts();
	list.innerHTML = products.map(p => `
		<article class="product-card" data-category="${p.category}">
			<div class="product-media">
				<img src="${p.image}" alt="${p.title}" />
			</div>
			<div class="product-body">
				<h3 class="product-title">${p.title}</h3>
				<p class="product-desc">${p.desc}</p>
			</div>
		</article>
	`).join('');
}

async function ensureAdminCredentials() {
	// Initialize or override admin credentials to the configured defaults
	const hash = await sha256Hex(ADMIN_DEFAULT_PASSWORD);
	localStorage.setItem('parfumy_admin_user', ADMIN_DEFAULT_USERNAME);
	localStorage.setItem('parfumy_admin_hash', hash);
}

async function handleLogin() {
	const form = $('#login-form');
	if (!form) return;
	const status = $('#login-status');

	const getLockUntil = () => parseInt(localStorage.getItem('parfumy_admin_lock_until') || '0', 10);
	const setLockUntil = (ts) => localStorage.setItem('parfumy_admin_lock_until', String(ts));
	const getAttempts = () => parseInt(localStorage.getItem('parfumy_admin_attempts') || '0', 10);
	const setAttempts = (n) => localStorage.setItem('parfumy_admin_attempts', String(n));

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = '';

		const now = Date.now();
		const lockUntil = getLockUntil();
		if (now < lockUntil) {
			const secs = Math.ceil((lockUntil - now) / 1000);
			status.textContent = `Too many attempts. Try again in ${secs}s.`;
			return;
		}

		const user = $('#username').value.trim();
		const pass = $('#password').value;
		if (!user || !pass) { status.textContent = 'Enter username and password.'; return; }

		const storedUser = localStorage.getItem('parfumy_admin_user') || '';
		const storedHash = localStorage.getItem('parfumy_admin_hash') || '';
		const hash = await sha256Hex(pass);

		if (user === storedUser && hash === storedHash) {
			setAuthed(true);
			touchActivity();
			localStorage.setItem('parfumy_admin_attempts', '0');
			enforceAuthGuard();
		} else {
			const attempts = getAttempts() + 1;
			setAttempts(attempts);
			if (attempts >= 5) {
				setLockUntil(Date.now() + 60_000);
				setAttempts(0);
				status.textContent = 'Too many attempts. Locked for 60 seconds.';
			} else {
				status.textContent = 'Invalid credentials.';
			}
		}
	});
}

function requireAuth() {
	enforceAuthGuard();
}

function wireLogout() {
	const btn = document.getElementById('logout-btn');
	if (!btn) return;
	btn.addEventListener('click', () => {
		setAuthed(false);
		window.location.href = './index.html';
	});
}

function wireProductForm() {
	const form = $('#product-form');
	if (!form) return;
	const status = $('#product-status');
	const getError = (key) => $(`.error[data-for="${key}"]`, form);
	const setErr = (key, msg) => { const el = getError(key); if (el) el.textContent = msg || ''; };

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = '';
		const title = $('#p-title').value.trim();
		const desc = $('#p-desc').value.trim();
		const price = $('#p-price').value.trim();
		const category = $('#p-category').value;
		const file = $('#p-image').files[0];

		let ok = true;
		if (!title) { setErr('p-title', 'Enter a name'); ok = false; } else setErr('p-title');
		if (!desc) { setErr('p-desc', 'Enter a description'); ok = false; } else setErr('p-desc');
		if (!category) { setErr('p-category', 'Select a category'); ok = false; } else setErr('p-category');
		if (!file) { setErr('p-image', 'Choose an image'); ok = false; } else setErr('p-image');
		if (!ok) return;

		const dataUrl = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});

		const newProduct = { id: Date.now(), title, desc, price, category, image: dataUrl };
		const products = getProducts();
		products.unshift(newProduct);
		setProducts(products);
		status.textContent = 'Added! It should appear on the site.';
		form.reset();
		renderAdminList();
	});
}

function showRevealImmediately() {
	$$('.reveal').forEach(el => el.classList.add('visible'));
}

// Dashboard navigation
function wireDashboardNav() {
	const links = $$('.sidebar-link');
	const panels = $$('.admin-panel');
	links.forEach(link => {
		link.addEventListener('click', () => {
			links.forEach(l => l.classList.remove('active'));
			link.classList.add('active');
			const target = link.getAttribute('data-target');
			panels.forEach(p => p.hidden = p.id !== target);
		});
	});
}

// Categories storage
function getCategories() {
	try { return JSON.parse(localStorage.getItem('parfumy_categories') || '[]'); } catch { return []; }
}
function setCategories(cats) {
	// Ensure 'all' is never stored
	const filtered = (cats || []).filter(c => c.toLowerCase() !== 'all');
	localStorage.setItem('parfumy_categories', JSON.stringify(filtered));
}
function ensureDefaultCategories() {
	if (!localStorage.getItem('parfumy_categories')) {
		setCategories(['men','women','unisex','kids','niche','gift-sets','gift-cards']);
	}
}
function renderCategories() {
	const list = $('#category-list');
	if (!list) return;
	const cats = getCategories();
	list.innerHTML = cats.map(c => `
		<li>
			<span>${c}</span>
			<div class="admin-actions">
				<button class="btn btn-ghost js-edit-cat" data-cat="${c}">Edit</button>
				<button class="btn btn-danger js-del-cat" data-cat="${c}">Delete</button>
			</div>
		</li>
	`).join('');
	// Fill select in add form (include only stored categories)
	const select = $('#p-category');
	if (select) {
		select.innerHTML = cats.map(c => `<option value="${c}">${c.replace('-', ' ')}</option>`).join('');
	}
	$$('.js-del-cat', list).forEach(btn => btn.addEventListener('click', () => {
		const cat = btn.getAttribute('data-cat');
		if (!confirm(`Delete category "${cat}"? Products in this category will no longer be visible.`)) return;
		const updated = getCategories().filter(x => x !== cat);
		setCategories(updated);
		renderCategories();
	}));
	$$('.js-edit-cat', list).forEach(btn => btn.addEventListener('click', () => {
		const oldCat = btn.getAttribute('data-cat');
		let newCat = prompt('Rename category:', oldCat) || '';
		newCat = newCat.trim().toLowerCase().replace(/\s+/g,'-');
		if (!newCat || newCat === 'all') { alert('Invalid or reserved name.'); return; }
		const catsNow = getCategories();
		if (catsNow.includes(newCat)) { alert('Category already exists.'); return; }
		const renamed = catsNow.map(c => c === oldCat ? newCat : c);
		setCategories(renamed);
		// Update products assigned to old category to use new category
		const products = getProducts().map(p => p.category === oldCat ? { ...p, category: newCat } : p);
		setProducts(products);
		renderCategories();
	}));
}
function wireCategoryForm() {
	const form = $('#category-form');
	if (!form) return;
	const status = $('#category-status');
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		status.textContent = '';
		const name = ($('#cat-name').value || '').trim().toLowerCase().replace(/\s+/g,'-');
		if (!name) { status.textContent = 'Enter a category name.'; return; }
		if (name === 'all') { status.textContent = 'The ALL category is reserved.'; return; }
		const cats = getCategories();
		if (cats.includes(name)) { status.textContent = 'Category exists.'; return; }
		cats.push(name);
		setCategories(cats);
		$('#cat-name').value = '';
		renderCategories();
		status.textContent = 'Added category.';
	});
}

// Users management
async function wireUserForm() {
	const form = $('#user-form');
	if (!form) return;
	const status = $('#user-status');
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = '';
		const user = ($('#new-username').value || '').trim();
		const pass = $('#new-password').value;
		if (!user && !pass) { status.textContent = 'Nothing to update.'; return; }
		if (user) localStorage.setItem('parfumy_admin_user', user);
		if (pass) localStorage.setItem('parfumy_admin_hash', await sha256Hex(pass));
		status.textContent = 'Credentials updated.';
	});
}

// Edit/Delete products
function renderAdminListWithActions() {
	const list = $('#admin-product-list');
	if (!list) return;
	const products = getProducts();
	list.innerHTML = products.map(p => `
		<article class="product-card" data-id="${p.id}">
			<div class="product-media"><img src="${p.image}" alt="${p.title}" /></div>
			<div class="product-body">
				<h3 class="product-title">${p.title}</h3>
				<p class="product-desc">${p.desc}</p>
				<div class="admin-actions">
					<button class="btn btn-ghost js-edit" data-id="${p.id}">Edit</button>
					<button class="btn btn-danger js-delete" data-id="${p.id}">Delete</button>
				</div>
			</div>
		</article>
	`).join('');
	$$('.js-delete', list).forEach(btn => btn.addEventListener('click', () => {
		const id = Number(btn.getAttribute('data-id'));
		const updated = getProducts().filter(x => x.id !== id);
		setProducts(updated);
		renderAdminListWithActions();
	}));
	$$('.js-edit', list).forEach(btn => btn.addEventListener('click', () => {
		const id = Number(btn.getAttribute('data-id'));
		const p = getProducts().find(x => x.id === id);
		if (!p) return;
		$('#p-title').value = p.title;
		$('#p-desc').value = p.desc;
		$('#p-price').value = p.price || '';
		$('#p-category').value = p.category;
		// Image remains as-is unless re-uploaded
		// Switch to Add panel for editing
		$$('.sidebar-link').forEach(l => l.classList.remove('active'));
		$$('.admin-panel').forEach(panel => panel.hidden = panel.id !== 'panel-add');
		$$('.sidebar-link').find(l => l.getAttribute('data-target') === 'panel-add')?.classList.add('active');
		// On next submit, replace instead of add
		const form = $('#product-form');
		form.dataset.editId = String(id);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}));
}

// Override product form to support edit
function wireProductFormWithEdit() {
	const form = $('#product-form');
	if (!form) return;
	const status = $('#product-status');
	const getError = (key) => $(`.error[data-for="${key}"]`, form);
	const setErr = (key, msg) => { const el = getError(key); if (el) el.textContent = msg || ''; };

	if (form.dataset.bound === '1') return; // prevent double-binding
	form.dataset.bound = '1';

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = '';
		const titleRaw = $('#p-title').value;
		const title = (titleRaw || '').trim();
		const desc = ($('#p-desc').value || '').trim();
		const price = ($('#p-price').value || '').trim();
		const category = ($('#p-category').value || '').trim().toLowerCase();
		const file = $('#p-image').files[0];

		let ok = true;
		if (!title) { setErr('p-title', 'Enter a name'); ok = false; } else setErr('p-title');
		if (!desc) { setErr('p-desc', 'Enter a description'); ok = false; } else setErr('p-desc');
		if (!price) { setErr('p-price', 'Enter a price'); ok = false; } else setErr('p-price');
		if (!category) { setErr('p-category', 'Select a category'); ok = false; } else setErr('p-category');
		if (!ok) return;

		let dataUrl = null;
		if (file) {
			dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
		}

		const key = `${title.toLowerCase()}|${category}`;
		const editId = form.dataset.editId ? Number(form.dataset.editId) : null;
		const products = getProducts();

		if (editId) {
			const idx = products.findIndex(x => x.id === editId);
			if (idx !== -1) {
				products[idx] = {
					...products[idx],
					title, desc, price, category,
					image: dataUrl ? dataUrl : products[idx].image
				};
				setProducts(products);
				status.textContent = 'Updated.';
				form.dataset.editId = '';
				form.reset();
				renderAdminListWithActions();
				return;
			}
		}

		// Upsert: if a product with same title+category exists, update it instead of inserting duplicate
		const existingIdx = products.findIndex(p => `${(p.title||'').toLowerCase()}|${(p.category||'').toLowerCase()}` === key);
		if (existingIdx !== -1) {
			products[existingIdx] = {
				...products[existingIdx],
				title, desc, price, category,
				image: dataUrl ? dataUrl : products[existingIdx].image
			};
			setProducts(products);
			status.textContent = 'Updated existing perfume.';
			form.reset();
			renderAdminListWithActions();
			return;
		}

		const newProduct = { id: Date.now(), title, desc, price, category, image: dataUrl || '' };
		if (!newProduct.image) { setErr('p-image', 'Choose an image'); return; }
		products.unshift(newProduct);
		setProducts(products);
		status.textContent = 'Added! It should appear on the site.';
		form.reset();
		renderAdminListWithActions();
	});
}

// Users storage
function getUsers() {
	try { return JSON.parse(localStorage.getItem('parfumy_users') || '[]'); } catch { return []; }
}
function setUsers(users) {
	localStorage.setItem('parfumy_users', JSON.stringify(users));
}
function ensureDefaultUser() {
	const users = getUsers();
	if (!users.length) {
		users.push({ id: Date.now(), username: localStorage.getItem('parfumy_admin_user') || 'admin' });
		setUsers(users);
	}
}
function renderUsers() {
	const list = $('#users-list');
	if (!list) return;
	const users = getUsers();
	list.innerHTML = users.map(u => `
		<li>
			<span>${u.username}</span>
			<div class="admin-actions">
				<button class="btn btn-ghost js-user-edit" data-id="${u.id}">Edit</button>
				<button class="btn btn-danger js-user-delete" data-id="${u.id}">Delete</button>
			</div>
		</li>
	`).join('');
	$$('.js-user-delete', list).forEach(btn => btn.addEventListener('click', () => {
		const id = Number(btn.getAttribute('data-id'));
		const updated = getUsers().filter(x => x.id !== id);
		setUsers(updated);
		renderUsers();
	}));
	$$('.js-user-edit', list).forEach(btn => btn.addEventListener('click', () => {
		const id = Number(btn.getAttribute('data-id'));
		const user = getUsers().find(x => x.id === id);
		if (!user) return;
		$('#add-username').value = user.username;
		$('#user-add-form').dataset.editId = String(id);
		$('#user-add-status').textContent = 'Editing existing user...';
	}));
}
function wireUserAddForm() {
	const form = $('#user-add-form');
	if (!form) return;
	const status = $('#user-add-status');
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = '';
		const username = ($('#add-username').value || '').trim();
		const password = $('#add-password').value;
		if (!username || !password) { status.textContent = 'Enter username and password.'; return; }
		const users = getUsers();
		const editId = form.dataset.editId ? Number(form.dataset.editId) : null;
		if (editId) {
			const idx = users.findIndex(x => x.id === editId);
			if (idx !== -1) {
				users[idx] = { ...users[idx], username };
				// if editing the current admin user, sync to auth store as well
				if ((localStorage.getItem('parfumy_admin_user') || '') === users[idx].username) {
					localStorage.setItem('parfumy_admin_user', username);
					if (password) localStorage.setItem('parfumy_admin_hash', await sha256Hex(password));
				}
				setUsers(users);
				status.textContent = 'User updated.';
				form.dataset.editId = '';
				form.reset();
				renderUsers();
				return;
			}
		}
		users.push({ id: Date.now(), username });
		setUsers(users);
		status.textContent = 'User added.';
		form.reset();
		renderUsers();
	});
}

// Initialize users and wire forms in dashboard init
function initDashboard() {
	wireDashboardNav();
	ensureDefaultCategories();
	renderCategories();
	renderAdminListWithActions();
	wireCategoryForm();
	wireUserForm();
	wireProductFormWithEdit();
	ensureDefaultUser();
	renderUsers();
	wireUserAddForm();
}

document.addEventListener('DOMContentLoaded', async () => {
	showRevealImmediately();
	await ensureAdminCredentials();
	requireAuth();
	handleLogin();
	renderAdminList();
	initDashboard();
	wireLogout();
	if (isAuthed()) startInactivityWatcher();
});

// Secret triple-click on admin logo (kept for parity; opens admin.html in new tab)
(function(){
	const logo = document.querySelector('.brand-logo');
	if (!logo) return;
	let clicks = 0; let timer = null;
	const reset = () => { clicks = 0; if (timer) { clearTimeout(timer); timer = null; } };
	logo.addEventListener('click', () => {
		clicks += 1;
		if (timer) clearTimeout(timer);
		timer = setTimeout(reset, 1200);
		if (clicks >= 3) { reset(); window.open('./admin.html', '_blank'); }
	});
})();
