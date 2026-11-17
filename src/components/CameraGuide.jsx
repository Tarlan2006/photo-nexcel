import { photoHeadLayout } from '../lib/crop'

export default function CameraGuide({ size, preset, mode }) {
  const { width, height } = size
  const center = width / 2
  const ratio = preset ? preset.width / preset.height : 3
  const frameHeight = Math.min(height * 0.84, width * (preset ? 0.84 : 0.86) / ratio)
  const frameWidth = frameHeight * ratio
  const x = (width - frameWidth) / 2
  const y = (height - frameHeight) / 2
  const end = y + frameHeight
  const layout = preset && photoHeadLayout(preset, frameHeight)

  let head
  if (layout) {
    const top = y + layout.headTop
    const h = layout.headHeight
    const half = h * 0.33
    const chin = top + h
    const neck = chin + (end - chin) * 0.35
    const shoulder = end - (end - chin) * 0.45
    head = (
      <>
        <path data-camera-silhouette="" vectorEffect="non-scaling-stroke"
          d={`M ${center} ${top}
              C ${center - half * 0.74} ${top}, ${center - half} ${top + h * 0.21}, ${center - half} ${top + h * 0.43}
              Q ${center - half} ${top + h * 0.73}, ${center - half * 0.58} ${top + h * 0.88}
              Q ${center} ${chin + h * 0.12}, ${center + half * 0.58} ${top + h * 0.88}
              Q ${center + half} ${top + h * 0.73}, ${center + half} ${top + h * 0.43}
              C ${center + half} ${top + h * 0.21}, ${center + half * 0.74} ${top}, ${center} ${top} Z
              M ${center - half * 0.58} ${top + h * 0.88}
              Q ${center - half * 0.5} ${neck}, ${center - half * 0.9} ${shoulder}
              Q ${x + frameWidth * 0.13} ${shoulder}, ${x + frameWidth * 0.07} ${end}
              M ${center + half * 0.58} ${top + h * 0.88}
              Q ${center + half * 0.5} ${neck}, ${center + half * 0.9} ${shoulder}
              Q ${x + frameWidth * 0.87} ${shoulder}, ${x + frameWidth * 0.93} ${end}`} />
        <path data-camera-eye-line="" vectorEffect="non-scaling-stroke" stroke="#83f4bd" strokeDasharray="4 5"
          d={`M ${center - half * 0.94} ${top + h * 0.46} h ${half * 1.88}`} />
      </>
    )
  }
  return (
    <svg aria-hidden="true" data-camera-guide={mode} viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_#000]"
      fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect data-camera-frame="" x={x} y={y} width={frameWidth} height={frameHeight}
        rx={frameHeight * 0.04} strokeDasharray={preset ? '5 5' : undefined} vectorEffect="non-scaling-stroke" />
      {head}
    </svg>
  )
}
