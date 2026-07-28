import bridge from '@vkontakte/vk-bridge'

export async function openExternalUrl(url: string): Promise<void> {
  const miniApp = /^https:\/\/(?:vk\.ru|vk\.com)\/app(\d+)/i.exec(url)
  try {
    if (bridge.isEmbedded() && miniApp) {
      await bridge.send('VKWebAppOpenApp', { app_id: Number(miniApp[1]) })
      return
    }
  } catch {
    // Regular links and unsupported clients use the safe browser fallback.
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
