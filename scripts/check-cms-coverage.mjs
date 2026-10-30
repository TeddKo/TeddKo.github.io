/**
 * Fails the build when public/cms/config.yml does not expose every key that
 * actually exists in the CMS-managed JSON files.
 *
 * Why this matters: Sveltia writes back only the fields its config declares.
 * A key present in the data but missing from the config is silently dropped
 * the first time someone saves that screen in the CMS. `astro check` catches
 * that only for keys a template happens to reference, and only after the data
 * is already gone. This check runs before any of that can happen.
 */
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const CONFIG = "public/cms/config.yml";

/** Every leaf path in a data file, with array indices collapsed to `[]`. */
const dataLeaves = (value, path = "", out = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach(item => dataLeaves(item, `${path}[]`, out));
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      dataLeaves(value[key], path ? `${path}.${key}` : key, out);
    }
  } else {
    out.add(path.replace(/^\[\]\./, ""));
  }
  return out;
};

/** Every leaf path the CMS config can read and write back. */
const configLeaves = (fields, path = "", out = new Set()) => {
  for (const field of fields ?? []) {
    const here = path ? `${path}.${field.name}` : field.name;
    if (field.widget === "object" && field.fields) {
      configLeaves(field.fields, here, out);
    } else if (field.widget === "list" && field.types) {
      // Variable-type list: the discriminator key plus each variant's fields.
      out.add(`${here}[].${field.typeKey ?? "type"}`);
      for (const type of field.types) {
        configLeaves(type.fields, `${here}[]`, out);
      }
    } else if (field.widget === "list" && field.fields) {
      // `root: true` stores the list at the top level of the file.
      configLeaves(field.fields, field.root ? path : `${here}[]`, out);
    } else if (field.widget === "list") {
      out.add(`${here}[]`); // plain list of strings
    } else {
      out.add(here);
    }
  }
  return out;
};

const config = parse(readFileSync(CONFIG, "utf8"));
const problems = [];

for (const singleton of config.singletons ?? []) {
  const data = JSON.parse(readFileSync(singleton.file, "utf8"));
  const covered = configLeaves(singleton.fields);
  const missing = [...dataLeaves(data)].filter(key => !covered.has(key));
  if (missing.length) {
    problems.push(`  ${singleton.file}\n    ${missing.join("\n    ")}`);
  }
}

if (problems.length) {
  console.error(
    `\n${CONFIG} does not cover every key in the data it manages.\n` +
      `Saving these screens in the CMS would delete the keys below.\n` +
      `Add a matching field to the config, or remove the key from the data.\n\n` +
      problems.join("\n") +
      "\n"
  );
  process.exit(1);
}

console.log(
  `CMS coverage OK — ${config.singletons.length} singletons, no uncovered keys.`
);
