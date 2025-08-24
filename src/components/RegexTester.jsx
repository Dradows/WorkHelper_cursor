import React, { useState, useEffect } from 'react'
import './RegexTester.css'

const RegexTester = () => {
  const [regexPattern, setRegexPattern] = useState('')
  const [testString, setTestString] = useState('')
  const [flags, setFlags] = useState('g')
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(true)

  // 测试正则表达式
  useEffect(() => {
    if (!regexPattern.trim() || !testString.trim()) {
      setMatches([])
      setError('')
      setIsValid(true)
      return
    }

    try {
      // 验证正则表达式是否有效
      new RegExp(regexPattern, flags)
      setIsValid(true)
      setError('')

      // 执行匹配
      const regex = new RegExp(regexPattern, flags)
      const results = []
      let match

      if (flags.includes('g')) {
        // 全局匹配
        while ((match = regex.exec(testString)) !== null) {
          results.push({
            fullMatch: match[0],
            groups: match.slice(1),
            index: match.index,
            input: match.input
        })
        }
      } else {
        // 非全局匹配
        match = regex.exec(testString)
        if (match) {
          results.push({
            fullMatch: match[0],
            groups: match.slice(1),
            index: match.index,
            input: match.input
          })
        }
      }

      setMatches(results)
    } catch (err) {
      setIsValid(false)
      setError(`正则表达式错误: ${err.message}`)
      setMatches([])
    }
  }, [regexPattern, testString, flags])

  // 复制匹配结果
  const handleCopyMatches = async () => {
    if (matches.length === 0) return

    const text = matches.map(match => match.fullMatch).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showNotification('匹配结果已复制到剪贴板！')
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showNotification('匹配结果已复制到剪贴板！')
    }
  }

  // 复制正则表达式
  const handleCopyRegex = async () => {
    if (!regexPattern.trim()) return

    const fullRegex = `/${regexPattern}/${flags}`
    try {
      await navigator.clipboard.writeText(fullRegex)
      showNotification('正则表达式已复制到剪贴板！')
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = fullRegex
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showNotification('正则表达式已复制到剪贴板！')
    }
  }

  // 显示通知
  const showNotification = (message) => {
    const notification = document.createElement('div')
    notification.textContent = message
    notification.className = 'notification'
    document.body.appendChild(notification)

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  }

  // 清空输入
  const handleClear = () => {
    setRegexPattern('')
    setTestString('')
    setFlags('g')
    setMatches([])
    setError('')
    setIsValid(true)
  }

  // 高亮匹配的文本
  const highlightMatches = (text, pattern) => {
    if (!pattern.trim()) return text

    try {
      const regex = new RegExp(`(${pattern})`, flags)
      return text.replace(regex, '<mark class="highlight">$1</mark>')
    } catch {
      return text
    }
  }

  return (
    <div className="regex-tester">
      <h2>正则表达式测试器</h2>
      
      <div className="input-section">
        <div className="regex-input-group">
          <label htmlFor="regex-pattern">正则表达式：</label>
          <div className="regex-input-container">
            <span className="regex-delimiter">/</span>
            <input
              id="regex-pattern"
              type="text"
              value={regexPattern}
              onChange={(e) => setRegexPattern(e.target.value)}
              placeholder="输入正则表达式，如：\d+"
              className={!isValid ? 'error' : ''}
            />
            <span className="regex-delimiter">/</span>
            <input
              id="regex-flags"
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="标志"
              className="flags-input"
              maxLength={10}
            />
          </div>
          {!isValid && <div className="error-message">{error}</div>}
        </div>

        <div className="string-input-group">
          <label htmlFor="test-string">测试字符串：</label>
          <textarea
            id="test-string"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="输入要测试的字符串..."
            rows={6}
          />
        </div>

        <div className="input-controls">
          <button 
            className="clear-btn"
            onClick={handleClear}
            disabled={!regexPattern.trim() && !testString.trim()}
          >
            清空输入
          </button>
        </div>
      </div>

      <div className="results-section">
        <h3>匹配结果：</h3>
        
        {matches.length > 0 ? (
          <div className="results-container">
            <div className="results-header">
              <span>找到 {matches.length} 个匹配</span>
              <div className="results-actions">
                <button
                  className="copy-matches-btn"
                  onClick={handleCopyMatches}
                >
                  复制匹配结果
                </button>
                <button
                  className="copy-regex-btn"
                  onClick={handleCopyRegex}
                >
                  复制正则表达式
                </button>
              </div>
            </div>
            
            <div className="matches-list">
              {matches.map((match, index) => (
                <div key={index} className="match-item">
                  <div className="match-header">
                    <span className="match-index">#{index + 1}</span>
                    <span className="match-position">位置: {match.index}</span>
                  </div>
                  <div className="match-content">
                    <strong>完整匹配:</strong> <span className="match-text">{match.fullMatch}</span>
                  </div>
                  {match.groups.length > 0 && (
                    <div className="match-groups">
                      <strong>捕获组:</strong>
                      {match.groups.map((group, groupIndex) => (
                        <span key={groupIndex} className="group-item">
                          {groupIndex + 1}: {group || '(空)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="highlighted-text">
              <h4>高亮显示：</h4>
              <div 
                className="highlighted-content"
                dangerouslySetInnerHTML={{ 
                  __html: highlightMatches(testString, regexPattern) 
                }}
              />
            </div>
          </div>
        ) : (
          <div className="no-results">
            {regexPattern.trim() && testString.trim() && isValid 
              ? '未找到匹配项' 
              : '输入正则表达式和测试字符串后将在此显示匹配结果'
            }
          </div>
        )}
      </div>

      <div className="usage-tips">
        <h4>使用说明：</h4>
        <ul>
          <li>在正则表达式输入框中输入模式（不需要包含分隔符/）</li>
          <li>在标志输入框中输入标志（如：g, i, m, s, u, y）</li>
          <li>在测试字符串中输入要匹配的文本</li>
          <li>实时查看匹配结果和捕获组</li>
          <li>支持复制匹配结果和正则表达式</li>
        </ul>
        
        <h4>常用正则表达式示例：</h4>
        <div className="examples">
          <div className="example-item">
            <strong>邮箱:</strong> <code>{'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'}</code>
          </div>
          <div className="example-item">
            <strong>手机号:</strong> <code>1[3-9]\d{9}</code>
          </div>
          <div className="example-item">
            <strong>身份证:</strong> <code>\d{17}[\dXx]</code>
          </div>
          <div className="example-item">
            <strong>时间格式:</strong> <code>\d{1,2}小时</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegexTester
