import bridge from '@vkontakte/vk-bridge'

export async function openExternalUrl(url: string): Promise<boolean> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(target.protocol)) return false

  const miniApp = /^\/app(\d+)/i.exec(target.pathname)
  try {
    if (
      bridge.isEmbedded() &&
      miniApp &&
      (await bridge.supportsAsync('VKWebAppOpenApp'))
    ) {
      await bridge.send('VKWebAppOpenApp', { app_id: Number(miniApp[1]) })
      return true
    }
  } catch {
    // Unsupported or rejected Bridge calls use the browser fallback.
  }
  // VK Bridge 3 exposes OpenApp for Mini Apps but has no generic OpenURL
  // command; target=_blank is the documented browser/WebView fallback.
  return window.open(target.href, '_blank', 'noopener,noreferrer') !== null
}
