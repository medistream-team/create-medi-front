#!/usr/bin/env node
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
import * as fs from "node:fs";
import * as path from "node:path";
import minimist from "minimist";
import prompts from "prompts";
import { red } from "kolorist";

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.resolve();

function postOrderDirectoryTraverse(dir, dirCallback, fileCallback) {
  for (const filename of fs.readdirSync(dir)) {
    const fullpath = path.resolve(dir, filename);
    if (fs.lstatSync(fullpath).isDirectory()) {
      postOrderDirectoryTraverse(fullpath, dirCallback, fileCallback);
      dirCallback(fullpath);
      // eslint-disable-next-line no-continue
      continue;
    }
    fileCallback(fullpath);
  }
}

const isObject = (val) => val && typeof val === "object";
const mergeArrayWithDedupe = (a, b) => Array.from(new Set([...a, ...b]));

function deepMerge(target: Object, obj: Object) {
  for (const key of Object.keys(obj)) {
    const oldVal = target[key];
    const newVal = obj[key];

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      target[key] = mergeArrayWithDedupe(oldVal, newVal);
    } else if (isObject(oldVal) && isObject(newVal)) {
      target[key] = deepMerge(oldVal, newVal);
    } else {
      target[key] = newVal;
    }
  }

  return target;
}

function sortDependencies(packageJson) {
  const sorted = {};

  const depTypes = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  for (const depType of depTypes) {
    if (packageJson[depType]) {
      sorted[depType] = {};

      Object.keys(packageJson[depType])
        .sort()
        .forEach((name) => {
          sorted[depType][name] = packageJson[depType][name];
        });
    }
  }

  return {
    ...packageJson,
    ...sorted,
  };
}

function renderTemplate(src, dest) {
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    // skip node_module
    if (path.basename(src) === "node_modules") {
      return;
    }

    // if it's a directory, render its subdirectories and files recursively
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      renderTemplate(path.resolve(src, file), path.resolve(dest, file));
    }
    return;
  }

  const filename = path.basename(src);

  if (filename === "package.json" && fs.existsSync(dest)) {
    // merge instead of overwriting
    const existing = JSON.parse(fs.readFileSync(dest, "utf8"));
    const newPackage = JSON.parse(fs.readFileSync(src, "utf8"));
    const pkg = sortDependencies(deepMerge(existing, newPackage));
    fs.writeFileSync(dest, `${JSON.stringify(pkg, null, 2)}\n`);
    return;
  }

  fs.copyFileSync(src, dest);
}

function bindSubdomainName(subDomainName, dest) {
  const pipelinePath = path.resolve(dest, "bitbucket-pipelines.yml");
  const pipeline = fs.readFileSync(pipelinePath, "utf8");
  fs.writeFileSync(
    pipelinePath,
    pipeline.replace(/\{\{\{sub\}\}/g, subDomainName)
  );
}

// --------------------------------------

function canSkipEmptying(dir: string) {
  if (!fs.existsSync(dir)) {
    return true;
  }

  const files = fs.readdirSync(dir);
  if (files.length === 0) {
    return true;
  }
  if (files.length === 1 && files[0] === ".git") {
    return true;
  }

  return false;
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  postOrderDirectoryTraverse(
    dir,
    (dir) => fs.rmdirSync(dir),
    (file) => fs.unlinkSync(file)
  );
}

// --------------------------------------

async function init() {
  console.log("\n-- Init Vue 3 Medistream Frontend Project --\n");

  const cwd = process.cwd();
  const argv = minimist(process.argv.slice(2), { boolean: true });

  const defaultProjectName = "medi-front-project";
  let targetDir = argv._[0];

  type Result = {
    projectName?: string;
    shouldOverwrite?: boolean;
    subdomainName?: string;
  };

  let result: Result = {};

  try {
    result = await prompts(
      [
        {
          name: "projectName",
          type: targetDir ? null : "text",
          message: "Project name:",
          initial: defaultProjectName,
          // eslint-disable-next-line no-return-assign
          onState: (state) =>
            (targetDir = String(state.value).trim() || defaultProjectName),
        },
        {
          name: "shouldOverwrite",
          type: () => (canSkipEmptying(targetDir) ? null : "confirm"),
          message: () => {
            const dirForPrompt =
              targetDir === "."
                ? "Current directory"
                : `Target directory "${targetDir}"`;

            return `${dirForPrompt} is not empty. Remove existing files and continue?`;
          },
        },
        {
          name: "overwriteChecker",
          type: (prev, values) => {
            if (values.shouldOverwrite === false) {
              throw new Error(`${red("✖")} Operation cancelled`);
            }
            return null;
          },
        },
        {
          name: "subdomainName",
          type: "text",
          message: "Subdomain name:",
          // eslint-disable-next-line no-return-assign
          onState: (state) => String(state.value).trim() || undefined,
        },
      ],
      {
        onCancel: () => {
          throw new Error(`${red("✖")} Operation cancelled`);
        },
      }
    );
  } catch (cancelled) {
    console.log(cancelled.message);
    process.exit(1);
  }

  const { projectName, shouldOverwrite, subdomainName } = result;

  const root = path.join(cwd, targetDir);

  if (fs.existsSync(root) && shouldOverwrite) {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root);
  }

  console.log(`\nScaffolding project in ${root}...`);

  // Scaffold the project
  const pkg = { name: projectName, version: "0.0.0" };

  fs.writeFileSync(
    path.resolve(root, "package.json"),
    JSON.stringify(pkg, null, 2)
  );

  const templateRoot = path.resolve(__dirname, "template");
  const render = function render(templateName) {
    const templateDir = path.resolve(templateRoot, templateName);
    renderTemplate(templateDir, root);
  };

  render("base");

  bindSubdomainName(subdomainName, root);
}

init().catch(console.error);
