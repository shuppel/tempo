import { LocalDocument, LocalFirstStore, StorageAdapter, LocalFirstDBOptions, DocumentId } from './types'
import { createStorageAdapter } from './adapters'

export class LocalFirstDB<T> implements LocalFirstStore<T> {
  private name: string
  private storage: StorageAdapter
  private subscribers: ((docs: LocalDocument<T>[]) => void)[] = []
  private syncInterval: number
  private conflictResolver?: <T>(doc1: LocalDocument<T>, doc2: LocalDocument<T>) => LocalDocument<T>
  private syncTimeoutId?: NodeJS.Timeout

  constructor(options: LocalFirstDBOptions) {
    this.name = options.name
    this.storage = options.storage || createStorageAdapter('localStorage', options.name)
    this.syncInterval = options.syncInterval || 5000 // Default 5 seconds
    this.conflictResolver = options.conflictResolver

    // Start sync loop
    this.startSync()
  }

  private startSync() {
    this.syncTimeoutId = setInterval(() => {
      this.sync().catch(console.error)
    }, this.syncInterval)
  }

  private stopSync() {
    if (this.syncTimeoutId) {
      clearInterval(this.syncTimeoutId)
    }
  }

  private getKey(id: DocumentId): string {
    return `${this.name}-${id}`
  }

  private notify(docs: LocalDocument<T>[]) {
    this.subscribers.forEach(callback => callback(docs))
  }

  async get(id: DocumentId): Promise<LocalDocument<T> | null> {
    const key = this.getKey(id)
    const data = await this.storage.get(key)
    if (!data) return null
    return JSON.parse(data) as LocalDocument<T>
  }

  async getAll(): Promise<LocalDocument<T>[]> {
    const keys = await this.storage.keys()
    const docs = await Promise.all(
      keys
        .filter(key => key.startsWith(this.name))
        .map(async key => {
          const data = await this.storage.get(key)
          return data ? JSON.parse(data) as LocalDocument<T> : null
        })
    )
    return docs.filter((doc): doc is LocalDocument<T> => doc !== null)
  }

  async put(id: DocumentId, data: T): Promise<LocalDocument<T>> {
    const existing = await this.get(id)
    const now = new Date().toISOString()

    const newDoc: LocalDocument<T> = {
      id,
      data,
      lastModified: now,
      version: existing ? existing.version + 1 : 1
    }

    if (existing && this.hasConflict(existing, newDoc)) {
      if (this.conflictResolver) {
        const resolved = this.conflictResolver(existing, newDoc)
        await this.storage.set(this.getKey(id), JSON.stringify(resolved))
        this.notify([resolved])
        return resolved
      } else {
        // Store conflict
        newDoc.conflicts = [
          ...(existing.conflicts || []),
          {
            data: existing.data,
            lastModified: existing.lastModified,
            version: existing.version
          }
        ]
      }
    }

    await this.storage.set(this.getKey(id), JSON.stringify(newDoc))
    this.notify([newDoc])
    return newDoc
  }

  async delete(id: DocumentId): Promise<void> {
    const doc = await this.get(id)
    if (doc) {
      const deletedDoc: LocalDocument<T> = {
        ...doc,
        deleted: true,
        lastModified: new Date().toISOString(),
        version: doc.version + 1
      }
      await this.storage.set(this.getKey(id), JSON.stringify(deletedDoc))
      this.notify([deletedDoc])
    }
  }

  async sync(): Promise<void> {
    // In this basic implementation, we're just notifying subscribers of all docs
    // In a real implementation, this would sync with a remote server or peer
    const docs = await this.getAll()
    this.notify(docs)
  }

  subscribe(callback: (docs: LocalDocument<T>[]) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private hasConflict(doc1: LocalDocument<T>, doc2: LocalDocument<T>): boolean {
    return doc1.lastModified > doc2.lastModified && doc1.version !== doc2.version
  }

  destroy() {
    this.stopSync()
    this.subscribers = []
  }
} 