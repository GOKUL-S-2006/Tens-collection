/* =========================================================
   TEN COLLECTION — app logic
   Plain JS, Firebase compat SDK, localStorage cart, Cloudinary uploads
   ========================================================= */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------------- state ----------------
const state = {
  user: null,
  products: [],
  category: 'all',
  search: '',
  cart: loadCart(),
  currentProduct: null,
};

// ---------------- helpers ----------------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $all = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function money(n) {
  n = Number(n) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem('tc_cart')) || []; }
  catch (e) { return []; }
}
function saveCart() {
  localStorage.setItem('tc_cart', JSON.stringify(state.cart));
  renderCartBadges();
}

function sortByCreatedDesc(a, b) {
  const at = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : Date.now();
  const bt = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : Date.now();
  return bt - at;
}

// ---------------- view routing ----------------
const VIEWS = ['home', 'cart', 'checkout', 'sell', 'account', 'orders', 'listings'];
function showView(name) {
  VIEWS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.classList.toggle('hidden', v !== name);
  });
  $all('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  window.scrollTo({ top: 0 });

  if (name === 'cart') renderCart();
  if (name === 'sell') renderSell();
  if (name === 'account') renderAccount();
  if (name === 'orders') renderOrders();
  if (name === 'listings') renderListings();
}

$all('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (target === 'sell' && !state.user) {
      showView('account');
      toast('Sign in to start selling ✦');
      return;
    }
    showView(target);
  });
});
$('#cartIconBtn').addEventListener('click', () => showView('cart'));
$('#cartBackBtn').addEventListener('click', () => showView('home'));
$('#checkoutBackBtn').addEventListener('click', () => showView('cart'));
$('#ordersBackBtn').addEventListener('click', () => showView('account'));
$('#listingsBackBtn').addEventListener('click', () => showView('account'));

// ---------------- auth ----------------
function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => toast(err.message));
}
function signOutUser() {
  auth.signOut().then(() => { showView('home'); toast('Signed out'); });
}

auth.onAuthStateChanged(user => {
  state.user = user;
  renderAccount();
  if (!$('#view-sell').classList.contains('hidden')) renderSell();
});

// ---------------- products (home feed) ----------------
db.collection('products').onSnapshot(snap => {
  const items = [];
  snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
  items.sort(sortByCreatedDesc);
  state.products = items;
  renderHome();
}, err => {
  console.error(err);
  $('#productGrid').innerHTML = '';
  $('#homeEmptyState').innerHTML = `<div class="empty-state"><div class="glyph">⚠</div><h3>Couldn't load products</h3><p>${esc(err.message)}</p></div>`;
});

function getFilteredProducts() {
  return state.products.filter(p => {
    const matchCat = state.category === 'all' || p.category === state.category;
    const matchSearch = !state.search || (p.name || '').toLowerCase().includes(state.search.toLowerCase());
    return matchCat && matchSearch;
  });
}

function renderHome() {
  const list = getFilteredProducts();
  $('#productCount').textContent = list.length ? `${list.length} piece${list.length > 1 ? 's' : ''}` : '';
  const grid = $('#productGrid');
  const empty = $('#homeEmptyState');

  if (!list.length) {
    grid.innerHTML = '';
    empty.innerHTML = `
      <div class="empty-state">
        <div class="glyph">✦</div>
        <h3>Nothing here yet</h3>
        <p>${state.products.length ? 'Try a different search or category.' : 'Be the first to list a piece — tap Sell below.'}</p>
      </div>`;
    return;
  }
  empty.innerHTML = '';
  grid.innerHTML = list.map(p => {
    const inCart = state.cart.some(c => c.productId === p.id);
    return `
    <div class="card" data-id="${p.id}">
      <div class="thumb" style="${p.imageUrl ? `background-image:url('${esc(p.imageUrl)}')` : ''}">
        ${!p.imageUrl ? `<div class="no-img">✦</div>` : ''}
        <div class="corner">${esc(p.category || 'Other')}</div>
      </div>
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        <div class="seller">by ${esc(p.sellerName || 'Seller')}</div>
        <div class="row">
          <div class="price">${money(p.price)}</div>
          <button class="add-btn ${inCart ? 'added' : ''}" data-add="${p.id}">${inCart ? '✓' : '+'}</button>
        </div>
      </div>
    </div>`;
  }).join('');

  $all('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn')) return;
      openProduct(card.dataset.id);
    });
  });
  $all('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(btn.dataset.add);
    });
  });
}

$('#searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderHome();
});
$('#categoryChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  $all('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  state.category = chip.dataset.cat;
  renderHome();
});

// ---------------- product detail sheet ----------------
function openProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  state.currentProduct = p;
  const inCart = state.cart.some(c => c.productId === p.id);
  $('#productSheetContent').innerHTML = `
    <div class="pd-hero" style="${p.imageUrl ? `background-image:url('${esc(p.imageUrl)}')` : 'background:#f4e7e2;'}"></div>
    <div class="pd-body">
      <div class="pd-category">${esc(p.category || 'Other')}</div>
      <h2 class="pd-name">${esc(p.name)}</h2>
      <div class="pd-price">${money(p.price)}</div>
      <div class="pd-seller">
        <img src="${esc(p.sellerPhoto || '')}" onerror="this.style.visibility='hidden'">
        <div class="who"><span class="label">Sold by</span>${esc(p.sellerName || 'Seller')}</div>
      </div>
      <div class="pd-desc">${esc(p.description || 'No description provided.')}</div>
    </div>
    <div class="pd-actions">
      <button class="btn secondary" id="pdAddBtn">${inCart ? 'Added ✓' : 'Add to Cart'}</button>
      <button class="btn" id="pdBuyBtn">Buy Now</button>
    </div>
  `;
  $('#pdAddBtn').addEventListener('click', () => { addToCart(p.id); openProduct(p.id); });
  $('#pdBuyBtn').addEventListener('click', () => {
    addToCart(p.id, true);
    closeProductSheet();
    showView('cart');
  });
  $('#productSheetOverlay').classList.remove('hidden');
}
function closeProductSheet() {
  $('#productSheetOverlay').classList.add('hidden');
}
$('#closeProductSheet').addEventListener('click', closeProductSheet);
$('#productSheetOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'productSheetOverlay') closeProductSheet();
});

// ---------------- cart ----------------
function addToCart(productId, silent) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const existing = state.cart.find(c => c.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl || '',
      qty: 1, sellerId: p.sellerId, sellerName: p.sellerName || 'Seller', qrUrl: p.qrUrl || ''
    });
  }
  saveCart();
  renderHome();
  if (!silent) toast('Added to cart ✦');
}
function changeQty(productId, delta) {
  const item = state.cart.find(c => c.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(c => c.productId !== productId);
  saveCart();
  renderCart();
  renderHome();
}
function removeFromCart(productId) {
  state.cart = state.cart.filter(c => c.productId !== productId);
  saveCart();
  renderCart();
  renderHome();
}
function cartCount() { return state.cart.reduce((s, i) => s + i.qty, 0); }
function cartTotal() { return state.cart.reduce((s, i) => s + i.qty * i.price, 0); }

function renderCartBadges() {
  const n = cartCount();
  [$('#cartBadge'), $('#tabCartBadge')].forEach(b => {
    b.textContent = n;
    b.classList.toggle('hidden', n === 0);
  });
}

function groupCartBySeller() {
  const groups = {};
  state.cart.forEach(item => {
    if (!groups[item.sellerId]) groups[item.sellerId] = { sellerName: item.sellerName, qrUrl: item.qrUrl, items: [] };
    groups[item.sellerId].items.push(item);
  });
  return groups;
}

function renderCart() {
  const content = $('#cartContent');
  if (!state.cart.length) {
    content.innerHTML = `<div class="empty-state"><div class="glyph">✦</div><h3>Your cart is empty</h3><p>Find something sparkly on the Home tab.</p></div>`;
    return;
  }
  const groups = groupCartBySeller();
  let html = '';
  Object.entries(groups).forEach(([sellerId, group]) => {
    html += `<div class="cart-seller-group"><div class="cart-seller-head">✦ Sold by ${esc(group.sellerName)}</div>`;
    group.items.forEach(item => {
      html += `
        <div class="cart-item">
          <div class="thumb" style="${item.imageUrl ? `background-image:url('${esc(item.imageUrl)}')` : ''}"></div>
          <div class="info">
            <div class="name">${esc(item.name)}</div>
            <div class="price">${money(item.price)} each</div>
            <div class="qty-ctrl">
              <button data-qty-minus="${item.productId}">−</button>
              <span class="qty">${item.qty}</span>
              <button data-qty-plus="${item.productId}">+</button>
            </div>
            <button class="remove" data-remove="${item.productId}">Remove</button>
          </div>
        </div>`;
    });
    html += `</div>`;
  });

  html += `
    <div class="cart-summary">
      <div class="line"><span>Items (${cartCount()})</span><span>${money(cartTotal())}</span></div>
      <div class="line total"><span>Total</span><span>${money(cartTotal())}</span></div>
    </div>
    <div style="height:14px;"></div>
    <button class="btn" id="goCheckoutBtn">Proceed to Pay</button>
  `;
  content.innerHTML = html;

  $all('[data-qty-plus]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.qtyPlus, 1)));
  $all('[data-qty-minus]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.qtyMinus, -1)));
  $all('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
  $('#goCheckoutBtn').addEventListener('click', () => {
    if (!state.user) { toast('Please sign in to checkout ✦'); showView('account'); return; }
    showView('checkout');
  });
}

// ---------------- checkout (per-seller GPay QR) ----------------
function renderCheckout() {
  const content = $('#checkoutContent');
  if (!state.cart.length) {
    content.innerHTML = `<div class="empty-state"><div class="glyph">✦</div><h3>Nothing to pay for</h3><p>Your cart is empty.</p></div>`;
    return;
  }
  const groups = groupCartBySeller();
  let html = `<div class="qr-note">Scan each seller's QR in Google Pay, complete the payment, then tap "I've Paid" to confirm your order with them.</div>`;

  Object.entries(groups).forEach(([sellerId, group]) => {
    const subtotal = group.items.reduce((s, i) => s + i.qty * i.price, 0);
    html += `
      <div class="qr-card" data-seller="${sellerId}">
        <div class="seller-name">✦ ${esc(group.sellerName)}</div>
        <div class="amount">${money(subtotal)}</div>
        ${group.qrUrl
          ? `<img src="${esc(group.qrUrl)}" alt="GPay QR for ${esc(group.sellerName)}">`
          : `<div class="qr-note">This seller hasn't added a payment QR yet. Please contact them directly.</div>`}
        <div class="items-list">${group.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}</div>
        <button class="btn gold" data-confirm-pay="${sellerId}">I've Paid ${money(subtotal)}</button>
      </div>`;
  });
  content.innerHTML = html;

  $all('[data-confirm-pay]').forEach(btn => {
    btn.addEventListener('click', () => confirmPayment(btn.dataset.confirmPay));
  });
}
// hook checkout render into showView
const _origShowView = showView;
showView = function (name) { _origShowView(name); if (name === 'checkout') renderCheckout(); };

function confirmPayment(sellerId) {
  const groups = groupCartBySeller();
  const group = groups[sellerId];
  if (!group) return;
  const subtotal = group.items.reduce((s, i) => s + i.qty * i.price, 0);

  const order = {
    buyerId: state.user.uid,
    buyerName: state.user.displayName || 'Buyer',
    sellerId,
    sellerName: group.sellerName,
    items: group.items.map(i => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, imageUrl: i.imageUrl })),
    total: subtotal,
    status: 'placed',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const btn = $(`[data-confirm-pay="${sellerId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order...'; }

  db.collection('orders').add(order).then(() => {
    state.cart = state.cart.filter(i => i.sellerId !== sellerId);
    saveCart();
    toast('Order placed! The seller will confirm shortly ✦');
    if (state.cart.length) {
      renderCheckout();
    } else {
      showView('orders');
    }
  }).catch(err => {
    toast(err.message);
    if (btn) { btn.disabled = false; btn.textContent = `I've Paid ${money(subtotal)}`; }
  });
}

// ---------------- sell (add product) ----------------
function renderSell() {
  const content = $('#sellContent');
  if (!state.user) {
    content.innerHTML = `
      <div class="view-pad">
        <div class="empty-state">
          <div class="glyph">✦</div>
          <h3>Sign in to sell</h3>
          <p>Create an account with Google to list your jewellery and accessories.</p>
        </div>
        <button class="btn" id="sellSignInBtn">Continue with Google</button>
      </div>`;
    $('#sellSignInBtn').addEventListener('click', signIn);
    return;
  }

  content.innerHTML = `
    <div class="view-pad">
      <div class="form-group">
        <label>Product Photo</label>
        <div class="upload-box" id="productImgBox">
          <div class="placeholder"><span class="glyph">📷</span>Tap to upload a clear photo</div>
          <input type="file" accept="image/*" id="productImgInput">
        </div>
      </div>

      <div class="form-group">
        <label>Product Name</label>
        <input type="text" id="fName" placeholder="e.g. Rose Gold Layered Chain">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select id="fCategory">
          <option>Rings</option>
          <option>Chains</option>
          <option>Earrings</option>
          <option>Bracelets</option>
          <option>Anklets</option>
          <option>Other</option>
        </select>
      </div>

      <div class="form-group">
        <label>Price (₹)</label>
        <input type="number" id="fPrice" placeholder="e.g. 499" min="0">
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea id="fDesc" placeholder="Material, size, care instructions..."></textarea>
      </div>

      <div class="form-group">
        <label>Your GPay QR Code</label>
        <div class="upload-box" id="qrImgBox">
          <div class="placeholder"><span class="glyph">🔳</span>Tap to upload your GPay QR</div>
          <input type="file" accept="image/*" id="qrImgInput">
        </div>
      </div>

      <div class="upload-progress hidden" id="uploadStatus"></div>
      <button class="btn" id="submitProductBtn">List This Product</button>
    </div>
  `;

  let productImgFile = null, qrImgFile = null;

  setupUploadBox('productImgBox', 'productImgInput', f => productImgFile = f);
  setupUploadBox('qrImgBox', 'qrImgInput', f => qrImgFile = f);

  $('#submitProductBtn').addEventListener('click', async () => {
    const name = $('#fName').value.trim();
    const category = $('#fCategory').value;
    const price = parseFloat($('#fPrice').value);
    const description = $('#fDesc').value.trim();

    if (!name) return toast('Please enter a product name');
    if (!price || price <= 0) return toast('Please enter a valid price');
    if (!productImgFile) return toast('Please add a product photo');
    if (!qrImgFile) return toast('Please add your GPay QR code');

    if (CLOUDINARY_CLOUD_NAME.includes('YOUR_')) {
      return toast('Seller: Cloudinary is not configured yet. See README.');
    }

    const submitBtn = $('#submitProductBtn');
    submitBtn.disabled = true;
    const status = $('#uploadStatus');
    status.classList.remove('hidden');

    try {
      status.textContent = 'Uploading product photo...';
      const imageUrl = await uploadToCloudinary(productImgFile);
      status.textContent = 'Uploading GPay QR...';
      const qrUrl = await uploadToCloudinary(qrImgFile);

      status.textContent = 'Saving listing...';
      await db.collection('products').add({
        name, category, price, description,
        imageUrl, qrUrl,
        sellerId: state.user.uid,
        sellerName: state.user.displayName || 'Seller',
        sellerPhoto: state.user.photoURL || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      toast('Your product is live ✦');
      showView('home');
    } catch (err) {
      console.error(err);
      toast('Failed: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      status.classList.add('hidden');
    }
  });
}

function setupUploadBox(boxId, inputId, onFile) {
  function attach() {
    const input = $('#' + inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      onFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const box = $('#' + boxId);
        box.classList.add('has-img');
        box.innerHTML = `<img src="${e.target.result}"><input type="file" accept="image/*" id="${inputId}">`;
        attach(); // rebind listener to the freshly-inserted input
      };
      reader.readAsDataURL(file);
    });
  }
  attach();
}

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Image upload failed');
  return data.secure_url;
}

// ---------------- account ----------------
function renderAccount() {
  const content = $('#accountContent');
  if (!state.user) {
    content.innerHTML = `
      <div class="view-pad">
        <div class="empty-state">
          <img src="assets/logo.png" alt="Ten's Collections" style="width:110px;height:110px;border-radius:50%;margin:0 auto 14px;display:block;border:2px solid var(--gold-soft);">
          <h3>Welcome to Ten's Collections</h3>
          <p>Sign in to shop, track orders, and sell your own pieces.</p>
        </div>
        <button class="btn" id="accSignInBtn">Continue with Google</button>
      </div>`;
    $('#accSignInBtn').addEventListener('click', signIn);
    return;
  }
  content.innerHTML = `
    <div class="profile-card">
      <img src="${esc(state.user.photoURL || '')}" onerror="this.style.visibility='hidden'">
      <div>
        <div class="pname">${esc(state.user.displayName || 'User')}</div>
        <div class="pemail">${esc(state.user.email || '')}</div>
      </div>
    </div>
    <div class="menu-list">
      <div class="menu-item" id="menuOrders"><span class="glyph">🧾</span>My Orders<span class="chev">›</span></div>
      <div class="menu-item" id="menuListings"><span class="glyph">💍</span>My Listings<span class="chev">›</span></div>
      <div class="menu-item" id="menuSignOut"><span class="glyph">⎋</span>Sign Out</div>
    </div>
  `;
  $('#menuOrders').addEventListener('click', () => showView('orders'));
  $('#menuListings').addEventListener('click', () => showView('listings'));
  $('#menuSignOut').addEventListener('click', signOutUser);
}

// ---------------- my orders ----------------
function renderOrders() {
  const content = $('#ordersContent');
  if (!state.user) { content.innerHTML = `<div class="empty-state"><p>Please sign in.</p></div>`; return; }
  content.innerHTML = `<div class="center-pad"><div class="spinner"></div>Loading your orders...</div>`;

  db.collection('orders').where('buyerId', '==', state.user.uid).get().then(snap => {
    const orders = [];
    snap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    orders.sort(sortByCreatedDesc);
    if (!orders.length) {
      content.innerHTML = `<div class="empty-state"><div class="glyph">🧾</div><h3>No orders yet</h3><p>Your placed orders will show up here.</p></div>`;
      return;
    }
    content.innerHTML = orders.map(o => `
      <div class="list-row" style="align-items:flex-start;">
        <div class="thumb" style="${o.items?.[0]?.imageUrl ? `background-image:url('${esc(o.items[0].imageUrl)}')` : ''}"></div>
        <div class="info">
          <div class="t1">${esc((o.items || []).map(i => i.name).join(', '))}</div>
          <div class="t2">Sold by ${esc(o.sellerName || 'Seller')} · ${money(o.total)}</div>
        </div>
        <span class="status-pill">${esc(o.status || 'placed')}</span>
      </div>
    `).join('');
  }).catch(err => content.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`);
}

// ---------------- my listings ----------------
function renderListings() {
  const content = $('#listingsContent');
  if (!state.user) { content.innerHTML = `<div class="empty-state"><p>Please sign in.</p></div>`; return; }
  content.innerHTML = `<div class="center-pad"><div class="spinner"></div>Loading your listings...</div>`;

  db.collection('products').where('sellerId', '==', state.user.uid).get().then(snap => {
    const items = [];
    snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    items.sort(sortByCreatedDesc);
    if (!items.length) {
      content.innerHTML = `<div class="empty-state"><div class="glyph">💍</div><h3>No listings yet</h3><p>Tap the Sell tab to list your first piece.</p></div>`;
      return;
    }
    content.innerHTML = items.map(p => `
      <div class="list-row">
        <div class="thumb" style="${p.imageUrl ? `background-image:url('${esc(p.imageUrl)}')` : ''}"></div>
        <div class="info">
          <div class="t1">${esc(p.name)}</div>
          <div class="t2">${money(p.price)} · ${esc(p.category || 'Other')}</div>
        </div>
        <button class="del" data-del="${p.id}">🗑</button>
      </div>
    `).join('');
    $all('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Remove this listing?')) return;
        db.collection('products').doc(btn.dataset.del).delete()
          .then(() => { toast('Listing removed'); renderListings(); })
          .catch(err => toast(err.message));
      });
    });
  }).catch(err => content.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`);
}

// ---------------- init ----------------
renderCartBadges();
showView('home');