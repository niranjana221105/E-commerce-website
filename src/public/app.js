
'use strict';
/* ══════════════════════════════════════════
   eCommerce — Product Browser
   Features: Browse · Search · Cart · Wishlist · Checkout
══════════════════════════════════════════ */

const API = '';

const CATEGORY_META = {
  'Electronics':    { icon:'🖥️',  bg:'#eef2ff' },
  'Books':          { icon:'📚',  bg:'#f0f9ff' },
  'Clothing':       { icon:'👕',  bg:'#fdf4ff' },
  'Home':           { icon:'🏠',  bg:'#f0fdf4' },
  'Sports':         { icon:'⚽',  bg:'#fffbeb' },
  'Beauty':         { icon:'💄',  bg:'#fff1f2' },
  'Toys':           { icon:'🧸',  bg:'#fefce8' },
  'Automotive':     { icon:'🚗',  bg:'#f0fdfa' },
  'Garden':         { icon:'🌱',  bg:'#dcfce7' },
  'Food & Grocery': { icon:'🛒',  bg:'#fff7ed' },
  'Health':         { icon:'💊',  bg:'#ecfeff' },
  'Music':          { icon:'🎸',  bg:'#faf5ff' },
  'Office':         { icon:'🖊️', bg:'#f8fafc' },
  'Pets':           { icon:'🐾',  bg:'#fef3c7' },
  'Travel':         { icon:'✈️',  bg:'#eff6ff' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }

function fakeReviews(id){
  const seed = id.charCodeAt(0)+id.charCodeAt(id.length-1);
  return { stars:Math.min(5,+(3.5+(seed%30)/20).toFixed(1)), count:100+(seed*37)%4900 };
}
function starsHtml(r){
  return '★'.repeat(Math.floor(r))+(r%1>=.5?'½':'')+'☆'.repeat(5-Math.floor(r)-(r%1>=.5?1:0));
}
function deliveryDate(){
  const d=new Date(); d.setDate(d.getDate()+1+Math.floor(Math.random()*3));
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function orderId(){ return 'EC-'+Date.now().toString(36).toUpperCase(); }

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  page:1, cursors:[null], nextCursor:null,
  category:'', limit:24, loading:false, editingId:null,
  searchQuery:'', allProducts:[], sortOrder:'',
};

// Cart: [{ product, qty }]
const cart     = JSON.parse(localStorage.getItem('ec_cart')    ||'[]');
// Wishlist: Set of product ids
const wishSet  = new Set(JSON.parse(localStorage.getItem('ec_wish')    ||'[]'));
// Wishlist products store
const wishProducts = JSON.parse(localStorage.getItem('ec_wishProds')||'[]');

function saveCart(){ localStorage.setItem('ec_cart', JSON.stringify(cart)); }
function saveWish(){
  localStorage.setItem('ec_wish',     JSON.stringify([...wishSet]));
  localStorage.setItem('ec_wishProds',JSON.stringify(wishProducts));
}

// ── DOM refs ───────────────────────────────────────────────────────────────────
const grid         = $('productGrid');
const emptyState   = $('emptyState');
const emptyMsg     = $('emptyMsg');
const resultsQuery = $('resultsQuery');
const resultsCount = $('resultsCount');
const prevBtn      = $('prevBtn');
const nextBtn      = $('nextBtn');
const pageInfo     = $('pageInfo');
const addBtn       = $('addProductBtn');
const emptyAddBtn  = $('emptyAddBtn');
const searchInput  = $('searchInput');
const searchBtn    = $('searchBtn');
const searchCatSel = $('searchCatSelect');
const sortSelect   = $('sortSelect');
const healthStatus = $('healthStatus');
const toast        = $('toast');
const toastMsg     = $('toastMsg');
const toastIcon    = $('toastIcon');

// Cart drawer
const cartBtn      = $('cartBtn');
const cartBadge    = $('cartBadge');
const cartOverlay  = $('cartOverlay');
const cartDrawer   = $('cartDrawer');
const cartClose    = $('cartClose');
const cartBody     = $('cartBody');
const cartEmpty    = $('cartEmpty');
const cartList     = $('cartList');
const cartFooter   = $('cartFooter');
const cartItemCount= $('cartItemCount');
const cartSubtotal = $('cartSubtotal');
const cartSavingsRow=$('cartSavingsRow');
const cartSavings  = $('cartSavings');
const checkoutBtn  = $('checkoutBtn');
const clearCartBtn = $('clearCartBtn');

// Wishlist drawer
const wishlistBtn     = $('wishlistBtn');
const wishlistBadge   = $('wishlistBadge');
const wishlistOverlay = $('wishlistOverlay');
const wishlistDrawer  = $('wishlistDrawer');
const wishlistClose   = $('wishlistClose');
const wishlistEmpty   = $('wishlistEmpty');
const wishlistList    = $('wishlistList');
const wishlistFooter  = $('wishlistFooter');
const addAllToCartBtn = $('addAllToCartBtn');
const clearWishlistBtn= $('clearWishlistBtn');

// Billing
const billingOverlay  = $('billingOverlay');
const billingClose    = $('billingClose');
const modalOverlay    = $('modalOverlay');
const modalTitle      = $('modalTitle');
const modalClose      = $('modalClose');
const modalCancel     = $('modalCancel');
const productForm     = $('productForm');
const modalSubmit     = $('modalSubmit');

// ── Health ─────────────────────────────────────────────────────────────────────
async function checkHealth(){
  try{
    const r=await fetch(`${API}/health`); const d=await r.json();
    if(d.status==='ok'){ healthStatus.className='navbar__status ok'; healthStatus.querySelector('.status-label').textContent='Live'; }
    else throw 0;
  }catch{ healthStatus.className='navbar__status err'; healthStatus.querySelector('.status-label').textContent='Offline'; }
}

// ── Fetch products ─────────────────────────────────────────────────────────────
async function fetchProducts(cursor=null){
  if(state.loading) return;
  state.loading=true; renderSkeletons();
  const p=new URLSearchParams({limit:state.limit});
  if(cursor)         p.set('cursor',cursor);
  if(state.category) p.set('category',state.category);
  try{
    const r=await fetch(`${API}/products?${p}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    state.nextCursor=data.nextCursor; state.allProducts=data.products;
    applyLocalFilterAndRender(data.meta); updatePagination(data.meta);
  }catch{
    showToast('Failed to load products.','error');
    grid.innerHTML=''; emptyState.classList.remove('hidden');
  }finally{ state.loading=false; }
}

function applyLocalFilterAndRender(meta){
  let products=[...state.allProducts];
  const q=state.searchQuery.toLowerCase().trim();
  if(q) products=products.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q));
  if(state.sortOrder==='price_asc')  products.sort((a,b)=>a.price-b.price);
  if(state.sortOrder==='price_desc') products.sort((a,b)=>b.price-a.price);
  renderProducts(products,q,meta);
}

function renderProducts(products,query){
  grid.innerHTML=''; emptyState.classList.add('hidden');
  if(query){ resultsQuery.textContent=`Results for "${query}"`; resultsQuery.style.fontStyle='italic'; }
  else if(state.category){ resultsQuery.textContent=state.category; resultsQuery.style.fontStyle='normal'; }
  else{ resultsQuery.textContent='All Products'; resultsQuery.style.fontStyle='normal'; }
  resultsCount.textContent=products.length
    ? `${products.length} result${products.length!==1?'s':''} · Page ${state.page}` : '0 results';
  if(!products.length){
    emptyMsg.textContent=query
      ? `No products match "${query}". Try a category like "Beauty" or "Electronics".`
      : 'No products found. Try a different category.';
    emptyState.classList.remove('hidden'); return;
  }
  const frag=document.createDocumentFragment();
  products.forEach(p=>frag.appendChild(buildCard(p)));
  grid.appendChild(frag);
}

// ── Build product card ─────────────────────────────────────────────────────────
function buildCard(p){
  const meta=CATEGORY_META[p.category]||{icon:'📦',bg:'#f9f9f9'};
  const slug=p.category.replace(/[^a-zA-Z0-9]/g,'');
  const rev=fakeReviews(p.id);
  const whole=Math.floor(p.price);
  const frac=String(Math.round((p.price-whole)*100)).padStart(2,'0');
  const isPrime=p.price>25;
  const isLow=p.id.charCodeAt(2)%7===0;
  const isWished=wishSet.has(p.id);

  const card=document.createElement('article');
  card.className='product-card'; card.setAttribute('role','listitem');
  card.innerHTML=`
    <div class="product-card__top-strip">
      <span class="product-card__badge badge--${slug}">${escHtml(p.category)}</span>
      <div style="display:flex;gap:4px;align-items:center">
        <button class="product-card__wish-btn${isWished?' wishlisted':''}" data-id="${p.id}" aria-label="${isWished?'Remove from':'Add to'} wishlist" title="Wishlist">
          ${isWished?'❤️':'🤍'}
        </button>
        <button class="product-card__edit-btn" aria-label="Edit ${escHtml(p.name)}">
          <svg viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H2V9L9.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
    <div class="product-card__img" style="background:${meta.bg}">${meta.icon}</div>
    <div class="product-card__body">
      <p class="product-card__name">${escHtml(p.name)}</p>
      <div class="product-card__stars">
        <span class="stars">${starsHtml(rev.stars)}</span>
        <span class="review-count">${rev.count.toLocaleString()}</span>
      </div>
      <div class="product-card__price-row">
        <span class="price-symbol">$</span>
        <span class="price-whole">${whole}</span>
        <span class="price-fraction">${frac}</span>
      </div>
      ${isPrime?`<div class="product-card__prime"><span class="prime-badge">prime</span>FREE delivery</div>`:''}
      <div class="product-card__delivery">Get it by <b>${deliveryDate()}</b></div>
      ${isLow?`<div class="product-card__stock stock--low">Only 3 left in stock</div>`:`<div class="product-card__stock stock--ok">In Stock</div>`}
      <button class="product-card__add-btn" data-id="${p.id}">Add to Cart</button>
    </div>`;

  // Wishlist toggle
  card.querySelector('.product-card__wish-btn').addEventListener('click', e=>{
    e.stopPropagation(); toggleWishlist(p, e.currentTarget);
  });
  // Edit
  card.querySelector('.product-card__edit-btn').addEventListener('click', e=>{
    e.stopPropagation(); openEditModal(p);
  });
  // Add to cart
  card.querySelector('.product-card__add-btn').addEventListener('click', ()=>{
    addToCart(p); showToast(`"${p.name.slice(0,30)}…" added to cart!`,'success');
  });
  return card;
}

function renderSkeletons(){
  const n=Math.min(state.limit,12);
  grid.innerHTML=Array(n).fill(`
    <div class="skeleton-card" aria-hidden="true">
      <div class="skel skel-img"></div>
      <div class="skel-body">
        <div class="skel skel-line"></div>
        <div class="skel skel-line skel-line--sm"></div>
        <div class="skel skel-line skel-line--price"></div>
        <div class="skel skel-line skel-line--btn"></div>
      </div>
    </div>`).join('');
  emptyState.classList.add('hidden');
  resultsCount.textContent='Loading…'; resultsQuery.textContent='';
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function updatePagination(meta){
  prevBtn.disabled=state.page<=1; nextBtn.disabled=!meta.hasNextPage;
  pageInfo.textContent=`Page ${state.page}`;
}
prevBtn.addEventListener('click',()=>{
  if(state.page<=1) return; state.page--; state.cursors.pop();
  fetchProducts(state.cursors[state.cursors.length-1]);
  window.scrollTo({top:0,behavior:'smooth'});
});
nextBtn.addEventListener('click',()=>{
  if(!state.nextCursor) return; state.cursors.push(state.nextCursor); state.page++;
  fetchProducts(state.nextCursor); window.scrollTo({top:0,behavior:'smooth'});
});
function resetPagination(){ state.page=1; state.cursors=[null]; state.nextCursor=null; }

// ── Search ─────────────────────────────────────────────────────────────────────
function CATS(){ return Object.keys(CATEGORY_META); }
function doSearch(){
  const q=searchInput.value.trim(); const cat=searchCatSel.value;
  const matchedCat=CATS().find(c=>c.toLowerCase()===q.toLowerCase());
  if(cat){ state.category=cat; state.searchQuery=q; syncCategoryUI(cat); resetPagination(); fetchProducts(); }
  else if(matchedCat){ state.category=matchedCat; state.searchQuery=''; syncCategoryUI(matchedCat); resetPagination(); fetchProducts(); }
  else{
    state.searchQuery=q; state.category=''; syncCategoryUI('');
    if(state.allProducts.length===0){ resetPagination(); fetchProducts(); }
    else{ applyLocalFilterAndRender({hasNextPage:!!state.nextCursor,count:state.allProducts.length}); updatePagination({hasNextPage:!!state.nextCursor}); }
  }
}
searchBtn.addEventListener('click',doSearch);
searchInput.addEventListener('keydown',e=>{ if(e.key==='Enter') doSearch(); });

document.querySelectorAll('.dept-pill').forEach(btn=>{
  btn.addEventListener('click',()=>{
    state.category=btn.dataset.cat; state.searchQuery=''; searchInput.value=''; searchCatSel.value=btn.dataset.cat;
    syncCategoryUI(btn.dataset.cat); resetPagination(); fetchProducts();
  });
});
document.querySelectorAll('.sidebar__link').forEach(btn=>{
  btn.addEventListener('click',()=>{
    state.category=btn.dataset.cat; state.searchQuery=''; searchInput.value=''; searchCatSel.value=btn.dataset.cat;
    syncCategoryUI(btn.dataset.cat); resetPagination(); fetchProducts();
  });
});
function syncCategoryUI(cat){
  document.querySelectorAll('.dept-pill').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  document.querySelectorAll('.sidebar__link').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
}

sortSelect.addEventListener('change',()=>{
  state.sortOrder=sortSelect.value;
  applyLocalFilterAndRender({hasNextPage:!!state.nextCursor,count:state.allProducts.length});
});
document.querySelectorAll('input[name="limit"]').forEach(r=>{
  r.addEventListener('change',()=>{ state.limit=parseInt(r.value,10); resetPagination(); fetchProducts(); });
});

// ══════════════════════════════════════════
//  CART
// ══════════════════════════════════════════
function addToCart(product, qty=1){
  const existing=cart.find(i=>i.product.id===product.id);
  if(existing) existing.qty+=qty;
  else cart.push({product,qty});
  saveCart(); updateCartBadge(); renderCart();
}

function removeFromCart(id){
  const idx=cart.findIndex(i=>i.product.id===id);
  if(idx>-1){ cart.splice(idx,1); saveCart(); updateCartBadge(); renderCart(); }
}

function updateCartQty(id, delta){
  const item=cart.find(i=>i.product.id===id);
  if(!item) return;
  item.qty=Math.max(1,item.qty+delta);
  saveCart(); updateCartBadge(); renderCart();
}

function clearCart(){ cart.length=0; saveCart(); updateCartBadge(); renderCart(); }

function updateCartBadge(){
  const total=cart.reduce((s,i)=>s+i.qty,0);
  cartBadge.textContent=total;
  cartBadge.classList.toggle('hidden', total===0);
}

function renderCart(){
  const isEmpty=cart.length===0;
  cartEmpty.classList.toggle('hidden',!isEmpty);
  cartList.classList.toggle('hidden',isEmpty);
  cartFooter.classList.toggle('hidden',isEmpty);

  if(isEmpty) return;

  cartList.innerHTML='';
  cart.forEach(({product:p, qty})=>{
    const meta=CATEGORY_META[p.category]||{icon:'📦',bg:'#f9f9f9'};
    const li=document.createElement('li');
    li.className='cart-item';
    li.innerHTML=`
      <div class="cart-item__img" style="background:${meta.bg}">${meta.icon}</div>
      <div class="cart-item__info">
        <div class="cart-item__name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
        <div class="cart-item__cat">${escHtml(p.category)}</div>
        <div class="cart-item__price">${fmt(p.price * qty)}</div>
        <div class="cart-item__controls">
          <button class="qty-btn" data-id="${p.id}" data-d="-1">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" data-id="${p.id}" data-d="1">+</button>
          <button class="cart-item__remove" data-id="${p.id}">Remove</button>
        </div>
      </div>`;
    li.querySelector('.cart-item__remove').addEventListener('click',()=>removeFromCart(p.id));
    li.querySelectorAll('.qty-btn').forEach(btn=>{
      btn.addEventListener('click',()=>updateCartQty(p.id,parseInt(btn.dataset.d)));
    });
    cartList.appendChild(li);
  });

  const subtotal=cart.reduce((s,i)=>s+i.product.price*i.qty,0);
  const totalQty=cart.reduce((s,i)=>s+i.qty,0);
  cartItemCount.textContent=totalQty;
  cartSubtotal.textContent=fmt(subtotal);

  // Savings: show 10% off for orders > $100
  if(subtotal>100){
    const saving=subtotal*0.1;
    cartSavings.textContent=`-${fmt(saving)}`;
    cartSavingsRow.classList.remove('hidden');
  } else { cartSavingsRow.classList.add('hidden'); }
}

// Cart drawer open/close
cartBtn.addEventListener('click',()=>openDrawer('cart'));
cartClose.addEventListener('click',()=>closeDrawer('cart'));
cartOverlay.addEventListener('click',()=>closeDrawer('cart'));
clearCartBtn.addEventListener('click',()=>{ clearCart(); showToast('Cart cleared','success'); });

// ══════════════════════════════════════════
//  WISHLIST
// ══════════════════════════════════════════
function toggleWishlist(product, btn){
  if(wishSet.has(product.id)){
    wishSet.delete(product.id);
    const idx=wishProducts.findIndex(p=>p.id===product.id);
    if(idx>-1) wishProducts.splice(idx,1);
    btn.textContent='🤍'; btn.classList.remove('wishlisted');
    showToast('Removed from wishlist','success');
  } else {
    wishSet.add(product.id);
    if(!wishProducts.find(p=>p.id===product.id)) wishProducts.push(product);
    btn.textContent='❤️'; btn.classList.add('wishlisted');
    showToast('Added to wishlist ❤️','success');
  }
  saveWish(); updateWishBadge(); renderWishlist();
}

function updateWishBadge(){
  wishlistBadge.textContent=wishSet.size;
  wishlistBadge.classList.toggle('hidden',wishSet.size===0);
}

function renderWishlist(){
  const isEmpty=wishProducts.length===0;
  wishlistEmpty.classList.toggle('hidden',!isEmpty);
  wishlistList.classList.toggle('hidden',isEmpty);
  wishlistFooter.classList.toggle('hidden',isEmpty);
  if(isEmpty) return;

  wishlistList.innerHTML='';
  wishProducts.forEach(p=>{
    const meta=CATEGORY_META[p.category]||{icon:'📦',bg:'#f9f9f9'};
    const li=document.createElement('li');
    li.className='cart-item';
    li.innerHTML=`
      <div class="cart-item__img" style="background:${meta.bg}">${meta.icon}</div>
      <div class="cart-item__info">
        <div class="cart-item__name">${escHtml(p.name)}</div>
        <div class="cart-item__cat">${escHtml(p.category)}</div>
        <div class="cart-item__price">${fmt(p.price)}</div>
        <div class="cart-item__controls">
          <button class="product-card__add-btn" style="padding:.25rem .6rem;font-size:.75rem;border-radius:3px;width:auto" data-id="${p.id}">Add to Cart</button>
          <button class="cart-item__remove" data-id="${p.id}">Remove</button>
        </div>
      </div>`;
    li.querySelector('.product-card__add-btn').addEventListener('click',()=>{
      addToCart(p); showToast(`"${p.name.slice(0,25)}…" added to cart!`,'success');
    });
    li.querySelector('.cart-item__remove').addEventListener('click',()=>{
      wishSet.delete(p.id);
      const idx=wishProducts.findIndex(x=>x.id===p.id);
      if(idx>-1) wishProducts.splice(idx,1);
      saveWish(); updateWishBadge(); renderWishlist();
      // Refresh hearts on product cards
      document.querySelectorAll(`.product-card__wish-btn[data-id="${p.id}"]`).forEach(b=>{
        b.textContent='🤍'; b.classList.remove('wishlisted');
      });
    });
    wishlistList.appendChild(li);
  });
}

wishlistBtn.addEventListener('click',()=>openDrawer('wishlist'));
wishlistClose.addEventListener('click',()=>closeDrawer('wishlist'));
wishlistOverlay.addEventListener('click',()=>closeDrawer('wishlist'));
addAllToCartBtn.addEventListener('click',()=>{
  wishProducts.forEach(p=>addToCart(p));
  showToast(`${wishProducts.length} items added to cart!`,'success');
  closeDrawer('wishlist');
});
clearWishlistBtn.addEventListener('click',()=>{
  wishSet.clear(); wishProducts.length=0; saveWish();
  updateWishBadge(); renderWishlist();
  document.querySelectorAll('.product-card__wish-btn').forEach(b=>{ b.textContent='🤍'; b.classList.remove('wishlisted'); });
  showToast('Wishlist cleared','success');
});

// ── Drawer helpers ─────────────────────────────────────────────────────────────
function openDrawer(type){
  if(type==='cart'){ cartDrawer.classList.add('open'); cartOverlay.classList.remove('hidden'); renderCart(); }
  else { wishlistDrawer.classList.add('open'); wishlistOverlay.classList.remove('hidden'); renderWishlist(); }
}
function closeDrawer(type){
  if(type==='cart'){ cartDrawer.classList.remove('open'); cartOverlay.classList.add('hidden'); }
  else { wishlistDrawer.classList.remove('open'); wishlistOverlay.classList.add('hidden'); }
}

// ══════════════════════════════════════════
//  BILLING / CHECKOUT
// ══════════════════════════════════════════
let billingStep=1;

checkoutBtn.addEventListener('click',()=>{
  if(cart.length===0){ showToast('Your cart is empty!','error'); return; }
  closeDrawer('cart');
  openBilling();
});

function openBilling(){
  billingOverlay.classList.remove('hidden');
  goToStep(1);
}
function closeBilling(){
  billingOverlay.classList.add('hidden');
  billingStep=1;
}
billingClose.addEventListener('click',closeBilling);
billingOverlay.addEventListener('click',e=>{ if(e.target===billingOverlay) closeBilling(); });

function goToStep(n){
  billingStep=n;
  [1,2,3].forEach(i=>{
    $(`billingStep${i}`).classList.toggle('hidden',i!==n);
    const ind=$(`step${i}ind`);
    ind.classList.remove('active','done');
    if(i===n) ind.classList.add('active');
    else if(i<n) ind.classList.add('done');
  });
  $('billingSuccess').classList.add('hidden');
  if(n===3) populateOrderReview();
}

// Step navigation
$('toStep2Btn').addEventListener('click',()=>{
  if(!validateShipping()) return; goToStep(2);
});
$('toStep1Btn').addEventListener('click',()=>goToStep(1));
$('toStep3Btn').addEventListener('click',()=>{
  if(!validatePayment()) return; goToStep(3);
});
$('toStep2Btn2').addEventListener('click',()=>goToStep(2));

// Shipping validation
function validateShipping(){
  let ok=true;
  const fields=[
    ['bFirstName','errFirstName','First name is required.'],
    ['bLastName','errLastName','Last name is required.'],
    ['bEmail','errEmail','Email is required.'],
    ['bAddress','errAddress','Address is required.'],
    ['bCity','errCity','City is required.'],
    ['bZip','errZip','ZIP code is required.'],
  ];
  fields.forEach(([id,errId,msg])=>{
    const el=$(id); const errEl=$(errId);
    if(!el.value.trim()){ errEl.textContent=msg; el.classList.add('error'); ok=false; }
    else { errEl.textContent=''; el.classList.remove('error'); }
  });
  // Email format
  const email=$('bEmail');
  if(email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)){
    $('errEmail').textContent='Enter a valid email.'; email.classList.add('error'); ok=false;
  }
  return ok;
}

// Payment validation
function validatePayment(){
  let ok=true;
  const fields=[
    ['bCardName','errCardName','Name on card is required.'],
    ['bCardNum','errCardNum','Card number is required.'],
    ['bExpiry','errExpiry','Expiry date is required.'],
    ['bCvv','errCvv','CVV is required.'],
  ];
  fields.forEach(([id,errId,msg])=>{
    const el=$(id); const errEl=$(errId);
    if(!el.value.trim()){ errEl.textContent=msg; el.classList.add('error'); ok=false; }
    else { errEl.textContent=''; el.classList.remove('error'); }
  });
  const cardNum=$('bCardNum').value.replace(/\s/g,'');
  if(cardNum && cardNum.length<13){ $('errCardNum').textContent='Enter a valid card number.'; $('bCardNum').classList.add('error'); ok=false; }
  const cvv=$('bCvv').value;
  if(cvv && !/^\d{3,4}$/.test(cvv)){ $('errCvv').textContent='Enter a valid CVV.'; $('bCvv').classList.add('error'); ok=false; }
  return ok;
}

// Format card number with spaces
$('bCardNum').addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,16);
  this.value=v.replace(/(.{4})/g,'$1 ').trim();
});
// Format expiry
$('bExpiry').addEventListener('input',function(){
  let v=this.value.replace(/\D/g,'').slice(0,4);
  if(v.length>2) v=v.slice(0,2)+' / '+v.slice(2);
  this.value=v;
});

// Populate review step
function populateOrderReview(){
  const review=$('orderReview');
  const totals=$('orderTotals');
  review.innerHTML='';
  cart.forEach(({product:p,qty})=>{
    const div=document.createElement('div');
    div.className='order-review-item';
    div.innerHTML=`<span class="order-review-item__name">${escHtml(p.name)}</span>
      <span class="order-review-item__qty">× ${qty}</span>
      <span class="order-review-item__price">${fmt(p.price*qty)}</span>`;
    review.appendChild(div);
  });

  const subtotal=cart.reduce((s,i)=>s+i.product.price*i.qty,0);
  const shipping=subtotal>50?0:5.99;
  const tax=+(subtotal*0.08).toFixed(2);
  const total=+(subtotal+shipping+tax).toFixed(2);
  const savings=subtotal>100?+(subtotal*0.1).toFixed(2):0;

  totals.innerHTML=`
    <div class="order-totals__row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
    ${savings?`<div class="order-totals__row" style="color:#146c39"><span>Discount (10%)</span><span>-${fmt(savings)}</span></div>`:''}
    <div class="order-totals__row"><span>Shipping</span><span>${shipping===0?'FREE':fmt(shipping)}</span></div>
    <div class="order-totals__row"><span>Tax (8%)</span><span>${fmt(tax)}</span></div>
    <div class="order-totals__row order-totals__row--total"><span>Order Total</span><span>${fmt(total-(savings||0))}</span></div>`;
}

// Place order
$('placeOrderBtn').addEventListener('click',async()=>{
  $('placeOrderLabel').textContent='Placing order…';
  $('placeOrderSpinner').classList.remove('hidden');
  $('placeOrderBtn').disabled=true;

  await new Promise(r=>setTimeout(r,1800)); // simulate network

  const email=$('bEmail').value;
  const oid=orderId();
  $('successEmail').textContent=email;
  $('successOrderId').textContent=oid;

  // Save order record for tracking
  const subtotal = cart.reduce((s,i)=>s+i.product.price*i.qty, 0);
  const shipping = subtotal > 50 ? 0 : 5.99;
  const tax      = +(subtotal * 0.08).toFixed(2);
  const savings  = subtotal > 100 ? +(subtotal * 0.1).toFixed(2) : 0;
  const total    = +(subtotal + shipping + tax - savings).toFixed(2);
  recordOrder({
    id:       oid,
    placedAt: Date.now(),
    items:    cart.map(i => ({ product: i.product, qty: i.qty })),
    total,
    address:  $('bAddress').value + ', ' + $('bCity').value,
    city:     $('bCity').value,
    country:  $('bCountry').value,
    email:    $('bEmail').value,
  });

  // Clear cart
  clearCart(); updateCartBadge();

  // Show success
  [1,2,3].forEach(i=>{ $(`billingStep${i}`).classList.add('hidden'); $(`step${i}ind`).classList.remove('active','done'); });
  $('billingSuccess').classList.remove('hidden');
  $('step3ind').classList.add('done');

  $('placeOrderLabel').textContent='Place Order 🎉';
  $('placeOrderSpinner').classList.add('hidden');
  $('placeOrderBtn').disabled=false;
});

$('successDoneBtn').addEventListener('click',()=>{
  closeBilling();
  $('billingStep1').classList.remove('hidden'); $('billingStep2').classList.add('hidden');
  $('billingStep3').classList.add('hidden'); $('billingSuccess').classList.add('hidden');
  document.getElementById('productForm') && document.getElementById('productForm').reset();
});

// Track from success screen
const successTrackBtn = document.getElementById('successTrackBtn');
if(successTrackBtn){
  successTrackBtn.addEventListener('click',()=>{
    const lastOrder = orders[0];
    if(!lastOrder) return;
    closeBilling();
    openTracking(lastOrder.id);
  });
}

// ══════════════════════════════════════════
//  ADD / EDIT PRODUCT MODAL
// ══════════════════════════════════════════
function openAddModal(){
  state.editingId=null;
  modalTitle.textContent='Add a New Product';
  $('modalSubmitLabel').textContent='Add Product';
  productForm.reset(); clearProductErrors();
  modalOverlay.classList.remove('hidden');
  setTimeout(()=>$('fieldName').focus(),50);
}
function openEditModal(p){
  state.editingId=p.id;
  modalTitle.textContent='Edit Product';
  $('modalSubmitLabel').textContent='Save Changes';
  $('fieldName').value=p.name; $('fieldCategory').value=p.category; $('fieldPrice').value=p.price;
  clearProductErrors();
  modalOverlay.classList.remove('hidden');
  setTimeout(()=>$('fieldName').focus(),50);
}
function closeModal(){ modalOverlay.classList.add('hidden'); state.editingId=null; }

addBtn.addEventListener('click',openAddModal);
emptyAddBtn.addEventListener('click',openAddModal);
modalClose.addEventListener('click',closeModal);
modalCancel.addEventListener('click',closeModal);
modalOverlay.addEventListener('click',e=>{ if(e.target===modalOverlay) closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeModal(); closeBilling(); } });

productForm.addEventListener('submit',async e=>{
  e.preventDefault(); clearProductErrors();
  const name=$('fieldName').value.trim();
  const category=$('fieldCategory').value;
  const price=parseFloat($('fieldPrice').value);
  let ok=true;
  if(!name){ setErr('errName','Product name is required.'); $('fieldName').classList.add('error'); ok=false; }
  if(!category){ setErr('errCategory','Please select a category.'); $('fieldCategory').classList.add('error'); ok=false; }
  if(isNaN(price)||price<0){ setErr('errPrice','Enter a valid price ≥ 0.'); $('fieldPrice').classList.add('error'); ok=false; }
  if(!ok) return;
  $('modalSubmit').disabled=true; $('modalSpinner').classList.remove('hidden');
  try{
    const isEdit=!!state.editingId;
    const res=await fetch(isEdit?`${API}/products/${state.editingId}`:`${API}/products`,
      {method:isEdit?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category,price})});
    if(!res.ok){ const d=await res.json().catch(()=>{}); throw new Error(d?.error||`HTTP ${res.status}`); }
    closeModal(); showToast(isEdit?'✅ Product updated!':'✅ Product added!','success');
    resetPagination(); fetchProducts();
  }catch(err){ showToast(err.message||'Something went wrong.','error'); }
  finally{ $('modalSubmit').disabled=false; $('modalSpinner').classList.add('hidden'); }
});

function setErr(id,msg){ $(id).textContent=msg; }
function clearProductErrors(){
  ['errName','errCategory','errPrice'].forEach(id=>$(id).textContent='');
  ['fieldName','fieldCategory','fieldPrice'].forEach(id=>$(id).classList.remove('error'));
}

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg,type='success'){
  clearTimeout(toastTimer);
  toastMsg.textContent=msg;
  toastIcon.textContent=type==='success'?'✅':'❌';
  toast.className=`toast toast--${type}`;
  toastTimer=setTimeout(()=>toast.classList.add('hidden'),3500);
}

// ── Init ───────────────────────────────────────────────────────────────────────
checkHealth();
fetchProducts();
updateCartBadge();
updateWishBadge();
renderCart();
renderWishlist();

// ══════════════════════════════════════════
//  ORDERS & TRACKING
// ══════════════════════════════════════════

// Orders stored in localStorage
const orders = JSON.parse(localStorage.getItem('ec_orders') || '[]');
function saveOrders(){ localStorage.setItem('ec_orders', JSON.stringify(orders)); }

// Shipping stages with metadata
const SHIPPING_STAGES = [
  { key:'ordered',    label:'Order Placed',       icon:'🛍️',  desc:'Your order has been received and confirmed.',          svgPath:'M9 12l2 2 4-4M7 7h10M7 11h4' },
  { key:'processing', label:'Processing',          icon:'⚙️',  desc:'We\'re preparing your items for shipment.',           svgPath:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { key:'shipped',    label:'Shipped',             icon:'🚚',  desc:'Your package is on its way to the sorting facility.',  svgPath:'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { key:'out',        label:'Out for Delivery',    icon:'🏃',  desc:'Your package is with the delivery agent near you.',    svgPath:'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
  { key:'delivered',  label:'Delivered',           icon:'✅',  desc:'Package delivered! We hope you enjoy your purchase.',  svgPath:'M5 13l4 4L19 7' },
];

const CARRIERS = [
  { name:'FedEx',    icon:'🟣', trackingPrefix:'FX' },
  { name:'UPS',      icon:'🟤', trackingPrefix:'1Z' },
  { name:'DHL',      icon:'🟡', trackingPrefix:'DH' },
  { name:'USPS',     icon:'🔵', trackingPrefix:'94' },
  { name:'Amazon Logistics', icon:'🟠', trackingPrefix:'TBA' },
];

// Status labels to stages index (0-based)
const STATUS_STAGE = {
  ordered:0, processing:1, shipped:2, out:3, delivered:4
};

// Generate a fake carrier tracking number
function fakeTrackingNum(prefix) {
  return prefix + Math.random().toString(36).substr(2,9).toUpperCase();
}

// Deterministically pick a carrier for an order
function carrierForOrder(ordId) {
  const idx = ordId.charCodeAt(3) % CARRIERS.length;
  return CARRIERS[idx];
}

// Simulate what stage an order is at based on time elapsed
function computeStage(placedAt) {
  const mins = (Date.now() - placedAt) / 60000;
  if (mins < 1)   return 'ordered';
  if (mins < 3)   return 'processing';
  if (mins < 6)   return 'shipped';
  if (mins < 10)  return 'out';
  return 'delivered';
}

// Generate timestamps for each stage
function stageTimestamps(placedAt, currentStage) {
  const stageIdx = STATUS_STAGE[currentStage];
  const base = new Date(placedAt);
  const stamps = [];
  const offsets = [0, 15, 90, 1440, 2880]; // minutes after order
  SHIPPING_STAGES.forEach((s, i) => {
    if (i <= stageIdx) {
      const d = new Date(base.getTime() + offsets[i] * 60000);
      stamps.push(d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }));
    } else {
      stamps.push(null);
    }
  });
  return stamps;
}

// ── Save order after checkout ──────────────────────────────────────────────────
// Patch the existing placeOrderBtn listener (append after existing)
function recordOrder(orderData) {
  orders.unshift(orderData);
  if (orders.length > 50) orders.pop(); // keep last 50
  saveOrders();
  updateOrdersBadge();
}

function updateOrdersBadge() {
  // No badge needed — just keep the button always visible
}

// ── Orders Drawer ──────────────────────────────────────────────────────────────
const ordersBtn     = $('ordersBtn');
const ordersDrawer  = $('ordersDrawer');
const ordersOverlay = $('ordersOverlay');
const ordersClose   = $('ordersClose');
const ordersEmpty   = $('ordersEmpty');
const ordersList    = $('ordersList');

ordersBtn.addEventListener('click',    () => openOrdersDrawer());
ordersClose.addEventListener('click',  () => closeOrdersDrawer());
ordersOverlay.addEventListener('click',() => closeOrdersDrawer());

function openOrdersDrawer() {
  renderOrdersList();
  ordersDrawer.classList.add('open');
  ordersOverlay.classList.remove('hidden');
}
function closeOrdersDrawer() {
  ordersDrawer.classList.remove('open');
  ordersOverlay.classList.add('hidden');
}

function renderOrdersList() {
  const isEmpty = orders.length === 0;
  ordersEmpty.classList.toggle('hidden', !isEmpty);
  ordersList.classList.toggle('hidden', isEmpty);
  if (isEmpty) return;

  ordersList.innerHTML = '';
  orders.forEach(order => {
    const stage = computeStage(order.placedAt);
    const li = document.createElement('li');
    li.className = 'order-card';
    const itemNames = order.items.map(i => i.product.name).join(', ');
    li.innerHTML = `
      <div class="order-card__header">
        <div>
          <div class="order-card__id">${order.id}</div>
          <div class="order-card__date">${new Date(order.placedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span class="order-status-pill status--${stage}">${SHIPPING_STAGES[STATUS_STAGE[stage]].label}</span>
      </div>
      <div class="order-card__body">
        <div class="order-card__items">${escHtml(itemNames)}</div>
        <div class="order-card__total">Total: ${fmt(order.total)}</div>
        <div class="order-card__address">📍 ${escHtml(order.address)}</div>
      </div>
      <div class="order-card__footer">
        <button class="order-card__track-btn" data-oid="${order.id}">📍 Track Order</button>
        <button class="order-card__reorder-btn" data-oid="${order.id}">🔁 Reorder</button>
      </div>`;

    li.querySelector('.order-card__track-btn').addEventListener('click', () => {
      closeOrdersDrawer();
      openTracking(order.id);
    });
    li.querySelector('.order-card__reorder-btn').addEventListener('click', () => {
      order.items.forEach(i => addToCart(i.product, i.qty));
      showToast(`${order.items.length} item(s) added to cart!`, 'success');
      closeOrdersDrawer();
    });
    ordersList.appendChild(li);
  });
}

// ── Tracking Modal ─────────────────────────────────────────────────────────────
const trackingOverlay = $('trackingOverlay');
const trackingClose   = $('trackingClose');
const trackingClose2  = $('trackingClose2');
const reorderBtn      = $('reorderBtn');

trackingClose.addEventListener('click',  () => closeTracking());
trackingClose2.addEventListener('click', () => closeTracking());
trackingOverlay.addEventListener('click', e => { if (e.target === trackingOverlay) closeTracking(); });

function closeTracking() {
  trackingOverlay.classList.add('hidden');
}

let currentTrackingOrderId = null;

function openTracking(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  currentTrackingOrderId = orderId;
  populateTrackingModal(order);
  trackingOverlay.classList.remove('hidden');
}

reorderBtn.addEventListener('click', () => {
  const order = orders.find(o => o.id === currentTrackingOrderId);
  if (!order) return;
  order.items.forEach(i => addToCart(i.product, i.qty));
  showToast('All items added to cart!', 'success');
  closeTracking();
});

function populateTrackingModal(order) {
  const stage    = computeStage(order.placedAt);
  const stageIdx = STATUS_STAGE[stage];
  const carrier  = carrierForOrder(order.id);
  const stamps   = stageTimestamps(order.placedAt, stage);

  // ETA
  const etaDate = new Date(order.placedAt + (stageIdx >= 4 ? 0 : (10 - stageIdx * 2) * 60000));
  const etaStr  = stageIdx >= 4
    ? 'Delivered'
    : etaDate.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  // Header
  $('trackingTitle').textContent = '📍 Order Tracking';
  $('trackingOrderId').textContent = `Order ${order.id}`;

  // Info bar
  $('trackingInfoBar').innerHTML = `
    <div class="tracking-info-cell">
      <div class="tracking-info-label">Order Date</div>
      <div class="tracking-info-value">${new Date(order.placedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
    </div>
    <div class="tracking-info-cell">
      <div class="tracking-info-label">Ship To</div>
      <div class="tracking-info-value">${escHtml(order.city)}, ${escHtml(order.country)}</div>
    </div>
    <div class="tracking-info-cell">
      <div class="tracking-info-label">Est. Delivery</div>
      <div class="tracking-info-value" style="color:${stageIdx>=4?'#15803d':'#c7511f'}">${etaStr}</div>
    </div>`;

  // Status banner
  const stageInfo = SHIPPING_STAGES[stageIdx];
  $('trackingBanner').className = `tracking-status-banner ${stage}`;
  $('trackingBanner').innerHTML = `
    <span class="tracking-status-icon">${stageInfo.icon}</span>
    <div>
      <div style="font-size:1rem">${stageInfo.label}</div>
      <div style="font-size:.8rem;font-weight:400;margin-top:.1rem;opacity:.85">${stageInfo.desc}</div>
    </div>`;

  // Timeline
  const timeline = $('trackingTimeline');
  timeline.innerHTML = '';
  SHIPPING_STAGES.forEach((s, i) => {
    const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending';
    const div = document.createElement('div');
    div.className = `timeline-step ${state}`;
    div.innerHTML = `
      <div class="timeline-dot">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="${s.svgPath}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="timeline-content">
        <div class="timeline-title">
          ${s.label}
          ${state === 'active' ? '<span class="timeline-badge-active">Current</span>' : ''}
        </div>
        ${stamps[i] ? `<div class="timeline-time">${stamps[i]}</div>` : ''}
        <div class="timeline-desc">${s.desc}</div>
      </div>`;
    timeline.appendChild(div);
  });

  // Carrier
  const trackNum = fakeTrackingNum(carrier.trackingPrefix);
  $('trackingCarrier').innerHTML = `
    <span class="carrier-icon">${carrier.icon}</span>
    <div class="carrier-details">
      <div class="carrier-name">${carrier.name}</div>
      <div class="carrier-tracking">Tracking #: ${trackNum}</div>
      <div class="carrier-eta">Estimated delivery: <b>${etaStr}</b></div>
    </div>`;

  // Items
  const itemsEl = $('trackingItems');
  itemsEl.innerHTML = '';
  order.items.forEach(({ product: p, qty }) => {
    const meta = CATEGORY_META[p.category] || { icon:'📦', bg:'#f9f9f9' };
    const div = document.createElement('div');
    div.className = 'tracking-item';
    div.innerHTML = `
      <div class="tracking-item__img" style="background:${meta.bg}">${meta.icon}</div>
      <span class="tracking-item__name">${escHtml(p.name)}</span>
      <span class="tracking-item__qty">× ${qty}</span>
      <span class="tracking-item__price">${fmt(p.price * qty)}</span>`;
    itemsEl.appendChild(div);
  });
}

// ── Auto-refresh tracking every 30s if modal is open ──────────────────────────
setInterval(() => {
  if (!trackingOverlay.classList.contains('hidden') && currentTrackingOrderId) {
    const order = orders.find(o => o.id === currentTrackingOrderId);
    if (order) populateTrackingModal(order);
  }
  // Also refresh orders list if drawer open
  if (!ordersDrawer.classList.contains('open') === false) {
    // drawer is open — re-render status pills
    renderOrdersList();
  }
}, 30000);
