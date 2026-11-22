/**
 * Bounded rider telemetry queue.
 *
 * Points are held in IndexedDB while the app is open, never localStorage. The
 * queue keeps at most 50 points or ten minutes of history, drops duplicate
 * fixes, and is flushed only while the rider's delivery is in progress. The
 * handover PIN is never part of this queue.
 */

export type TelemetryPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
};

export type QueuedTelemetryPoint = TelemetryPoint & {
  orderId: string;
  sequence: number;
};

export const MAX_QUEUE_POINTS = 50;
export const MAX_QUEUE_AGE_MS = 10 * 60 * 1_000;
export const DUPLICATE_WINDOW_MS = 5_000;

export function pruneTelemetryPoints(
  points: readonly QueuedTelemetryPoint[],
  now = Date.now(),
): QueuedTelemetryPoint[] {
  const fresh = points.filter((point) => {
    const at = Date.parse(point.recordedAt);
    return Number.isFinite(at) && now - at <= MAX_QUEUE_AGE_MS;
  });

  return fresh.slice(Math.max(0, fresh.length - MAX_QUEUE_POINTS));
}

export function isDuplicateTelemetryPoint(
  points: readonly QueuedTelemetryPoint[],
  point: TelemetryPoint,
): boolean {
  const last = points[points.length - 1];
  if (!last) return false;
  if (last.latitude !== point.latitude || last.longitude !== point.longitude) {
    return false;
  }
  const previous = Date.parse(last.recordedAt);
  const next = Date.parse(point.recordedAt);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  return next - previous <= DUPLICATE_WINDOW_MS;
}

export function appendTelemetryPoint(
  points: readonly QueuedTelemetryPoint[],
  orderId: string,
  point: TelemetryPoint,
  now = Date.now(),
): QueuedTelemetryPoint[] {
  const pruned = pruneTelemetryPoints(points, now);
  if (isDuplicateTelemetryPoint(pruned, point)) return pruned;

  const sequence =
    pruned.reduce((highest, entry) => Math.max(highest, entry.sequence), 0) + 1;

  return [...pruned, { ...point, orderId, sequence }].slice(-MAX_QUEUE_POINTS);
}

type StoredPoint = QueuedTelemetryPoint & { key: number };

const DB_NAME = "mrfss-rider-telemetry";
const STORE_NAME = "points";

const memoryDb = new Map<number, StoredPoint>();
let memoryKey = 1;

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "key",
          autoIncrement: true,
        });
        store.createIndex("orderId", "orderId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStored(orderId: string): Promise<StoredPoint[]> {
  if (!canUseIndexedDb()) {
    return [...memoryDb.values()]
      .filter((point) => point.orderId === orderId)
      .sort((left, right) => left.sequence - right.sequence);
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("orderId");
    const rows = await requestToPromise(
      index.getAll(IDBKeyRange.only(orderId)) as IDBRequest<StoredPoint[]>,
    );
    return rows.sort((left, right) => left.sequence - right.sequence);
  } finally {
    db.close();
  }
}

async function deleteKeys(keys: readonly number[]): Promise<void> {
  if (keys.length === 0) return;

  if (!canUseIndexedDb()) {
    for (const key of keys) memoryDb.delete(key);
    return;
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const key of keys) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function replaceQueue(
  orderId: string,
  rows: readonly StoredPoint[],
  points: readonly QueuedTelemetryPoint[],
): Promise<void> {
  await deleteKeys(rows.map((row) => row.key));

  if (!canUseIndexedDb()) {
    for (const point of points) {
      memoryDb.set(memoryKey, { ...point, key: memoryKey });
      memoryKey += 1;
    }
    return;
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      for (const point of points) store.add(point);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function enqueueTelemetryPoint(
  orderId: string,
  point: TelemetryPoint,
  now = Date.now(),
): Promise<number> {
  const existing = await readStored(orderId);
  const next = appendTelemetryPoint(existing, orderId, point, now);
  if (next.length === existing.length) return next.length;

  await replaceQueue(orderId, existing, next);
  return next.length;
}

/** Read the queue oldest-first, including the internal IndexedDB keys. */
export async function readTelemetryQueue(
  orderId: string,
): Promise<StoredPoint[]> {
  return readStored(orderId);
}

export async function deleteTelemetryPoints(
  keys: readonly number[],
): Promise<void> {
  await deleteKeys(keys);
}

export async function clearTelemetryQueue(orderId: string): Promise<void> {
  const rows = await readStored(orderId);
  await deleteKeys(rows.map((row) => row.key));
}

export function resetTelemetryQueueForTests(): void {
  memoryDb.clear();
  memoryKey = 1;
}
