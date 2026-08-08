import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@vkontakte/vkui'

import { getVkAvatar } from '../api/auth'

interface VkAvatarProps {
  vkUrl: string
  preferredSrc?: string | null
  initials: string
  size: 44 | 48
  className?: string
}

function isVkUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'vk.ru' || hostname.endsWith('.vk.ru')
  } catch {
    return false
  }
}

export function VkAvatar({
  vkUrl,
  preferredSrc,
  initials,
  size,
  className,
}: VkAvatarProps) {
  const canLoad = !preferredSrc && isVkUrl(vkUrl)
  const avatar = useQuery({
    queryKey: ['vk-avatar', vkUrl],
    queryFn: () => getVkAvatar(vkUrl),
    enabled: canLoad,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  return (
    <Avatar
      size={size}
      src={preferredSrc || avatar.data?.photo_url || undefined}
      initials={initials}
      className={className}
    />
  )
}
