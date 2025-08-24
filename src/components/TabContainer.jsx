import React, { useState } from 'react'
import QRCodeGenerator from './QRCodeGenerator'
import TextFormatter from './TextFormatter'
import TimeExtractor from './TimeExtractor'
import RegexTester from './RegexTester'
import './TabContainer.css'

const TabContainer = () => {
  const [activeTab, setActiveTab] = useState('qr') // 'qr', 'text', 'time', 或 'regex'

  return (
    <div className="tab-container">
      <div className="tab-header">
        <button
          className={`tab-button ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <span className="tab-icon">📱</span>
          二维码生成器
        </button>
        <button
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <span className="tab-icon">📝</span>
          文本格式化器
        </button>
        <button
          className={`tab-button ${activeTab === 'time' ? 'active' : ''}`}
          onClick={() => setActiveTab('time')}
        >
          <span className="tab-icon">⏰</span>
          时间提取器
        </button>
        <button
          className={`tab-button ${activeTab === 'regex' ? 'active' : ''}`}
          onClick={() => setActiveTab('regex')}
        >
          <span className="tab-icon">🔍</span>
          正则测试器
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'qr' && <QRCodeGenerator />}
        {activeTab === 'text' && <TextFormatter />}
        {activeTab === 'time' && <TimeExtractor />}
        {activeTab === 'regex' && <RegexTester />}
      </div>
    </div>
  )
}

export default TabContainer
