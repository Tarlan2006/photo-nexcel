import { photoHeadLayout } from '../lib/crop'

export function SignatureCameraGuide({ size: { width, height } }) {
  const side = Math.min(width, height) * 0.76
  return (
    <svg aria-hidden="true" data-camera-guide="signature" viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_#000]"
      fill="none" stroke="white" strokeWidth="2">
      <rect data-camera-frame="" x={(width - side) / 2} y={(height - side) / 2}
        width={side} height={side} rx={side * 0.025} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function CameraGuide({ size, preset, mode }) {
  const { width, height } = size
  const center = width / 2
  const ratio = preset.width / preset.height
  const frameHeight = Math.min(height * 0.84, width * 0.84 / ratio)
  const frameWidth = frameHeight * ratio
  const y = (height - frameHeight) / 2
  const { headTop, headHeight: h } = photoHeadLayout(preset, frameHeight)
  const top = y + headTop
  const half = h * 0.34
  const chin = top + h
  const neck = chin + h * 0.06
  const shoulder = Math.min(height * 0.94, chin + h * 0.18)
  const shoulderHalf = Math.min(width * 0.44, Math.max(frameWidth * 0.6, half * 1.95))
  // One continuous head-and-shoulders outline; its bottom closes outside the video.
  const silhouette = `M ${center} ${top}
    C ${center - half * 0.74} ${top}, ${center - half} ${top + h * 0.2}, ${center - half} ${top + h * 0.43}
    C ${center - half} ${top + h * 0.68}, ${center - half * 0.78} ${top + h * 0.8}, ${center - half * 0.62} ${top + h * 0.86}
    Q ${center - half * 0.56} ${chin}, ${center - half * 0.58} ${neck}
    C ${center - half * 0.62} ${neck + h * 0.1}, ${center - shoulderHalf} ${shoulder - h * 0.06}, ${center - shoulderHalf} ${shoulder + h * 0.12}
    L ${center - shoulderHalf} ${height + 4}
    L ${center + shoulderHalf} ${height + 4}
    L ${center + shoulderHalf} ${shoulder + h * 0.12}
    C ${center + shoulderHalf} ${shoulder - h * 0.06}, ${center + half * 0.62} ${neck + h * 0.1}, ${center + half * 0.58} ${neck}
    Q ${center + half * 0.56} ${chin}, ${center + half * 0.62} ${top + h * 0.86}
    C ${center + half * 0.78} ${top + h * 0.8}, ${center + half} ${top + h * 0.68}, ${center + half} ${top + h * 0.43}
    C ${center + half} ${top + h * 0.2}, ${center + half * 0.74} ${top}, ${center} ${top} Z`
  // The mask and outline share the same viewBox so they also align in letterboxed video.
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="white" fill-rule="evenodd" d="M 0 0 H ${width} V ${height} H 0 Z ${silhouette}"/></svg>`
  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(mask)}")`

  return (
    <div aria-hidden="true" data-camera-guide={mode} className="pointer-events-none absolute inset-0">
      <div data-camera-outside="" className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
        style={{ maskImage, WebkitMaskImage: maskImage, maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
      <svg viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_#000]"
        fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path data-camera-silhouette="" d={silhouette} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
