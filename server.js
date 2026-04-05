const http = require("http");
const fs = require("fs");
const path = require("path");
const { createHttpError, handleBootstrap, handleCategories, handleExpenses, parseJsonBody } = require("./lib/api");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (request, response) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith("/api/")) {
    try {
      const rawBody = await readRequestBody(request);
      const body = parseJsonBody(rawBody);
      const query = Object.fromEntries(parsedUrl.searchParams.entries());

      let data;
      if (pathname === "/api/bootstrap") {
        data = await handleBootstrap();
      } else if (pathname === "/api/categories") {
        data = await handleCategories(request.method, query, body);
      } else if (pathname === "/api/expenses") {
        data = await handleExpenses(request.method, query, body);
      } else {
        throw createHttpError(404, "API route not found.");
      }

      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(data));
      return;
    } catch (error) {
      response.writeHead(error.status || 500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message || "API request failed." }));
      return;
    }
  }

  const urlPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Expense tracker running at http://localhost:${PORT}`);
});

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}
