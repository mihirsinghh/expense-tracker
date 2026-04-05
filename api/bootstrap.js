const { handleBootstrap } = require("../lib/api");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const data = await handleBootstrap();
    response.status(200).json(data);
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message || "Failed to load app data." });
  }
};
