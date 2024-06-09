const { writeFile, readFile } = require("fs/promises");
const { existsSync } = require("fs");
const path = require("path");

// Get path relative to current file.
const dataFilePath = path.join(__dirname, ".data/data.json");
let data = {};

async function load() {
  if (existsSync(dataFilePath)) {
    data = JSON.parse(await readFile(dataFilePath, "utf8"));
  } else {
    await writeFile(dataFilePath, JSON.stringify(data));
  }
  return data;
}

async function save() {
  await writeFile(dataFilePath, JSON.stringify(data));
}

async function set(key, value) {
  data[key] = value;
  await save();
}

function get(key) {
  return data[key];
}

module.exports = {
  get,
  set,
};

load();
