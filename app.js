const state = {
  foods: [],
  selectedFood: null,
  category: null,
  searchTimer: null
};

const els = {
  search: document.getElementById("food-search"),
  suggestions: document.getElementById("search-suggestions"),
  chips: document.getElementById("category-chips"),
  profile: document.getElementById("food")
};

const NAMES = {
  calories: ["energy", "calories", "energy (kcal)", "energy, kcal"],
  protein: ["protein"],
  carbs: ["carbohydrate", "carbohydrates", "carbs", "carbohydrate, by difference"],
  fat: ["total lipid", "total lipid (fat)", "fat", "total fat"],
  fibre: ["fiber", "fibre", "fiber, total dietary", "fibre, total dietary"],
};

const VITAMIN_HINTS = [
  "vitamin a", "vitamin b1", "thiamin", "vitamin b2", "riboflavin",
  "vitamin b3", "niacin", "vitamin b5", "pantothenic",
  "vitamin b6", "vitamin b7", "biotin", "vitamin b9", "folate",
  "vitamin b12", "vitamin c", "vitamin d", "vitamin e", "vitamin k", "choline"
];

const CATEGORY_ORDER = [
  "Vegetable", "Fruit", "Grains", "Legumes", "Nuts and seeds",
  "Meat and poultry", "Seafood", "Dairy and eggs", "Herbs and spices"
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase().trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normaliseName(value) {
  return String(value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function nutrientName(n) {
  return String(n?.name ?? n?.nutrientName ?? n?.nutrient?.name ?? "").trim();
}

function nutrientValue(n) {
  const value = n?.value ?? n?.amount ?? n?.nutrientValue ?? n?.nutrient?.value;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function nutrientUnit(n) {
  return String(n?.unit ?? n?.unitName ?? n?.nutrient?.unitName ?? "").trim();
}

function getNutrients(food) {
  const raw = food?.nutrients ?? food?.nutrition ?? food?.nutrientData ?? [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([name, value]) => ({ name, value }));
  }
  return [];
}

function findNutrient(food, aliases) {
  const nutrients = getNutrients(food);
  const exact = nutrients.find(n => {
    const name = normaliseName(nutrientName(n));
    return aliases.some(a => name === normaliseName(a));
  });
  if (exact) return exact;
  return nutrients.find(n => {
    const name = normaliseName(nutrientName(n));
    return aliases.some(a => name.includes(normaliseName(a)));
  }) || null;
}

function valueOf(food, key) {
  const n = findNutrient(food, NAMES[key]);
  return n ? nutrientValue(n) : null;
}

function unitOf(food, key, fallback = "g") {
  const n = findNutrient(food, NAMES[key]);
  return n ? nutrientUnit(n) || fallback : fallback;
}

function getFoodName(food) {
  return food?.name ?? food?.food ?? food?.description ?? food?.fdcDescription ?? "Unknown food";
}

function getCategory(food) {
  return food?.category ?? food?.group ?? food?.foodCategory ?? "Other";
}

const CATEGORY_COLORS = {
  "vegetable": "#4caf50",
  "fruit": "#e67e22",
  "grains": "#c68642",
  "legumes": "#daa520",
  "nuts and seeds": "#a0522d",
  "meat and poultry": "#d32f2f",
  "seafood": "#1e88e5",
  "dairy and eggs": "#ffc107",
  "herbs and spices": "#8e44ad"
};

function categoryColor(category) {
  return CATEGORY_COLORS[normaliseName(category)] || "#cad8ca";
}

function getAliases(food) {
  const aliases = food?.aliases ?? food?.alias ?? [];
  return Array.isArray(aliases) ? aliases : [];
}

function getImage(food) {
  return food?.image ?? food?.imageUrl ?? food?.imageURL ?? food?.photo ?? "";
}

function getFdcId(food) {
  return food?.fdcId ?? food?.fdc_id ?? food?.fdcID ?? "";
}

function getDescription(food) {
  return food?.description ?? food?.summary ?? "";
}

function formatNumber(value, max = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(Math.min(1, max));
  return n.toFixed(max);
}

function formatNutrient(n) {
  if (!n) return "—";
  const value = nutrientValue(n);
  if (value == null) return "—";
  return `${formatNumber(value, value < 1 ? 2 : 1)} ${esc(nutrientUnit(n))}`;
}

function isVitamin(name) {
  const n = normaliseName(name);
  return VITAMIN_HINTS.some(h => n.includes(h));
}

function getVitaminList(food) {
  return getNutrients(food)
    .filter(n => nutrientValue(n) != null && isVitamin(nutrientName(n)))
    .filter(n => !/energy|calorie/i.test(nutrientName(n)))
    .sort((a,b) => (nutrientValue(b) || 0) - (nutrientValue(a) || 0));
}

function getMineralList(food) {
  return getNutrients(food)
    .filter(n => nutrientValue(n) != null)
    .filter(n => {
      const name = nutrientName(n);
      return name && !isVitamin(name) &&
        !/energy|calorie|protein|carbohydrate|total lipid|fat|fiber|fibre|sugar|starch|alcohol|water/i.test(name);
    })
    .sort((a,b) => (nutrientValue(b) || 0) - (nutrientValue(a) || 0));
}

function caloriesFromMacros(food) {
  const protein = valueOf(food, "protein") || 0;
  const carbs = valueOf(food, "carbs") || 0;
  const fat = valueOf(food, "fat") || 0;
  return {
    protein: protein * 4,
    carbs: carbs * 4,
    fat: fat * 9
  };
}

function nutritionTags(food) {
  const protein = valueOf(food, "protein") ?? 0;
  const carbs = valueOf(food, "carbs") ?? 0;
  const fat = valueOf(food, "fat") ?? 0;
  const fibre = valueOf(food, "fibre") ?? 0;
  const tags = [];

  if (protein >= 20) tags.push("High in Protein");
  else if (protein >= 10) tags.push("Protein Source");

  if (carbs <= 5) tags.push("Low in Carbohydrate");
  if (fat <= 3) tags.push("Low in Fat");
  if (fibre >= 5) tags.push("High in Fibre");

  return tags.slice(0, 3);
}

function generatedInsight(food) {
  const name = getFoodName(food);
  const protein = valueOf(food, "protein") ?? 0;
  const carbs = valueOf(food, "carbs") ?? 0;
  const fat = valueOf(food, "fat") ?? 0;
  const fibre = valueOf(food, "fibre") ?? 0;
  const vitamins = getVitaminList(food).slice(0, 3).map(nutrientName).filter(Boolean);

  let lead;
  if (protein >= 20 && carbs <= 5) {
    lead = `${name} is predominantly a protein food, with very little carbohydrate per 100g.`;
  } else if (carbs >= 50 && protein < 10) {
    lead = `${name} is primarily a carbohydrate food, with comparatively little protein per 100g.`;
  } else if (fibre >= 5) {
    lead = `${name} provides a useful amount of dietary fibre alongside its other nutrients.`;
  } else if (fat >= 15) {
    lead = `${name} provides a substantial proportion of its energy from fat, alongside its other nutrients.`;
  } else {
    lead = `${name} provides a combination of macronutrients and micronutrients that can be explored below.`;
  }

  let second = "";
  if (vitamins.length) {
    second = ` Notable nutrients in the available data include ${vitamins.join(", ")}.`;
  }
  return `${lead}${second}`;
}

function commonPreparation(food) {
  const name = getFoodName(food).toLowerCase();
  const category = getCategory(food).toLowerCase();

  if (/chicken|turkey|beef|lamb|pork|meat/.test(name)) {
    return [
      ["Grilled", "A simple method that adds flavour through browning."],
      ["Baked", "Convenient and easy to combine with vegetables."],
      ["Stir-fried", "Works well sliced or diced with vegetables."],
      ["Poached", "Gentle cooking method suitable for lean cuts."]
    ];
  }
  if (/salmon|tuna|fish|cod|haddock|trout|seafood|prawn|shrimp/.test(name) || category.includes("seafood")) {
    return [
      ["Baked", "An easy method that works well with herbs and vegetables."],
      ["Grilled", "Adds browning and flavour with little preparation."],
      ["Pan-seared", "A quick method using a hot pan."],
      ["Poached", "Gentle cooking that helps retain moisture."]
    ];
  }
  if (/egg/.test(name) || category.includes("dairy")) {
    return [
      ["Boiled", "Simple preparation without requiring added cooking fat."],
      ["Poached", "Gentle cooking method for a soft texture."],
      ["Scrambled", "Can be combined with vegetables and herbs."],
      ["Omelette", "Pairs naturally with vegetables and other protein foods."]
    ];
  }
  if (/lentil|bean|pea|chickpea/.test(name) || category.includes("legume")) {
    return [
      ["Simmered", "Useful for soups, stews and grain bowls."],
      ["Salad", "Works well chilled or at room temperature."],
      ["Stewed", "Combines easily with vegetables and herbs."],
      ["Soup", "A practical way to build a filling meal."]
    ];
  }
  if (category.includes("vegetable")) {
    return [
      ["Steamed", "A simple method requiring little added fat."],
      ["Roasted", "Brings out flavour through browning."],
      ["Stir-fried", "Works well with other vegetables and protein foods."],
      ["Raw", "Suitable for foods commonly eaten fresh."]
    ];
  }
  return [
    ["Fresh", "Suitable when the food is commonly eaten without cooking."],
    ["Baked", "A versatile preparation for many foods."],
    ["Cooked", "Can be incorporated into a balanced meal."],
    ["With vegetables", "Pairing with vegetables adds variety to a meal."]
  ];
}

function faqData(food) {
  const name = getFoodName(food);
  const protein = valueOf(food, "protein") ?? 0;
  const carbs = valueOf(food, "carbs") ?? 0;
  const fat = valueOf(food, "fat") ?? 0;
  const fibre = valueOf(food, "fibre") ?? 0;

  return [
    {
      q: `Is ${name} a good source of protein?`,
      a: protein >= 10
        ? `${name} provides about ${formatNumber(protein,1)}g of protein per 100g in the displayed data.`
        : `${name} contains about ${formatNumber(protein,1)}g of protein per 100g in the displayed data.`
    },
    {
      q: `Is ${name} low in carbohydrate?`,
      a: carbs <= 5
        ? `The displayed value is about ${formatNumber(carbs,1)}g of carbohydrate per 100g, which is relatively low.`
        : `The displayed value is about ${formatNumber(carbs,1)}g of carbohydrate per 100g.`
    },
    {
      q: `Does cooking change the nutrition of ${name}?`,
      a: `Cooking can change the weight, water content and concentration of nutrients in food. WhatsInFood displays the specific food record selected, so raw and cooked records should be treated as separate foods where available.`
    },
    {
      q: `How much fibre does ${name} contain?`,
      a: `The displayed food record contains about ${formatNumber(fibre,1)}g of fibre per 100g when a fibre value is available.`
    }
  ];
}

function scoreSimilarity(a, b) {
  const av = [valueOf(a,"protein"), valueOf(a,"carbs"), valueOf(a,"fat"), valueOf(a,"fibre")].map(x => x ?? 0);
  const bv = [valueOf(b,"protein"), valueOf(b,"carbs"), valueOf(b,"fat"), valueOf(b,"fibre")].map(x => x ?? 0);
  let score = getCategory(a) === getCategory(b) ? 4 : 0;
  const scales = [30, 60, 30, 10];
  for (let i=0; i<4; i++) score += Math.max(0, 2 - Math.abs(av[i]-bv[i]) / scales[i]);
  return score;
}

function similarFoods(food) {
  return state.foods
    .filter(f => f !== food)
    .map(f => ({ food: f, score: scoreSimilarity(food, f) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.food);
}

function macroPercentages(food) {
  const m = caloriesFromMacros(food);
  const total = m.protein + m.carbs + m.fat;
  if (!total) return { protein:0, carbs:0, fat:0 };
  return {
    protein: Math.round(m.protein / total * 100),
    carbs: Math.round(m.carbs / total * 100),
    fat: Math.round(m.fat / total * 100)
  };
}

function renderCategories() {
  const present = [...new Set(state.foods.map(getCategory).filter(Boolean))];
  const categories = CATEGORY_ORDER.filter(c => present.some(p => normaliseName(p) === normaliseName(c)))
    .concat(present.filter(c => !CATEGORY_ORDER.some(x => normaliseName(x) === normaliseName(c))));

  els.chips.innerHTML = categories.map(category =>
    `<button class="category-chip" data-category="${esc(category)}" style="--chip-color:${categoryColor(category)}">${esc(category)}</button>`
  ).join("");

  els.chips.querySelectorAll(".category-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category;
      const wasActive = btn.classList.contains("active");
      els.chips.querySelectorAll(".category-chip").forEach(b => b.classList.remove("active"));

      if (wasActive) {
        state.category = null;
        els.suggestions.classList.remove("open");
        els.suggestions.innerHTML = "";
        return;
      }

      btn.classList.add("active");
      state.category = category;
      const matches = state.foods.filter(f => normaliseName(getCategory(f)) === normaliseName(category));
      renderFoodList(matches);
    });
  });
}

function renderFoodList(foods) {
  if (!foods.length) {
    els.suggestions.classList.remove("open");
    els.suggestions.innerHTML = "";
    return;
  }

  els.suggestions.innerHTML = foods.map(food => `
    <button class="suggestion" type="button" data-food-id="${esc(food.id ?? slugify(getFoodName(food)))}">
      ${esc(getFoodName(food))}
      <small>${esc(getCategory(food))} · per 100g</small>
    </button>
  `).join("");

  els.suggestions.classList.add("open");
  els.suggestions.querySelectorAll(".suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
      const food = state.foods.find(f => String(f.id ?? slugify(getFoodName(f))) === btn.dataset.foodId);
      if (food) selectFood(food);
    });
  });
}

function searchFoods(query) {
  const q = normaliseName(query);
  if (!q) return [];

  return state.foods.map(food => {
    const name = normaliseName(getFoodName(food));
    const aliases = getAliases(food).map(normaliseName);
    const category = normaliseName(getCategory(food));
    let score = 0;

    if (name === q) score += 1000;
    else if (name.startsWith(q)) score += 700;
    else if (name.includes(q)) score += 400;
    if (aliases.some(a => a === q)) score += 900;
    else if (aliases.some(a => a.startsWith(q))) score += 500;
    if (category.includes(q)) score += 100;

    return { food, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 7);
}

function renderSuggestions(query) {
  const results = searchFoods(query);
  if (!query || !results.length) {
    els.suggestions.classList.remove("open");
    els.suggestions.innerHTML = "";
    return;
  }

  els.suggestions.innerHTML = results.map(({food}) => `
    <button class="suggestion" type="button" data-food-id="${esc(food.id ?? slugify(getFoodName(food)))}">
      ${esc(getFoodName(food))}
      <small>${esc(getCategory(food))} · per 100g</small>
    </button>
  `).join("");

  els.suggestions.classList.add("open");
  els.suggestions.querySelectorAll(".suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
      const food = state.foods.find(f => String(f.id ?? slugify(getFoodName(f))) === btn.dataset.foodId);
      if (food) selectFood(food);
    });
  });
}

function metric(label, value, unit) {
  return `<div class="metric">
    <span class="metric-label">${label}</span>
    <span class="metric-value">${value}</span>
    <span class="metric-unit">${unit}</span>
  </div>`;
}

function renderFoodImage(food) {
  const primary = `images/${food.id}.jpg`;
  return `<img src="${esc(primary)}" alt="${esc(getFoodName(food))}" loading="lazy" onerror="this.onerror=null;this.src='images/Image-pending.jpg';">`;
}

function renderVitamins(food) {
  const vitamins = getVitaminList(food);
  const shown = vitamins.slice(0, 5);

  if (!shown.length) {
    return `<section class="card section-card">
      <div class="section-heading"><h3>Key vitamins</h3><span>per 100g</span></div>
      <p class="muted">Vitamin information is not available in this food record.</p>
    </section>`;
  }

  return `<section class="card section-card">
    <div class="section-heading"><h3>Key vitamins</h3><span>per 100g</span></div>
    <div class="vitamin-grid">
      ${shown.map(n => `
        <div class="nutrient-tile">
          <span class="nutrient-name">${esc(nutrientName(n))}</span>
          <span class="nutrient-value">${formatNumber(nutrientValue(n), nutrientValue(n) < 1 ? 2 : 1)} ${esc(nutrientUnit(n))}</span>
          <span class="nutrient-note">USDA value</span>
        </div>
      `).join("")}
    </div>
    ${vitamins.length > 5 ? `<a class="text-link" href="#all-vitamins">View all vitamins →</a>` : ""}
  </section>`;
}

function renderMinerals(food) {
  const minerals = getMineralList(food).slice(0, 12);
  return `<section class="card mineral-card">
    <div class="mineral-toggle">
      <strong>Show minerals</strong>
      <button class="toggle" id="mineral-toggle" aria-label="Show minerals" aria-expanded="false"></button>
    </div>
    <div class="mineral-list" id="mineral-list">
      <div class="section-heading"><h3>Minerals</h3><span>per 100g</span></div>
      ${minerals.length ? minerals.map(n => `
        <div class="nutrient-row">
          <span>${esc(nutrientName(n))}</span>
          <strong>${formatNumber(nutrientValue(n), nutrientValue(n) < 1 ? 2 : 1)} ${esc(nutrientUnit(n))}</strong>
          <span class="dv">—</span>
        </div>
      `).join("") : `<p class="muted">Mineral information is not available in this food record.</p>`}
      <small class="muted">% Daily Value is not calculated unless a suitable reference value is available.</small>
    </div>
  </section>`;
}

function renderPreparation(food) {
  const items = commonPreparation(food);
  return `<section class="card section-card">
    <div class="section-heading"><h3>Common preparation methods</h3></div>
    <div class="prep-list">
      ${items.map((item, i) => `
        <div class="prep-item">
          <div class="prep-icon">${["⌁","□","✣","◌"][i]}</div>
          <div><strong>${esc(item[0])}</strong><span>${esc(item[1])}</span></div>
        </div>
      `).join("")}
    </div>
    <a class="text-link" href="#preparation">More preparation ideas →</a>
  </section>`;
}

function renderSimilar(food) {
  const similar = similarFoods(food);
  return `<section class="card section-card" id="compare">
    <div class="section-heading"><h3>Compare with similar foods</h3><span>per 100g</span></div>
    <table class="compare-table">
      <thead><tr><th>Food</th><th>Calories</th><th>Protein</th><th>Fat</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>${esc(getFoodName(food))}</strong></td>
          <td>${formatNumber(valueOf(food,"calories"),0)}</td>
          <td>${formatNumber(valueOf(food,"protein"),1)}g</td>
          <td>${formatNumber(valueOf(food,"fat"),1)}g</td>
        </tr>
        ${similar.slice(0,4).map(f => `
          <tr>
            <td>${esc(getFoodName(f))}</td>
            <td>${formatNumber(valueOf(f,"calories"),0)}</td>
            <td>${formatNumber(valueOf(f,"protein"),1)}g</td>
            <td>${formatNumber(valueOf(f,"fat"),1)}g</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <a class="text-link" href="#compare">Compare more foods →</a>
  </section>`;
}

function renderFaq(food) {
  return `<section class="card section-card">
    <div class="section-heading"><h3>Frequently asked questions</h3></div>
    <div class="faq-list">
      ${faqData(food).map((item, i) => `
        <div class="faq" data-faq="${i}">
          <button type="button">${esc(item.q)} <span>+</span></button>
          <div class="faq-answer">${esc(item.a)}</div>
        </div>
      `).join("")}
    </div>
    <a class="text-link" href="#faq">View more FAQs →</a>
  </section>`;
}

function renderSource(food) {
  const fdcId = getFdcId(food);
  return `<section class="card side-card source-card">
    <h3>Data source</h3>
    <p>
      Nutrient values are sourced from USDA FoodData Central${fdcId ? ` (FDC ID ${esc(fdcId)})` : ""}.
      Nutrient roles are summarised from NIH Office of Dietary Supplements fact sheets.
    </p>
    <a class="text-link" href="#about">Learn more about our data and methodology →</a>
  </section>`;
}

function renderCharacteristics(food) {
  const tags = nutritionTags(food);
  const characteristics = tags.length ? tags : ["Nutrient profile shown per 100g", "USDA-sourced nutrient data"];
  return `<section class="card side-card">
    <h3>Nutrition characteristics</h3>
    <div class="characteristic-list">
      ${characteristics.map(t => `<div class="characteristic">${esc(t)}</div>`).join("")}
    </div>
  </section>`;
}

function renderProfile(food) {
  state.selectedFood = food;
  const name = getFoodName(food);
  const calories = valueOf(food,"calories");
  const protein = valueOf(food,"protein");
  const carbs = valueOf(food,"carbs");
  const fat = valueOf(food,"fat");
  const fibre = valueOf(food,"fibre");
  const macro = macroPercentages(food);

  const image = renderFoodImage(food);
  const description = getDescription(food);

  els.profile.innerHTML = `
    <div class="food-title-row">
      <h2>${esc(name)}</h2>
      <div class="food-meta">Per 100g <span>•</span> USDA FoodData Central ${getFdcId(food) ? `· FDC ${esc(getFdcId(food))}` : ""}</div>
    </div>

    <div class="food-grid">
      <div class="left-column">
        <section class="card insight-card">
          <div class="insight-copy">
            <p class="eyebrow">LEAF · NUTRITION INSIGHT</p>
            <h3>What stands out?</h3>
            <p>${esc(description || generatedInsight(food))}</p>
            <div class="tag-row">
              ${nutritionTags(food).map(t => `<span class="tag">◆ ${esc(t)}</span>`).join("")}
            </div>
          </div>
          <div class="food-image">${image}</div>
        </section>

        <section class="card section-card">
          <div class="section-heading"><h3>Nutrition summary</h3><span>per 100g</span></div>
          <div class="metric-grid">
            ${metric("Calories", formatNumber(calories,0), "kcal")}
            ${metric("Protein", formatNumber(protein,1), "g")}
            ${metric("Carbohydrates", formatNumber(carbs,1), "g")}
            ${metric("Fat", formatNumber(fat,1), "g")}
            ${metric("Fibre", formatNumber(fibre,1), "g")}
          </div>

          <div class="macro-wrap">
            <div class="section-heading"><h3>Macro breakdown</h3><span>% of calories</span></div>
            <div class="macro-bar" aria-label="Macro breakdown">
              <div class="macro-segment protein" style="width:${macro.protein}%"></div>
              <div class="macro-segment carb" style="width:${macro.carbs}%"></div>
              <div class="macro-segment fat" style="width:${macro.fat}%"></div>
            </div>
            <div class="macro-legend">
              <span><i class="dot protein"></i>Protein ${macro.protein}%</span>
              <span><i class="dot carb"></i>Carbohydrate ${macro.carbs}%</span>
              <span><i class="dot fat"></i>Fat ${macro.fat}%</span>
            </div>
            <p class="macro-note">These percentages show each macronutrient's share of calories, not its share of the food's weight.</p>
          </div>
        </section>

        ${renderVitamins(food)}

        <div class="lower-grid">
          ${renderPreparation(food)}
          ${renderSimilar(food)}
        </div>

        ${renderFaq(food)}
      </div>

      <aside class="right-column">
        ${renderMinerals(food)}
        ${renderCharacteristics(food)}
        ${renderSource(food)}
      </aside>
    </div>
  `;

  els.profile.querySelector("#mineral-toggle")?.addEventListener("click", e => {
    const button = e.currentTarget;
    const list = els.profile.querySelector("#mineral-list");
    const open = list.classList.toggle("open");
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", String(open));
  });

  els.profile.querySelectorAll(".faq").forEach(faq => {
    faq.querySelector("button").addEventListener("click", () => {
      faq.classList.toggle("open");
      faq.querySelector("button span").textContent = faq.classList.contains("open") ? "−" : "+";
    });
  });

  els.search.value = name;
  els.suggestions.classList.remove("open");
  document.title = `${name} Nutrition Facts | WhatsInFood`;
  document.getElementById("breadcrumb").innerHTML =
    `Home <span>›</span> ${esc(getCategory(food))} <span>›</span> ${esc(name)}`;
}

function selectFood(food) {
  state.category = getCategory(food);
  els.chips.querySelectorAll(".category-chip").forEach(btn => {
    btn.classList.toggle("active", normaliseName(btn.dataset.category) === normaliseName(state.category));
  });
  renderProfile(food);
  document.getElementById("food").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadFoods() {
  try {
    const response = await fetch("foods.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`foods.json returned ${response.status}`);
    const data = await response.json();
    state.foods = Array.isArray(data) ? data : (data.foods || data.items || []);
    renderCategories();

    const initial = searchFoods("egg")[0]?.food || state.foods[0];
    if (initial) renderProfile(initial);
  } catch (error) {
    console.error(error);
    els.profile.innerHTML = `
      <div class="empty-state">
        <h2>Food data could not be loaded</h2>
        <p>Check that <strong>foods.json</strong> is in the same directory as index.html and contains an array of food records.</p>
      </div>`;
  }
}

els.search.addEventListener("input", e => {
  clearTimeout(state.searchTimer);
  const query = e.target.value;
  state.searchTimer = setTimeout(() => renderSuggestions(query), 80);
});

function submitSearch() {
  const result = searchFoods(els.search.value)[0];
  if (result) selectFood(result.food);
}

els.search.addEventListener("keydown", e => {
  if (e.key === "Enter") submitSearch();
});

document.getElementById("search-submit").addEventListener("click", submitSearch);

document.addEventListener("click", e => {
  if (!e.target.closest(".global-search") && !e.target.closest(".category-chips")) els.suggestions.classList.remove("open");
});

loadFoods();
