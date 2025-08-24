import React, { useState, useEffect } from 'react'
import './TextFormatter.css'

const TextFormatter = () => {
  const [inputText, setInputText] = useState('')
  const [formattedText, setFormattedText] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  // 格式化文本
  useEffect(() => {
    if (!inputText.trim()) {
      setFormattedText('')
      return
    }

    // 分割文本（支持换行、空格、逗号等分隔符）
    const items = inputText
      .split(/[\n\s,，;；]+/) // 支持换行、空格、逗号、分号等分隔符
      .map(item => item.trim())
      .filter(item => item.length > 0) // 过滤空项

    // 转换为带引号的格式
    const formatted = items.map(item => `'${item}'`).join(',')
    setFormattedText(formatted)
  }, [inputText])

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText)
      setCopySuccess(true)
      
      // 3秒后重置成功状态
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    } catch (err) {
      console.error('复制失败:', err)
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea')
      textArea.value = formattedText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      setCopySuccess(true)
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    }
  }

  // 清空输入
  const handleClear = () => {
    setInputText('')
    setFormattedText('')
  }

  return (
    <div className="text-formatter">
      <h2>文本格式化工具</h2>
      
      <div className="input-section">
        <label htmlFor="text-input">输入文本（支持换行、空格、逗号等分隔符）：</label>
        <textarea
          id="text-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="请输入要格式化的文本，例如：&#10;A&#10;B&#10;C&#10;或者：A B C&#10;或者：A,B,C"
          rows={6}
        />
        <div className="input-controls">
          <button 
            className="clear-btn"
            onClick={handleClear}
            disabled={!inputText.trim()}
          >
            清空输入
          </button>
        </div>
      </div>

      <div className="output-section">
        <h3>格式化结果：</h3>
        <div className="output-container">
          {formattedText ? (
            <div className="formatted-text">{formattedText}</div>
          ) : (
            <div className="placeholder">输入内容后将在此显示格式化结果</div>
          )}
        </div>
        
        <div className="output-controls">
          <button
            className="copy-btn"
            onClick={handleCopy}
            disabled={!formattedText}
          >
            {copySuccess ? '复制成功！' : '复制结果'}
          </button>
          
          {formattedText && (
            <div className="stats">
              <span>共 {formattedText.split(',').length} 项</span>
            </div>
          )}
        </div>
      </div>

      <div className="usage-tips">
        <h4>使用说明：</h4>
        <ul>
          <li>支持多种分隔符：换行、空格、逗号、分号等</li>
          <li>自动过滤空项和多余空格</li>
          <li>结果格式：'A','B','C'</li>
          <li>点击复制按钮可复制到剪贴板</li>
        </ul>
      </div>
    </div>
  )
}

export default TextFormatter
