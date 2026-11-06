import { describe, expect, it } from 'vitest'
import { filterHubUsage, hubUsageRows } from '../hubAnalytics'

describe('服务端用量展示', () => {
  const rows = hubUsageRows([
    { value: 'chat.example', upload_bytes: 100, download_bytes: 500 },
    { value: 'Build.example', upload_bytes: 400, download_bytes: 20 },
    { value: '', upload_bytes: 0, download_bytes: 0 },
  ])
  it('保留窗口归因量、未知标签和零值，不伪造连接次数', () => {
    expect(rows[0]).toEqual({
      label: 'chat.example',
      upload: 100,
      download: 500,
      total: 600,
    })
    expect(rows[2]).toEqual({ label: '', upload: 0, download: 0, total: 0 })
    expect(rows.every((row) => !('count' in row))).toBe(true)
  })
  it('按上传、下载或总量排序，同时保留原始排行供其他视图使用', () => {
    const before = structuredClone(rows)
    expect(filterHubUsage(rows, '', 'upload', true)[0]?.label).toBe(
      'Build.example',
    )
    expect(filterHubUsage(rows, '', 'download', true)[0]?.label).toBe(
      'chat.example',
    )
    expect(filterHubUsage(rows, '', 'total', false)[0]?.label).toBe('')
    expect(rows).toEqual(before)
  })
  it('搜索忽略大小写和首尾空格，未匹配时返回空列表', () => {
    expect(
      filterHubUsage(rows, '  BUILD ', 'total', true).map((row) => row.label),
    ).toEqual(['Build.example'])
    expect(filterHubUsage(rows, 'missing', 'label', false)).toEqual([])
  })
})
