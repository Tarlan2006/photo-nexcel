// One date per Vite invocation, shared by HTML, sitemap and the result notice.
export function buildDateFor(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function datedSitemap(template, date) {
  return template.replaceAll('__BUILD_DATE__', date)
}
