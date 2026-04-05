const DEFAULT_CATEGORIES = ["Food", "Transport", "Bills", "Fun"];
const COLORS = ["#C96C3A", "#6F8F72", "#3F6C88", "#BC8E2A", "#905C8C", "#D05757", "#4E8F91", "#7C6A58"];

const state = {
  categories: [],
  expenses: [],
  loading: true,
  saving: false,
  error: "",
};

const expenseForm = document.querySelector("#expense-form");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const expenseCategorySelect = document.querySelector("#expense-category");
const expenseDateInput = document.querySelector("#expense-date");
const chart = document.querySelector("#chart");
const expenseList = document.querySelector("#expense-list");
const syncStatus = document.querySelector("#sync-status");

const periodTotal = document.querySelector("#period-total");
const periodLabel = document.querySelector("#period-label");
const dashboardRange = document.querySelector("#dashboard-range");

expenseDateInput.value = formatDateInput(new Date());
render();
loadAppData();

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(expenseForm);
  const amount = Number.parseFloat(formData.get("amount"));
  const category = String(formData.get("category") || "");
  const date = String(formData.get("date") || "");
  const note = String(formData.get("note") || "").trim();

  if (!amount || amount <= 0 || !category || !date) {
    return;
  }

  try {
    state.saving = true;
    state.error = "";
    renderStatus();

    await apiFetch("/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        amount,
        category,
        date,
        note,
      }),
    });

    expenseForm.reset();
    expenseDateInput.value = formatDateInput(new Date());
    await loadAppData();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.saving = false;
    render();
  }
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(categoryForm);
  const rawName = String(formData.get("categoryName") || "").trim();

  if (!rawName) {
    return;
  }

  try {
    state.saving = true;
    state.error = "";
    renderStatus();

    await apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: rawName }),
    });

    categoryForm.reset();
    await loadAppData();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.saving = false;
    render();
  }
});

async function loadAppData() {
  try {
    state.loading = true;
    state.error = "";
    render();

    const data = await apiFetch("/api/bootstrap");
    state.categories = normalizeCategories(data.categories);
    state.expenses = normalizeExpenses(data.expenses);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  renderStatus();
  renderCategoryOptions();
  renderCategoryChips();
  renderDashboard();
  renderExpenses();
  syncFormState();
}

function renderStatus() {
  if (state.error) {
    syncStatus.textContent = state.error;
    syncStatus.dataset.variant = "error";
    return;
  }

  if (state.loading) {
    syncStatus.textContent = "Loading expenses...";
    syncStatus.dataset.variant = "info";
    return;
  }

  if (state.saving) {
    syncStatus.textContent = "Saving...";
    syncStatus.dataset.variant = "info";
    return;
  }

  syncStatus.textContent = "Synced";
  syncStatus.dataset.variant = "success";
}

function syncFormState() {
  const disabled = state.loading || state.saving;
  Array.from(expenseForm.elements).forEach((element) => {
    element.disabled = disabled || (!state.categories.length && element.name === "category");
  });
  Array.from(categoryForm.elements).forEach((element) => {
    element.disabled = disabled;
  });
}

function renderCategoryOptions() {
  expenseCategorySelect.innerHTML = "";

  if (!state.categories.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.loading ? "Loading categories..." : "Add a category first";
    expenseCategorySelect.append(option);
    expenseCategorySelect.disabled = true;
    return;
  }

  expenseCategorySelect.disabled = state.loading || state.saving;

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    expenseCategorySelect.append(option);
  });
}

function renderCategoryChips() {
  categoryList.innerHTML = "";

  if (state.loading) {
    categoryList.innerHTML = `<div class="empty-state">Loading categories...</div>`;
    return;
  }

  if (!state.categories.length) {
    categoryList.innerHTML = `<div class="empty-state">No categories yet. Add one to start tracking expenses.</div>`;
    return;
  }

  state.categories.forEach((category, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.style.background = `${colorForIndex(index)}22`;

    const label = document.createElement("span");
    label.textContent = category;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "delete-button";
    button.textContent = "Delete";
    button.disabled = state.loading || state.saving;
    button.addEventListener("click", async () => {
      await deleteCategory(category);
    });

    chip.append(label, button);
    categoryList.append(chip);
  });
}

function renderDashboard() {
  const currentWeek = buildCurrentWeek(state.expenses);
  const currentTotal = sumExpenses(currentWeek.expenses);

  periodTotal.textContent = currency(currentTotal);
  periodLabel.textContent = currentWeek.label;
  dashboardRange.textContent = `Week of ${currentWeek.label}`;

  renderChart(currentWeek);
}

function renderChart(week) {
  chart.innerHTML = "";

  if (state.loading) {
    chart.innerHTML = `<div class="empty-state">Loading dashboard...</div>`;
    return;
  }

  if (!week.total) {
    chart.innerHTML = `<div class="empty-state">No expenses in this week yet. Add one to populate the dashboard.</div>`;
    return;
  }

  const orderedCategories = Object.entries(week.categoryTotals).sort((a, b) => b[1] - a[1]);

  orderedCategories.forEach(([category, total]) => {
    const row = document.createElement("article");
    row.className = "breakdown-row";

    const header = document.createElement("div");
    header.className = "breakdown-header";

    const name = document.createElement("div");
    name.className = "breakdown-name";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = colorForCategory(category);

    const label = document.createElement("span");
    label.textContent = category;
    name.append(swatch, label);

    const amount = document.createElement("div");
    amount.className = "column-total";
    amount.textContent = `${currency(total)} | ${Math.round((total / week.total) * 100)}%`;

    header.append(name, amount);

    const bar = document.createElement("div");
    bar.className = "breakdown-bar";

    const fill = document.createElement("div");
    fill.className = "breakdown-fill";
    fill.style.width = `${(total / week.total) * 100}%`;
    fill.style.background = colorForCategory(category);

    bar.append(fill);
    row.append(header, bar);
    chart.append(row);
  });
}

function renderExpenses() {
  expenseList.innerHTML = "";

  if (state.loading) {
    expenseList.innerHTML = `<div class="empty-state">Loading expenses...</div>`;
    return;
  }

  if (!state.expenses.length) {
    expenseList.innerHTML = `<div class="empty-state">No expenses logged yet.</div>`;
    return;
  }

  const template = document.querySelector("#expense-item-template");
  const sortedExpenses = [...state.expenses]
    .sort((left, right) => parseStoredDate(right.date) - parseStoredDate(left.date))
    .slice(0, 10);

  sortedExpenses.forEach((expense) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".expense-category").textContent = expense.category;
    fragment.querySelector(".expense-note").textContent = expense.note || "No note";
    fragment.querySelector(".expense-amount").textContent = currency(expense.amount);
    fragment.querySelector(".expense-date").textContent = friendlyDate(expense.date);

    const deleteButton = fragment.querySelector(".delete-expense");
    deleteButton.disabled = state.loading || state.saving;
    deleteButton.addEventListener("click", async () => {
      await deleteExpense(expense.id);
    });

    expenseList.append(fragment);
  });
}

function buildCurrentWeek(expenses) {
  const today = startOfDay(new Date());
  const start = startOfWeekSunday(today);
  const end = addDays(start, 6);
  const expensesInWeek = expenses.filter((expense) => {
    const expenseDate = startOfDay(parseStoredDate(expense.date));
    return expenseDate >= start && expenseDate <= end;
  });

  return {
    start,
    end,
    expenses: expensesInWeek,
    total: sumExpenses(expensesInWeek),
    categoryTotals: totalsByCategory(expensesInWeek),
    label: `${formatMonthDay(start)} - ${formatMonthDay(end)}`,
  };
}

async function deleteCategory(categoryToDelete) {
  try {
    state.saving = true;
    state.error = "";
    render();

    await apiFetch(`/api/categories?name=${encodeURIComponent(categoryToDelete)}`, {
      method: "DELETE",
    });

    await loadAppData();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.saving = false;
    render();
  }
}

async function deleteExpense(expenseId) {
  try {
    state.saving = true;
    state.error = "";
    render();

    await apiFetch(`/api/expenses?id=${encodeURIComponent(expenseId)}`, {
      method: "DELETE",
    });

    await loadAppData();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.saving = false;
    render();
  }
}

function totalsByCategory(expenses) {
  return expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
}

function sumExpenses(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

function startOfWeekSunday(date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function friendlyDate(dateString) {
  return parseStoredDate(dateString).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseStoredDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function currency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function colorForCategory(category) {
  const index = state.categories.indexOf(category);
  return colorForIndex(index >= 0 ? index : 0);
}

function colorForIndex(index) {
  return COLORS[index % COLORS.length];
}

function normalizeCategories(categories) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const names = safeCategories
    .map((category) => typeof category === "string" ? category : category.name)
    .filter(Boolean);

  return names.length ? names : [...DEFAULT_CATEGORIES];
}

function normalizeExpenses(expenses) {
  return Array.isArray(expenses) ? expenses : [];
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && payload.error ? payload.error : "Something went wrong while syncing data.";
    throw new Error(message);
  }

  return payload;
}
