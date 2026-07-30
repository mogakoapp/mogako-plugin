export function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const [rawName, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawName] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[rawName] = next;
      index += 1;
    } else {
      flags[rawName] = true;
    }
  }

  return { positional, flags };
}

export function booleanFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    return true;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(`--${name} must be a boolean flag.`);
}

export function stringFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}
