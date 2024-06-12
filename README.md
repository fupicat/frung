# frung

**frung** is what happens when a bluepilled JS dev gets a whiff of PHP and kinda likes it. This is a starter template for making quick and dirty server-rendered websites without any build steps - in fact, you can even edit your website while it's running! Just how the internet is meant to be.

> ⚠️ **Attention:** I literally wrote this in two days. I did my best, but I know nothing about security vulnerabilities. Maybe don't use this dumb project for anything actually important.

## Features

- All the features and familiarity of [Express](https://expressjs.com).
- Simple route handling with [EJS](https://ejs.co) templates - you just write Javascript to generate HTML.
- Dynamic module loading for editing routes and files while the server is running.
- Dynamic routing with support for catch-all routes.
- Middleware support, per route or per folder.
- Easy to setup and run.
- ~300 lines of pure, well-commented Javascript. Feel free to mess around!

### Non-features

It's important to point out what this project is *not*, so you can decide if it's really a right fit for you.

- ~~Typescript support~~ - The need for a build step doesn't allow for the dynamicism I was looking for.
- ~~Bundling of any kind~~ - This would also need a build step. You'll have to use plain old JS and CSS files for your client, or configure any tools you wanna use yourself. If it can generate a file, it's probably possible.
- ~~ESM module support~~ - Currently there is no way to dynamically import ESM modules without caching, which would force you to have to restart your server every time you made a change to your route middlewares, and I don't want that.
- ~~Support for serverless environments~~ - You *might* be able to run this on Vercel? But it's not meant to. This is a long-running Express server that only uses CommonJS modules and needs access to the file system, so it's hard to make serverless adapters for it. This is meant to run on something like a VPS.

If you want to use a more serious framework for big-boy apps that has all of the features above, but still keeps things simple, I'd recommend taking a look at [Astro](https://astro.build).

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [Routes](#routes)
- [Middleware](#middleware)
- [Plugins](#plugins)
- [Error handling](#error-handling)

## Installation

Install [Node.js](https://nodejs.org/en), clone this repository, and install dependencies. I recommend using [degit](https://github.com/Rich-Harris/degit) so that you don't copy over the git history.

```bash
npm install -g degit
degit fupicat/frung my-frung-project
cd my-frung-project
npm install
```

## Usage

1. **Setting up your project**

    A frung website consists of [routes](#routes) and [middleware](#middleware), both of which are kept in a `routes` folder. For example:

    ```
    frung/
    ├── routes/
    │   ├── index.ejs
    │   ├── middleware.js
    │   └── ...
    └── server.js
    ```

2. **Running the server**

    Just run the server.js file using Node.js:

    ```sh
    node server.js
    # Or, if you prefer, run the start script:
    npm run start
    ```

    By default, the server runs on `http://localhost:3000`.

3. **Configuration**

    You can configure the server using environment variables. You can create a `.env` file at the root of the project and it will be automatically loaded.

    - `PORT`: Set the port used for the server (default: `3000`).
    - `ROUTES_PATH`: Set the routes directory (default: `routes`).
    - `CACHE_MIDDLEWARE`: Enable middleware caching (default: no)
      - This makes it so that all middleware files are cached after they're first loaded. If you want to change a middleware's code with this enabled, you'll have to restart the server for the changes to take effect. Might help if you have heavy operations on middleware but, in general, I don't recommend this.
    - `NOT_FOUND_ROUTE`: Set the 404 error route file (default: `404.ejs`).
    - `ERROR_ROUTE`: Set the 500 error route file (default: `500.ejs`).

## Routes

Every file you put in the `routes` directory becomes a route, be it a static file, or an EJS template. All EJS templates have access to the Express `req`, `res`, and the `require` function.

- You can edit/add/remove routes and files while the server is running.
- Routes can respond to any kind of HTTP method, accessible with the value `req.method`.
- `index.ejs` routes will be accessible at the root of their folder. So to access `/posts/index.ejs` in the browser, you just need to go to `/posts`.
- Dynamic routes can be created by wrapping a parameter name in square brackets, like `[postId].ejs`. Then, the parameter will be available at `req.params.postId` as a string.
- Catch-all routes can be created with rest syntax, like `[...path].ejs`. The rest of the path after that point will be available at `req.params.path` as a string like this: `rest/of/path`.
- Folders whose name is in parentheses, like `(elements)`, will not be available as a route. Use this to organize your template partials and store files that shouldn't be accessible.

Here's an example of a `routes` folder showcasing all features:

```
routes/
├── favicon.ico
├── index.ejs
├── about.ejs
├── posts/
│   ├── index.ejs
│   └── [postId].ejs
├── admin/
│   └── [...path].ejs
└── (elements)/
    └── header.ejs
```

You should read the [EJS documentation](https://ejs.co/#docs) for info on how to use the templating language. But there are some different things that you should keep in mind:

### Await

You can fetch data or implement any promise just by awaiting:

```js
<%
  const postReq = await fetch(`https://jsonplaceholder.typicode.com/posts/${req.params.postId}`);
  const post = await postReq.json();
%>

<h1><%= post.title %></h1>
<p><%= post.body %></p>
```

### Include

You can use the `include` function to render another template within a template. Absolute paths will be relative to the `routes` folder, so you can store your partials inside it. Also, since rendering is done asynchronously, ***you need to await the function***. This is not covered in the EJS documentation.

```js
<%- await include("/(elements)/header") %>

<h1>Page</h1>

<%- await include("/(elements)/footer") %>
```

### Require

Use `require()` to import modules in your template.

```js
<%
  const fs = require("fs/promises");
  // Filepaths are relative to the project root, not to the EJS file.
  const blogPost = await fs.readFile("content/post.md", { encoding: "utf-8" });
%>

<p><%= blogPost %></p>
```

### Local modules

In order to allow you to edit the website while it's running, routes and middleware aren't cached. Therefore, you might want to delegate heavy operations to other JS files in your project, so you can do proper caching, and then require them in your templates. Required modules are always cached, so if you edit the code of a JS module that you import elsewhere, you have to restart the server for it to work.

```js
<%
  // Module filepaths starting with "./" are relative to the project root, not to the EJS file.
  const bigModule = require("./modules/heavy.js");
%>

<p><%= bigModule.doOperation() %></p>
```

If you need to access server configuration through your local modules, you can import the server itself as a module like this:

```js
// Path is relative to the project directory.
const { config } = require("./server.js");
```

### Other response types

Your responses can be anything, not just HTML. For example, you can create an `api.json.ejs` file that returns a JSON response:

```js
<%
  res.json({ hello: "json" })
%>
```

### Ideas

- Create a personal blog that loads its content from the file system.
- Save form submissions to a database directly in your templates.
- Use [HTMX](https://htmx.org) on the client and check request headers on the server to send out HTML partials on demand.

## Middleware

Middleware files can be placed at various levels within the routes directory. They can either apply to a single route, or all routes in an entire folder. They can also be edited while the server is running.

### Route middleware

To apply a middleware to a route, create a file at the same level called `route-name.middleware.js`:

```
routes/
├── index.ejs
└── index.middleware.js
```

This file should be a CommonJS module that exports an [Express middleware function](https://expressjs.com/en/guide/writing-middleware.html). You can use JSDoc for autocomplete in your code editor:

```js
/**
 * @type {import('express').RequestHandler}
 */
module.exports = function indexMiddleware(req, res, next) {
  console.log("Hello from the middleware!");
  return next();
};
```

You can also export an array of middleware functions, and they'll be executed in order:

```js
/**
 * @type {import('express').RequestHandler[]}
 */
module.exports = [
  function first(req, res, next) {
    console.log("First");
    return next();
  },
  function second(req, res, next) {
    console.log("Second");
    return next();
  },
]
```

### Folder middleware

To apply a middleware to an entire folder, create a file at the root of that folder called `middleware.js`:

```
routes/
└── admin/
    ├── index.ejs
    ├── secret.ejs
    ├── secreter.ejs
    ├── secretest.ejs
    └── middleware.js
```

If you prefer, you can also use a file called `folder-name.middleware.js`, but then the file should be put outside the folder.

```
routes/
├── admin/
│   ├── index.ejs
│   ├── secret.ejs
│   ├── secreter.ejs
│   └── secretest.ejs
└── admin.middleware.js
```

You can use the `req.path` (prepended with `/`) value to know what path the user requested, and the `req.filePath` (prepended with `routes/`) value to know what file is actually gonna be rendered or sent to the browser.

A `middleware.js` file also applies to every route in the folders within its own folder, so you can nest and chain routes to create complex behavior. If multiple middlewares are applied to a given route, they are executed in the order from the most general (less deep in the folder structure) to the most specific (deeper in the folder structure).

For example, if a user requests the page `/admin/posts/new`, the server will look for and run middlewares in the following order:

- `/routes/middleware.js`
- `/routes/admin.middleware.js`
- `/routes/admin/middleware.js`
- `/routes/admin/posts.middleware.js`
- `/routes/admin/posts/middleware.js`
- `/routes/admin/posts/new.middleware.js`
- `/routes/admin/posts/new/middleware.js`
- `/routes/admin/posts/new/index.middleware.js`
- `/routes/admin/posts/new/index/middleware.js`

### Ideas

- Use folder middlewares to protect all routes with authentication.
- Populate the `req` object with data fetched in the middleware to declutter your template files.
- Use [Multer](https://www.npmjs.com/package/multer) to handle form submissions and file uploads on a per-route basis.
- Create whatever logging behavior you want.

## Error Handling

The server handles errors by logging them to the console and serving an error page to the client. You can customize the error page by creating a file called `500.ejs` at the top level of the `routes` folder. The error object is available at `req.error`.

You can also create a `404.ejs` file that will be served when the client requests a non-existent route.
