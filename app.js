// ── STATE ─────────────────────────────────────────────────────────────────────

const state = {
  userProfile:      { name: "", age: null, gender: "" },
  recipientProfile: { age: null, gender: "", relationship: "" },
  messages:         [],   // full history sent to backend
  cart:             [],   // [{ product, quantity }]
  onboardingStep:   0,    // 0=name 1=age 2=gender 3=done
  voiceEnabled:     localStorage.getItem("voiceEnabled") !== "false",
  isSending:        false,
  pendingCheckoutUrl: null,
};

// ── ONBOARDING SCRIPTS ────────────────────────────────────────────────────────

const OB_PROMPTS = [
  "Hey! Just a few quick things so I can give you better recommendations. What's your name?",
  null,   // filled after name: "Nice to meet you, [Name]! How old are you?"
  "And are you male or female?",
  null,   // filled after gender: "Perfect! So what are we shopping for today, [Name]?"
];

// ── DOM REFS ──────────────────────────────────────────────────────────────────

const $ob      = document.getElementById("onboarding-screen");
const $obMsgs  = document.getElementById("onboarding-messages");
const $obInput = document.getElementById("onboarding-input");
const $obSend  = document.getElementById("onboarding-send");

const $chat       = document.getElementById("chat-screen");
const $msgs       = document.getElementById("messages-container");
const $chatInput  = document.getElementById("chat-input");
const $sendBtn    = document.getElementById("send-btn");

const $voiceBtn     = document.getElementById("voice-toggle");
const $voicePulse   = document.getElementById("voice-pulse");
const $voiceIconOn  = document.getElementById("voice-icon-on");
const $voiceIconOff = document.getElementById("voice-icon-off");

const $cartBtn      = document.getElementById("cart-icon-btn");
const $cartCount    = document.getElementById("cart-count");
const $cartPanel    = document.getElementById("cart-panel");
const $cartOverlay  = document.getElementById("cart-overlay");
const $cartClose    = document.getElementById("cart-close");
const $cartItems    = document.getElementById("cart-items-list");
const $cartEmpty    = document.getElementById("cart-empty-state");
const $cartTotal    = document.getElementById("cart-total-amount");
const $checkoutBtn  = document.getElementById("checkout-btn");

// ── BACKGROUND CANVAS ─────────────────────────────────────────────────────────

(function initCanvas() {
  const canvas = document.getElementById("bg-canvas");
  const ctx    = canvas.getContext("2d");
  let W, H, frame = 0;

  const GRID = 48;
  const DOTS = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    DOTS.length = 0;
    for (let x = 0; x < W + GRID; x += GRID) {
      for (let y = 0; y < H + GRID; y += GRID) {
        DOTS.push({ x, y, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    const t = frame * 0.012;
    for (const d of DOTS) {
      const wave = Math.sin(d.x * 0.012 + t) * Math.cos(d.y * 0.012 + t + d.phase);
      const alpha = (wave + 1) * 0.5 * 0.55;
      const r = 1.5 + wave * 0.8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,51,41,${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();

// ── ONBOARDING ────────────────────────────────────────────────────────────────

function obAddBubble(text, role) {
  const div = document.createElement("div");
  div.className = `ob-bubble ${role}`;
  div.textContent = text;
  $obMsgs.appendChild(div);
  gsap.from(div, { opacity: 0, y: 14, duration: 0.38, ease: "power2.out" });
  return div;
}

function obStart() {
  setTimeout(() => obAddBubble(OB_PROMPTS[0], "agent"), 400);
}

function obHandleInput(raw) {
  const val = raw.trim();
  if (!val) return;

  obAddBubble(val, "user");
  $obInput.value = "";

  const step = state.onboardingStep;

  if (step === 0) {
    state.userProfile.name = val.split(" ")[0];
    state.onboardingStep = 1;
    const msg = `Nice to meet you, ${state.userProfile.name}! How old are you?`;
    OB_PROMPTS[1] = msg;
    setTimeout(() => obAddBubble(msg, "agent"), 500);

  } else if (step === 1) {
    const age = parseInt(val);
    state.userProfile.age = isNaN(age) ? null : age;
    state.onboardingStep = 2;
    setTimeout(() => obAddBubble(OB_PROMPTS[2], "agent"), 500);

  } else if (step === 2) {
    const lower = val.toLowerCase();
    if (lower.includes("male") || lower.includes("man") || lower.includes("boy") || lower === "m") {
      state.userProfile.gender = "male";
    } else if (lower.includes("female") || lower.includes("woman") || lower.includes("girl") || lower === "f") {
      state.userProfile.gender = "female";
    } else {
      state.userProfile.gender = val;
    }
    state.onboardingStep = 3;
    const msg = `Perfect! So what are we shopping for today, ${state.userProfile.name}?`;
    OB_PROMPTS[3] = msg;
    setTimeout(() => {
      obAddBubble(msg, "agent");
      // Append onboarding as conversation context
      state.messages.push({ role: "assistant", content: OB_PROMPTS[0] });
      state.messages.push({ role: "user",      content: state.userProfile.name });
      state.messages.push({ role: "assistant", content: OB_PROMPTS[1] });
      state.messages.push({ role: "user",      content: val });
      state.messages.push({ role: "assistant", content: OB_PROMPTS[2] });
      state.messages.push({ role: "user",      content: raw.trim() });
      state.messages.push({ role: "assistant", content: msg });
      // Transition after a brief pause
      setTimeout(transitionToChat, 1000);
    }, 500);
  }
}

function transitionToChat() {
  gsap.to($ob, {
    opacity: 0, duration: 0.5, ease: "power2.in",
    onComplete: () => {
      $ob.classList.add("hidden");
      $chat.classList.remove("hidden");
      gsap.from($chat, { opacity: 0, duration: 0.5, ease: "power2.out" });
      $chatInput.focus();
    }
  });
}

$obSend.addEventListener("click", () => obHandleInput($obInput.value));
$obInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") obHandleInput($obInput.value);
});

// ── CHAT ──────────────────────────────────────────────────────────────────────

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  if (role === "agent") {
    const av = document.createElement("div");
    av.className = "agent-avatar";
    av.textContent = "K";
    row.appendChild(av);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);

  $msgs.appendChild(row);
  gsap.from(row, { opacity: 0, y: 16, duration: 0.4, ease: "power2.out" });
  scrollToBottom();
  return row;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "message-row agent";
  row.id = "typing-row";

  const av = document.createElement("div");
  av.className = "agent-avatar";
  av.textContent = "K";
  row.appendChild(av);

  const wrap = document.createElement("div");
  wrap.className = "typing-dots";
  wrap.innerHTML = "<span></span><span></span><span></span>";
  row.appendChild(wrap);

  $msgs.appendChild(row);
  gsap.from(row, { opacity: 0, y: 10, duration: 0.3 });
  scrollToBottom();
  return row;
}

function removeTyping() {
  const el = document.getElementById("typing-row");
  if (el) el.remove();
}

function addProductCards(products) {
  if (!products || !products.length) return;

  const wrap = document.createElement("div");
  wrap.className = "products-carousel";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";

    if (p.image_url) {
      const img = document.createElement("img");
      img.className = "product-card-image";
      img.src = p.image_url;
      img.alt = p.name;
      img.loading = "lazy";
      img.onerror = () => { img.replaceWith(makeImgPlaceholder()); };
      card.appendChild(img);
    } else {
      card.appendChild(makeImgPlaceholder());
    }

    const body = document.createElement("div");
    body.className = "product-card-body";

    const name = document.createElement("div");
    name.className = "product-card-name";
    name.textContent = p.name || "Product";
    body.appendChild(name);

    const price = document.createElement("div");
    price.className = "product-card-price";
    price.textContent = p.price ? `Rs. ${Number(p.price).toLocaleString()}` : "";
    body.appendChild(price);

    const btn = document.createElement("button");
    btn.className = "product-card-add";
    btn.textContent = "Add to Cart";
    btn.addEventListener("click", () => addToCart(p, btn));
    body.appendChild(btn);

    card.appendChild(body);
    wrap.appendChild(card);
  });

  $msgs.appendChild(wrap);
  gsap.from(wrap.children, {
    opacity: 0, y: 24, stagger: 0.08, duration: 0.45, ease: "power2.out"
  });
  scrollToBottom();
}

function makeImgPlaceholder() {
  const d = document.createElement("div");
  d.className = "product-card-image-placeholder";
  d.textContent = "🛍️";
  return d;
}

function showSkeletonCards(n = 3) {
  const wrap = document.createElement("div");
  wrap.className = "products-carousel";
  wrap.id = "skeleton-row";

  for (let i = 0; i < n; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML = `
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>`;
    wrap.appendChild(card);
  }

  $msgs.appendChild(wrap);
  scrollToBottom();
}

function removeSkeletons() {
  const el = document.getElementById("skeleton-row");
  if (el) el.remove();
}

function scrollToBottom() {
  setTimeout(() => { $msgs.scrollTop = $msgs.scrollHeight; }, 50);
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = $chatInput.value.trim();
  if (!text || state.isSending) return;

  state.isSending = true;
  $sendBtn.disabled = true;
  $chatInput.value = "";
  autoResizeTextarea();

  addMessage("user", text);
  state.messages.push({ role: "user", content: text });

  const typingEl = showTyping();
  showSkeletonCards(3);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages:         state.messages,
        userProfile:      state.userProfile,
        recipientProfile: state.recipientProfile,
      }),
    });

    removeTyping();
    removeSkeletons();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Network error" }));
      addMessage("agent", `Sorry, something went wrong: ${err.error || res.statusText}`);
      state.messages.pop();
      return;
    }

    const data = await res.json();

    if (data.message) {
      addMessage("agent", data.message);
      state.messages.push({ role: "assistant", content: data.message });
      speak(data.message);
    }

    if (data.products && data.products.length) {
      addProductCards(data.products);
    }

    if (data.checkoutUrl) {
      state.pendingCheckoutUrl = data.checkoutUrl;
      $checkoutBtn.disabled = false;
    }

  } catch (err) {
    removeTyping();
    removeSkeletons();
    addMessage("agent", "Connection error. Please try again.");
    state.messages.pop();
  } finally {
    state.isSending = false;
    $sendBtn.disabled = false;
    $chatInput.focus();
  }
}

$sendBtn.addEventListener("click", sendMessage);

$chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

$chatInput.addEventListener("input", autoResizeTextarea);

function autoResizeTextarea() {
  $chatInput.style.height = "auto";
  $chatInput.style.height = Math.min($chatInput.scrollHeight, 120) + "px";
}

// ── VOICE ─────────────────────────────────────────────────────────────────────

function speak(text) {
  if (!state.voiceEnabled || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const clean = text
    .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
    .replace(/[*_`#>]/g, "")
    .slice(0, 400);

  const u = new SpeechSynthesisUtterance(clean);
  u.lang   = "en-US";
  u.rate   = 1.05;
  u.pitch  = 1;

  u.onstart = () => $voicePulse.classList.add("speaking");
  u.onend   = () => $voicePulse.classList.remove("speaking");
  u.onerror = () => $voicePulse.classList.remove("speaking");

  window.speechSynthesis.speak(u);
}

function updateVoiceUI() {
  if (state.voiceEnabled) {
    $voiceIconOn.classList.remove("hidden");
    $voiceIconOff.classList.add("hidden");
  } else {
    $voiceIconOn.classList.add("hidden");
    $voiceIconOff.classList.remove("hidden");
    window.speechSynthesis && window.speechSynthesis.cancel();
    $voicePulse.classList.remove("speaking");
  }
}

$voiceBtn.addEventListener("click", () => {
  state.voiceEnabled = !state.voiceEnabled;
  localStorage.setItem("voiceEnabled", state.voiceEnabled);
  updateVoiceUI();
});

updateVoiceUI();

// ── CART ──────────────────────────────────────────────────────────────────────

function addToCart(product, btn) {
  const existing = state.cart.find((i) => i.product.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({ product, quantity: 1 });
  }

  if (btn) {
    btn.textContent = "Added ✓";
    btn.classList.add("added");
    setTimeout(() => {
      btn.textContent = "Add to Cart";
      btn.classList.remove("added");
    }, 1800);
  }

  updateCartUI();
  gsap.from($cartCount, { scale: 1.6, duration: 0.3, ease: "back.out(2)" });
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((i) => i.product.id !== productId);
  updateCartUI();
}

function updateCartUI() {
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);
  const total = state.cart.reduce((s, i) => s + (i.product.price || 0) * i.quantity, 0);

  $cartCount.textContent = count;
  if (count > 0) $cartCount.classList.remove("hidden");
  else           $cartCount.classList.add("hidden");

  $cartTotal.textContent = `Rs. ${total.toLocaleString()}`;
  $checkoutBtn.disabled = count === 0 && !state.pendingCheckoutUrl;

  $cartItems.innerHTML = "";
  if (state.cart.length === 0) {
    $cartEmpty.style.display = "flex";
    $cartItems.style.display = "none";
  } else {
    $cartEmpty.style.display = "none";
    $cartItems.style.display = "flex";

    state.cart.forEach((item) => {
      const el = document.createElement("div");
      el.className = "cart-item";

      if (item.product.image_url) {
        const img = document.createElement("img");
        img.className = "cart-item-img";
        img.src = item.product.image_url;
        img.alt = item.product.name;
        img.onerror = () => img.replaceWith(makeCartPlaceholder());
        el.appendChild(img);
      } else {
        el.appendChild(makeCartPlaceholder());
      }

      const info = document.createElement("div");
      info.className = "cart-item-info";

      const nameEl = document.createElement("div");
      nameEl.className = "cart-item-name";
      nameEl.textContent = `${item.product.name}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`;
      info.appendChild(nameEl);

      const priceEl = document.createElement("div");
      priceEl.className = "cart-item-price";
      priceEl.textContent = item.product.price
        ? `Rs. ${(item.product.price * item.quantity).toLocaleString()}`
        : "";
      info.appendChild(priceEl);

      el.appendChild(info);

      const rm = document.createElement("button");
      rm.className = "cart-item-remove";
      rm.innerHTML = "×";
      rm.setAttribute("aria-label", `Remove ${item.product.name}`);
      rm.addEventListener("click", () => removeFromCart(item.product.id));
      el.appendChild(rm);

      $cartItems.appendChild(el);
    });
  }
}

function makeCartPlaceholder() {
  const d = document.createElement("div");
  d.className = "cart-item-img-placeholder";
  d.textContent = "🛍️";
  return d;
}

function openCart() {
  $cartPanel.classList.add("open");
  $cartOverlay.classList.add("active");
}

function closeCart() {
  $cartPanel.classList.remove("open");
  $cartOverlay.classList.remove("active");
}

$cartBtn.addEventListener("click",    openCart);
$cartClose.addEventListener("click",  closeCart);
$cartOverlay.addEventListener("click", closeCart);

$checkoutBtn.addEventListener("click", () => {
  const url = state.pendingCheckoutUrl;
  if (url) {
    window.open(url, "_blank", "noopener");
  } else {
    // Ask agent to generate checkout
    $chatInput.value = "I'm ready to checkout. Please create the order.";
    sendMessage();
    closeCart();
  }
});

// ── EXPOSE addToCart for external use (product cards rendered dynamically) ──
window._addToCart = addToCart;

// ── INIT ─────────────────────────────────────────────────────────────────────

updateCartUI();
obStart();
