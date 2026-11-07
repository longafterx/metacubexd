// 浏览器等待覆盖 Hub 最大维护时限；真正的上游超时仍由 Go 配置控制。
export const MAINTENANCE_OPTIONS = { timeout: 610_000, retry: 0 } as const

export function controllerErrorKey(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 401) return 'hub.control.session'
  if (status === 403) return 'hub.control.forbidden'
  if (status === 404 || status === 405) return 'hub.control.unsupported'
  if (status === 400 || status === 422) return 'hub.control.invalid'
  if (status === 429) return 'hub.control.rateLimit'
  // 网络中断时操作可能已经执行，不能提示用户盲目重复重启或配置加载。
  return 'hub.control.unconfirmed'
}
