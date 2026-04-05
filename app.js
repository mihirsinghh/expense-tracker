const STORAGE_KEYS = {
  categories: "expense-tracker-categories",
  expenses: "expense-tracker-expenses",
  view: "expense-tracker-view",
};

const DEFAULT_CATEGORIES = ["Food", "Transport", "Bills", "Fun"];
const COLORS = ["#C96C3A", "#6F8F72", "#3F6C88", "#BC8E2A", "#905C8C", "#D05757", "#4E8F91", "#7C6A58"];

const state = {
  categories: loadData(STORAGE_KEYS.categories, DEFAULT_CATEGORIES),
  expenses: loadData(STORAGE_KEYS.expenses, []),
  currentView: loadData(STORAGE_KEYS.view, "weekly"),
};

const expenseForm = document.querySelector("#expense-form");
const categoryForm = document.querySelector("#category-form");
const categoryList = document.querySelector("#category-list");
const expenseCategorySelect = document.querySelector("#expense-category");
const expenseDateInput = document.querySelector("#expense-date");
const chart = document.querySelector("#chart");
const legend = document.querySelector("#legend");
const expenseList = document.querySelector("#expense-list");
const toggleButtons = document.querySelectorAll(".toggle");

const periodTotal = document.querySelector("#period-total");
const periodLabel = document.querySelector("#period-label");
const topCategory = document.querySelector("#top-category");
const transactionCount = document.querySelector("#transaction-count");
const averageSpend = document.querySelector("#average-spend");

expenseDateInput.value = formatDateInput(new Date());

render();

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(expenseForm);
  const amount = Number.parseFloat(formData.get("amount"));
  const category = String(formData.get("category"));
  const date = String(formData.get("date"));
  const note = String(formData.get("note") || "").trim();

  if (!amount || amount <= 0 || !category || !date) {
    return;
  }

  state.expenses.unshift({
    id: crypto.randomUUID(),
    amount,
    category,
    date,
    note,
  });

  saveData(STORAGE_KEYS.expenses, state.expenses);
  expenseForm.reset();
  expenseDateInput.value = formatDateInput(new Date());
  render();
});

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(categoryForm);
  const rawName = String(formData.get("categoryName") || "").trim();

  if (!rawName) {
    return;
  }

  const exists = state.categories.some((category) => category.toLowerCase() === rawName.toLowerCase());
  if (exists) {
    categoryForm.reset();
    return;
  }

  state.categories.push(rawName);
  state.categories.sort((left, right) => left.localeCompare(right));
  saveData(STORAGE_KEYS.categories, state.categories);
  categoryForm.reset();
  render();
});

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.currentView = button.dataset.view;
    saveData(STORAGE_KEYS.view, state.currentView);
    render();
  });
});

function render() {
  renderCategoryOptions();
  renderCategoryChips();
  renderDashboard();
  renderExpenses();
  syncViewButtons();
}

function renderCategoryOptions() {
  expenseCategorySelect.innerHTML = "";

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    expenseCategorySelect.append(option);
  });
}

function renderCategoryChips() {
  categoryList.innerHTML = "";

  state.categories.forEach((category, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = category;
    chip.style.background = `${colorForIndex(index)}22`;
    categoryList.append(chip);
  });
}

function renderDashboard() {
  const periods = buildPeriods(state.currentView, state.expenses, 6);
  const currentPeriod = periods.at(-1);
  const currentExpenses = currentPeriod ? currentPeriod.expenses : [];
  const currentTotal = sumExpenses(currentExpenses);
  const categoryTotals = totalsByCategory(currentExpenses);
  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  periodTotal.textContent = currency(currentTotal);
  periodLabel.textContent = currentPeriod ? currentPeriod.label : state.currentView === "weekly" ? "This week" : "This month";
  topCategory.textContent = top ? `${top[0]} (${currency(top[1])})` : "None yet";
  transactionCount.textContent = String(currentExpenses.length);
  averageSpend.textContent = currentExpenses.length ? currency(currentTotal / currentExpenses.length) : "$0.00";

  renderChart(periods);
  renderLegend();
}

function renderChart(periods) {
  chart.innerHTML = "";

  if (!periods.length || periods.every((period) => period.total === 0)) {
    chart.innerHTML = `<div class="empty-state">No expenses yet. Add one to populate the dashboard.</div>`;
    return;
  }

  const highestTotal = Math.max(...periods.map((period) => period.total), 1);

  periods.forEach((period) => {
    const column = document.createElement("div");
    column.className = "chart-column";

    const stack = document.createElement("div");
    stack.className = "bar-stack";

    const orderedCategories = Object.entries(period.categoryTotals).sort((a, b) => b[1] - a[1]);
    orderedCategories.forEach(([category, total]) => {
      const segment = document.createElement("div");
      segment.className = "bar-segment";
      segment.style.height = `${Math.max((total / highestTotal) * 240, 10)}px`;
      segment.style.background = colorForCategory(category);
      segment.title = `${category}: ${currency(total)}`;
      stack.append(segment);
    });

    const totalLabel = document.createElement("div");
    totalLabel.className = "column-total";
    totalLabel.textContent = currency(period.total);

    const dateLabel = document.createElement("div");
    dateLabel.className = "column-label";
    dateLabel.textContent = period.shortLabel;

    column.append(stack, totalLabel, dateLabel);
    chart.append(column);
  });
}

function renderLegend() {
  legend.innerHTML = "";

  state.categories.forEach((category) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = colorForCategory(category);

    const label = document.createElement("span");
    label.textContent = category;

    item.append(swatch, label);
    legend.append(item);
  });
}

function renderExpenses() {
  expenseList.innerHTML = "";

  if (!state.expenses.length) {
    expenseList.innerHTML = `<div class="empty-state">No expenses logged yet.</div>`;
    return;
  }

  const template = document.querySelector("#expense-item-template");
  const sortedExpenses = [...state.expenses]
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 10);

  sortedExpenses.forEach((expense) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".expense-category").textContent = expense.category;
    fragment.querySelector(".expense-note").textContent = expense.note || "No note";
    fragment.querySelector(".expense-amount").textContent = currency(expense.amount);
    fragment.querySelector(".expense-date").textContent = friendlyDate(expense.date);
    expenseList.append(fragment);
  });
}

function syncViewButtons() {
  toggleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });
}

function buildPeriods(view, expenses, count) {
  const today = startOfDay(new Date());
  const periods = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = view === "weekly"
      ? addDays(startOfWeekSunday(today), -offset * 7)
      : startOfMonth(addMonths(today, -offset));
    const end = view === "weekly" ? addDays(start, 6) : endOfMonth(start);
    const expensesInPeriod = expenses.filter((expense) => {
      const expenseDate = startOfDay(new Date(expense.date));
      return expenseDate >= start && expenseDate <= end;
    });

    const categoryTotals = totalsByCategory(expensesInPeriod);
    periods.push({
      start,
      end,
      expenses: expensesInPeriod,
      total: sumExpenses(expensesInPeriod),
      categoryTotals,
      label: view === "weekly"
        ? `${formatMonthDay(start)} - ${formatMonthDay(end)}`
        : start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      shortLabel: view === "weekly"
        ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : start.toLocaleDateString(undefined, { month: "short" }),
    });
  }

  return periods;
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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
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
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
