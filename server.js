const ejs = require("ejs");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

// Check arguments for configuration, or use defaults.
// E.g: node server.js -p 3000 -rp routes -pp plugins -cm -nf 404.ejs -er 500.ejs
// E.g: node server.js --port=3000 --routes-path=routes --plugins-path=plugins --cache-middleware --not-found-route=404.ejs --error-route=500.ejs
const config = {
  port: 3000,
  routesPath: "routes",
  pluginsPath: "plugins",
  cacheMiddleware: false,
  notFoundRoute: "404.ejs",
  errorRoute: "500.ejs",
};
const configArgs = [
  {
    short: "p",
    long: "port",
    key: "port",
  },
  {
    short: "rp",
    long: "routes-path",
    key: "routesPath",
  },
  {
    short: "pp",
    long: "plugins-path",
    key: "pluginsPath",
  },
  {
    short: "cm",
    long: "cache-middleware",
    key: "cacheMiddleware",
  },
  {
    short: "nf",
    long: "not-found-route",
    key: "notFoundRoute",
  },
  {
    short: "er",
    long: "error-route",
    key: "errorRoute",
  },
];
process.argv.forEach((arg, index) => {
  for (const configArg of configArgs) {
    if (arg === `-${configArg.short}`) {
      config[configArg.key] = process.argv[index + 1];
      break;
    }
    if (arg.startsWith(`--${configArg.long}=`)) {
      config[configArg.key] = arg.replace(`--${configArg.long}=`, "");
      break;
    }
  }
});

// Import all default exports from .js files from the plugins folder into a plugins object.
const plugins = {};
(() => {
  const pluginFiles = fs.readdirSync(config.pluginsPath);
  for (const file of pluginFiles) {
    if (file.endsWith(".js")) {
      const plugin = require(`./${config.pluginsPath}/${file}`);
      plugins[file.replace(".js", "")] = plugin;
    }
  }
})();

// Route resolver
app.use((req, res, next) => {
  // Let's go through the routes!!
  // First, split the path into its component parts and remove empty strings and dots.
  const splitPath = req.path
    .split("/")
    .filter((part) => !["", "..", "."].includes(part));
  let filePath = `${config.routesPath}`;
  let params = {};

  let catchAllFilePath;
  let catchAllParams = {};

  function notFound() {
    res.statusCode = 404;
    req.filePath = `${config.routesPath}/${config.notFoundRoute}`;
    return next();
  }

  // Loop through the split path to find the route
  for (let i = 0; i < splitPath.length; i++) {
    const currentPart = splitPath[i];
    const isLastPart = i === splitPath.length - 1;
    // Get all paths, ignoring folders with names in parentheses.
    // E.g: (ignoreThisFolder)
    // Also ignore any middleware files.
    // E.g: posts.middleware.js, middleware.js
    const availableRoutes = fs.readdirSync(filePath).filter((route) => {
      if (route.endsWith(".middleware.js")) return false;
      if (route === "middleware.js") return false;
      if (route.startsWith("(") && route.endsWith(")")) return false;
      return true;
    });

    // Is there a catch-all route? E.g: [...slug]
    // If there is, save it for later. If an end is reached
    // and there is no other match, use this one.
    const catchAllRegex = /^\[\.\.\.(\w+)\](.ejs)?$/;
    const catchAllRoute = availableRoutes.find((route) =>
      catchAllRegex.test(route)
    );
    if (catchAllRoute) {
      const match = catchAllRegex.exec(catchAllRoute);
      const paramName = match[1];
      catchAllParams[paramName] = splitPath.slice(i).join("/");
      catchAllFilePath = filePath + `/${catchAllRoute}`;
      // If it's a folder, get the index.ejs file here.
      // If there is none, forget about it.
      if (fs.lstatSync(catchAllFilePath).isDirectory()) {
        if (fs.existsSync(`${catchAllFilePath}/index.ejs`)) {
          catchAllFilePath += "/index.ejs";
        } else {
          catchAllFilePath = null;
          catchAllParams = {};
        }
      }
    }

    // Is there a route that matches the current part exactly?
    // Or, if it's the last part, is there a file with an .ejs extension?
    // Don't match index.ejs files if the last part is "index".
    const exactMatch = availableRoutes.find(
      (route) =>
        route === currentPart ||
        (isLastPart &&
          route === `${currentPart}.ejs` &&
          currentPart !== "index")
    );
    if (exactMatch) {
      filePath += `/${exactMatch}`;
      continue;
    }

    // Is there a dynamic route that matches the current part? E.g: [slug]
    // If it's the last part, it should match a folder, or a file with an .ejs extension.
    // If it's not the last part, it should only match folders.
    const dynamicRegex = isLastPart ? /^\[(\w+)\](.ejs)?$/ : /^\[(\w+)\]$/;
    const dynamicRoute = availableRoutes.find((route) =>
      dynamicRegex.test(route)
    );
    if (dynamicRoute) {
      const match = dynamicRegex.exec(dynamicRoute);
      const paramName = match[1];
      params[paramName] = currentPart;
      filePath += `/${dynamicRoute}`;
      continue;
    }

    // If you don't find anywhere else to go, see if you have a catch-all route available.
    if (catchAllFilePath) {
      filePath = catchAllFilePath;
      params = catchAllParams;
      break;
    }

    // If nothing applies, return a 404.
    return notFound();
  }

  // Is the final path a folder? If so, check if there's an index.ejs file.
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
    if (!fs.existsSync(`${filePath}/index.ejs`)) {
      // if you don't have a catch-all route, return a 404.
      if (!catchAllFilePath) {
        return notFound();
      }
      // else, use the catch-all route.
      filePath = catchAllFilePath;
      params = catchAllParams;
    } else {
      filePath += "/index.ejs";
    }
  }

  req.filePath = filePath;
  req.routeParams = params;

  return next();
});

// Middleware resolver.
// Routes can be affected by multiple middlewares. Each folder that the route passes through
// can have it's own middleware.js file that protects every file in the folder. Also, the route itself
// can have a middleware file, with the same name as the route, with .middleware.js appended.
// E.g: If the route is /admin/posts/new, the server should look for middleware files in the following order:
//   - /routes.middleware.js
//   - /routes/middleware.js
//   - /routes/admin.middleware.js
//   - /routes/admin/middleware.js
//   - /routes/admin/posts.middleware.js
//   - /routes/admin/posts/middleware.js
//   - /routes/admin/posts/new.middleware.js
//   - /routes/admin/posts/new/middleware.js
//   - /routes/admin/posts/new/index.middleware.js
//   - /routes/admin/posts/new/index/middleware.js
// If any of these files exist, they should be required and executed in order from top to bottom.
// Aka, from the most general to the most specific.
app.use((req, res, next) => {
  const { filePath } = req;
  const middlewareFunctions = [];
  const splitPath = filePath.split("/");

  for (let i = 0; i < splitPath.length; i++) {
    let currentPath = splitPath.slice(0, i + 1).join("/");
    if (currentPath.endsWith(".ejs")) {
      currentPath = currentPath.replace(".ejs", "");
    }

    const fileMiddlewarePath = `./${currentPath}.middleware.js`;
    if (fs.existsSync(fileMiddlewarePath)) {
      // If the cacheMiddleware flag is not set, the middleware cache should be cleared.
      if (!config.cacheMiddleware) {
        delete require.cache[require.resolve(fileMiddlewarePath)];
      }
      middlewareFunctions.push(require(path.resolve(fileMiddlewarePath)));
    }

    const folderMiddlewarePath = `./${currentPath}/middleware.js`;
    if (fs.existsSync(folderMiddlewarePath)) {
      // If the cacheMiddleware flag is not set, the middleware cache should be cleared.
      if (!config.cacheMiddleware) {
        delete require.cache[require.resolve(folderMiddlewarePath)];
      }
      middlewareFunctions.push(require(path.resolve(folderMiddlewarePath)));
    }
  }

  // Execute the middleware files in order.
  const router = express.Router();

  router.use(...middlewareFunctions);

  return router.handle(req, res, next);
});

// Catch-all route for any method
app.all("*", async (req, res) => {
  const { filePath } = req;
  req.params = req.routeParams;
  req.routeParams = undefined;

  async function renderPage(path) {
    async function renderTemplate(path) {
      if (!fs.existsSync(path)) {
        return "404";
      }
      try {
        const html = await ejs.renderFile(
          path,
          { req, res, plugins, require },
          { async: true }
        );
        if (res.headersSent) return;
        return html;
      } catch (error) {
        console.error(error);
        return null;
      }
    }

    const html = await renderTemplate(path);
    if (!html) {
      res.statusCode = 500;
      const errorHtml = await renderTemplate(
        `${config.routesPath}/${config.errorRoute}`
      );
      if (!errorHtml || errorHtml === "404")
        return res.send("500 Internal Server Error");
      return res.send(errorHtml);
    }
    return res.send(html);
  }

  // If the final path is a .ejs file, render it.
  if (filePath.endsWith(".ejs")) {
    return await renderPage(filePath);
  }

  // If the final path is a static file, send it.
  return res.sendFile(filePath, { root: "." });
});

app.listen(config.port, () => {
  console.log(
    "Server is up: \x1b[36m%s\x1b[0m",
    `http://localhost:${config.port}`
  );
});
