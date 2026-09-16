/**
 * Ecomexperts Hiring Test - Custom Javascript
 * Handles dynamic modal rendering, variant selection, and custom Cart API logic.
 * Written in strict vanilla JavaScript (No jQuery).
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- State Management ---
  let currentProductData = null; // Stores the currently viewed product's JSON data

  // --- DOM Elements ---
  const modal = document.getElementById("custom-product-modal");
  const closeModalBtn = document.querySelector(".custom-modal-close");
  const triggerBtns = document.querySelectorAll(".open-modal-btn");
  const form = document.getElementById("modal-add-to-cart-form");

  // Modal Content Elements
  const elements = {
    image: document.getElementById("modal-product-image"),
    title: document.getElementById("modal-product-title"),
    price: document.getElementById("modal-product-price"),
    description: document.getElementById("modal-product-description"),
    variantsContainer: document.getElementById("modal-product-variants"),
    hiddenVariantId: document.getElementById("modal-variant-id"),
    message: document.getElementById("modal-cart-message"),
    submitBtn: document.getElementById("modal-add-to-cart-btn"),
  };

  // --- Event Listeners ---
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
    if (e.target === modal) closeModal(); // Close if user clicks the dark overlay
  });

  form.addEventListener("submit", handleAddToCart);

  // --- Core Functions ---

  /**
   * Fetches product data via Shopify's AJAX API and populates the modal UI.
   * @param {string} handle - The Shopify product handle
   */
  async function fetchAndPopulateProduct(handle) {
    try {
      // Reset message state
      elements.message.style.display = "none";

      // Fetch product JSON
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) throw new Error("Failed to fetch product");
      const product = await response.json();

      currentProductData = product; // Cache for variant matching

      // Populate text and image
      elements.title.textContent = product.title;
      elements.description.innerHTML = product.description;
      elements.image.src = product.images.length > 0 ? product.images[0] : "";
      elements.image.alt = product.title;

      // Shopify returns prices in cents, divide by 100 for display
      elements.price.textContent = (product.price / 100).toFixed(2) + "€";

      buildVariantSelectors(product);
    } catch (error) {
      console.error("Error loading product data:", error);
    }
  }

  /**
   * Dynamically generates <select> dropdowns based on product options.
   * @param {Object} product - The Shopify product object
   */
  function buildVariantSelectors(product) {
    elements.variantsContainer.innerHTML = ""; // Clear existing

    // Check if product actually has variants (not just default 'Title')
    if (product.options && product.options[0].name !== "Title") {
      product.options.forEach((option, index) => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "variant-group";

        const label = document.createElement("label");
        label.textContent = option.name;
        groupDiv.appendChild(label);

        const select = document.createElement("select");
        select.className = "custom-variant-select";

        option.values.forEach((value) => {
          const optionEl = document.createElement("option");
          optionEl.value = value;
          optionEl.textContent = value;
          select.appendChild(optionEl);
        });

        // Listen for changes to update price and hidden ID
        select.addEventListener("change", updateSelectedVariant);
        groupDiv.appendChild(select);
        elements.variantsContainer.appendChild(groupDiv);
      });
    }

    updateSelectedVariant(); // Run once to set initial ID
  }

  /**
   * Matches selected dropdown values against product variants to find the correct Variant ID.
   */
  function updateSelectedVariant() {
    if (!currentProductData) return;

    const selects = Array.from(
      document.querySelectorAll(".custom-variant-select"),
    );
    const selectedValues = selects.map((select) => select.value);

    // Find the variant where all option values match the user's selections
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

  /**
   * Intercepts form submission, evaluates the 'Black + Medium' rule, and sends to Cart API.
   */
  async function handleAddToCart(e) {
    e.preventDefault();

    const variantId = elements.hiddenVariantId.value;
    if (!variantId) return;

    elements.submitBtn.disabled = true;
    elements.submitBtn.querySelector(".btn-text").textContent = "ADDING...";

    // 1. Check current selections for the special condition
    const selects = Array.from(
      document.querySelectorAll(".custom-variant-select"),
    );
    const selectedValues = selects.map((s) => s.value.toLowerCase());

    const isBlack = selectedValues.includes("black");
    const isMedium =
      selectedValues.includes("m") || selectedValues.includes("medium");

    // Create the payload array for the Cart API
    let itemsToAdd = [
      {
        id: parseInt(variantId),
        quantity: 1,
      },
    ];

    // 2. BONUS LOGIC: If Black & Medium, append the Soft Winter Jacket
    if (isBlack && isMedium) {
      try {
        // Fetch the jacket to dynamically get its first available Variant ID
        const jacketRes = await fetch(`/products/soft-winter-jacket.js`);
        if (jacketRes.ok) {
          const jacketData = await jacketRes.json();
          if (jacketData.variants && jacketData.variants.length > 0) {
            itemsToAdd.push({
              id: jacketData.variants[0].id,
              quantity: 1,
            });
          }
        }
      } catch (error) {
        console.error("Soft Winter Jacket fetch failed:", error);
      }
    }

    // 3. Post to Cart API
    try {
      const response = await fetch(window.Shopify.routes.root + "cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToAdd }),
      });

      if (response.ok) {
        elements.message.textContent =
          itemsToAdd.length > 1
            ? "Success! Product AND Soft Winter Jacket added to cart."
            : "Product added to cart successfully!";
        elements.message.style.color = "green";
        elements.message.style.display = "block";
      } else {
        throw new Error("Failed to add to cart");
      }
    } catch (error) {
      elements.message.textContent = "Error adding to cart.";
      elements.message.style.color = "red";
      elements.message.style.display = "block";
    } finally {
      elements.submitBtn.disabled = false;
      elements.submitBtn.querySelector(".btn-text").textContent = "ADD TO CART";
    }
  }

  // --- UI Helpers ---
  function openModal() {
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("active"), 10);
  }

  function closeModal() {
    modal.classList.remove("active");
    setTimeout(() => (modal.style.display = "none"), 300);
  }
});
