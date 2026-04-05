const { Pool } = require("pg");

let pool;
let initialized = false;

function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("Database is not configured. Add POSTGRES_URL or DATABASE_URL.");
    }

    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

async function ensureSchema() {
  if (initialized) {
    return;
  }

  const client = await getPool().connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        amount NUMERIC(10, 2) NOT NULL,
        category TEXT NOT NULL,
        expense_date DATE NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO categories (name)
      VALUES ('Food'), ('Transport'), ('Bills'), ('Fun')
      ON CONFLICT (name) DO NOTHING;
    `);

    initialized = true;
  } finally {
    client.release();
  }
}

async function getAppData() {
  await ensureSchema();
  const client = await getPool().connect();

  try {
    const [categoryResult, expenseResult] = await Promise.all([
      client.query("SELECT name FROM categories ORDER BY name ASC"),
      client.query(`
        SELECT id, amount::float8 AS amount, category, expense_date, note
        FROM expenses
        ORDER BY expense_date DESC, created_at DESC
      `),
    ]);

    return {
      categories: categoryResult.rows.map((row) => row.name),
      expenses: expenseResult.rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        category: row.category,
        date: formatDbDate(row.expense_date),
        note: row.note || "",
      })),
    };
  } finally {
    client.release();
  }
}

async function createCategory(name) {
  await ensureSchema();
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  await getPool().query(
    "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
    [normalizedName]
  );
}

async function deleteCategory(name) {
  await ensureSchema();
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  await getPool().query("DELETE FROM categories WHERE name = $1", [normalizedName]);
}

async function createExpense(expense) {
  await ensureSchema();

  const payload = {
    id: String(expense.id || "").trim(),
    amount: Number(expense.amount),
    category: String(expense.category || "").trim(),
    date: String(expense.date || "").trim(),
    note: String(expense.note || "").trim(),
  };

  if (!payload.id || !payload.category || !payload.date || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error("Expense id, amount, category, and date are required.");
  }

  await getPool().query(
    `
      INSERT INTO expenses (id, amount, category, expense_date, note)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [payload.id, payload.amount, payload.category, payload.date, payload.note]
  );
}

async function deleteExpense(id) {
  await ensureSchema();
  const normalizedId = String(id || "").trim();

  if (!normalizedId) {
    throw new Error("Expense id is required.");
  }

  await getPool().query("DELETE FROM expenses WHERE id = $1", [normalizedId]);
}

function shouldUseSsl(connectionString) {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

function formatDbDate(value) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = {
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  getAppData,
};
