/**
 * ARTISAN MARKETPLACE: CLIENT-SIDE STORAGE & OFFLINE-FIRST SYNC ENGINE
 * File: src/services/storage.ts
 * 
 * Production-ready IndexedDB persistence layer and automatic network sync manager.
 * Intercepts form submissions during offline states, queues payloads safely,
 * and flushes them to the server when network connectivity is re-established.
 * 
 * Dependencies: Native Browser Web APIs (IndexedDB, Fetch, window events).
 */

import { ProductListingPayload, QueuedProduct } from "../types/artisan.ts";

const DB_NAME = "ArtisanHubOfflineDB";
const DB_VERSION = 1;
const OBJECT_STORE_NAME = "offline_products_queue";

/**
 * Native IndexedDB Wrapper Class
 * Provides asynchronous, transactional CRUD operations on local browser storage.
 */
export class OfflineStorageQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initializes and opens the IndexedDB connection with schema migrations.
   */
  public async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      // Guard against environments lacking IndexedDB (e.g. server-side rendering)
      if (typeof window === "undefined" || !window.indexedDB) {
        return reject(new Error("IndexedDB is not supported in this runtime environment."));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create the object store if it doesn't already exist
        if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          const store = db.createObjectStore(OBJECT_STORE_NAME, {
            keyPath: "localId",
            autoIncrement: true,
          });

          // Indexes for sorting and status tracking
          store.createIndex("idx_queuedAt", "queuedAt", { unique: false });
          store.createIndex("idx_retryCount", "retryCount", { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to open IndexedDB"));
      };

      request.onblocked = () => {
        console.warn("[IndexedDB] Database open request was blocked by an active tab.");
      };
    });

    return this.dbPromise;
  }

  /**
   * Caches a product listing payload into the offline queue.
   * @param payload The craft listing form submission payload.
   * @returns Generated local auto-incremented identifier.
   */
  public async enqueue(payload: ProductListingPayload): Promise<number> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);

      const record: Omit<QueuedProduct, "localId"> = {
        payload: {
          ...payload,
          offline_created_at: payload.offline_created_at || new Date().toISOString(),
        },
        queuedAt: new Date().toISOString(),
        retryCount: 0,
      };

      const request = store.add(record);

      request.onsuccess = () => {
        resolve(Number(request.result));
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to enqueue payload into IndexedDB"));
      };
    });
  }

  /**
   * Retrieves all pending product payloads currently held in the queue.
   */
  public async getAll(): Promise<QueuedProduct[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readonly");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as QueuedProduct[]);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to read queued items from IndexedDB"));
      };
    });
  }

  /**
   * Deletes a successfully synchronized record from the local store.
   * @param localId Unique key of the item in IndexedDB.
   */
  public async delete(localId: number): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const request = store.delete(localId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error(`Failed to delete record ${localId} from IndexedDB`));
      };
    });
  }

  /**
   * Increments the retry count and logs error info for failed synchronization attempts.
   */
  public async updateRetry(localId: number, errorMessage: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const getReq = store.get(localId);

      getReq.onsuccess = () => {
        const item = getReq.result as QueuedProduct | undefined;
        if (!item) {
          return resolve();
        }

        item.retryCount = (item.retryCount || 0) + 1;
        item.lastAttemptAt = new Date().toISOString();
        item.lastError = errorMessage;

        const updateReq = store.put(item);
        updateReq.onsuccess = () => resolve();
        updateReq.onerror = () => reject(updateReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Returns total count of un-synchronized craft listings.
   */
  public async count(): Promise<number> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readonly");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to count IndexedDB queue"));
      };
    });
  }

  /**
   * Purges all items from the offline queue.
   */
  public async clear(): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORE_NAME], "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Synchronization Manager
 * Orchestrates online/offline event listeners and executes background queue flushes.
 */
export class OfflineSyncManager {
  private queue: OfflineStorageQueue;
  private isSyncing = false;
  private syncEndpoint: string;
  private onStatusChangeCallback?: (isOnline: boolean, queuedCount: number) => void;

  constructor(
    syncEndpoint = "/api/sync/products", 
    onStatusChange?: (isOnline: boolean, queuedCount: number) => void
  ) {
    this.queue = new OfflineStorageQueue();
    this.syncEndpoint = syncEndpoint;
    this.onStatusChangeCallback = onStatusChange;

    this.registerNetworkListeners();
  }

  /**
   * Registers native browser network state listeners (online/offline).
   */
  private registerNetworkListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      console.info("[Network] Connection restored. Initiating automatic background sync...");
      this.notifyStatus(true);
      this.flushQueue();
    });

    window.addEventListener("offline", () => {
      console.warn("[Network] Connection dropped. System operating in offline-first mode.");
      this.notifyStatus(false);
    });

    // Initial check on bootstrap
    this.notifyStatus(navigator.onLine);
    if (navigator.onLine) {
      // Opportunistic sync on application boot
      this.flushQueue();
    }
  }

  /**
   * Emits status updates to subscribers and custom window events.
   */
  private async notifyStatus(isOnline: boolean): Promise<void> {
    try {
      const pendingCount = await this.queue.count();
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(isOnline, pendingCount);
      }

      window.dispatchEvent(
        new CustomEvent("artisan:network-status", {
          detail: { isOnline, pendingCount },
        })
      );
    } catch (err) {
      console.error("[OfflineSync] Error reading queue count for status event:", err);
    }
  }

  /**
   * Handles form submission in an offline-resilient manner.
   * If offline, caches locally; if online, attempts direct send with fallback to queue.
   */
  public async submitListing(
    payload: ProductListingPayload
  ): Promise<{ success: boolean; isOffline: boolean; message: string; localId?: number }> {
    // 1. If currently marked offline by browser
    if (!navigator.onLine) {
      const localId = await this.queue.enqueue(payload);
      await this.notifyStatus(false);
      return {
        success: true,
        isOffline: true,
        message: "Saved locally! Offline mode active. Your craft will auto-sync when network returns.",
        localId,
      };
    }

    // 2. If online, attempt direct transmission
    try {
      const response = await fetch(this.syncEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify([payload]), // Standardized array payload format
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP ${response.status}`);
      }

      return {
        success: true,
        isOffline: false,
        message: "Craft listing successfully published to the live marketplace!",
      };
    } catch (networkErr: any) {
      // 3. Graceful fallback on network glitch or server timeout
      console.warn("[Sync] Direct submission failed, fallback caching to IndexedDB:", networkErr);
      const localId = await this.queue.enqueue(payload);
      await this.notifyStatus(false);
      return {
        success: true,
        isOffline: true,
        message: "Network fluctuation detected. Saved safely to village local storage.",
        localId,
      };
    }
  }

  /**
   * Flushes all queued objects to the server via Fetch API.
   * Executes batch synchronization with automatic error logging and retry limits.
   */
  public async flushQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      console.info("[Sync] Flush already in progress, skipping concurrent call.");
      return { synced: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await this.queue.getAll();

      if (pendingItems.length === 0) {
        return { synced: 0, failed: 0 };
      }

      console.info(`[Sync] Flushing ${pendingItems.length} queued product listing(s)...`);

      // Extract array of payloads matching backend contract
      const payloads = pendingItems.map(item => item.payload);

      const response = await fetch(this.syncEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payloads),
      });

      if (response.ok) {
        // Bulk delete on successful batch confirmation
        for (const item of pendingItems) {
          if (typeof item.localId === "number") {
            await this.queue.delete(item.localId);
            syncedCount++;
          }
        }

        console.info(`[Sync] Batch sync successful: ${syncedCount} items saved to cloud.`);
        window.dispatchEvent(
          new CustomEvent("artisan:sync-completed", {
            detail: { count: syncedCount },
          })
        );
      } else {
        // Log failures
        const errText = await response.text();
        console.error(`[Sync] Server rejected sync batch (${response.status}):`, errText);
        for (const item of pendingItems) {
          if (typeof item.localId === "number") {
            await this.queue.updateRetry(item.localId, `HTTP ${response.status}: ${errText.slice(0, 100)}`);
            failedCount++;
          }
        }
      }
    } catch (err: any) {
      console.error("[Sync] Network exception while flushing queue:", err);
      failedCount++;
    } finally {
      this.isSyncing = false;
      this.notifyStatus(navigator.onLine);
    }

    return { synced: syncedCount, failed: failedCount };
  }

  /**
   * Helper to inspect the underlying storage instance.
   */
  public getStorage(): OfflineStorageQueue {
    return this.queue;
  }
}
