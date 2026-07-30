import os from "node:os";
import path from "node:path";

export function getMogakoHome(env = process.env) {
  return path.resolve(env.MOGAKO_HOME || path.join(os.homedir(), ".mogako"));
}

export function getPaths(env = process.env) {
  const home = getMogakoHome(env);
  return {
    home,
    config: path.join(home, "config.json"),
    connection: path.join(home, "connection.json"),
    activity: path.join(home, "activity"),
    outbox: path.join(home, "outbox")
  };
}
