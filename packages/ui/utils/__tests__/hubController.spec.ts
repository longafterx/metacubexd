import { describe, expect, it } from 'vitest'
import { hubControllerURL, splitHubControllerURL } from '../hubController'

describe('controller 主机与端口表单', () => {
  it('自动生成 HTTP 地址，支持 IPv4、IPv6 和已有主机名', () => {
    expect(hubControllerURL('127.0.0.1', 9090)).toBe('http://127.0.0.1:9090')
    expect(hubControllerURL(' 100.111.37.112 ', '9090')).toBe(
      'http://100.111.37.112:9090',
    )
    expect(hubControllerURL('::1', '9090')).toBe('http://[::1]:9090')
    expect(hubControllerURL('[::1]', '9090')).toBe('http://[::1]:9090')
    expect(hubControllerURL('controller.local', '9090')).toBe(
      'http://controller.local:9090',
    )
  })
  it.each([
    'http://127.0.0.1',
    'user@127.0.0.1',
    '127.0.0.1/path',
    '127.0.0.1:9090',
    '127.0.0.1?token=x',
    '',
    'bad host',
  ])('拒绝混入协议、凭据、路径或端口：%s', (host) => {
    expect(hubControllerURL(host, '9090')).toBe('')
  })
  it.each(['', '0', '65536', '1e3', '-1', '1.5', '9090/path'])(
    '拒绝无效端口：%s',
    (port) => {
      expect(hubControllerURL('127.0.0.1', port)).toBe('')
    },
  )
  it('编辑拆分地址并保留已有 HTTPS，规范化时不丢失默认端口', () => {
    expect(splitHubControllerURL('https://controller.local')).toEqual({
      host: 'controller.local',
      port: '443',
      protocol: 'https:',
    })
    const address = splitHubControllerURL('https://[fd00::1]:9443/')
    expect(address.host).toBe('fd00::1')
    expect(hubControllerURL(address.host, address.port, address.protocol)).toBe(
      'https://[fd00::1]:9443',
    )
    expect(splitHubControllerURL('http://127.0.0.1').port).toBe('80')
    expect(() =>
      splitHubControllerURL('http://user:password@127.0.0.1'),
    ).toThrow()
  })
})
