"use client";

const memory = new Map<string, unknown>();

export function readMemory<T>(key: string) {
  return memory.get(key) as T | undefined;
}

export function writeMemory<T>(key: string, value: T) {
  memory.set(key, value);
}

export function deleteMemory(key: string) {
  memory.delete(key);
}

export function clearMemoryPrefix(prefix: string) {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) {
      memory.delete(key);
    }
  }
}
