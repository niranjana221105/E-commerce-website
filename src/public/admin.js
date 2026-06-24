'use strict';
/* ══════════════════════════════════════════
   eCommerce Admin Panel
══════════════════════════════════════════ */

const API = '/admin/api';
const PRODUCTS_API = '/products';

const CATEGORY_META = {
  'Electronics':    { icon:'🖥️', bg:'#eef2ff' },
  'Books':          { icon:'📚', bg:'#f0f9ff' },
  'Clothing':       { icon:'👕', bg:'#fdf4ff' },
  'Home':           { icon:'🏠', bg:'#f0fdf4' },
  'Sports':         { icon:'⚽', bg:'#fffbeb' },
  'Beauty':         { icon:'💄', bg:'#fff1f2' },
  'Toys':           { icon:'🧸', bg:'#fefce8' },
  'Automotive':     { icon:'🚗', bg:'#f0fdfa' },
  'Garden':         { icon:'🌱', bg:'#dcfce7' },
  'Food & Grocery': { icon:'🛒', bg:'#fff7ed' },
  'Health':         { icon:'💊', bg:'#ecfeff' },
  'Music':          { icon:'🎸', bg:'#faf5ff' },
  'Office':         { icon:'🖊️',bg:'#f8fafc' },
  'Pets':           { icon:'🐾', bg:'#fef3c7' },
  'Travel':         { icon:'✈️', bg:'#eff6ff' },
};

const STAGE_LABELS = { ordered:'Order Placed', processing:'Processing', shipped:'Shipped', out:'Out for Delivery', delivered:'Delivered' };

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
function catSlug(c){ return c.replace(/[^a-zA-Z0-9]/g,''); }

let adminKey = '';

// ── Auth ──────────────────────────────────────────────────────────────────────
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('adminKeyInput').value.trim();
  if (!key) { $('loginErr').textContent = 'Enter your admin key.'; return; }
  $('loginLabel').textContent = 'Signing in…'; $('loginSpin').classList.remove('hidden');
  try {
    const r = await fetch(`${API}/stats`, { headers: { 'x-admin-key': key } });
    if (!r.ok) throw new Error('Invalid key');
    adminKey = key;
    localStorage.setItem('ec_admin_key', key);
    $('loginScreen').classList.add('hidden');
    $('adminApp').classList.remove('hidden');
    document.body.classList.remove('login-page');
    initAdmin();
  } catch {
    $('loginErr').textContent = 'Invalid admin key. Try admin123.';
  } finally {
    $('loginLabel').textContent = 'Sign In'; $('loginSpin').classList.add('hidden');
  }
});

$('logoutBtn').addEventListener('click', () => {
  adminKey = '';
  localStorage.removeItem('ec_admin_key');
  location.reload();
});

// Auto-login from localStorage
(function autoLogin() {
  const saved = localStorage.getItem('ec_admin_key');
  if (saved) {
    $('adminKeyInput').value = saved;
    $('loginForm').dispatchEvent(new Event('submit'));
  }
})();

// ── Navigation ─────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
document.querySelectorAll('.adm-nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});
document.querySelectorAll('.adm-link-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.adm-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.adm-page').forEach(p => p.classList.toggle('hidden', p.id !== `page${cap(page)}`));
  $('pageTitle').textContent = { dashboard:'Dashboard', products:'Products', orders:'Orders', categories:'Categories' }[page] || page;
  if (page === 'dashboard')   loadDashboard();
  if (page === 'products')    loadProducts();
  if (page === 'orders')      loadOrders();
  if (page === 'categories')  loadCategories();
}

function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

// ── Init ──────────────────────────────────────────────────────────────────────
function initAdmin() {
  checkHealth();
  navigateTo('dashboard');
}

async function checkHealth() {
  try {
    const r = await fetch('/health');
    const d = await r.json();
    const el = $('admDbStatus');
    if (d.status === 'ok') { el.className='adm-db-status ok'; $('admDbLabel').textContent='DB Connected'; }
    else throw 0;
  } catch {
    const el=$('admDbStatus'); el.className='adm-db-status err'; $('admDbLabel').textContent='DB Offline';
  }
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard() {
  try {
    const [statsRes] = await Promise.all([
      fetch(`${API}/stats`, { headers: { 'x-admin-key': adminKey } }),
    ]);
    const stats = await statsRes.json();
    const orders = JSON.parse(localStorage.getItem('ec_orders') || '[]');
    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);

    // Stat cards
    $('statGrid').innerHTML = `
      <div class="stat-card stat-card--blue">
        <div class="stat-card__icon">📦</div>
        <div class="stat-card__label">Total Products</div>
        <div class="stat-card__value">${stats.totalProducts.toLocaleString()}</div>
        <div class="stat-card__sub">Across ${stats.categoryBreakdown.length} categories</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__icon">🧾</div>
        <div class="stat-card__label">Total Orders</div>
        <div class="stat-card__value">${orders.length}</div>
        <div class="stat-card__sub">From this browser session</div>
      </div>
      <div class="stat-card stat-card--amber">
        <div class="stat-card__icon">💰</div>
        <div class="stat-card__label">Total Revenue</div>
        <div class="stat-card__value">${fmt(revenue)}</div>
        <div class="stat-card__sub">From placed orders</div>
      </div>
      <div class="stat-card stat-card--purple">
        <div class="stat-card__icon">🏷️</div>
        <div class="stat-card__label">Categories</div>
        <div class="stat-card__value">${stats.categoryBreakdown.length}</div>
        <div class="stat-card__sub">Active product categories</div>
      </div>`;

    // Category bar chart
    const maxCount = Math.max(...stats.categoryBreakdown.map(c => c.count), 1);
    $('categoryChart').innerHTML = stats.categoryBreakdown.map(c => `
      <div class="cat-bar-row">
        <span class="cat-bar-label">${escHtml(c.category)}</span>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.count/maxCount*100).toFixed(1)}%"></div></div>
        <span class="cat-bar-count">${c.count.toLocaleString()}</span>
      </div>`).join('');

    // Recent orders
    if (orders.length === 0) {
      $('recentOrdersList').innerHTML = '<div class="no-data">No orders yet. Place an order from the store to see it here.</div>';
    } else {
      $('recentOrdersList').innerHTML = orders.slice(0,8).map(o => `
        <div class="recent-order-row">
          <div>
            <div class="recent-order-row__id">${escHtml(o.id)}</div>
            <div class="recent-order-row__email">${escHtml(o.email||'—')}</div>
          </div>
          <div class="recent-order-row__total">${fmt(o.total)}</div>
        </div>`).join('');
    }
  } catch (err) {
    showToast('Failed to load dashboard stats', 'error');
  }
}

// ══════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════
let prodPage = 1;
let prodSearch = '';
let prodCat = '';
let prodEditingId = null;

async function loadProducts(page = 1) {
  prodPage = page;
  const params = new URLSearchParams({ page, limit: 20 });
  if (prodSearch) params.set('search', prodSearch);
  if (prodCat)    params.set('category', prodCat);

  $('prodTableBody').innerHTML = `<tr><td colspan="5" class="adm-loading">Loading…</td></tr>`;
  try {
    const r = await fetch(`${API}/products?${params}`, { headers: { 'x-admin-key': adminKey } });
    const d = await r.json();
    renderProdTable(d.products);
    renderProdPagination(d.page, d.pages, d.total);
  } catch {
    $('prodTableBody').innerHTML = `<tr><td colspan="5" class="adm-loading">Failed to load products.</td></tr>`;
  }
}

function renderProdTable(products) {
  if (!products.length) {
    $('prodTableBody').innerHTML = `<tr><td colspan="5" class="adm-loading">No products found.</td></tr>`;
    return;
  }
  $('prodTableBody').innerHTML = products.map(p => {
    const meta = CATEGORY_META[p.category] || { icon:'📦', bg:'#f9f9f9' };
    const slug = catSlug(p.category);
    return `<tr>
      <td>
        <div class="prod-name-cell">
          <div class="prod-icon" style="background:${meta.bg}">${meta.icon}</div>
          <span class="prod-name" title="${escHtml(p.name)}">${escHtml(p.name)}</span>
        </div>
      </td>
      <td><span class="cat-pill cat-${slug}">${escHtml(p.category)}</span></td>
      <td>${fmt(p.price)}</td>
      <td>${new Date(p.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
      <td>
        <div class="action-btns">
          <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick="editProduct('${p.id}','${escHtml(p.name).replace(/'/g,"\\'")}','${escHtml(p.category)}','${p.price}')">✏️ Edit</button>
          <button class="adm-btn adm-btn--sm adm-btn--danger" onclick="deleteProduct('${p.id}','${escHtml(p.name).replace(/'/g,"\\'")}')">🗑️ Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderProdPagination(page, pages, total) {
  $('prodPagination').innerHTML = `
    <button class="adm-pag-btn" onclick="loadProducts(${page-1})" ${page<=1?'disabled':''}>← Prev</button>
    <span class="adm-pag-info">Page ${page} of ${pages} · ${total.toLocaleString()} products</span>
    <button class="adm-pag-btn" onclick="loadProducts(${page+1})" ${page>=pages?'disabled':''}>Next →</button>`;
}

// Search & filter
let prodSearchTimer;
$('prodSearch').addEventListener('input', e => {
  clearTimeout(prodSearchTimer);
  prodSearchTimer = setTimeout(() => { prodSearch = e.target.value.trim(); loadProducts(1); }, 350);
});
$('prodCatFilter').addEventListener('change', e => { prodCat = e.target.value; loadProducts(1); });
$('addProdBtn').addEventListener('click', () => openProdModal());

// Product modal
function openProdModal(id, name, category, price) {
  prodEditingId = id || null;
  $('prodModalTitle').textContent = id ? 'Edit Product' : 'Add Product';
  $('prodModalLabel').textContent = id ? 'Save Changes' : 'Add Product';
  $('pmName').value     = name     || '';
  $('pmCategory').value = category || '';
  $('pmPrice').value    = price    || '';
  clearProdErrors();
  $('prodModalOverlay').classList.remove('hidden');
  setTimeout(() => $('pmName').focus(), 50);
}
window.editProduct = openProdModal;

function closeProdModal() { $('prodModalOverlay').classList.add('hidden'); prodEditingId = null; }
$('prodModalClose').addEventListener('click', closeProdModal);
$('prodModalCancel').addEventListener('click', closeProdModal);
$('prodModalOverlay').addEventListener('click', e => { if (e.target === $('prodModalOverlay')) closeProdModal(); });

$('prodModalForm').addEventListener('submit', async e => {
  e.preventDefault(); clearProdErrors();
  const name     = $('pmName').value.trim();
  const category = $('pmCategory').value;
  const price    = parseFloat($('pmPrice').value);
  let ok = true;
  if (!name)                   { $('pmErrName').textContent='Name is required.';  $('pmName').classList.add('error');     ok=false; }
  if (!category)               { $('pmErrCat').textContent='Select a category.';  $('pmCategory').classList.add('error'); ok=false; }
  if (isNaN(price)||price < 0) { $('pmErrPrice').textContent='Enter valid price.'; $('pmPrice').classList.add('error');   ok=false; }
  if (!ok) return;

  $('prodModalSubmit').disabled = true; $('prodModalSpin').classList.remove('hidden');
  try {
    const isEdit = !!prodEditingId;
    const res = await fetch(
      isEdit ? `${PRODUCTS_API}/${prodEditingId}` : PRODUCTS_API,
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name, category, price }) }
    );
    if (!res.ok) { const d = await res.json().catch(()=>{}); throw new Error(d?.error||'Error'); }
    closeProdModal();
    showToast(isEdit ? '✅ Product updated!' : '✅ Product added!', 'success');
    loadProducts(prodPage);
  } catch (err) { showToast(err.message || 'Something went wrong', 'error'); }
  finally { $('prodModalSubmit').disabled=false; $('prodModalSpin').classList.add('hidden'); }
});

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    const r = await fetch(`${API}/products/${id}`, { method:'DELETE', headers:{'x-admin-key':adminKey} });
    if (!r.ok) throw new Error('Delete failed');
    showToast('🗑️ Product deleted', 'success');
    loadProducts(prodPage);
  } catch { showToast('Failed to delete product', 'error'); }
}
window.deleteProduct = deleteProduct;

function clearProdErrors() {
  ['pmErrName','pmErrCat','pmErrPrice'].forEach(id => $(id).textContent='');
  ['pmName','pmCategory','pmPrice'].forEach(id => $(id).classList.remove('error'));
}

// ══════════════════════════════════════════
//  ORDERS
// ══════════════════════════════════════════
let ordersData = [];

function loadOrders() {
  ordersData = JSON.parse(localStorage.getItem('ec_orders') || '[]');
  renderOrdersTable(ordersData);
}

function computeStage(placedAt) {
  const mins = (Date.now() - placedAt) / 60000;
  if (mins < 1)  return 'ordered';
  if (mins < 3)  return 'processing';
  if (mins < 6)  return 'shipped';
  if (mins < 10) return 'out';
  return 'delivered';
}

function renderOrdersTable(orders) {
  if (!orders.length) {
    $('ordersTableBody').innerHTML = `<tr><td colspan="7" class="adm-loading">No orders found. Place an order from the store first.</td></tr>`;
    return;
  }
  $('ordersTableBody').innerHTML = orders.map(o => {
    const stage = o.adminStatus || computeStage(o.placedAt);
    const itemCount = o.items ? o.items.reduce((s,i)=>s+i.qty,0) : 0;
    return `<tr>
      <td style="font-family:monospace;font-size:.75rem;font-weight:700">${escHtml(o.id)}</td>
      <td>
        <div style="font-size:.82rem;font-weight:600">${escHtml(o.email||'—')}</div>
        <div style="font-size:.72rem;color:#6b7280">${escHtml(o.address||'—')}</div>
      </td>
      <td>${itemCount} item${itemCount!==1?'s':''}</td>
      <td style="font-weight:700">${fmt(o.total)}</td>
      <td><span class="status-pill sp--${stage}">${STAGE_LABELS[stage]||stage}</span></td>
      <td>${new Date(o.placedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
      <td>
        <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick="viewOrder('${o.id}')">👁 View</button>
      </td>
    </tr>`;
  }).join('');
}

// Search & filter orders
let orderSearchTimer;
$('orderSearch').addEventListener('input', e => {
  clearTimeout(orderSearchTimer);
  orderSearchTimer = setTimeout(() => {
    const q = e.target.value.toLowerCase();
    const filtered = ordersData.filter(o => o.id.toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q));
    renderOrdersTable(filtered);
  }, 250);
});
$('orderStatusFilter').addEventListener('change', e => {
  const s = e.target.value;
  const filtered = s ? ordersData.filter(o => (o.adminStatus || computeStage(o.placedAt)) === s) : ordersData;
  renderOrdersTable(filtered);
});

// View order modal
window.viewOrder = function(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;
  const stage = o.adminStatus || computeStage(o.placedAt);

  $('orderModalTitle').textContent = 'Order Detail';
  $('orderModalId').textContent = o.id;

  const itemsMeta = (o.items || []).map(({ product:p, qty }) => {
    const meta = CATEGORY_META[p.category] || { icon:'📦', bg:'#f9f9f9' };
    return `<div class="order-detail-item">
      <div class="order-detail-item__img" style="background:${meta.bg}">${meta.icon}</div>
      <span class="order-detail-item__name">${escHtml(p.name)}</span>
      <span style="color:#6b7280;font-size:.75rem">×${qty}</span>
      <span class="order-detail-item__price">${fmt(p.price*qty)}</span>
    </div>`;
  }).join('');

  $('orderModalBody').innerHTML = `
    <div class="order-detail-section">
      <h4>Customer Info</h4>
      <div class="order-detail-row"><span>Email</span><span>${escHtml(o.email||'—')}</span></div>
      <div class="order-detail-row"><span>Ship To</span><span>${escHtml(o.address||'—')}</span></div>
      <div class="order-detail-row"><span>Country</span><span>${escHtml(o.country||'—')}</span></div>
      <div class="order-detail-row"><span>Order Date</span><span>${new Date(o.placedAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
    </div>
    <div class="order-detail-section">
      <h4>Items (${(o.items||[]).reduce((s,i)=>s+i.qty,0)})</h4>
      <div class="order-items-list">${itemsMeta || '<div style="color:#9ca3af;font-size:.8rem">No items</div>'}</div>
    </div>
    <div class="order-detail-section">
      <h4>Order Total</h4>
      <div class="order-detail-row"><span>Order Total</span><span style="font-size:1rem">${fmt(o.total)}</span></div>
    </div>`;

  $('orderStatusControls').innerHTML = `
    <label>Update Status:</label>
    <select id="orderStatusSel">
      ${Object.entries(STAGE_LABELS).map(([k,v]) => `<option value="${k}" ${k===stage?'selected':''}>${v}</option>`).join('')}
    </select>
    <button class="adm-btn adm-btn--primary adm-btn--sm" onclick="updateOrderStatus('${o.id}')">Update</button>`;

  $('orderModalOverlay').classList.remove('hidden');
};

window.updateOrderStatus = function(ordId) {
  const newStatus = $('orderStatusSel').value;
  const idx = ordersData.findIndex(o => o.id === ordId);
  if (idx === -1) return;
  ordersData[idx].adminStatus = newStatus;
  localStorage.setItem('ec_orders', JSON.stringify(ordersData));
  showToast(`✅ Status updated to "${STAGE_LABELS[newStatus]}"`, 'success');
  renderOrdersTable(ordersData);
  // Update status pill in modal header
  $('orderModalId').textContent = ordId;
};

$('orderModalClose').addEventListener('click', () => $('orderModalOverlay').classList.add('hidden'));
$('orderModalDone').addEventListener('click', () => $('orderModalOverlay').classList.add('hidden'));
$('orderModalOverlay').addEventListener('click', e => { if (e.target === $('orderModalOverlay')) $('orderModalOverlay').classList.add('hidden'); });

// ══════════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════════
async function loadCategories() {
  $('catDetailGrid').innerHTML = '<div style="padding:2rem;color:#9ca3af">Loading…</div>';
  try {
    const r = await fetch(`${API}/stats`, { headers: { 'x-admin-key': adminKey } });
    const d = await r.json();
    $('catDetailGrid').innerHTML = d.categoryBreakdown.map(c => {
      const meta = CATEGORY_META[c.category] || { icon:'📦' };
      return `<div class="cat-detail-card">
        <div class="cat-detail-card__name">${meta.icon} ${escHtml(c.category)}</div>
        <div class="cat-detail-card__stat"><span>Products</span><span>${c.count.toLocaleString()}</span></div>
        <div class="cat-detail-card__stat"><span>Avg Price</span><span>${fmt(c.avgPrice)}</span></div>
        <div class="cat-detail-card__stat"><span>Min Price</span><span>${fmt(c.minPrice)}</span></div>
        <div class="cat-detail-card__stat"><span>Max Price</span><span>${fmt(c.maxPrice)}</span></div>
      </div>`;
    }).join('');
  } catch { $('catDetailGrid').innerHTML = '<div style="padding:2rem;color:#ef4444">Failed to load categories.</div>'; }
}

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  const t = $('admToast');
  t.textContent = msg;
  t.className = `adm-toast adm-toast--${type}`;
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// Close modals on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeProdModal();
    $('orderModalOverlay').classList.add('hidden');
  }
});
