const { handleExpenses } = require("../lib/api");

module.exports = async function handler(request, response) {
  try {
    const data = await handleExpenses(request.method, request.query || {}, request.body || {});
    response.status(200).json(data);
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message || "Failed to update expenses." });
  }
};
