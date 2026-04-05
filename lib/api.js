const {
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  getAppData,
} = require("./db");

async function handleBootstrap() {
  return getAppData();
}

async function handleCategories(method, query, body) {
  if (method === "POST") {
    await createCategory(body.name);
    return getAppData();
  }

  if (method === "DELETE") {
    await deleteCategory(query.name);
    return getAppData();
  }

  throw createHttpError(405, "Method not allowed.");
}

async function handleExpenses(method, query, body) {
  if (method === "POST") {
    await createExpense(body);
    return getAppData();
  }

  if (method === "DELETE") {
    await deleteExpense(query.id);
    return getAppData();
  }

  throw createHttpError(405, "Method not allowed.");
}

function parseJsonBody(rawBody) {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw createHttpError(400, "Request body must be valid JSON.");
  }
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  createHttpError,
  handleBootstrap,
  handleCategories,
  handleExpenses,
  parseJsonBody,
};
