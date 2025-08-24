import React, { useState, useEffect, useCallback } from 'react'
import { generateQRCode } from '../utils/qrCodeUtils'
import './QRCodeGenerator.css'

const QRCodeGenerator = () => {
  const [inputText, setInputText] = useState('')
  const [qrCodeData, setQrCodeData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [size, setSize] = useState(300)
  const [debouncedText, setDebouncedText] = useState('')

  // 防抖处理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(inputText)
    }, 300)

    return () => clearTimeout(timer)
  }, [inputText])

  // 生成二维码
  useEffect(() => {
    if (!debouncedText.trim()) {
      setQrCodeData('')
      setError('')
      return
    }

    const generateCode = async () => {
      setIsLoading(true)
      setError('')
      
      try {
        const qrData = await generateQRCode(debouncedText, size)
        setQrCodeData(qrData)
      } catch (err) {
        setError('生成二维码时出错，请重试')
        console.error('生成二维码错误:', err)
      } finally {
        setIsLoading(false)
      }
    }

    generateCode()
  }, [debouncedText, size])

  // 下载二维码
  const handleDownload = useCallback(() => {
    if (!qrCodeData) return

    try {
      const link = document.createElement('a')
      link.download = 'qrcode.png'
      link.href = qrCodeData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 显示成功提示
      showNotification('二维码下载成功！')
    } catch (err) {
      console.error('下载错误:', err)
      alert('下载失败，请重试')
    }
  }, [qrCodeData])

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

  return (
    <div className="container">
      <h1>实时二维码生成器</h1>
      
      <div className="input-section">
        <label htmlFor="text-input">输入文本或链接：</label>
        <textarea
          id="text-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="请输入要转换为二维码的文本、链接或内容..."
          rows={4}
        />
      </div>

      <div className="qr-section">
        <h3>生成的二维码：</h3>
        <div className="qr-code-container">
          {isLoading && (
            <div className="loading">
              <div className="spinner"></div>
              正在生成二维码...
            </div>
          )}
          
          {error && (
            <div className="error">{error}</div>
          )}
          
          {!isLoading && !error && !qrCodeData && (
            <div className="placeholder">输入内容后将在此显示二维码</div>
          )}
          
          {!isLoading && !error && qrCodeData && (
            <img src={qrCodeData} alt="生成的二维码" />
          )}
        </div>

        <div className="qr-controls">
          <button
            className="download-btn"
            onClick={handleDownload}
            disabled={!qrCodeData || isLoading}
          >
            下载二维码
          </button>
          
          <div className="size-controls">
            <label htmlFor="size-select">二维码大小：</label>
            <select
              id="size-select"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              <option value={200}>200x200</option>
              <option value={300}>300x300</option>
              <option value={400}>400x400</option>
              <option value={500}>500x500</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRCodeGenerator
