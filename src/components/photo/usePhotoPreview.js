import { useEffect, useState } from 'react'

export default function usePhotoPreview(source, settings, enabled) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!source || !enabled) return
    let active = true
    const cancelled = () => !active || source.closed
    const timer = setTimeout(() => {
      // Share the source queue with export. Obsolete slider values never start new work.
      const work = (source.work ?? Promise.resolve()).catch(() => {}).then(async () => {
        if (cancelled()) return null
        const { previewPhotoSettings } = await import('../../lib/photo-pipeline.js')
        if (cancelled()) return null
        return previewPhotoSettings(source, settings, cancelled)
      })
      source.work = work
      work.then(bitmap => {
        if (!bitmap) return
        if (cancelled()) bitmap.close()
        else setResult({ source, settings, bitmap })
      }).catch(error => {
        if (!cancelled()) setResult({ source, settings, error: error.message })
      })
    }, 160)
    return () => { active = false; clearTimeout(timer) }
  }, [source, settings, enabled])

  // Canvas has already drawn the new image before its predecessor is released.
  useEffect(() => () => result?.bitmap?.close(), [result])
  useEffect(() => { setResult(null) }, [source])

  const current = result?.source === source ? result : null
  return {
    bitmap: current?.bitmap,
    error: current?.settings === settings ? current.error : null,
    updating: Boolean(source && enabled && current?.settings !== settings),
  }
}
