import React, { useState, useEffect } from 'react'
import './TimeExtractor.css'

const TimeExtractor = () => {
  const [inputText, setInputText] = useState('')
  const [extractedTimes, setExtractedTimes] = useState([])
  const [totalHours, setTotalHours] = useState(0)
  const [copySuccess, setCopySuccess] = useState(false)

  // 提取时间并计算总和
  useEffect(() => {
    if (!inputText.trim()) {
      setExtractedTimes([])
      setTotalHours(0)
      return
    }

    // 正则表达式匹配时间格式
    const timeRegex = /(\d+(?:\.\d+)?)\s*小时/g
    const matches = []
    let match
    let total = 0

    // 提取所有匹配的时间
    while ((match = timeRegex.exec(inputText)) !== null) {
      const hours = parseFloat(match[1])
      matches.push({
        text: match[0],
        hours: hours,
        index: match.index
      })
      total += hours
    }

    setExtractedTimes(matches)
    setTotalHours(total)
  }, [inputText])

  // 复制总小时数
  const handleCopyTotal = async () => {
    try {
      await navigator.clipboard.writeText(totalHours.toString())
      setCopySuccess(true)
      
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    } catch (err) {
      console.error('复制失败:', err)
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = totalHours.toString()
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

  // 复制详细结果
  const handleCopyDetails = async () => {
    const details = extractedTimes.map(item => item.text).join(', ')
    try {
      await navigator.clipboard.writeText(details)
      setCopySuccess(true)
      
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    } catch (err) {
      console.error('复制失败:', err)
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = details
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
    setExtractedTimes([])
    setTotalHours(0)
  }

  // 格式化小时数显示
  const formatHours = (hours) => {
    if (Number.isInteger(hours)) {
      return `${hours}小时`
    } else {
      return `${hours}小时`
    }
  }

  return (
    <div className="time-extractor">
      <h2>时间提取计算器</h2>
      
      <div className="input-section">
        <label htmlFor="text-input">输入包含时间的文本：</label>
        <textarea
          id="text-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="请输入包含时间的文本，例如：&#10;今天工作了3小时，明天计划2.5小时&#10;或者：上午1.5小时，下午2小时，晚上1小时"
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

      <div className="total-section">
        <h3>总计：</h3>
        <div className="total-display">
          <span className="total-label">总小时数：</span>
          <span className="total-value">{formatHours(totalHours)}</span>
        </div>
        
        <div className="total-controls">
          <button
            className="copy-total-btn"
            onClick={handleCopyTotal}
            disabled={totalHours === 0}
          >
            {copySuccess ? '复制成功！' : '复制总小时数'}
          </button>
          
          {extractedTimes.length > 0 && (
            <button
              className="copy-details-btn"
              onClick={handleCopyDetails}
            >
              复制详细结果
            </button>
          )}
        </div>
      </div>

      <div className="extraction-section">
        <h3>提取结果：</h3>
        
        {extractedTimes.length > 0 ? (
          <div className="extracted-list">
            <div className="list-header">
              <span>序号</span>
              <span>时间文本</span>
              <span>小时数</span>
            </div>
            {extractedTimes.map((item, index) => (
              <div key={index} className="list-item">
                <span className="item-index">{index + 1}</span>
                <span className="item-text">{item.text}</span>
                <span className="item-hours">{item.hours}小时</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">
            {inputText.trim() ? '未找到时间格式，请检查输入' : '输入内容后将在此显示提取结果'}
          </div>
        )}
      </div>

      <div className="usage-tips">
        <h4>使用说明：</h4>
        <ul>
          <li>支持格式：3小时、2.5小时、1.25小时等</li>
          <li>自动识别并提取所有时间信息</li>
          <li>实时计算总小时数</li>
          <li>支持复制总小时数或详细结果</li>
          <li>支持小数时间（如2.5小时）</li>
        </ul>
        
        <h4>示例输入：</h4>
        <div className="examples">
          <div className="example-item">
            <strong>输入：</strong>今天工作了3小时，明天计划2.5小时
          </div>
          <div className="example-item">
            <strong>提取：</strong>3小时, 2.5小时
          </div>
          <div className="example-item">
            <strong>总计：</strong>5.5小时
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimeExtractor
