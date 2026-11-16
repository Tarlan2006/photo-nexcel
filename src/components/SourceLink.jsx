export default function SourceLink({ source, lang }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="font-semibold text-emerald-accent underline">
      {source.label[lang]}
    </a>
  )
}
