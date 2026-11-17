import { createEditorEngine, drawScaled, makeCanvas, segmentInputLimit } from './engine.js'

function workerEndpoint() {
  const worker = new Worker(new URL('./editor-worker.js', import.meta.url))
  const jobs = new Map()
  let counter = 0
  let closed = false

  const close = (error = new Error('EDITOR_CLOSED')) => {
    if (closed) return
    closed = true
    worker.terminate()
    for (const { reject } of jobs.values()) reject(error)
    jobs.clear()
  }

  worker.onmessage = ({ data: { id, value, error } }) => {
    const job = jobs.get(id)
    jobs.delete(id)
    if (!job) {
      if (value instanceof ImageBitmap) value.close()
      else value?.bitmap?.close()
    } else if (error) {
      job.reject(new Error(error))
    } else {
      job.resolve(value)
    }
  }
  worker.onerror = () => close(new Error('EDITOR_WORKER'))
  worker.onmessageerror = () => close(new Error('EDITOR_WORKER'))

  return {
    close,
    request(action, args, transfer = []) {
      if (closed) return Promise.reject(new Error('EDITOR_CLOSED'))
      return new Promise((resolve, reject) => {
        const id = ++counter
        jobs.set(id, { resolve, reject })
        try {
          worker.postMessage({ id, action, args }, transfer)
        } catch (error) {
          jobs.delete(id)
          reject(error)
        }
      })
    },
  }
}

async function mainSegmentation(bitmap) {
  const { segmentPortrait } = await import('./segmenter.js')
  return segmentPortrait(drawScaled(bitmap, segmentInputLimit), makeCanvas)
}

export function createEditorSession(bitmap) {
  let endpoint
  let local
  let disposed = false
  let segmentPromise

  const ready = (async () => {
    if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      let clone
      try {
        endpoint = workerEndpoint()
        clone = await createImageBitmap(bitmap)
        if (disposed) throw new Error('EDITOR_CLOSED')
        await endpoint.request('init', { bitmap: clone }, [clone])
        return
      } catch {
        clone?.close()
        endpoint?.close()
        endpoint = null
      }
    }
    if (!disposed) local = createEditorEngine(bitmap)
  })()

  async function request(action, args, transfer) {
    await ready
    if (disposed) throw new Error('EDITOR_CLOSED')
    return endpoint ? endpoint.request(action, args, transfer) : local[action](args)
  }

  return {
    render: args => request('render', args),
    exposure: () => request('exposure'),
    segment() {
      segmentPromise ??= (async () => {
        await ready
        if (disposed) throw new Error('EDITOR_CLOSED')
        if (endpoint) {
          try {
            return await request('segment')
          } catch (error) {
            if (error.message !== 'NO_WEBGL') throw error
          }
        }
        return request('setSegmentation', await mainSegmentation(bitmap))
      })().catch((error) => {
        segmentPromise = null
        throw error
      })
      return segmentPromise
    },
    close() {
      disposed = true
      endpoint?.close()
      local?.close()
    },
  }
}
