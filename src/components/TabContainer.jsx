import React, { useState, useEffect } from 'react'
import Home from './Home';
import QRCodeGenerator from './QRCodeGenerator';
import TextFormatter from './TextFormatter';
import TimeExtractor from './TimeExtractor';
import RegexTester from './RegexTester';
import './TabContainer.css';
import ExcelImporter from './ExcelImporter';

const TabContainer = () => {
  // 根据hash初始化tab
  const getTabFromHash = () => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['home', 'text', 'time', 'regex', 'qr', 'excel'];
    return validTabs.includes(hash) ? hash : 'home';
  };
  const [activeTab, setActiveTab] = useState(getTabFromHash());

  // 切换tab时同步hash
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // 监听hash变化
  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromHash();
      setActiveTab(tab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="tab-container">
      <div className="tab-header">
        <button
          className={`tab-button ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => handleTabChange('home')}
        >
          <span className="tab-icon">🏠</span>
          首页
        </button>
        <button
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => handleTabChange('text')}
        >
          <span className="tab-icon">📝</span>
          文本格式化器
        </button>
        <button
          className={`tab-button ${activeTab === 'time' ? 'active' : ''}`}
          onClick={() => handleTabChange('time')}
        >
          <span className="tab-icon">⏰</span>
          时间提取器
        </button>
        <button
          className={`tab-button ${activeTab === 'regex' ? 'active' : ''}`}
          onClick={() => handleTabChange('regex')}
        >
          <span className="tab-icon">🔍</span>
          正则测试器
        </button>
        <button
          className={`tab-button ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => handleTabChange('qr')}
        >
          <span className="tab-icon">📱</span>
          二维码生成器
        </button>
        <button
          className={`tab-button ${activeTab === 'excel' ? 'active' : ''}`}
          onClick={() => handleTabChange('excel')}
        >
          <span className="tab-icon">📥</span>
          导入 Excel 并生成 SQL
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'home' && <Home setActiveTab={handleTabChange} />}
        {activeTab === 'text' && <TextFormatter />}
        {activeTab === 'time' && <TimeExtractor />}
        {activeTab === 'regex' && <RegexTester />}
        {activeTab === 'qr' && <QRCodeGenerator />}
        {activeTab === 'excel' && <ExcelImporter />}
      </div>
    </div>
  )
}

export default TabContainer
