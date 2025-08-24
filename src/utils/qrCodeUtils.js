import QRCode from 'qrcode'

/**
 * 生成二维码
 * @param {string} text - 要转换为二维码的文本
 * @param {number} size - 二维码尺寸
 * @returns {Promise<string>} 二维码的Data URL
 */
export const generateQRCode = async (text, size = 300) => {
  try {
    const options = {
      width: size,
      height: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    }

    const dataURL = await QRCode.toDataURL(text, options)
    return dataURL
  } catch (error) {
    console.error('生成二维码失败:', error)
    throw new Error('生成二维码失败')
  }
}

/**
 * 生成二维码为Canvas元素
 * @param {string} text - 要转换为二维码的文本
 * @param {number} size - 二维码尺寸
 * @returns {Promise<HTMLCanvasElement>} 包含二维码的Canvas元素
 */
export const generateQRCodeCanvas = async (text, size = 300) => {
  try {
    const options = {
      width: size,
      height: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    }

    const canvas = await QRCode.toCanvas(text, options)
    return canvas
  } catch (error) {
    console.error('生成二维码Canvas失败:', error)
    throw new Error('生成二维码Canvas失败')
  }
}

/**
 * 生成二维码为SVG字符串
 * @param {string} text - 要转换为二维码的文本
 * @param {number} size - 二维码尺寸
 * @returns {Promise<string>} 二维码的SVG字符串
 */
export const generateQRCodeSVG = async (text, size = 300) => {
  try {
    const options = {
      width: size,
      height: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    }

    const svg = await QRCode.toString(text, options)
    return svg
  } catch (error) {
    console.error('生成二维码SVG失败:', error)
    throw new Error('生成二维码SVG失败')
  }
}
