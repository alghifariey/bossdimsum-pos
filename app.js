import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, serverTimestamp, writeBatch, doc, increment, getDocs, query, where, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAfIoCBtXQP9iJ_9t_emz0iD1ClBAJUofs",
  authDomain: "boss-dimsum-pos-b4734.firebaseapp.com",
  projectId: "boss-dimsum-pos-b4734",
  storageBucket: "boss-dimsum-pos-b4734.firebasestorage.app",
  messagingSenderId: "705169822846",
  appId: "1:705169822846:web:01d045efb8e8c4cb80342f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentOutlet = ""; 
let isOwner = false;
let cart = [];
let grandTotal = 0;
let paymentMethod = "CASH";

const itemNames = {
    "dimsum_pcs": "Dimsum (Pcs)",
    "dimsum_frozen": "Dimsum Frozen (Pcs)",
    "foil_small": "Aluminium Foil - Small",
    "foil_medium": "Aluminium Foil - Medium",
    "foil_large": "Aluminium Foil - Large"
};

const colorClasses = {
    "orange": "bg-orange-50 border-orange-200 text-orange-900",
    "red": "bg-red-50 border-red-200 text-red-900",
    "blue": "bg-blue-50 border-blue-200 text-blue-900",
    "green": "bg-green-50 border-green-200 text-green-900",
    "yellow": "bg-yellow-50 border-yellow-200 text-yellow-900"
};

let menuItems = [];

const defaultMenus = [
    { id: "DO5", name: "Dimsum Original 5pcs", price: 15000, color: "orange", components: [{id: "dimsum_pcs", qty: 5}] },
    { id: "DM3", name: "Dimsum Mentai 3pcs", price: 15000, color: "red", components: [{id: "dimsum_pcs", qty: 3}, {id: "foil_small", qty: 1}] },
    { id: "DM6", name: "Dimsum Mentai 6pcs", price: 25000, color: "red", components: [{id: "dimsum_pcs", qty: 6}, {id: "foil_medium", qty: 1}] },
    { id: "DM16", name: "Dimsum Mentai 16pcs", price: 80000, color: "red", components: [{id: "dimsum_pcs", qty: 16}, {id: "foil_large", qty: 1}] },
    { id: "DG6", name: "Dimsum Gift 6pcs", price: 33000, color: "blue", components: [{id: "dimsum_pcs", qty: 6}, {id: "foil_medium", qty: 1}] },
    { id: "DG16", name: "Dimsum Gift 16pcs", price: 85000, color: "blue", components: [{id: "dimsum_pcs", qty: 16}, {id: "foil_large", qty: 1}] },
    { id: "DF25", name: "Dimsum Frozen 25pcs", price: 68000, color: "green", components: [{id: "dimsum_frozen", qty: 1}] },
    { id: "ECO", name: "Extra Chili Oil", price: 3000, color: "yellow", components: [] }
];

async function fetchMenus() {
    try {
        const snap = await getDocs(collection(db, "menus"));
        if (snap.empty) {
            const batch = writeBatch(db);
            defaultMenus.forEach(item => {
                const docRef = doc(db, "menus", item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return fetchMenus();
        }
        menuItems = [];
        snap.forEach(doc => { menuItems.push(doc.data()); });
        menuItems.sort((a,b) => a.price - b.price);
        
        if(pages.kasir && !pages.kasir.classList.contains('hidden')) renderMenu();
        if(pages.masterMenu && !pages.masterMenu.classList.contains('hidden')) renderMasterMenu();
    } catch (e) { console.error("Gagal mengambil menu:", e); }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        isOwner = !user.email.includes("aster") && !user.email.includes("murni");
        fetchMenus();

        if (isOwner) {
            document.getElementById('outlet-name').textContent = "Mode Pemilik";
            document.getElementById('owner-outlet-selector').classList.remove('hidden');
            currentOutlet = document.getElementById('owner-outlet-selector').value;
            
            if(document.getElementById('nav-kasir')) document.getElementById('nav-kasir').classList.add('hidden');
            if(document.getElementById('btn-show-inbound')) document.getElementById('btn-show-inbound').classList.add('hidden');
            if(document.getElementById('btn-show-outbound')) document.getElementById('btn-show-outbound').classList.add('hidden'); 
            if(document.getElementById('nav-master-menu')) {
                document.getElementById('nav-master-menu').classList.remove('hidden');
                document.getElementById('nav-master-menu').classList.add('flex');
            }
            switchPage('laporan'); 
        } else {
            currentOutlet = user.email.includes("aster") ? "Taman Aster" : "Telaga Murni";
            document.getElementById('outlet-name').textContent = `Cabang ${currentOutlet}`;
            document.getElementById('owner-outlet-selector').classList.add('hidden');
            
            if(document.getElementById('nav-kasir')) document.getElementById('nav-kasir').classList.remove('hidden');
            if(document.getElementById('btn-show-inbound')) document.getElementById('btn-show-inbound').classList.remove('hidden');
            if(document.getElementById('btn-show-outbound')) document.getElementById('btn-show-outbound').classList.remove('hidden');
            if(document.getElementById('nav-master-menu')) document.getElementById('nav-master-menu').classList.add('hidden');
            switchPage('kasir'); 
        }
    } else {
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

document.getElementById('owner-outlet-selector').addEventListener('change', (e) => {
    currentOutlet = e.target.value; 
    if (pages.laporan && !pages.laporan.classList.contains('hidden')) loadReports();
    else if (pages.inventori && !pages.inventori.classList.contains('hidden')) loadInventory();
    else if (pages.riwayat && !pages.riwayat.classList.contains('hidden')) loadStockHistory(); 
});

document.getElementById('btn-login').addEventListener('click', () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('password').value;
    document.getElementById('btn-login').textContent = "Loading...";
    signInWithEmailAndPassword(auth, e, p).catch(() => { 
        document.getElementById('login-error').classList.remove('hidden'); 
        document.getElementById('btn-login').textContent = "Masuk"; 
    });
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- NAVIGASI MANAJEMEN HALAMAN ---
const pages = {
    kasir: document.getElementById('page-kasir'),
    inventori: document.getElementById('page-inventori'),
    laporan: document.getElementById('page-laporan'),
    riwayat: document.getElementById('page-riwayat'),
    rekap: document.getElementById('page-rekap'),
    masterMenu: document.getElementById('page-master-menu')
};
const navBtns = {
    kasir: document.getElementById('nav-kasir'),
    inventori: document.getElementById('nav-inventori'),
    laporan: document.getElementById('nav-laporan'),
    riwayat: document.getElementById('nav-riwayat'),
    rekap: document.getElementById('nav-rekap'),
    masterMenu: document.getElementById('nav-master-menu')
};

const btnMenuToggle = document.getElementById('btn-menu-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');

if(btnMenuToggle) {
    btnMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
        dropdownMenu.classList.toggle('flex');
    });
}

document.addEventListener('click', (e) => {
    if (btnMenuToggle && dropdownMenu && !btnMenuToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.add('hidden');
        dropdownMenu.classList.remove('flex');
    }
});

function switchPage(activePage) {
    Object.values(pages).forEach(page => {
        if (page) page.classList.add('hidden');
    });
    
    if (pages[activePage]) pages[activePage].classList.remove('hidden');
    
    Object.values(navBtns).forEach(btn => {
        if (btn) {
            btn.classList.remove('text-red-600', 'font-bold');
            btn.classList.add('text-gray-700', 'font-medium');
        }
    });
    
    if (navBtns[activePage]) {
        navBtns[activePage].classList.remove('text-gray-700', 'font-medium');
        navBtns[activePage].classList.add('text-red-600', 'font-bold');
    }

    if(dropdownMenu) {
        dropdownMenu.classList.add('hidden');
        dropdownMenu.classList.remove('flex');
    }

    if(activePage === 'inventori') loadInventory();
    if(activePage === 'laporan') loadReports();
    if(activePage === 'riwayat') loadStockHistory();
    if(activePage === 'masterMenu') renderMasterMenu();
    if(activePage === 'kasir') renderMenu();
}

if(navBtns.kasir) navBtns.kasir.addEventListener('click', () => switchPage('kasir'));
if(navBtns.inventori) navBtns.inventori.addEventListener('click', () => switchPage('inventori'));
if(navBtns.laporan) navBtns.laporan.addEventListener('click', () => switchPage('laporan'));
if(navBtns.riwayat) navBtns.riwayat.addEventListener('click', () => switchPage('riwayat'));
if(navBtns.rekap) navBtns.rekap.addEventListener('click', () => switchPage('rekap'));
if(navBtns.masterMenu) navBtns.masterMenu.addEventListener('click', () => switchPage('masterMenu'));


// --- MODUL KASIR & KERANJANG ---
function renderMenu() {
    const mg = document.getElementById('menu-grid');
    if(!mg) return;
    mg.innerHTML = "";
    menuItems.forEach(item => {
        const btn = document.createElement('button');
        const cssClass = colorClasses[item.color] || colorClasses['orange']; 
        btn.className = `${cssClass} p-3 rounded-2xl shadow-sm border active:scale-95 transition text-left h-24 flex flex-col justify-between`;
        btn.innerHTML = `<div class="font-bold text-sm leading-tight">${item.name}</div><div class="font-black text-xs mt-1">Rp ${item.price.toLocaleString('id-ID')}</div>`;
        btn.addEventListener('click', () => addToCart(item));
        mg.appendChild(btn);
    });
}

function addToCart(item) {
    const ex = cart.find(c => c.id === item.id);
    if (ex) ex.qty += 1; else cart.push({ ...item, qty: 1 });
    updateCartUI();
}

function updateCartUI() {
    const cl = document.getElementById('cart-list');
    if(!cl) return;
    cl.innerHTML = ""; grandTotal = 0; let items = 0;
    
    if (cart.length === 0) {
        cl.innerHTML = `<li class="text-gray-400 italic text-center mt-4 text-sm">Belum ada pesanan</li>`;
    } else {
        cart.forEach((i) => {
            grandTotal += i.price * i.qty; items += i.qty;
            const li = document.createElement('li');
            li.className = "p-3 bg-white border border-gray-200 rounded-xl flex flex-col gap-2 text-sm shadow-sm";
            li.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="font-bold text-gray-800 flex-1">${i.name}</div>
                    <div class="font-bold text-gray-900">Rp ${(i.price * i.qty).toLocaleString('id-ID')}</div>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-xs text-red-600 font-medium">${i.qty} x Rp ${i.price.toLocaleString('id-ID')}</div>
                    <div class="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                        <button class="btn-min w-7 h-7 bg-white text-red-500 rounded-md shadow-sm flex items-center justify-center font-bold border border-gray-200 active:scale-95">-</button>
                        <span class="w-6 text-center font-bold text-gray-800">${i.qty}</span>
                        <button class="btn-plus w-7 h-7 bg-white text-blue-500 rounded-md shadow-sm flex items-center justify-center font-bold border border-gray-200 active:scale-95">+</button>
                        <button class="btn-del w-7 h-7 bg-red-100 text-red-600 rounded-md shadow-sm flex items-center justify-center hover:bg-red-500 hover:text-white ml-2 active:scale-95">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `;
            li.querySelector('.btn-min').addEventListener('click', () => changeCartQty(i.id, -1));
            li.querySelector('.btn-plus').addEventListener('click', () => changeCartQty(i.id, 1));
            li.querySelector('.btn-del').addEventListener('click', () => changeCartQty(i.id, -i.qty));
            cl.appendChild(li);
        });
    }
    
    if(document.getElementById('cart-total-bottom')) document.getElementById('cart-total-bottom').textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    if(document.getElementById('cart-badge')) document.getElementById('cart-badge').textContent = `${items} Item`;
    if(document.getElementById('modal-total')) document.getElementById('modal-total').textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    
    const cashInput = document.getElementById('cash-input');
    if (cashInput && cashInput.value) {
        cashInput.dispatchEvent(new Event('input'));
    }
}

function changeCartQty(id, delta) {
    const item = cart.find(c => c.id === id);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
        updateCartUI();
    }
}

const btnCheckout = document.getElementById('btn-checkout');
if(btnCheckout) {
    btnCheckout.addEventListener('click', () => {
        if (cart.length === 0) return alert("Keranjang masih kosong! Silakan pilih menu terlebih dahulu.");
        document.getElementById('payment-modal').classList.remove('hidden');
        setPaymentMethod('CASH');
        document.getElementById('cash-input').value = "";
        document.getElementById('change-display').textContent = "Rp 0";
    });
}

const btnCancelPayment = document.getElementById('btn-cancel-payment');
if(btnCancelPayment) {
    btnCancelPayment.addEventListener('click', () => document.getElementById('payment-modal').classList.add('hidden'));
}

function setPaymentMethod(method) {
    paymentMethod = method;
    const c = document.getElementById('btn-cash'), q = document.getElementById('btn-qris'), ca = document.getElementById('cash-area');
    if(c && q && ca) {
        c.className = method === 'CASH' ? "flex-1 py-3 rounded-xl font-bold bg-red-600 text-white" : "flex-1 py-3 rounded-xl font-bold border-2 border-gray-200 text-gray-500 bg-white";
        q.className = method === 'QRIS' ? "flex-1 py-3 rounded-xl font-bold bg-red-600 text-white" : "flex-1 py-3 rounded-xl font-bold border-2 border-gray-200 text-gray-500 bg-white";
        method === 'CASH' ? ca.classList.remove('hidden') : ca.classList.add('hidden');
    }
}

if(document.getElementById('btn-cash')) document.getElementById('btn-cash').addEventListener('click', () => setPaymentMethod('CASH'));
if(document.getElementById('btn-qris')) document.getElementById('btn-qris').addEventListener('click', () => setPaymentMethod('QRIS'));

if(document.getElementById('cash-input')) {
    document.getElementById('cash-input').addEventListener('input', (e) => {
        const received = parseInt(e.target.value) || 0;
        const change = received - grandTotal;
        const cd = document.getElementById('change-display');
        if (change < 0 && received > 0) { cd.textContent = "Uang Kurang!"; cd.className = "text-xl font-black text-red-500"; }
        else { cd.textContent = `Rp ${change >= 0 ? change.toLocaleString('id-ID') : 0}`; cd.className = "text-xl font-black text-green-700"; }
    });
}

const btnConfirmPayment = document.getElementById('btn-confirm-payment');
if(btnConfirmPayment) {
    btnConfirmPayment.addEventListener('click', async () => {
        if (cart.length === 0) return alert("Keranjang kosong!");
        let received = grandTotal, change = 0;
        if (paymentMethod === 'CASH') {
            received = parseInt(document.getElementById('cash-input').value) || 0;
            if (received < grandTotal) return alert("Uang kurang!");
            change = received - grandTotal;
        }
        btnConfirmPayment.textContent = "MEMPROSES...";
        try {
            const batch = writeBatch(db);
            const txRef = doc(collection(db, "transactions"));
            batch.set(txRef, { outlet: currentOutlet, items: cart, total: grandTotal, payment_method: paymentMethod, timestamp: serverTimestamp() });
            
            cart.forEach(cItem => {
                const menuData = menuItems.find(m => m.id === cItem.id);
                if (menuData && menuData.name.toLowerCase().includes("frozen")) {
                    batch.set(doc(db, "inventory", `${currentOutlet}_${cItem.id}`), { 
                        outlet: currentOutlet, item_id: cItem.id, qty: increment(-cItem.qty) 
                    }, { merge: true });
                } else if (menuData && menuData.components) {
                    menuData.components.forEach(comp => {
                        batch.set(doc(db, "inventory", `${currentOutlet}_${comp.id}`), { 
                            outlet: currentOutlet, item_id: comp.id, qty: increment(-(comp.qty * cItem.qty)) 
                        }, { merge: true });
                    });
                }
            });
            await batch.commit();
            document.getElementById('payment-modal').classList.add('hidden');
            showSuccess(`Berhasil! Kembalian: Rp ${change.toLocaleString('id-ID')}`);
            cart = []; updateCartUI();
        } catch (e) { alert("Error!"); console.error(e); }
        btnConfirmPayment.textContent = "PROSES SEKARANG";
    });
}

// --- MODUL MASTER MENU ---
function renderMasterMenu() {
    const list = document.getElementById('master-menu-list');
    if(!list) return;
    list.innerHTML = "";
    if(menuItems.length === 0) {
        list.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">Tidak ada data menu.</td></tr>`;
        return;
    }
    menuItems.forEach(item => {
        let compStr = item.components.map(c => `${c.qty}x ${itemNames[c.id]||c.id}`).join(', ');
        if(!compStr) compStr = "- Tanpa potong stok -";
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-4 font-bold text-gray-800 text-sm">${item.id}</td>
            <td class="p-4"><div class="font-bold text-gray-800 mb-1">${item.name}</div><div class="text-sm font-black text-blue-600 mb-1">Rp ${item.price.toLocaleString('id-ID')}</div><div class="text-xs text-gray-500 font-medium">${compStr}</div></td>
            <td class="p-4 text-center"><button class="btn-edit-menu text-xs bg-yellow-400 text-yellow-900 px-3 py-2 rounded font-bold shadow mb-2 w-full hover:bg-yellow-500">Edit</button><button class="btn-del-menu text-xs bg-red-100 text-red-600 px-3 py-2 rounded font-bold shadow w-full hover:bg-red-200">Hapus</button></td>
        `;
        tr.querySelector('.btn-edit-menu').addEventListener('click', () => openMenuForm(item));
        tr.querySelector('.btn-del-menu').addEventListener('click', () => deleteMenu(item.id, item.name));
        list.appendChild(tr);
    });
}

if(document.getElementById('btn-add-menu')) document.getElementById('btn-add-menu').addEventListener('click', () => openMenuForm(null));
if(document.getElementById('btn-cancel-menu')) document.getElementById('btn-cancel-menu').addEventListener('click', () => document.getElementById('menu-form-modal').classList.add('hidden'));

function addIngredientRow(selectedId = 'dimsum_pcs', qty = 1) {
    const container = document.getElementById('ingredients-container');
    const row = document.createElement('div');
    row.className = "flex gap-2 items-center ing-row bg-white p-2 rounded border border-blue-50";
    let optionsHTML = '';
    for (const [key, val] of Object.entries(itemNames)) {
        optionsHTML += `<option value="${key}" ${selectedId === key ? 'selected' : ''}>${val}</option>`;
    }
    row.innerHTML = `<select class="ing-id flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">${optionsHTML}</select><input type="number" class="ing-qty w-16 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" value="${qty}" min="1"><button class="btn-rm-ing text-red-500 font-bold px-2 hover:bg-red-50 rounded">X</button>`;
    row.querySelector('.btn-rm-ing').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

if(document.getElementById('btn-add-ingredient')) document.getElementById('btn-add-ingredient').addEventListener('click', () => addIngredientRow());

let isEditMode = false;
function openMenuForm(item = null) {
    const modal = document.getElementById('menu-form-modal');
    const title = document.getElementById('menu-modal-title');
    const idIn = document.getElementById('menu-id-input');
    const nameIn = document.getElementById('menu-name-input');
    const priceIn = document.getElementById('menu-price-input');
    const colorIn = document.getElementById('menu-color-input');
    const ingCont = document.getElementById('ingredients-container');
    ingCont.innerHTML = ""; 

    if (item) {
        isEditMode = true; title.textContent = "Edit Menu"; idIn.value = item.id; idIn.disabled = true; idIn.classList.add('bg-gray-200');
        nameIn.value = item.name; priceIn.value = item.price; colorIn.value = item.color || 'orange';
        item.components.forEach(c => addIngredientRow(c.id, c.qty));
    } else {
        isEditMode = false; title.textContent = "Tambah Menu Baru"; idIn.value = ""; idIn.disabled = false; idIn.classList.remove('bg-gray-200');
        nameIn.value = ""; priceIn.value = ""; colorIn.value = "orange"; addIngredientRow('dimsum_pcs', 1); 
    }
    modal.classList.remove('hidden');
}

if(document.getElementById('btn-save-menu')) {
    document.getElementById('btn-save-menu').addEventListener('click', async () => {
        const id = document.getElementById('menu-id-input').value.trim().toUpperCase();
        const name = document.getElementById('menu-name-input').value.trim();
        const price = parseInt(document.getElementById('menu-price-input').value);
        const color = document.getElementById('menu-color-input').value;
        if(!id || !name || !price) return alert("Harap lengkapi Kode, Nama, dan Harga Menu!");
        const components = [];
        const rows = document.querySelectorAll('.ing-row');
        rows.forEach(row => {
            const item_id = row.querySelector('.ing-id').value;
            const qty = parseInt(row.querySelector('.ing-qty').value) || 0;
            if(qty > 0) components.push({ id: item_id, qty: qty });
        });
        const btn = document.getElementById('btn-save-menu');
        btn.textContent = "Menyimpan..."; btn.disabled = true;
        try {
            const menuRef = doc(db, "menus", id);
            await setDoc(menuRef, { id: id, name: name, price: price, color: color, components: components });
            document.getElementById('menu-form-modal').classList.add('hidden');
            showSuccess("Menu berhasil disimpan!");
            await fetchMenus(); 
        } catch(e) { alert("Gagal menyimpan menu!"); } 
        finally { btn.textContent = "SIMPAN MENU"; btn.disabled = false; }
    });
}

async function deleteMenu(id, name) {
    if(confirm(`Yakin ingin MENGHAPUS menu "${name}"?\n(Ini tidak akan menghapus riwayat transaksi)`)) {
        try { await deleteDoc(doc(db, "menus", id)); showSuccess("Menu berhasil dihapus."); fetchMenus(); } catch(e) { alert("Gagal menghapus menu."); }
    }
}

// --- MODUL INVENTORI & LOG STOK ---
async function loadInventory() {
    const list = document.getElementById('inventory-list');
    if(!list) return;
    list.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">Memuat stok...</td></tr>`;
    try {
        const q = query(collection(db, "inventory"), where("outlet", "==", currentOutlet));
        const snap = await getDocs(q);
        list.innerHTML = "";
        if (snap.empty) { list.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400 italic">Belum ada data stok.</td></tr>`; return; }
        
        let foundItems = {};
        snap.forEach(doc => {
            const data = doc.data();
            foundItems[data.item_id] = data.qty;
        });

        for (const [itemId, labelName] of Object.entries(itemNames)) {
            const currentQty = foundItems[itemId] || 0;
            const colorClass = currentQty < 50 ? 'text-red-600 font-bold' : 'text-gray-800';
            list.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-4 text-gray-800 font-medium">${labelName}</td>
                    <td class="p-4 text-right ${colorClass}">${currentQty.toLocaleString('id-ID')}</td>
                </tr>`;
        }
    } catch (error) { list.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-red-500">Gagal memuat data.</td></tr>`; }
}

if(document.getElementById('btn-show-inbound')) {
    document.getElementById('btn-show-inbound').addEventListener('click', () => { document.getElementById('inbound-qty').value = ""; document.getElementById('inbound-modal').classList.remove('hidden'); });
    document.getElementById('btn-cancel-inbound').addEventListener('click', () => document.getElementById('inbound-modal').classList.add('hidden'));
}

if(document.getElementById('btn-submit-inbound')) {
    document.getElementById('btn-submit-inbound').addEventListener('click', async () => {
        const itemId = document.getElementById('inbound-item').value; const qty = parseInt(document.getElementById('inbound-qty').value);
        if(!qty || qty <= 0) return alert("Masukkan jumlah stok dengan benar!");
        const btn = document.getElementById('btn-submit-inbound'); btn.textContent = "Menyimpan..."; btn.disabled = true;
        try {
            const batch = writeBatch(db);
            const invRef = doc(db, "inventory", `${currentOutlet}_${itemId}`);
            batch.set(invRef, { outlet: currentOutlet, item_id: itemId, qty: increment(qty), last_updated: serverTimestamp() }, { merge: true });
            const logRef = doc(collection(db, "stock_inbound"));
            batch.set(logRef, { outlet: currentOutlet, item_id: itemId, qty_added: qty, timestamp: serverTimestamp() });
            await batch.commit();
            document.getElementById('inbound-modal').classList.add('hidden'); showSuccess(`Berhasil menambah ${qty} ${itemNames[itemId]}`); loadInventory(); 
        } catch(e) { alert("Gagal menambah stok."); } finally { btn.textContent = "SIMPAN STOK"; btn.disabled = false; }
    });
}

if(document.getElementById('btn-show-outbound')) {
    document.getElementById('btn-show-outbound').addEventListener('click', () => { document.getElementById('outbound-qty').value = ""; document.getElementById('outbound-reason').value = ""; document.getElementById('outbound-modal').classList.remove('hidden'); });
    document.getElementById('btn-cancel-outbound').addEventListener('click', () => document.getElementById('outbound-modal').classList.add('hidden'));
}

if(document.getElementById('btn-submit-outbound')) {
    document.getElementById('btn-submit-outbound').addEventListener('click', async () => {
        const itemId = document.getElementById('outbound-item').value; const qty = parseInt(document.getElementById('outbound-qty').value); const reason = document.getElementById('outbound-reason').value.trim();
        if(!qty || qty <= 0) return alert("Masukkan jumlah stok dengan benar!"); if(!reason) return alert("Harap isi alasan pengurangan stok!");
        const btn = document.getElementById('btn-submit-outbound'); btn.textContent = "Menyimpan..."; btn.disabled = true;
        try {
            const batch = writeBatch(db);
            const invRef = doc(db, "inventory", `${currentOutlet}_${itemId}`);
            batch.set(invRef, { outlet: currentOutlet, item_id: itemId, qty: increment(-qty), last_updated: serverTimestamp() }, { merge: true });
            const logRef = doc(collection(db, "stock_adjustments"));
            batch.set(logRef, { outlet: currentOutlet, item_id: itemId, qty_reduced: qty, reason: reason, timestamp: serverTimestamp() });
            await batch.commit();
            document.getElementById('outbound-modal').classList.add('hidden'); showSuccess(`Berhasil mengurangi ${qty} ${itemNames[itemId]}`); loadInventory(); 
        } catch(e) { alert("Gagal mengurangi stok."); } finally { btn.textContent = "KURANGI STOK"; btn.disabled = false; }
    });
}

async function loadStockHistory() {
    const inList = document.getElementById('inbound-list'); const outList = document.getElementById('outbound-list');
    if(!inList || !outList) return;
    inList.innerHTML = `<li class="p-4 text-center text-gray-400">Memuat riwayat masuk...</li>`; outList.innerHTML = `<li class="p-4 text-center text-gray-400">Memuat riwayat keluar...</li>`;
    try {
        const qIn = query(collection(db, "stock_inbound"), where("outlet", "==", currentOutlet)); const snapIn = await getDocs(qIn);
        const qOut = query(collection(db, "stock_adjustments"), where("outlet", "==", currentOutlet)); const snapOut = await getDocs(qOut);

        if (snapIn.empty) inList.innerHTML = `<li class="p-4 text-center text-gray-400 italic">Belum ada riwayat tambah stok.</li>`;
        else {
            const sortedIn = snapIn.docs.sort((a,b) => (b.data().timestamp?.toDate() || 0) - (a.data().timestamp?.toDate() || 0)); inList.innerHTML = "";
            sortedIn.forEach(doc => {
                const data = doc.data(); const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : "Baru saja"; const name = itemNames[data.item_id] || data.item_id;
                inList.innerHTML += `<li class="p-4 hover:bg-gray-50 flex justify-between items-center"><div><div class="font-bold text-gray-800">${name}</div><div class="text-xs text-gray-400">${timeStr}</div></div><div class="font-black text-blue-600">+${data.qty_added} pcs</div></li>`;
            });
        }
        if (snapOut.empty) outList.innerHTML = `<li class="p-4 text-center text-gray-400 italic">Belum ada riwayat pengurangan stok.</li>`;
        else {
            const sortedOut = snapOut.docs.sort((a,b) => (b.data().timestamp?.toDate() || 0) - (a.data().timestamp?.toDate() || 0)); outList.innerHTML = "";
            sortedOut.forEach(doc => {
                const data = doc.data(); const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : "Baru saja"; const name = itemNames[data.item_id] || data.item_id;
                outList.innerHTML += `<li class="p-4 hover:bg-gray-50 flex justify-between items-center"><div><div class="font-bold text-gray-800">${name}</div><div class="text-xs text-gray-500 font-medium">Alasan: ${data.reason}</div><div class="text-xs text-gray-400">${timeStr}</div></div><div class="font-black text-red-600">-${data.qty_reduced} pcs</div></li>`;
            });
        }
    } catch (e) { inList.innerHTML = `<li class="p-4 text-center text-red-500">Gagal memuat data.</li>`; outList.innerHTML = `<li class="p-4 text-center text-red-500">Gagal memuat data.</li>`; }
}


// --- MODUL LAPORAN TRANSAKSI & SUMMARY ---
async function loadReports(startDateObj = null, endDateObj = null) {
    const list = document.getElementById('report-list');
    const totalEl = document.getElementById('report-total-sales');
    const summaryEl = document.getElementById('report-item-summary'); 
    if(!list || !totalEl || !summaryEl) return;
    
    list.innerHTML = `<li class="p-4 text-center text-gray-400">Memuat laporan...</li>`;
    summaryEl.innerHTML = `<li class="text-sm text-gray-400 italic">Memuat ringkasan...</li>`;
    
    try {
        const q = query(collection(db, "transactions"), where("outlet", "==", currentOutlet));
        const snap = await getDocs(q);
        list.innerHTML = ""; 
        let totalSales = 0;
        let itemSummary = {}; 

        if (snap.empty) { 
            list.innerHTML = `<li class="p-4 text-center text-gray-400 italic">Belum ada transaksi.</li>`; 
            totalEl.textContent = "Rp 0"; 
            summaryEl.innerHTML = `<li class="text-sm text-gray-400 italic">Belum ada produk terjual.</li>`;
            return; 
        }
        
        let filteredDocs = snap.docs;
        if (startDateObj && endDateObj) {
            filteredDocs = snap.docs.filter(doc => {
                const docTime = doc.data().timestamp?.toDate();
                return docTime && docTime >= startDateObj && docTime <= endDateObj;
            });
        }

        const sortedDocs = filteredDocs.sort((a, b) => (b.data().timestamp?.toDate() || 0) - (a.data().timestamp?.toDate() || 0));
        
        if (sortedDocs.length === 0) { 
            list.innerHTML = `<li class="p-4 text-center text-gray-400 italic">Tidak ada transaksi.</li>`; 
            totalEl.textContent = "Rp 0"; 
            summaryEl.innerHTML = `<li class="text-sm text-gray-400 italic">Tidak ada produk terjual pada tanggal ini.</li>`;
            return; 
        }

        sortedDocs.forEach(doc => {
            const data = doc.data(); totalSales += data.total;
            const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}) : "Baru saja";
            const itemsStr = data.items.map(i => `${i.qty}x ${i.name}`).join(', ');
            
            data.items.forEach(item => {
                if (itemSummary[item.name]) {
                    itemSummary[item.name] += item.qty;
                } else {
                    itemSummary[item.name] = item.qty;
                }
            });

            list.innerHTML += `<li class="p-4 hover:bg-gray-50"><div class="flex justify-between items-start mb-1"><div class="font-bold text-gray-800">Rp ${data.total.toLocaleString('id-ID')}</div><div class="text-xs font-medium text-white px-2 py-1 rounded ${data.payment_method === 'CASH' ? 'bg-green-500' : 'bg-blue-500'}">${data.payment_method}</div></div><div class="text-sm text-gray-600 mb-1 leading-tight">${itemsStr}</div><div class="text-xs text-gray-400 mt-1">${timeStr}</div></li>`;
        });
        
        totalEl.textContent = `Rp ${totalSales.toLocaleString('id-ID')}`;

        summaryEl.innerHTML = "";
        const summaryKeys = Object.keys(itemSummary);
        
        summaryKeys.sort((a, b) => itemSummary[b] - itemSummary[a]).forEach(itemName => {
            summaryEl.innerHTML += `
                <li class="bg-gray-50 p-2 rounded-xl border border-gray-100 flex justify-between items-center">
                    <span class="text-xs font-bold text-gray-700">${itemName}</span>
                    <span class="text-xs font-black text-red-600 bg-red-100 px-2 py-1 rounded">${itemSummary[itemName]} porsi</span>
                </li>
            `;
        });

    } catch (error) { 
        list.innerHTML = `<li class="p-4 text-center text-red-500">Gagal memuat laporan.</li>`; 
        summaryEl.innerHTML = `<li class="text-sm text-red-500">Gagal memuat ringkasan.</li>`;
    }
}

if(document.getElementById('btnFilterLaporan')) {
    document.getElementById('btnFilterLaporan').addEventListener('click', () => {
        const sVal = document.getElementById('startDate').value; const eVal = document.getElementById('endDate').value;
        if (!sVal || !eVal) return alert("Pilih tanggal terlebih dahulu!");
        const s = new Date(sVal); s.setHours(0,0,0,0);
        const e = new Date(eVal); e.setHours(23,59,59,999);
        loadReports(s, e);
    });
}

if(document.getElementById('btnResetFilter')) {
    document.getElementById('btnResetFilter').addEventListener('click', () => {
        document.getElementById('startDate').value = ''; document.getElementById('endDate').value = '';
        loadReports(); 
    });
}

function showSuccess(msg) {
    if(document.getElementById('success-msg')) document.getElementById('success-msg').textContent = msg;
    if(document.getElementById('success-modal')) document.getElementById('success-modal').classList.remove('hidden');
}

if(document.getElementById('btn-close-success')) {
    document.getElementById('btn-close-success').addEventListener('click', () => document.getElementById('success-modal').classList.add('hidden'));
}
