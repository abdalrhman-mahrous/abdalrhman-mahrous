document.addEventListener("DOMContentLoaded", () => {
  let currentProductData = null;

  const modal = document.getElementById("custom-product-modal");
  const closeModalBtn = document.querySelector(".custom-modal-close");
  const triggerBtns = document.querySelectorAll(".open-modal-btn");
  const form = document.getElementById("modal-add-to-cart-form");

  const elements = {
    image: document.getElementById("modal-product-image"),
    title: document.getElementById("modal-product-title"),
    price: document.getElementById("modal-product-price"),
    description: document.getElementById("modal-product-description"),
    variantsContainer: document.getElementById("modal-product-variants"),
    hiddenVariantId: document.getElementById("modal-variant-id"),
    submitBtn: document.getElementById("modal-add-to-cart-btn"),
  };

  triggerBtns.forEach((btn) => {
    btn.addEventListener("click", async function () {
      const handle = this.getAttribute("data-product-handle");
      if (!handle) return;
      await fetchAndPopulateProduct(handle);
      openModal();
    });
  });

  closeModalBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener("submit", handleAddToCart);

  async function fetchAndPopulateProduct(handle) {
    try {
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) throw new Error("Failed to fetch product");
      const product = await response.json();

      currentProductData = product;

      elements.title.textContent = product.title;
      elements.description.innerHTML = product.description;
      elements.image.src = product.images.length > 0 ? product.images[0] : "";
      elements.price.textContent = (product.price / 100).toFixed(2) + "€";

      buildVariantSelectors(product);
    } catch (error) {
      console.error("Error loading product data:", error);
    }
  }

  function buildVariantSelectors(product) {
    elements.variantsContainer.innerHTML = "";

    if (product.options && product.options[0].name !== "Title") {
      product.options.forEach((option, index) => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "variant-group";

        const label = document.createElement("label");
        label.textContent = option.name;
        groupDiv.appendChild(label);

        // --- CUSTOM UI FOR COLOR ---
        if (option.name.toLowerCase() === "color") {
          const swatchContainer = document.createElement("div");
          swatchContainer.className = "color-swatches";
          swatchContainer.dataset.index = index;

          option.values.forEach((value, vIdx) => {
            const swatch = document.createElement("div");
            // First item is active by default
            swatch.className = "color-swatch" + (vIdx === 0 ? " active" : "");
            swatch.textContent = value;
            swatch.dataset.value = value;

            swatch.addEventListener("click", function () {
              // Remove active class from siblings, add to clicked
              Array.from(swatchContainer.children).forEach((c) =>
                c.classList.remove("active"),
              );
              this.classList.add("active");
              updateSelectedVariant();
            });
            swatchContainer.appendChild(swatch);
          });
          groupDiv.appendChild(swatchContainer);
        }
        // --- DEFAULT UI FOR SIZE/OTHER ---
        else {
          const select = document.createElement("select");
          select.className = "custom-variant-select";
          select.dataset.index = index;

          option.values.forEach((value) => {
            const optionEl = document.createElement("option");
            optionEl.value = value;
            optionEl.textContent = value;
            select.appendChild(optionEl);
          });

          select.addEventListener("change", updateSelectedVariant);
          groupDiv.appendChild(select);
        }

        elements.variantsContainer.appendChild(groupDiv);
      });
    }
    updateSelectedVariant();
  }

  function updateSelectedVariant() {
    if (!currentProductData) return;

    const selectedValues = [];

    // Gather selected values from our custom UI
    currentProductData.options.forEach((opt, idx) => {
      if (opt.name.toLowerCase() === "color") {
        const activeSwatch = document.querySelector(
          `.color-swatches[data-index="${idx}"] .color-swatch.active`,
        );
        selectedValues[idx] = activeSwatch ? activeSwatch.dataset.value : "";
      } else {
        const select = document.querySelector(`select[data-index="${idx}"]`);
        selectedValues[idx] = select ? select.value : "";
      }
    });

    // Find matching variant ID
    const matchedVariant = currentProductData.variants.find((variant) => {
      const vOptions = [
        variant.option1,
        variant.option2,
        variant.option3,
      ].filter(Boolean);
      return selectedValues.every((val, index) => val === vOptions[index]);
    });

    if (matchedVariant) {
      elements.hiddenVariantId.value = matchedVariant.id;
      elements.price.textContent =
        (matchedVariant.price / 100).toFixed(2) + "€";
    }
  }

  async function handleAddToCart(e) {
    e.preventDefault();

    const variantId = elements.hiddenVariantId.value;
    if (!variantId) return;

    elements.submitBtn.disabled = true;
    elements.submitBtn.querySelector(".btn-text").textContent = "ADDING...";

    // 1. Check current selections for the Black + Medium rule
    let isBlack = false;
    let isMedium = false;

    currentProductData.options.forEach((opt, idx) => {
      if (opt.name.toLowerCase() === "color") {
        const activeSwatch = document.querySelector(
          `.color-swatches[data-index="${idx}"] .color-swatch.active`,
        );
        if (
          activeSwatch &&
          activeSwatch.dataset.value.toLowerCase() === "black"
        )
          isBlack = true;
      } else if (opt.name.toLowerCase() === "size") {
        const select = document.querySelector(`select[data-index="${idx}"]`);
        if (
          select &&
          (select.value.toLowerCase() === "m" ||
            select.value.toLowerCase() === "medium")
        )
          isMedium = true;
      }
    });

    let itemsToAdd = [{ id: parseInt(variantId), quantity: 1 }];

    // 2. Add Soft Winter Jacket if condition met
    if (isBlack && isMedium) {
      try {
        const jacketRes = await fetch(`/products/soft-winter-jacket.js`);
        if (jacketRes.ok) {
          const jacketData = await jacketRes.json();
          if (jacketData.variants && jacketData.variants.length > 0) {
            itemsToAdd.push({ id: jacketData.variants[0].id, quantity: 1 });
          }
        }
      } catch (error) {
        console.error("Soft Winter Jacket fetch failed:", error);
      }
    }

    // 3. Post to Cart API and REDIRECT TO CART
    try {
      const response = await fetch(window.Shopify.routes.root + "cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToAdd }),
      });

      if (response.ok) {
        // Redirect straight to the cart page so the user sees the update!
        window.location.href = "/cart";
      } else {
        throw new Error("Failed to add to cart");
      }
    } catch (error) {
      console.error("Cart error", error);
      elements.submitBtn.disabled = false;
      elements.submitBtn.querySelector(".btn-text").textContent = "ADD TO CART";
    }
  }

  function openModal() {
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("active"), 10);
  }

  function closeModal() {
    modal.classList.remove("active");
    setTimeout(() => (modal.style.display = "none"), 300);
  }
});
