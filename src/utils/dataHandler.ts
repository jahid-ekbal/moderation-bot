import fs from "fs";
import path from "path";

export const loadJSON = <T>(filePath: string, defaultValue: T): T => {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absolutePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(absolutePath, "utf8").trim();
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error loading JSON from ${filePath}:`, error);
    return defaultValue;
  }
};

export const saveJSON = (filePath: string, data: object) => {
  try {
    fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving JSON to ${filePath}:`, error);
  }
};
