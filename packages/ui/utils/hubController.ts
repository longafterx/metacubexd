export type HubControllerProtocol = 'http:' | 'https:'

/** 表单只接收主机和端口；新增默认 HTTP，编辑保留已有协议。 */
export function hubControllerURL(
  host: string,
  port: string | number,
  protocol: HubControllerProtocol = 'http:',
) {
  const input = host.trim()
  // number 输入框的 v-model 会自动转成数字，统一为文本后再做整数校验。
  const digits = String(port).trim()
  if (!input || /[\s/\\@?#%]/.test(input) || !/^\d+$/.test(digits)) return ''
  const number = Number(digits)
  if (number < 1 || number > 65535 || !['http:', 'https:'].includes(protocol))
    return ''
  const bare =
    input.startsWith('[') && input.endsWith(']') ? input.slice(1, -1) : input
  const authority = bare.includes(':') ? `[${bare}]` : bare
  try {
    const url = new URL(`${protocol}//${authority}:${number}`)
    return `${url.protocol}//${url.hostname}:${number}`
  } catch {
    return ''
  }
}

export function splitHubControllerURL(raw: string) {
  const url = new URL(raw)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid Controller address')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  return { host, port, protocol: url.protocol as HubControllerProtocol }
}
